/**
 * The staleness guard (PRD §8.10, §10 row 12, prompt §7 criterion 12).
 *
 * This is the single most-tested behaviour in the brief, so it is tested with
 * no `fetch`, no `setTimeout` and no wall-clock wait: the transport is injected
 * and every promise is resolved by hand, in a chosen order. The suite is
 * therefore deterministic — an out-of-order race is *constructed*, not raced
 * for — and cannot flake.
 *
 * Seam S5: the guard keys on a payload hash stored beside the result, not on a
 * monotonic counter. The two designs are distinguished explicitly below.
 */

import { describe, expect, it, vi } from 'vitest';

import type { ChargePreviewResponse, RecipientInput } from '@signed-doc/shared';

import { ApiRequestError, UNREACHABLE_MESSAGE } from '../api/client.js';
import {
  PreviewController,
  previewKey,
  type PreviewTransport,
} from '../features/recipients/preview-controller.js';

const ENVELOPE = 'env_01';

const RINA: RecipientInput = {
  name: 'Rina Halim',
  email: 'rina.halim@example.test',
  signature_count: 2,
  meterai_count: 0,
};
const BUDI: RecipientInput = {
  name: 'Budi Santoso',
  email: 'budi.santoso@example.test',
  signature_count: 1,
  meterai_count: 0,
};

const SEEDED = [RINA, BUDI];
/** Rina bumped to 3 — the "user edits while a request is pending" payload. */
const EDITED = [{ ...RINA, signature_count: 3 }, BUDI];
/** The same list with one duty stamp added instead (Case 2 §A3). */
const STAMPED = [{ ...RINA, meterai_count: 1 }, BUDI];

function response(totalSignatures: number, totalCharge: string, remaining: number): ChargePreviewResponse {
  return {
    // §B4 — both are always present in a `200`, in either mode. In `parallel`
    // `steps` is the single group §A3.4 says a parallel document is.
    order_mode: 'parallel',
    steps: [
      {
        step: 1,
        recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'],
      },
    ],
    recipient_count: 2,
    total_signatures: totalSignatures,
    total_meterai: 0,
    price: { signature: '5000.00', meterai: '10000.10' },
    charges: { signature: totalCharge, meterai: '0.00' },
    total_charge: totalCharge,
    quota: { signature: 8, meterai: 3 },
    quota_remaining: { signature: remaining, meterai: 3 },
  };
}

const SEEDED_RESULT = response(3, '15000.00', 5);
const EDITED_RESULT = response(4, '20000.00', 4);

/**
 * A transport whose every call is resolved or rejected by the test, by index.
 * It records the signal it was handed so abort behaviour can be asserted.
 */
function deferredTransport() {
  const calls: {
    key: string;
    signal: AbortSignal;
    resolve: (value: ChargePreviewResponse) => void;
    reject: (reason: unknown) => void;
  }[] = [];

  const transport: PreviewTransport = (envelopeId, recipients, orderMode, signal) =>
    new Promise<ChargePreviewResponse>((resolve, reject) => {
      calls.push({ key: previewKey(envelopeId, recipients, orderMode), signal, resolve, reject });
    });

  return { transport, calls };
}

/** Let every already-settled promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('previewKey (seam S5)', () => {
  it('is stable for the same payload', () => {
    expect(previewKey(ENVELOPE, SEEDED)).toBe(previewKey(ENVELOPE, [...SEEDED]));
  });

  it('changes when any recipient field changes', () => {
    const base = previewKey(ENVELOPE, SEEDED);
    expect(previewKey(ENVELOPE, EDITED)).not.toBe(base);
    expect(previewKey(ENVELOPE, [{ ...RINA, name: 'Rina H' }, BUDI])).not.toBe(base);
    expect(previewKey(ENVELOPE, [{ ...RINA, email: 'other@example.test' }, BUDI])).not.toBe(base);
  });

  it('changes when an eMeterai count changes — §A3 data is hashed too', () => {
    const base = previewKey(ENVELOPE, SEEDED);
    expect(previewKey(ENVELOPE, STAMPED)).not.toBe(base);
    // And on the second row independently, so it is the row's value that
    // counts and not merely the list total.
    expect(previewKey(ENVELOPE, [RINA, { ...BUDI, meterai_count: 1 }])).not.toBe(base);
    expect(previewKey(ENVELOPE, STAMPED)).not.toBe(
      previewKey(ENVELOPE, [RINA, { ...BUDI, meterai_count: 1 }]),
    );
  });

  it('changes when the list length or order changes', () => {
    const base = previewKey(ENVELOPE, SEEDED);
    expect(previewKey(ENVELOPE, [RINA])).not.toBe(base);
    expect(previewKey(ENVELOPE, [BUDI, RINA])).not.toBe(base);
  });

  it('changes when the envelope changes', () => {
    expect(previewKey('env_02', SEEDED)).not.toBe(previewKey(ENVELOPE, SEEDED));
  });

  it('ignores property order and local-only fields, so a re-render is not a change', () => {
    const reordered = [
      { meterai_count: 0, signature_count: 2, email: 'rina.halim@example.test', name: 'Rina Halim' },
      { email: 'budi.santoso@example.test', signature_count: 1, name: 'Budi Santoso', meterai_count: 0 },
    ];
    expect(previewKey(ENVELOPE, reordered)).toBe(previewKey(ENVELOPE, SEEDED));
  });
});

describe('the happy path', () => {
  it('goes loading -> confirmed and files the result under the payload key', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const key = previewKey(ENVELOPE, SEEDED);

    const pending = controller.request(ENVELOPE, SEEDED);
    expect(controller.isLoadingFor(key)).toBe(true);
    expect(controller.resultFor(key)).toBeNull();

    calls[0]?.resolve(SEEDED_RESULT);
    await pending;

    expect(controller.getSnapshot().status).toBe('confirmed');
    expect(controller.resultFor(key)).toEqual(SEEDED_RESULT);
    expect(controller.resultFor(key)?.total_charge).toBe('15000.00');
    expect(controller.resultFor(key)?.quota_remaining.signature).toBe(5);
  });

  it('sends exactly the wire fields, with no price, quota or total', async () => {
    const seen: readonly RecipientInput[][] = [];
    const transport = vi.fn<PreviewTransport>(async (_id, recipients) => {
      (seen as RecipientInput[][]).push([...recipients]);
      return SEEDED_RESULT;
    });

    await new PreviewController(transport).request(ENVELOPE, [
      { ...RINA, id: 'r0', countRaw: '2', meteraiRaw: '0' } as RecipientInput,
    ]);

    expect(Object.keys(seen[0]?.[0] ?? {}).sort()).toEqual([
      'email',
      'meterai_count',
      'name',
      'signature_count',
    ]);
  });

  it('notifies subscribers on every state change', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const listener = vi.fn();
    controller.subscribe(listener);

    const pending = controller.request(ENVELOPE, SEEDED);
    expect(listener).toHaveBeenCalledTimes(1); // loading

    calls[0]?.resolve(SEEDED_RESULT);
    await pending;
    expect(listener).toHaveBeenCalledTimes(2); // confirmed
  });
});

describe('a stale response never becomes the active result (PRD §8.10, §10 row 12)', () => {
  it('drops the older response when two are in flight and the SECOND resolves first', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const seededKey = previewKey(ENVELOPE, SEEDED);
    const editedKey = previewKey(ENVELOPE, EDITED);

    // A goes out for the seeded list; the user edits; B goes out for the edit.
    const a = controller.request(ENVELOPE, SEEDED);
    const b = controller.request(ENVELOPE, EDITED);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.key).toBe(seededKey);
    expect(calls[1]?.key).toBe(editedKey);

    // B (the newer request) lands first.
    calls[1]?.resolve(EDITED_RESULT);
    await b;
    expect(controller.resultFor(editedKey)).toEqual(EDITED_RESULT);

    // A (the older request) lands late. It must be ignored.
    calls[0]?.resolve(SEEDED_RESULT);
    await a;
    await flush();

    expect(controller.getSnapshot().status).toBe('confirmed');
    expect(controller.getSnapshot().key).toBe(editedKey);
    expect(controller.resultFor(editedKey)).toEqual(EDITED_RESULT);
    expect(controller.resultFor(editedKey)?.total_charge).toBe('20000.00');
    // The stale figures are nowhere: not active, and not readable for their key.
    expect(controller.resultFor(seededKey)).toBeNull();
  });

  it('drops the older response when it resolves first but has already been superseded', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const editedKey = previewKey(ENVELOPE, EDITED);

    const a = controller.request(ENVELOPE, SEEDED);
    const b = controller.request(ENVELOPE, EDITED);

    calls[0]?.resolve(SEEDED_RESULT); // stale lands first
    await a;
    await flush();
    expect(controller.getSnapshot().status).toBe('loading');
    expect(controller.getSnapshot().key).toBe(editedKey);

    calls[1]?.resolve(EDITED_RESULT);
    await b;
    expect(controller.resultFor(editedKey)).toEqual(EDITED_RESULT);
  });

  it('a stale FAILURE cannot raise a banner over newer data either', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const editedKey = previewKey(ENVELOPE, EDITED);

    const a = controller.request(ENVELOPE, SEEDED);
    const b = controller.request(ENVELOPE, EDITED);

    calls[1]?.resolve(EDITED_RESULT);
    await b;

    calls[0]?.reject(
      new ApiRequestError({ code: 'SERVER_ERROR', message: 'boom', status: 500, retryable: true }),
    );
    await a;
    await flush();

    expect(controller.getSnapshot().status).toBe('confirmed');
    expect(controller.errorFor(editedKey)).toBeNull();
  });

  it('aborts the superseded request rather than leaving it running (LD-28)', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);

    void controller.request(ENVELOPE, SEEDED);
    expect(calls[0]?.signal.aborted).toBe(false);

    void controller.request(ENVELOPE, EDITED);
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
  });

  it('keeps exactly one request in flight per intent — no queue, no auto-retry (LD-29)', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);

    void controller.request(ENVELOPE, SEEDED);
    void controller.request(ENVELOPE, EDITED);

    expect(calls).toHaveLength(2);
    expect(calls.filter((call) => !call.signal.aborted)).toHaveLength(1);
  });
});

describe('any change to recipient data invalidates the previous server result (§8.10)', () => {
  it('a confirmed result is unreadable for the edited payload', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const seededKey = previewKey(ENVELOPE, SEEDED);
    const editedKey = previewKey(ENVELOPE, EDITED);

    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.resolve(SEEDED_RESULT);
    await pending;

    // The user edits a signature count. No new request has been made.
    controller.syncKey(editedKey);

    // The panel asks for the CURRENT payload and gets nothing — it falls back
    // to the local estimate rather than showing figures for the old list.
    expect(controller.resultFor(editedKey)).toBeNull();
    expect(controller.resultFor(seededKey)).toEqual(SEEDED_RESULT);
  });

  it('an eMeterai change invalidates a CONFIRMED preview, exactly as a signature change does', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const seededKey = previewKey(ENVELOPE, SEEDED);
    const stampedKey = previewKey(ENVELOPE, STAMPED);

    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.resolve(SEEDED_RESULT);
    await pending;
    expect(controller.resultFor(seededKey)).toEqual(SEEDED_RESULT);

    // The user adds one duty stamp to Rina. No new request has been made.
    controller.syncKey(stampedKey);

    expect(controller.resultFor(stampedKey)).toBeNull();
    // ...and taking it off again reaches the server's own answer, unasked.
    controller.syncKey(seededKey);
    expect(controller.resultFor(seededKey)).toEqual(SEEDED_RESULT);
    expect(calls).toHaveLength(1);
  });

  it('an eMeterai change aborts a PENDING preview and drops its late answer', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const stampedKey = previewKey(ENVELOPE, STAMPED);

    const pending = controller.request(ENVELOPE, SEEDED);
    expect(calls[0]?.signal.aborted).toBe(false);

    controller.syncKey(stampedKey); // the eMeterai stepper moved
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(controller.getSnapshot().status).toBe('idle');

    calls[0]?.resolve(SEEDED_RESULT);
    await pending;
    await flush();

    expect(controller.getSnapshot().status).toBe('idle');
    expect(controller.resultFor(stampedKey)).toBeNull();
  });

  it('aborts an in-flight request when the data changes under it', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);

    void controller.request(ENVELOPE, SEEDED);
    controller.syncKey(previewKey(ENVELOPE, EDITED));

    expect(calls[0]?.signal.aborted).toBe(true);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('a response arriving after the data changed is dropped', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const editedKey = previewKey(ENVELOPE, EDITED);

    const pending = controller.request(ENVELOPE, SEEDED);
    controller.syncKey(editedKey);

    calls[0]?.resolve(SEEDED_RESULT);
    await pending;
    await flush();

    expect(controller.getSnapshot().status).toBe('idle');
    expect(controller.resultFor(editedKey)).toBeNull();
  });

  it('keying on the PAYLOAD, not a counter: editing back restores the server\'s own answer', async () => {
    // A monotonic request counter would have burned its sequence number and
    // thrown this away. The answer is still the server's answer for exactly
    // this input, so a payload hash correctly keeps it. This assertion is the
    // behavioural difference between the two designs.
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const seededKey = previewKey(ENVELOPE, SEEDED);
    const editedKey = previewKey(ENVELOPE, EDITED);

    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.resolve(SEEDED_RESULT);
    await pending;

    controller.syncKey(editedKey);
    expect(controller.resultFor(editedKey)).toBeNull();

    controller.syncKey(seededKey); // the user undoes the edit
    expect(controller.resultFor(seededKey)).toEqual(SEEDED_RESULT);
    expect(calls).toHaveLength(1); // and no second request was needed
  });
});

describe('failures are retryable and lose nothing (LD-28, LD-29)', () => {
  it('surfaces a 10 s timeout as the LD-28 message, filed under the current key', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const key = previewKey(ENVELOPE, SEEDED);

    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.reject(
      new ApiRequestError({
        code: 'REQUEST_TIMEOUT',
        message: UNREACHABLE_MESSAGE,
        status: 0,
        retryable: true,
      }),
    );
    await pending;

    expect(controller.errorFor(key)).toEqual({
      code: 'REQUEST_TIMEOUT',
      message: UNREACHABLE_MESSAGE,
      details: undefined,
    });
    // Nothing the user typed lives in this controller, so nothing can be lost:
    // the recipient rows are the reducer's, untouched by any of this.
    expect(controller.getSnapshot().result).toBeNull();
  });

  it('surfaces a server 422 with its code and details so the rows can be marked', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const key = previewKey(ENVELOPE, SEEDED);

    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.reject(
      new ApiRequestError({
        code: 'DUPLICATE_RECIPIENT_EMAIL',
        message: 'Duplicate recipient email',
        status: 422,
        details: { recipient_indexes: [0, 1] },
        retryable: false,
      }),
    );
    await pending;

    expect(controller.errorFor(key)?.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
    expect(controller.errorFor(key)?.details).toEqual({ recipient_indexes: [0, 1] });
  });

  it('surfaces ENVELOPE_NOT_FOUND rather than leaving a stale total on screen', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const key = previewKey(ENVELOPE, SEEDED);

    const first = controller.request(ENVELOPE, SEEDED);
    calls[0]?.resolve(SEEDED_RESULT);
    await first;

    const second = controller.request(ENVELOPE, SEEDED);
    calls[1]?.reject(
      new ApiRequestError({
        code: 'ENVELOPE_NOT_FOUND',
        message: 'Envelope not found',
        status: 404,
        retryable: false,
      }),
    );
    await second;

    expect(controller.getSnapshot().status).toBe('error');
    expect(controller.resultFor(key)).toBeNull();
  });

  it('retries only when asked, and only the last intent', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const key = previewKey(ENVELOPE, SEEDED);

    const first = controller.request(ENVELOPE, SEEDED);
    calls[0]?.reject(
      new ApiRequestError({ code: 'SERVER_ERROR', message: 'boom', status: 500, retryable: true }),
    );
    await first;
    expect(controller.errorFor(key)?.code).toBe('SERVER_ERROR');

    await flush();
    expect(calls).toHaveLength(1); // nothing re-issued itself

    const retried = controller.retry();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.key).toBe(key);

    calls[1]?.resolve(SEEDED_RESULT);
    await retried;
    expect(controller.resultFor(key)).toEqual(SEEDED_RESULT);
  });

  it('retry before any request is a no-op', async () => {
    const { transport, calls } = deferredTransport();
    await new PreviewController(transport).retry();
    expect(calls).toHaveLength(0);
  });

  it('never rejects to the caller — a failure has a rendered home, not a catch block', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);
    const pending = controller.request(ENVELOPE, SEEDED);
    calls[0]?.reject(new Error('unexpected'));
    await expect(pending).resolves.toBeUndefined();
    expect(controller.getSnapshot().error?.message).toBe(UNREACHABLE_MESSAGE);
  });
});

describe('dispose', () => {
  it('aborts in-flight work and forgets the result', async () => {
    const { transport, calls } = deferredTransport();
    const controller = new PreviewController(transport);

    void controller.request(ENVELOPE, SEEDED);
    controller.dispose();

    expect(calls[0]?.signal.aborted).toBe(true);
    expect(controller.getSnapshot().status).toBe('idle');
  });
});
