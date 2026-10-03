/**
 * `POST /api/envelopes/:id/charge-preview` — the authoritative total (PRD §8.9).
 *
 * The request carries **only** `order_mode`,
 * `recipients: [{ name, email, signature_count, meterai_count, step? }]` and —
 * from Step 3 onwards — `fields` (`test_2_en.md` §B4). Price, quota and any
 * total are the server's to source (ADR-003, PRD §9), and the server rejects a
 * client that proposes them with `422 UNKNOWN_FIELD` — so sending one would not
 * merely be ignored, it would break the request.
 *
 * **`fields` is absent or it is a real collection; it is never `[]` by
 * accident.** §B4 makes the optionality load-bearing in both directions:
 * ABSENT means "no field collection was submitted", which is the Step-2
 * preview, and the whole reconciliation invariant is vacuous for it. PRESENT
 * means Step 3, and `fields: []` is then a document where nothing has been
 * placed — which a recipient who asked for a signature makes invalid with `422
 * FIELD_COUNT_MISMATCH`. So the body builder OMITS THE KEY ENTIRELY when it was
 * given no collection rather than defaulting to an empty array: sending `[]`
 * from Step 2 would turn every working Case-1/P1/P2 preview into a rejection.
 *
 * **`step` is a function of the mode, not of the data.** §B4 is explicit and
 * asymmetric: in `sequential` every recipient carries one, and in `parallel`
 * sending one at all is `422 UNKNOWN_FIELD` (§B7 row 9). So the body builder
 * takes the mode and branches on it, rather than forwarding whatever a row
 * happens to hold — a row that still had a stale `step` must not be able to
 * break a parallel preview.
 *
 * `order_mode` is sent in BOTH modes, although §B4 lets a parallel body omit
 * it. The client has a mode selector now; echoing the user's explicit choice
 * costs one key and means the request never relies on the server and the
 * browser agreeing about what the default is. The response echoes the resolved
 * mode back, so the two can be compared.
 *
 * `toWireRecipients` is the one place the body is shaped, which is what makes
 * "the client never proposes a commercial value" assertable in a unit test
 * rather than only reviewable by eye.
 */

import {
  DEFAULT_ORDER_MODE,
  stepOf,
  type ChargePreviewRequest,
  type ChargePreviewResponse,
  type FieldInput,
  type OrderMode,
  type RecipientInput,
} from '@signed-doc/shared';

import { request } from './client.js';

/** LD-28. */
export const CHARGE_PREVIEW_TIMEOUT_MS = 10_000;

export function chargePreviewPath(envelopeId: string): string {
  return `/api/envelopes/${encodeURIComponent(envelopeId)}/charge-preview`;
}

/**
 * Project UI rows onto the wire shape, dropping every local-only field (the
 * row id, the in-progress `countRaw` text) and adding nothing the mode does not
 * call for.
 *
 * The mode defaults to `parallel` so a caller that has no mode to give sends
 * exactly the Case-1 four keys — the same default §A2 and the kernel use.
 */
export function toWireRecipients(
  recipients: readonly RecipientInput[],
  orderMode: OrderMode = DEFAULT_ORDER_MODE,
): RecipientInput[] {
  return recipients.map((r) => {
    const wire: RecipientInput = {
      name: r.name,
      email: r.email,
      signature_count: r.signature_count,
      // Sent raw, never repaired here: a count the server would refuse must
      // reach the server, or §B7.4's `422` becomes unreachable from the UI.
      meterai_count: r.meterai_count,
    };
    // §B4 / §B7.9: present in `sequential`, absent in `parallel`. Read through
    // the kernel, so a row mid-edit sends step 1 rather than `undefined`.
    return orderMode === 'sequential' ? { ...wire, step: stepOf(r) } : wire;
  });
}

/**
 * Project placed fields onto the §B3 wire shape — exactly `id`, `kind`,
 * `recipient_email`, `page`, `x` and `y`, in that order, and nothing else.
 *
 * The twin of `toWireRecipients`, and for the same reason: this is the one
 * place a field becomes a payload, so "the client never sends a local-only
 * key" is a property a unit test can hold.
 *
 * Nothing is repaired here. A coordinate the server would refuse must reach the
 * server unchanged, or §B7.15/§B7.16's `422 FIELD_OUT_OF_BOUNDS` becomes
 * unreachable. The UI's clamping happens where the box is placed or moved
 * (`clampFieldPosition`), not on the way out.
 */
export function toWireFields(fields: readonly FieldInput[]): FieldInput[] {
  return fields.map((f) => ({
    id: f.id,
    kind: f.kind,
    recipient_email: f.recipient_email,
    page: f.page,
    x: f.x,
    y: f.y,
  }));
}

/**
 * The body, with `fields` present only when a collection was given.
 *
 * `fields === undefined` is Step 2 and the key is OMITTED — see the file
 * header. An empty array passed deliberately is kept as `[]`, because that is a
 * real Step 3 with nothing placed and the server is supposed to say so.
 */
export function buildChargePreviewBody(
  recipients: readonly RecipientInput[],
  orderMode: OrderMode = DEFAULT_ORDER_MODE,
  fields?: readonly FieldInput[],
): ChargePreviewRequest {
  const body: ChargePreviewRequest = {
    order_mode: orderMode,
    recipients: toWireRecipients(recipients, orderMode),
  };
  return fields === undefined ? body : { ...body, fields: toWireFields(fields) };
}

export function fetchChargePreview(
  envelopeId: string,
  recipients: readonly RecipientInput[],
  orderMode: OrderMode = DEFAULT_ORDER_MODE,
  options: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    /** §B4 — Step 3 only. Absent means "no collection submitted". */
    fields?: readonly FieldInput[];
  } = {},
): Promise<ChargePreviewResponse> {
  return request<ChargePreviewResponse>(
    chargePreviewPath(envelopeId),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildChargePreviewBody(recipients, orderMode, options.fields)),
    },
    {
      timeoutMs: CHARGE_PREVIEW_TIMEOUT_MS,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
    },
  );
}
