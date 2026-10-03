/**
 * `POST /api/envelopes/:id/charge-preview` over real HTTP
 * (PRD §10 rows 6-11, `docs/prompt.md` §7 criteria 6-11).
 *
 * This is the densest acceptance coverage in the repo and the place the fixed
 * validation order is actually proven — Case 1's five stages, and Case 2's
 * extension of them (`test_2_en.md` §B5, P1, P2 and P3). Order is asserted BY
 * CONSTRUCTION, not by reading the source: each ordering test sends a request
 * that violates two rules at once and pins which one is reported.
 *
 * Every Case-1 expectation below is still here and still exact. Where Case 2
 * widened a response body the fixture gained keys — `meterai` for P1,
 * `order_mode` and `steps` for P2, `field_count` for P3 — and NOT a changed
 * value. §B7.21 assesses Case-1 regressions, so a Case-1 figure moving would be
 * the bug, not the fix.
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
  meterai_count?: unknown;
  step?: unknown;
}

/** §B3's field, every property loosened so a hostile value can be sent as-is. */
interface FieldPayload {
  id?: unknown;
  kind?: unknown;
  recipient_email?: unknown;
  page?: unknown;
  x?: unknown;
  y?: unknown;
}

const RINA = { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2 };
const BUDI = { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 };
const CITRA = { name: 'Citra Dewi', email: 'citra.dewi@example.test', signature_count: 1 };

/**
 * One in-bounds box of each kind (§B2: `signature` is `x in [0,420]`,
 * `y in [0,500]`; `meterai` is `x in [0,520]`, `y in [0,476]`). The defaults are
 * §B4's own coordinates, so a test that cares about one axis overrides that axis
 * and nothing else.
 */
function sigField(id: string, email: string, x = 64, y = 224): FieldPayload {
  return { id, kind: 'signature', recipient_email: email, page: 1, x, y };
}

function metField(id: string, email: string, x = 360, y = 224): FieldPayload {
  return { id, kind: 'meterai', recipient_email: email, page: 1, x, y };
}

/** §B4's `fields` array, verbatim: Rina 2 signatures + 1 eMeterai, Budi 1. */
const B4_FIELDS: readonly FieldPayload[] = [
  { id: 'f1', kind: 'signature', recipient_email: 'rina.halim@example.test', page: 1, x: 64, y: 224 },
  { id: 'f2', kind: 'signature', recipient_email: 'rina.halim@example.test', page: 1, x: 64, y: 340 },
  { id: 'f3', kind: 'meterai', recipient_email: 'rina.halim@example.test', page: 1, x: 360, y: 224 },
  {
    id: 'f4',
    kind: 'signature',
    recipient_email: 'budi.santoso@example.test',
    page: 1,
    x: 64,
    y: 440,
  },
];

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
      // Case 2 §B4 widened the body again for P2. The request carries no
      // `order_mode`, so it means `parallel` — exactly what this Case-1 payload
      // always meant — and §A3.4 makes that one step holding everyone.
      order_mode: 'parallel',
      steps: [
        { step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] },
      ],
      recipient_count: 2,
      total_signatures: 3,
      // Case 2 §B4 widened the body. Neither recipient asks for a duty stamp,
      // so every Case-1 figure below is unchanged: the meterai line is 0 and
      // contributes nothing to the total.
      total_meterai: 0,
      // P3 widened the body a third time. This payload sends no `fields` key at
      // all — it is a Step-2 preview — so §B4's `field_count` is 0 and the field
      // rules never bind. The money below is still Case 1's, to the byte.
      field_count: 0,
      price: { signature: '5000.00', meterai: '10000.10' },
      charges: { signature: '15000.00', meterai: '0.00' },
      total_charge: '15000.00',
      quota: { signature: 8, meterai: 3 },
      quota_remaining: { signature: 5, meterai: 3 },
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
    expect(response.body.quota_remaining).toEqual({ signature: 0, meterai: 3 });
  });

  it('consumes no quota — Case 1 never changes it (LD-18)', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const body = { recipients: [RINA, BUDI] };

    const first = await preview(app, envelopeId, body);
    const second = await preview(app, envelopeId, body);

    expect(second.body).toEqual(first.body);
    expect(second.body.quota_remaining).toEqual({ signature: 5, meterai: 3 });
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
    // No `order_mode` means `parallel`, where `step` is not an accepted key
    // (§B7.9). The accepted recipient shape is a function of the mode, so this
    // payload is deliberately mode-less.
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

/**
 * E-meterai — `test_2_en.md` §A3 / §B1 / §B4, priority P1.
 *
 * Every figure below is checked against the brief's own arithmetic rather than
 * against whatever the implementation happens to produce: `"25000.10"` and
 * `"45000.30"` (§B7 rows 1-2) are the two totals a float implementation gets
 * wrong, which is the whole reason §B8.3 names them explicitly.
 */
describe('POST /api/envelopes/:id/charge-preview — e-meterai (§A3, P1)', () => {
  it('§B7.1 — Rina 2 sig/1 met + Budi 1 sig/0 met totals "25000.10", 5 and 2 left', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 1 },
        { ...BUDI, meterai_count: 0 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      // P2 widened the body; §B7.1 is a `parallel` row, so this is the single
      // group of §A3.4 and every P1 figure below is untouched.
      order_mode: 'parallel',
      steps: [
        { step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] },
      ],
      recipient_count: 2,
      total_signatures: 3,
      total_meterai: 1,
      // P3 widened the body again, and §A4.12 is why nothing else moved: this
      // payload places no boxes, so `field_count` is 0 while the bill stays
      // exactly the "25000.10" the counts alone produce.
      field_count: 0,
      price: { signature: '5000.00', meterai: '10000.10' },
      charges: { signature: '15000.00', meterai: '10000.10' },
      total_charge: '25000.10',
      quota: { signature: 8, meterai: 3 },
      quota_remaining: { signature: 5, meterai: 2 },
    });

    // The two priced lines are separate on the wire (§A3.7), and the combined
    // total is not a float that happens to round well — it is a decimal string.
    expect(response.text).toContain('"total_charge":"25000.10"');
    expect(response.text).not.toMatch(/"total_charge":\s*\d/);
  });

  it('§B7.2 — 3 meterai against a quota of 3 is ALLOWED and totals "45000.30"', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 2 },
        { ...BUDI, meterai_count: 1 },
      ],
    });

    // Exactly at the allowance is the boundary, never the failure.
    expect(response.status).toBe(200);
    expect(response.body.total_signatures).toBe(3);
    expect(response.body.total_meterai).toBe(3);
    expect(response.body.charges).toEqual({ signature: '15000.00', meterai: '30000.30' });
    expect(response.body.total_charge).toBe('45000.30');
    expect(response.body.quota_remaining).toEqual({ signature: 5, meterai: 0 });
  });

  it('§B7.3 — a fourth meterai is refused, and the message names eMeterai', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 2 },
        { ...BUDI, meterai_count: 1 },
        { ...CITRA, meterai_count: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_METERAI_QUOTA');
    expect(response.body.error.message).toBe('4 of 3 eMeterai - 1 over your eMeterai quota');

    // §A3.5: the two shortfalls must be distinguishable. The code differs, and
    // so does every word of the message — this one never says "signatures".
    expect(response.body.error.code).not.toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    expect(response.body.error.message).not.toContain('signature');
    // Four signatures are inside the signature allowance, so nothing but the
    // meterai allowance was breached.
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.4 — 3 meterai on a 2-signature row names that row, not the form', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Rina is second on purpose: the index must point at the offending row.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...BUDI, meterai_count: 1 },
        { ...RINA, meterai_count: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(response.body.error.details.recipient_index).toBe(1);
    // Not a quota failure: 4 meterai would also bust the allowance of 3, but
    // §B5 puts the per-row rule first, and it is the truer cause.
    expect(response.body.error.code).not.toBe('INSUFFICIENT_METERAI_QUOTA');
  });

  it('allows meterai_count equal to signature_count — the boundary, not the failure', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...BUDI, meterai_count: 1 }],
    });

    expect(response.status).toBe(200);
    expect(response.body.total_meterai).toBe(1);
    expect(response.body.total_charge).toBe('15000.10');
  });

  it.each([
    ['negative', -1],
    ['above the maximum', 4],
    ['fractional', 2.5],
    ['a numeric string', '2'],
    ['null', null],
    ['boolean', true],
  ])('refuses a meterai_count that is %s, without ever clamping it', async (_label, value) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: value }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_COUNT_INVALID');
    expect(response.body.error.details.recipient_index).toBe(0);
    // A clamped value would have produced a 200 with a charge attached.
    expect(response.body.total_charge).toBeUndefined();
  });

  it('treats an ABSENT meterai_count as the documented default of 0 (§B1)', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Byte-for-byte a Case-1 payload. It must still mean what it meant.
    const response = await preview(app, envelopeId, { recipients: [RINA, BUDI] });

    expect(response.status).toBe(200);
    expect(response.body.total_meterai).toBe(0);
    expect(response.body.charges.meterai).toBe('0.00');
    expect(response.body.total_charge).toBe('15000.00');
  });

  it('accepts meterai_count as a known key, while step stays UNKNOWN_FIELD here', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const accepted = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: 1 }],
    });
    expect(accepted.status).toBe(200);

    // This payload names no mode, so it is `parallel` (§A2), and §B7.9 makes
    // `step` an unaccepted key there — P2 shipping changed nothing about it.
    // The sequential counterpart lives in the P2 block below.
    const refused = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: 1, step: 1 }],
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe('UNKNOWN_FIELD');
    expect(refused.body.error.details.field).toBe('recipients[0].step');
  });
});

/**
 * §B5's extended order, asserted the same way Case 1's was: every test here
 * sends a request that breaks TWO rules at once and pins which one is reported.
 * Reading the source is not evidence; only the earlier code coming back is.
 */
describe('POST /api/envelopes/:id/charge-preview — §B5 order, with meterai', () => {
  it('reports a malformed meterai_count before the per-row comparison', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // `9` is both out of range (per-recipient) and greater than the row's 2
    // signatures (meterai-vs-signature). The per-recipient stage is earlier.
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: 9 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_COUNT_INVALID');
  });

  it('reports a duplicate email before the per-row meterai comparison', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, email: 'rina.halim@example.test', meterai_count: 0 },
        { ...RINA, email: 'RINA.HALIM@example.test ', meterai_count: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('reports meterai-vs-signature BEFORE the signature quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 11 signatures against an allowance of 8, AND Citra carries 3 duty stamps
    // on a single signature. The per-row rule is the earlier stage.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 5, meterai_count: 0 },
        { ...BUDI, signature_count: 5, meterai_count: 0 },
        { ...CITRA, signature_count: 1, meterai_count: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(response.body.error.details.recipient_index).toBe(2);
  });

  it('reports meterai-vs-signature BEFORE the meterai quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 5 duty stamps against an allowance of 3, AND Budi carries 2 on one
    // signature. Both are meterai failures; the per-row one is reported.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 2 },
        { ...BUDI, signature_count: 1, meterai_count: 2 },
        { ...CITRA, meterai_count: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(response.body.error.details.recipient_index).toBe(1);
  });

  it('reports the signature quota BEFORE the meterai quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 9 signatures against 8 and 4 duty stamps against 3 — both allowances are
    // breached, every row is individually legal, and signatures come first.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 3, meterai_count: 3 },
        { ...BUDI, signature_count: 3, meterai_count: 1 },
        { ...CITRA, signature_count: 3, meterai_count: 0 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    // Byte-identical to Case 1's message, though the check now lives in the
    // kernel rather than in the service (§B7.21).
    expect(response.body.error.message).toBe('9 of 8 signatures - 1 over your quota');
  });

  it('reports the meterai quota once the signature quota is satisfied', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The same list with one signature removed from each row: 6 signatures is
    // inside the allowance, so the next stage — the meterai quota — reports.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 2, meterai_count: 2 },
        { ...BUDI, signature_count: 2, meterai_count: 2 },
        { ...CITRA, signature_count: 2, meterai_count: 0 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_METERAI_QUOTA');
    expect(response.body.error.message).toBe('4 of 3 eMeterai - 1 over your eMeterai quota');
  });
});

/**
 * Signing order — `test_2_en.md` §A2, §A3.3/§A3.4, §B4, §B7 rows 5-9 (P2).
 *
 * Three things are proven here and nowhere else in this package:
 *
 * 1. `order_mode` and `steps` are on EVERY `200`, in both modes (§B4). The
 *    parallel shape is the single group §A3.4 defines, so a client has one
 *    shape to render rather than two.
 * 2. `step` is accepted in `sequential` and refused in `parallel` (§B7.9) —
 *    the allow-list is a function of the body, and this is the only evidence
 *    that the branch is actually wired.
 * 3. A malformed `order_mode` reaches the rule and comes back
 *    `ORDER_MODE_INVALID`, NOT `UNKNOWN_FIELD`. Those two are easy to confuse
 *    from the outside and mean opposite things to a client: one says "that is
 *    not a mode", the other says "delete this field".
 */
describe('POST /api/envelopes/:id/charge-preview — signing order (§A2, P2)', () => {
  it('§B7.5 — sequential with Rina 1, Budi 2, Citra 2 gives 2 steps, the second shared', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, step: 2 },
        { ...CITRA, step: 2 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.order_mode).toBe('sequential');
    expect(response.body.steps).toHaveLength(2);
    expect(response.body.steps).toEqual([
      { step: 1, recipient_emails: ['rina.halim@example.test'] },
      // §A2.2: sharing a step is the normal case, not an edge one — these two
      // sign in parallel inside step 2.
      { step: 2, recipient_emails: ['budi.santoso@example.test', 'citra.dewi@example.test'] },
    ]);

    // The order mode changes who is invited when, never what it costs: 4
    // signatures at the Case-1 price, no duty stamps.
    expect(response.body.recipient_count).toBe(3);
    expect(response.body.total_signatures).toBe(4);
    expect(response.body.total_meterai).toBe(0);
    expect(response.body.total_charge).toBe('20000.00');
    expect(response.body.quota_remaining).toEqual({ signature: 4, meterai: 3 });
  });

  it('orders the steps ascending and normalizes their emails', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Rows arrive in step order 2, 1 — `[2,1]` is the contiguous SET {1,2}, so
    // it is valid (§A2.3 is about the set, not the row sequence).
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...BUDI, email: '  Budi.Santoso@Example.test ', step: 2 },
        { ...RINA, step: 1 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.steps).toEqual([
      { step: 1, recipient_emails: ['rina.halim@example.test'] },
      { step: 2, recipient_emails: ['budi.santoso@example.test'] },
    ]);
  });

  it('echoes parallel and one group, whether the mode is sent or left out', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const oneGroup = [
      { step: 1, recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'] },
    ];

    // §A2: absence IS `parallel`, so a byte-for-byte Case-1 payload and an
    // explicit `parallel` one must answer identically (§B7.21).
    const implicit = await preview(app, envelopeId, { recipients: [RINA, BUDI] });
    expect(implicit.status).toBe(200);
    expect(implicit.body.order_mode).toBe('parallel');
    expect(implicit.body.steps).toEqual(oneGroup);

    const explicit = await preview(app, envelopeId, {
      order_mode: 'parallel',
      recipients: [RINA, BUDI],
    });
    expect(explicit.status).toBe(200);
    expect(explicit.body).toEqual(implicit.body);
  });

  it('§B7.6 — Citra carrying eMeterai in step 2 is refused and named', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, step: 2 },
        { ...CITRA, meterai_count: 1, step: 2 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    // §A3.3 requires the reason to point at THAT recipient, so the failure
    // carries both the row and the identity needed to word a sentence about it.
    expect(response.body.error.details.recipient_index).toBe(2);
    expect(response.body.error.details.recipient_email).toBe('citra.dewi@example.test');
    expect(response.body.error.message).toContain('citra.dewi@example.test');
    expect(response.body.error.message).toContain('step 2');
    expect(response.body.total_charge).toBeUndefined();
  });

  it('allows eMeterai in step 1 — the rule is about step 2 and later', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, meterai_count: 1, step: 1 },
        { ...BUDI, step: 2 },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.total_meterai).toBe(1);
    expect(response.body.total_charge).toBe('25000.10');
  });

  it('§A3.4 — the placement rule does not bind in parallel', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The same duty stamp that is illegal in step 2 is fine here: parallel is a
    // single step, so there is no later step for a carrier to stray into.
    const response = await preview(app, envelopeId, {
      order_mode: 'parallel',
      recipients: [RINA, { ...BUDI, meterai_count: 1 }],
    });

    expect(response.status).toBe(200);
    expect(response.body.total_meterai).toBe(1);
    expect(response.body.steps).toHaveLength(1);
  });

  it.each([
    ['[1,3]', [1, 3], 'Step numbers must be contiguous starting at 1 - got 1, 3'],
    ['[2,3]', [2, 3], 'Step numbers must be contiguous starting at 1 - got 2, 3'],
  ])('§B7.7 — steps sent as %s are refused as a gap', async (_label, [first, second], message) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: first },
        { ...BUDI, step: second },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STEP_SEQUENCE_INVALID');
    expect(response.body.error.message).toBe(message);
    // No single row is at fault in a gap, so none is marked — pointing at one
    // would be a guess the UI would render as fact.
    expect(response.body.error.details).toBeUndefined();
  });

  it('§B7.7 — steps sent as [0,1] are refused, and the zero row is named', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 0 },
        { ...BUDI, step: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STEP_SEQUENCE_INVALID');
    // Here one row IS at fault: step 0 is not a step at all (§A2.1).
    expect(response.body.error.details.recipient_index).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['a numeric string', '2'],
    ['fractional', 1.5],
    ['null', null],
  ])('refuses a sequential step that is %s, without ever coercing it', async (_label, value) => {
    const { app, envelopeId } = await appWithEnvelope();
    const recipient: RecipientPayload = { ...RINA };
    if (value !== undefined) recipient.step = value;

    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [recipient, { ...BUDI, step: 1 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STEP_SEQUENCE_INVALID');
    expect(response.body.error.details.recipient_index).toBe(0);
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.9 — a parallel payload carrying step is UNKNOWN_FIELD', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'parallel',
      recipients: [RINA, { ...BUDI, step: 1 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('recipients[1].step');
    // Not silently dropped: nothing was computed at all.
    expect(response.body.total_charge).toBeUndefined();
  });

  it.each([
    ['a near miss in case', 'Parallel'],
    ['a plausible synonym', 'serial'],
    ['empty', ''],
    ['null', null],
    ['a number', 1],
    ['an object', { mode: 'sequential' }],
  ])('refuses an order_mode that is %s with ORDER_MODE_INVALID', async (_label, value) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: value,
      recipients: [RINA, BUDI],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORDER_MODE_INVALID');
    expect(response.body.error.message).toBe('order_mode must be "parallel" or "sequential"');
    // The point of the unconditional allow-list entry: `order_mode` is a key
    // §B4 requires, so a bad VALUE must reach the rule instead of being masked
    // as a key the server does not accept.
    expect(response.body.error.code).not.toBe('UNKNOWN_FIELD');
    // A request-level field has no row to mark (contrast §B7.6).
    expect(response.body.error.details).toBeUndefined();
  });
});

/**
 * §B5's P2 order, asserted the way the rest of this file asserts order: every
 * request below breaks TWO rules at once and pins which one is reported. The
 * two new stages are INTERLEAVED, not appended — `step-structure` sits between
 * duplicate emails and `meterai-vs-signature`, and `meterai-step-placement`
 * right after it — so appending them would pass a "both stages exist" test and
 * fail every one of these.
 */
describe('POST /api/envelopes/:id/charge-preview — §B5 order, with signing order', () => {
  it('reports the payload shape before the order mode', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // A mode that is not a mode, and a `step` that is unaccepted because of it.
    // §B5 puts payload shape first, so the surplus key is what comes back.
    const response = await preview(app, envelopeId, {
      order_mode: 'nope',
      recipients: [{ ...RINA, step: 1 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('recipients[0].step');
  });

  it('reports the order mode before the recipient count', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // An empty list AND a bad mode. `order-mode` is the first kernel stage, so
    // this also proves the mode got past the allow-list to reach a rule.
    const response = await preview(app, envelopeId, { order_mode: 'nope', recipients: [] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORDER_MODE_INVALID');
  });

  it('reports a per-recipient failure before the step structure', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [{ ...RINA, signature_count: 0, step: 7 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('reports a duplicate email before the step structure', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...RINA, email: 'RINA.HALIM@example.test ', step: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('reports the step structure BEFORE the meterai step placement', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Steps `[1,3]` is a gap, and the step-3 row also carries a duty stamp.
    // Which step a carrier is in is meaningless while the steps are malformed.
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, meterai_count: 1, step: 3 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STEP_SEQUENCE_INVALID');
    expect(response.body.error.code).not.toBe('METERAI_NOT_IN_FIRST_STEP');
  });

  it('reports meterai-vs-signature BEFORE the meterai step placement', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Rina asks for 3 duty stamps on 2 signatures AND sits in step 2. The
    // per-row rule is §B5's earlier stage.
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...BUDI, step: 1 },
        { ...RINA, meterai_count: 3, step: 2 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(response.body.error.details.recipient_index).toBe(1);
  });

  it('reports the meterai step placement BEFORE the signature quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 10 signatures against an allowance of 8, AND Budi carries a duty stamp in
    // step 2. The placement rule is the earlier stage.
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, signature_count: 5, step: 1 },
        { ...BUDI, signature_count: 5, meterai_count: 1, step: 2 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(response.body.error.details.recipient_index).toBe(1);
  });

  it('reports the meterai step placement BEFORE the meterai quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 4 duty stamps against an allowance of 3, and two of the carriers are in
    // step 2. Placement comes first, and names the first offending row.
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, meterai_count: 2, step: 1 },
        { ...BUDI, meterai_count: 1, step: 2 },
        { ...CITRA, meterai_count: 1, step: 2 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(response.body.error.details.recipient_index).toBe(1);
  });
});

/**
 * Field placement and the reconciliation invariant (§A4, §B2, §B3, §B4, P3).
 *
 * Four things this block exists to prove, in order of how badly they would hurt
 * if they were wrong:
 *
 * 1. THE RULES ARE REACHED AT ALL. `chargePreviewStages` takes the raw `fields`
 *    as a THIRD argument; passing only two typechecks cleanly and makes every
 *    rule below dead code, so the server would answer `200` to all of §B7 rows
 *    10-18. Every test here fails loudly in that state. It is the same trap P2
 *    documented for the raw `order_mode`.
 * 2. THE API REJECTS, IT NEVER CLAMPS (§B2). For each boundary the suite sends
 *    both the out-of-range value AND the value the UI would have clamped it to,
 *    and asserts a `422` for the first and a `200` for the second. A server that
 *    imported `clampFieldPosition` would pass the second and fail the first.
 * 3. ABSENCE IS NOT EMPTINESS. No `fields` key is a Step-2 preview and the field
 *    rules are vacuous (`field_count: 0`); `fields: []` is a Step 3 with nothing
 *    placed and FAILS reconciliation. Collapsing the two would silently accept
 *    an unplaced document.
 * 4. THE BILL COMES FROM THE COUNTS (§A4.12). The same recipients priced with
 *    and without a complete field collection answer with identical money.
 */
describe('POST /api/envelopes/:id/charge-preview — field placement (§A4, P3)', () => {
  it('§B4 — the documented payload: 2 recipients, 4 fields, sequential, "25000.10"', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, meterai_count: 1, step: 1 },
        { ...BUDI, meterai_count: 0, step: 2 },
      ],
      fields: B4_FIELDS,
    });

    expect(response.status).toBe(200);
    // §B4's success body in full, minus `preview_token` (P4, not attempted).
    // Every monetary figure is the one P1 already produced for these counts: the
    // four boxes added `field_count` and moved nothing else (§A4.12).
    expect(response.body).toEqual({
      order_mode: 'sequential',
      steps: [
        { step: 1, recipient_emails: ['rina.halim@example.test'] },
        { step: 2, recipient_emails: ['budi.santoso@example.test'] },
      ],
      recipient_count: 2,
      total_signatures: 3,
      total_meterai: 1,
      field_count: 4,
      price: { signature: '5000.00', meterai: '10000.10' },
      charges: { signature: '15000.00', meterai: '10000.10' },
      total_charge: '25000.10',
      quota: { signature: 8, meterai: 3 },
      quota_remaining: { signature: 5, meterai: 2 },
    });
  });

  it('§A4.12 — adding a complete field collection changes field_count and nothing else', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const recipients = [
      { ...RINA, meterai_count: 1, step: 1 },
      { ...BUDI, meterai_count: 0, step: 2 },
    ];

    // The Step-2 preview of the same intent: no `fields` key at all.
    const step2 = await preview(app, envelopeId, { order_mode: 'sequential', recipients });
    // The Step-3 preview, fully placed.
    const step3 = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients,
      fields: B4_FIELDS,
    });

    expect(step2.status).toBe(200);
    expect(step3.status).toBe(200);
    expect(step2.body.field_count).toBe(0);
    expect(step3.body.field_count).toBe(4);

    // Pricing is computed from the COUNTS. Strip the one key that is about
    // fields and the two bodies must be indistinguishable — which is also the
    // structural reason a MISMATCHED collection cannot change the bill either:
    // there is no path from a field to a sum.
    const { field_count: _step2Count, ...step2Money } = step2.body as Record<string, unknown>;
    const { field_count: _step3Count, ...step3Money } = step3.body as Record<string, unknown>;
    expect(step3Money).toEqual(step2Money);
  });

  it('keeps a Step-2 payload with NO fields key valid — the field rules are vacuous', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Byte-for-byte a P1 payload: Rina promises two signatures and places none.
    // §B4 makes an absent collection the Step-2 preview, so this is still a
    // `200` — every Case-1, P1 and P2 request in this file has this shape.
    const response = await preview(app, envelopeId, { recipients: [RINA, BUDI] });

    expect(response.status).toBe(200);
    expect(response.body.field_count).toBe(0);
    expect(response.body.total_charge).toBe('15000.00');
  });

  it('refuses fields: [] for the same recipients — empty is NOT absent (§B4)', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The identical recipient list as the test above, with one key added. An
    // explicit empty array is a real Step 3 where nothing has been placed, so
    // Rina's two promised signatures are unmaterialized.
    const response = await preview(app, envelopeId, { recipients: [RINA, BUDI], fields: [] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.details.recipient_index).toBe(0);
    expect(response.body.error.details.recipient_email).toBe('rina.halim@example.test');
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.10 — signature_count 2 with one signature field placed is a shortfall', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [sigField('f1', 'rina.halim@example.test')],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.details.recipient_index).toBe(0);
    expect(response.body.error.details.recipient_email).toBe('rina.halim@example.test');
    // The message carries the `Signature 1/2` figures §A4.6 renders.
    expect(response.body.error.message).toContain('1 of 2');
    expect(response.body.error.message).toContain('1 still to place');
    // A shortfall has no box to point at, so none is named (contrast §B7.11).
    expect(response.body.error.details.field_id).toBeUndefined();
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.11 — signature_count 2 with three signature fields is an excess', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f2', 'rina.halim@example.test', 64, 340),
        sigField('f3', 'rina.halim@example.test', 64, 440),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.message).toContain('3 of 2');
    expect(response.body.error.message).toContain('1 too many');
    // §A4.13's decision is FLAG, not auto-drop: the surplus box is named so the
    // user can remove that one, and the third is the surplus because the first
    // two are what the count promised.
    expect(response.body.error.details.field_id).toBe('f3');
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.11 — an excess eMeterai is reported the same way, naming the box', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: 1 }],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f2', 'rina.halim@example.test', 64, 340),
        metField('f3', 'rina.halim@example.test'),
        metField('f4', 'rina.halim@example.test', 360, 340),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.message).toContain('eMeterai');
    expect(response.body.error.details.field_id).toBe('f4');
  });

  it('§B7.12 — a field owned by someone outside the list is FIELD_UNKNOWN_RECIPIENT', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // §B7.13 is the same state arrived at from the other side — a recipient
    // deleted while owning boxes — and gets the same answer: the field is
    // reported as orphaned, never cascade-deleted.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f2', 'rina.halim@example.test', 64, 340),
        sigField('f3', 'ghost@example.test', 64, 440),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_UNKNOWN_RECIPIENT');
    expect(response.body.error.details.field_id).toBe('f3');
    expect(response.body.error.details.field_index).toBe(2);
    expect(response.body.error.details.recipient_email).toBe('ghost@example.test');
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B3 — a field owner is matched trimmed and case-insensitively', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The same comparison the duplicate rule uses. A client that echoes the
    // email as the user typed it must still reconcile.
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', '  Budi.Santoso@Example.test ')],
    });

    expect(response.status).toBe(200);
    expect(response.body.field_count).toBe(1);
    expect(response.body.total_charge).toBe('5000.00');
  });

  it('§B7.15 — a signature at x = 500 is refused, and x = 420 is ACCEPTED', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    // The UI would have clamped this to 420. The API must not: a `200` here
    // would mean the server silently moved a box the user never placed there.
    const refused = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', 'budi.santoso@example.test', 500, 224)],
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(refused.body.error.details.field_id).toBe('f1');
    expect(refused.body.error.message).toContain('0-420');
    // Nothing was computed, so nothing was repaired.
    expect(refused.body.total_charge).toBeUndefined();
    expect(refused.body.field_count).toBeUndefined();

    // The exact edge, on BOTH axes: `632 - 212 = 420` and `588 - 88 = 500`.
    const accepted = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', 'budi.santoso@example.test', 420, 500)],
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.field_count).toBe(1);
  });

  it('§B7.15 — one past the signature edge is refused on either axis', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const pastX = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', 'budi.santoso@example.test', 421, 0)],
    });
    expect(pastX.status).toBe(422);
    expect(pastX.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');

    const pastY = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', 'budi.santoso@example.test', 0, 501)],
    });
    expect(pastY.status).toBe(422);
    expect(pastY.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
  });

  it('§B7.16 — an eMeterai at y = 600 is refused, and y = 476 is ACCEPTED', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const carrier = { ...BUDI, meterai_count: 1 };

    const refused = await preview(app, envelopeId, {
      recipients: [carrier],
      fields: [
        sigField('f1', 'budi.santoso@example.test'),
        metField('f2', 'budi.santoso@example.test', 360, 600),
      ],
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(refused.body.error.details.field_id).toBe('f2');
    expect(refused.body.error.message).toContain('0-476');
    expect(refused.body.total_charge).toBeUndefined();

    // `588 - 112 = 476` and `632 - 112 = 520` — the eMeterai edge on both axes.
    // Note it CROSSES the signature range: y = 500 was legal above and is not
    // here, which is why the two kinds cannot share one bound.
    const accepted = await preview(app, envelopeId, {
      recipients: [carrier],
      fields: [
        sigField('f1', 'budi.santoso@example.test'),
        metField('f2', 'budi.santoso@example.test', 520, 476),
      ],
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.field_count).toBe(2);
    expect(accepted.body.total_charge).toBe('15000.10');
  });

  it('§B7.16 — one past the eMeterai edge is refused on either axis', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const carrier = { ...BUDI, meterai_count: 1 };

    const pastX = await preview(app, envelopeId, {
      recipients: [carrier],
      fields: [
        sigField('f1', 'budi.santoso@example.test'),
        metField('f2', 'budi.santoso@example.test', 521, 0),
      ],
    });
    expect(pastX.status).toBe(422);
    expect(pastX.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');

    const pastY = await preview(app, envelopeId, {
      recipients: [carrier],
      fields: [
        sigField('f1', 'budi.santoso@example.test'),
        metField('f2', 'budi.santoso@example.test', 0, 477),
      ],
    });
    expect(pastY.status).toBe(422);
    expect(pastY.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
  });

  it.each([
    ['negative', -1],
    ['fractional', 64.5],
    ['a numeric string', '64'],
    ['null', null],
    ['missing', undefined],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('refuses an x that is %s, without ever repairing it', async (_label, value) => {
    const { app, envelopeId } = await appWithEnvelope();
    const field: FieldPayload = sigField('f1', 'budi.santoso@example.test');
    if (value === undefined) delete field.x;
    else field.x = value;

    const response = await preview(app, envelopeId, { recipients: [BUDI], fields: [field] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    // A clamped or rounded coordinate would have produced a 200 with a charge.
    expect(response.body.total_charge).toBeUndefined();
  });

  it('refuses a kind outside the two — an unknown box has no range to be inside', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [{ ...sigField('f1', 'budi.santoso@example.test'), kind: 'initials' }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(response.body.error.message).toContain('"signature"');
    expect(response.body.error.details.field_id).toBe('f1');
  });

  it.each([
    ['2', 2],
    ['0', 0],
    ['-1', -1],
    ['fractional', 1.5],
    ['a numeric string', '1'],
  ])('§B7.17 — a field with page %s is FIELD_PAGE_INVALID', async (_label, page) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [{ ...sigField('f1', 'budi.santoso@example.test'), page }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_PAGE_INVALID');
    expect(response.body.error.details.field_id).toBe('f1');
    expect(response.body.error.details.field_index).toBe(0);
    expect(response.body.total_charge).toBeUndefined();
  });

  it('§B7.17 — an absent page is refused too: §B3 makes it required', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const field: FieldPayload = sigField('f1', 'budi.santoso@example.test');
    delete field.page;

    const response = await preview(app, envelopeId, { recipients: [BUDI], fields: [field] });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_PAGE_INVALID');
  });

  it('§B7.18 — two fields sharing an id are refused, and the SECOND is named', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f1', 'rina.halim@example.test', 64, 340),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_ID_DUPLICATE');
    // The first box is the one the user already had; the collision arrived with
    // the later one, so that is the index reported.
    expect(response.body.error.details.field_id).toBe('f1');
    expect(response.body.error.details.field_index).toBe(1);
    expect(response.body.total_charge).toBeUndefined();
  });

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['a number', 7],
    ['null', null],
  ])('refuses an id that is %s — it cannot be shown to be unique', async (_label, id) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [{ ...sigField('f1', 'budi.santoso@example.test'), id }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_ID_DUPLICATE');
    expect(response.body.error.details.field_index).toBe(0);
  });

  it('compares ids exactly: "f1" and "F1" are two different boxes (§B3)', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // §B3 normalizes `recipient_email` and says only "unique" about `id`, so no
    // case folding is applied to an id. Two boxes, both of Rina's two.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('F1', 'rina.halim@example.test', 64, 340),
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.field_count).toBe(2);
  });

  it('§A4.11 — a step-2 recipient with meterai_count 0 may not OWN an eMeterai box', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The one state that gets past the recipient-level `meterai-step-placement`
    // stage: Budi promises no duty stamp, so that stage is satisfied, yet a
    // meterai box is placed on him in step 2. Reporting it as a mere count
    // mismatch would send the user to raise his `meterai_count`, which §A3.3
    // forbids outright — so it comes back as the placement rule, naming the box.
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, step: 2 },
      ],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f2', 'rina.halim@example.test', 64, 340),
        sigField('f3', 'budi.santoso@example.test', 64, 440),
        metField('f4', 'budi.santoso@example.test'),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(response.body.error.details.recipient_index).toBe(1);
    expect(response.body.error.details.recipient_email).toBe('budi.santoso@example.test');
    expect(response.body.error.details.field_id).toBe('f4');
    expect(response.body.error.code).not.toBe('FIELD_COUNT_MISMATCH');
  });

  it('§A3.4 — an eMeterai box on a later-placed recipient is fine in parallel', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Parallel is a single step, so there is no later step for a carrier to
    // stray into and the placement rule does not bind.
    const response = await preview(app, envelopeId, {
      order_mode: 'parallel',
      recipients: [RINA, { ...BUDI, meterai_count: 1 }],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        sigField('f2', 'rina.halim@example.test', 64, 340),
        sigField('f3', 'budi.santoso@example.test', 64, 440),
        metField('f4', 'budi.santoso@example.test'),
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.field_count).toBe(4);
    expect(response.body.total_charge).toBe('25000.10');
  });

  it('accepts `fields` as a known root key in BOTH modes', async () => {
    const { app, envelopeId } = await appWithEnvelope();

    const parallel = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [sigField('f1', 'budi.santoso@example.test')],
    });
    expect(parallel.status).toBe(200);

    const sequential = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [{ ...BUDI, step: 1 }],
      fields: [sigField('f1', 'budi.santoso@example.test')],
    });
    expect(sequential.status).toBe(200);
  });

  it('refuses an unknown key INSIDE a field and gives its path', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [
        sigField('f1', 'rina.halim@example.test'),
        { ...sigField('f2', 'rina.halim@example.test', 64, 340), rotation: 90 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('fields[1].rotation');
    expect(response.body.total_charge).toBeUndefined();
  });

  it.each([
    ['width', 'width'],
    ['label', 'label'],
    ['__proto__', '__proto__'],
  ])('refuses the surplus field property %s', async (_label, key) => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [{ ...sigField('f1', 'budi.santoso@example.test'), [key]: 1 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    // Named by path, including a prototype-pollution key: it is refused as an
    // ordinary unaccepted property, not special-cased.
    expect(response.body.error.details.field).toBe(`fields[0].${key}`);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses a `fields` that is present but not an array — nothing is placed', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Present-but-malformed is a mistake rather than a default (the stance
    // `meterai_count: null` already takes), so it is read as an empty list and
    // refused by reconciliation, not accepted as a Step-2 preview.
    for (const fields of [null, {}, 'f1', 7]) {
      const response = await preview(app, envelopeId, { recipients: [RINA], fields });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    }
  });
});

/**
 * §B5's P3 order, asserted the way the rest of this file asserts order: every
 * request below breaks TWO rules at once and pins which one is reported.
 *
 * The two field stages were INSERTED into the middle of §B5's list — after
 * `meterai-step-placement` and before both allowances — not appended. Appending
 * them would pass every test in the block above and fail the four tests here
 * that pin reconciliation ahead of a quota.
 */
describe('POST /api/envelopes/:id/charge-preview — §B5 order, with field placement', () => {
  it('reports the payload shape before any field rule', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // A surplus property on a box that is ALSO out of bounds and ALSO leaves
    // Rina short. §B5 puts payload shape first.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [{ ...sigField('f1', 'rina.halim@example.test', 500, 224), rotation: 90 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('fields[0].rotation');
  });

  it('reports a surplus recipient key before a surplus field key', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Both collections carry a key the server has no rule for. The recipient
    // level is walked first, which is §B4's own key order.
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, step: 1 }],
      fields: [{ ...sigField('f1', 'rina.halim@example.test'), rotation: 90 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
    expect(response.body.error.details.field).toBe('recipients[0].step');
  });

  it('reports a per-recipient failure before the field shape', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, signature_count: 0 }],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('reports a duplicate email before the field shape', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [RINA, { ...RINA, email: 'RINA.HALIM@example.test ' }],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('reports the step structure before the field shape', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, step: 3 },
      ],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STEP_SEQUENCE_INVALID');
  });

  it('reports meterai-vs-signature before the field shape', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [{ ...RINA, meterai_count: 3 }],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_EXCEEDS_SIGNATURE');
  });

  it('reports the meterai step placement before the field shape', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      order_mode: 'sequential',
      recipients: [
        { ...RINA, step: 1 },
        { ...BUDI, meterai_count: 1, step: 2 },
      ],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(response.body.error.details.recipient_index).toBe(1);
  });

  it('reports the field SHAPE before the field RECONCILIATION', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // One box, out of bounds, and Rina promised two. Both rules fire; a box
    // that is not on the page materializes nothing, so the shape is the truer
    // cause and the earlier stage.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(response.body.error.code).not.toBe('FIELD_COUNT_MISMATCH');
  });

  it('reports a duplicate id before an unknown owner', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Both boxes claim id `f1` and both belong to nobody. A list whose ids are
    // ambiguous cannot be reported on by id, which is how every other field
    // rejection names its subject — so the ambiguity is reported first.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [sigField('f1', 'ghost@example.test'), sigField('f1', 'ghost@example.test', 64, 340)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_ID_DUPLICATE');
    expect(response.body.error.code).not.toBe('FIELD_UNKNOWN_RECIPIENT');
  });

  it('reports the page before the position: both wrong, the page comes back', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    const response = await preview(app, envelopeId, {
      recipients: [BUDI],
      fields: [{ ...sigField('f1', 'budi.santoso@example.test', 500, 600), page: 2 }],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_PAGE_INVALID');
    expect(response.body.error.code).not.toBe('FIELD_OUT_OF_BOUNDS');
  });

  it('reports an unknown owner before a count mismatch', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // Two boxes belong to nobody, which ALSO leaves Rina short of both of hers.
    // "This box belongs to nobody" is the actionable cause: fixing the email
    // fixes both, while placing another box fixes neither.
    const response = await preview(app, envelopeId, {
      recipients: [RINA],
      fields: [sigField('f1', 'ghost@example.test'), sigField('f2', 'ghost@example.test', 64, 340)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_UNKNOWN_RECIPIENT');
    expect(response.body.error.code).not.toBe('FIELD_COUNT_MISMATCH');
  });

  it('reports the field shape BEFORE the signature quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 9 signatures against an allowance of 8, and the one box is off the page.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 5 },
        { ...BUDI, signature_count: 4 },
      ],
      fields: [sigField('f1', 'rina.halim@example.test', 500, 224)],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(response.body.error.code).not.toBe('INSUFFICIENT_SIGNATURE_QUOTA');
  });

  it('§B7.10 — reports the field reconciliation BEFORE the signature quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 9 signatures against an allowance of 8 AND nothing placed. §B7.10 wants
    // the mismatch, so reconciliation must sit ahead of the allowance.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 5 },
        { ...BUDI, signature_count: 4 },
      ],
      fields: [],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.code).not.toBe('INSUFFICIENT_SIGNATURE_QUOTA');
  });

  it('reports the field reconciliation BEFORE the meterai quota', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 4 duty stamps against an allowance of 3 — each row within its own
    // signature count, so the per-row rule is satisfied — and nothing placed.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 2 },
        { ...BUDI, signature_count: 2, meterai_count: 2 },
      ],
      fields: [],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FIELD_COUNT_MISMATCH');
    expect(response.body.error.code).not.toBe('INSUFFICIENT_METERAI_QUOTA');
  });

  it('reports the signature quota once every field rule is satisfied', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // The allowance is the LAST word, not a bypassed one: a fully reconciled
    // 9-signature document still fails on quota.
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, signature_count: 5 },
        { ...BUDI, signature_count: 4 },
      ],
      fields: [
        sigField('f1', 'rina.halim@example.test', 0, 0),
        sigField('f2', 'rina.halim@example.test', 0, 100),
        sigField('f3', 'rina.halim@example.test', 0, 200),
        sigField('f4', 'rina.halim@example.test', 0, 300),
        sigField('f5', 'rina.halim@example.test', 0, 400),
        sigField('f6', 'budi.santoso@example.test', 200, 0),
        sigField('f7', 'budi.santoso@example.test', 200, 100),
        sigField('f8', 'budi.santoso@example.test', 200, 200),
        sigField('f9', 'budi.santoso@example.test', 200, 300),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    expect(response.body.error.message).toBe('9 of 8 signatures - 1 over your quota');
  });

  it('reports the meterai quota once every field rule is satisfied', async () => {
    const { app, envelopeId } = await appWithEnvelope();
    // 4 duty stamps, every box placed and reconciled. The eMeterai allowance is
    // still 3, and its message still names eMeterai and nothing else (§A3.5).
    const response = await preview(app, envelopeId, {
      recipients: [
        { ...RINA, meterai_count: 2 },
        { ...BUDI, signature_count: 2, meterai_count: 2 },
      ],
      fields: [
        sigField('f1', 'rina.halim@example.test', 0, 0),
        sigField('f2', 'rina.halim@example.test', 0, 100),
        metField('f3', 'rina.halim@example.test', 0, 200),
        metField('f4', 'rina.halim@example.test', 0, 320),
        sigField('f5', 'budi.santoso@example.test', 200, 0),
        sigField('f6', 'budi.santoso@example.test', 200, 100),
        metField('f7', 'budi.santoso@example.test', 300, 200),
        metField('f8', 'budi.santoso@example.test', 300, 320),
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_METERAI_QUOTA');
    expect(response.body.error.message).toBe('4 of 3 eMeterai - 1 over your eMeterai quota');
  });
});
