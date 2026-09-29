/**
 * `POST /api/envelopes/:id/charge-preview` over real HTTP
 * (PRD §10 rows 6-11, `docs/prompt.md` §7 criteria 6-11).
 *
 * This is the densest acceptance coverage in the repo and the place the fixed
 * five-stage validation order is actually proven. Order is asserted BY
 * CONSTRUCTION, not by reading the source: each ordering test sends a request
 * that violates two rules at once and pins which one is reported.
 *
 * Fixture emails are `@example.test` throughout — no real personal data
 * anywhere in the repository (PRD §5).
 */

import request from 'supertest';
import type { Express } from 'express';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { attachRaw } from './support/attach.js';

interface RecipientPayload {
  name?: unknown;
  email?: unknown;
  signature_count?: unknown;
}

const RINA = { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2 };
const BUDI = { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 };

/** Upload a document so there is a real envelope id to preview against. */
async function appWithEnvelope(): Promise<{ app: Express; envelopeId: string }> {
  const app = createApp();
  const created = await attachRaw(
    request(app).post('/api/envelopes'),
    Buffer.alloc(64, 0x41),
    { filepath: 'agreement-vendor-2026.pdf', contentType: 'application/pdf' },
  );

  expect(created.status).toBe(201);
  return { app, envelopeId: created.body.envelope_id as string };
}

function preview(app: Express, envelopeId: string, body: unknown): request.Test {
  return request(app).post(`/api/envelopes/${envelopeId}/charge-preview`).send(body as object);
}

/** N valid recipients with distinct emails and the given signature count each. */
function manyRecipients(count: number, signatures = 1): RecipientPayload[] {
  return Array.from({ length: count }, (_unused, index) => ({
    name: `Signer ${index + 1}`,
    email: `signer-${index + 1}@example.test`,
    signature_count: signatures,
  }));
}

describe('POST /api/envelopes/:id/charge-preview — the authoritative total', () => {
  it('Rina (2) + Budi (1) totals 3 signatures, "15000.00", 5 left', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, { recipients: [RINA, BUDI] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      recipient_count: 2,
      total_signatures: 3,
      price: { signature: '5000.00' },
      charges: { signature: '15000.00' },
      total_charge: '15000.00',
      quota: { signature: 8 },
      quota_remaining: { signature: 5 },
    });

    // Every monetary value is a decimal string on the wire, never a JSON number
    // (PRD §4 fact 1) — asserted on the raw text, since `body` would coerce.
    expect(response.text).toContain('"total_charge":"15000.00"');
    expect(response.text).not.toMatch(/"total_charge":\s*\d/);
  });

  it('is exact at the quota boundary: 8 of 8 is allowed and leaves 0', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 5 },
        { ...BUDI, signature_count: 3 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.total_signatures).toBe(8);
    expect(response.body.total_charge).toBe('40000.00');
    expect(response.body.quota_remaining).toEqual({ signature: 0 });
  });

  it('consumes no quota — Case 1 never changes it (LD-18)', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const body = { recipients: [RINA, BUDI] };

    const first = await preview(app, envelopeId, body);
    const second = await preview(app, envelopeId, body);

    expect(second.body).toEqual(first.body);
    expect(second.body.quota_remaining).toEqual({ signature: 5 });
  });
});

describe('POST /api/envelopes/:id/charge-preview — rejections', () => {
  it('refuses 9 signatures against a quota of 8', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 3 },
        { ...BUDI, signature_count: 3 },
        { name: 'Citra Dewi', email: 'citra.dewi@example.test', signature_count: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    // The message names the numbers, so the UI can show the reason (LD-17).
    expect(response.body.error.message).toBe('9 of 8 signatures - 1 over your quota');
  });

  it('refuses a trimmed, case-variant duplicate email and names the rows', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { name: 'Rina Halim', email: '  Rina.Halim@Example.test ', signature_count: 1 },
        { name: 'Rina Again', email: 'rina.halim@example.test', signature_count: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
    expect(response.body.error.details.recipient_indexes).toEqual([0, 1]);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 2.5],
    ['non-numeric text', 'abc'],
    ['null', null],
    ['missing', undefined],
    ['numeric string', '3'],
    ['above the maximum', 21],
  ])('refuses a signature_count that is %s, without ever clamping it', async (_label, value) => {
    const { app, envelopeId } = await appWithEnvelope();
    const recipient: RecipientPayload = { name: RINA.name, email: RINA.email };
    if (value !== undefined) recipient.signature_count = value;

    const response = await preview(app, envelopeId, { recipients: [recipient] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SIGNATURE_COUNT_INVALID');
    expect(response.body.error.details.recipient_index).toBe(0);
    // A clamped value would have produced a 200 with a charge attached.
    expect(response.body.total_charge).toBeUndefined();
  });

  it('refuses an empty name and an unparseable email', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const blankName = await preview(app, envelopeId, {
      recipients: [{ ...RINA, name: '   ' }],
    });
    expect(blankName.status).toBe(422);
    expect(blankName.body.error.code).toBe('RECIPIENT_INVALID');
    expect(blankName.body.error.details.recipient_index).toBe(0);

    const badEmail = await preview(app, envelopeId, {
      recipients: [RINA, { ...BUDI, email: 'budi.santoso@localhost' }],
    });
    expect(badEmail.status).toBe(422);
    expect(badEmail.body.error.code).toBe('RECIPIENT_INVALID');
    expect(badEmail.body.error.details.recipient_index).toBe(1);
  });

  it('refuses an empty recipient list and one of eleven', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const empty = await preview(app, envelopeId, { recipients: [] });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('RECIPIENT_COUNT_INVALID');

    const eleven = await preview(app, envelopeId, { recipients: manyRecipients(11) });
    expect(eleven.status).toBe(422);
    expect(eleven.body.error.code).toBe('RECIPIENT_COUNT_INVALID');

    // Ten is the ceiling, not a rejection — but ten signatures still exceed the
    // quota of eight, which is the NEXT stage and therefore the reported one.
    const ten = await preview(app, envelopeId, { recipients: manyRecipients(10) });
    expect(ten.status).toBe(422);
    expect(ten.body.error.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
  });

  it('returns 404 for an envelope that does not exist', async () => {
    const { app } = await appWithEnvelope();
    const response = await preview(app, 'env_999', { recipients: [RINA, BUDI] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'ENVELOPE_NOT_FOUND', message: 'Envelope not found' },
    });
  });
});

describe('POST /api/envelopes/:id/charge-preview — the strict key allow-list', () => {
  it.each([
    ['total_charge', { recipients: [RINA], total_charge: '1.00' }, 'total_charge'],
    ['quota', { recipients: [RINA], quota: { signature: 99 } }, 'quota'],
    ['price', { recipients: [RINA], price: { signature: '0.01' } }, 'price'],
    ['total_signatures', { recipients: [RINA], total_signatures: 0 }, 'total_signatures'],
  ])('refuses a client-supplied %s and names the offending key', async (_label, body, field) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, body);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe(field);
    // Nothing the client sent was read: no total came back at all.
    expect(response.body.total_charge).toBeUndefined();
  });

  it('refuses an unknown key inside a recipient and gives its path', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA, { ...BUDI, step: 1 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('recipients[1].step');
  });

  it('refuses a prototype-pollution key like any other unknown key', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await request(app)
      .post(`/api/envelopes/${envelopeId}/charge-preview`)
      .set('Content-Type', 'application/json')
      .send('{"recipients":[],"__proto__":{"polluted":true}}');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('answers malformed JSON in the standard envelope, not an HTML error page', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await request(app)
      .post(`/api/envelopes/${envelopeId}/charge-preview`)
      .set('Content-Type', 'application/json')
      .send('{"recipients": [');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.text).not.toContain('<html');
  });

  it('refuses a JSON body past the 64 KB ceiling', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, name: 'R'.repeat(70 * 1024) }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('body');
  });
});

describe('POST /api/envelopes/:id/charge-preview — the fixed validation order', () => {
  it('reports the payload shape before the missing envelope', async () => {
    const { app } = await appWithEnvelope();
    const response = await preview(app, 'env_999', {
      recipients: [RINA],
      total_charge: '1.00',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
  });

  it('reports the missing envelope before any recipient rule', async () => {
    const { app } = await appWithEnvelope();
    const response = await preview(app, 'env_999', {
      recipients: [
        { ...RINA, email: 'same@example.test' },
        { ...BUDI, email: 'SAME@example.test' },
      ],
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ENVELOPE_NOT_FOUND');
  });

  it('reports the recipient count before a per-recipient failure', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const eleven = manyRecipients(11);
    eleven[0] = { name: '', email: 'not-an-email', signature_count: 0 };

    const response = await preview(app, envelopeId, { recipients: eleven });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('RECIPIENT_COUNT_INVALID');
  });

  it('reports signature_count before name, and name before email', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const allThreeBad = await preview(app, envelopeId, {
      recipients: [{ name: '', email: 'nope', signature_count: 0 }],
    });
    expect(allThreeBad.body.error.code).toBe('SIGNATURE_COUNT_INVALID');

    const nameAndEmailBad = await preview(app, envelopeId, {
      recipients: [{ name: '', email: 'nope', signature_count: 1 }],
    });
    expect(nameAndEmailBad.body.error.code).toBe('RECIPIENT_INVALID');
    expect(nameAndEmailBad.body.error.message).toBe('Full name is required');
  });

  it('reports a per-recipient failure before a duplicate email', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 0 },
        { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('reports a duplicate email before the quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 5 },
        { name: 'Rina Halim', email: 'RINA.HALIM@example.test', signature_count: 5 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('refuses a body with no recipients array at all', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('RECIPIENT_COUNT_INVALID');
  });
});
