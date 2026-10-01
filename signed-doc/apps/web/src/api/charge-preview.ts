/**
 * `POST /api/envelopes/:id/charge-preview` — the authoritative total (PRD §8.9).
 *
 * The request carries **only**
 * `{ recipients: [{ name, email, signature_count, meterai_count }] }`
 * (`test_2_en.md` §B4 adds the fourth key; P2's `step` and P3's `fields` are
 * not sent, because this build does not have them).
 * Price, quota and any total are the server's to source (ADR-003, PRD §9), and
 * the server rejects a client that proposes them with `422 UNKNOWN_FIELD` —
 * so sending one would not merely be ignored, it would break the request.
 *
 * `toWireRecipients` is the one place the body is shaped, which is what makes
 * "the client never proposes a commercial value" assertable in a unit test
 * rather than only reviewable by eye.
 */

import type { ChargePreviewRequest, ChargePreviewResponse, RecipientInput } from '@signed-doc/shared';

import { request } from './client.js';

/** LD-28. */
export const CHARGE_PREVIEW_TIMEOUT_MS = 10_000;

export function chargePreviewPath(envelopeId: string): string {
  return `/api/envelopes/${encodeURIComponent(envelopeId)}/charge-preview`;
}

/**
 * Project UI rows onto the wire shape, dropping every local-only field (the
 * row id, the in-progress `countRaw` text) and adding nothing.
 */
export function toWireRecipients(
  recipients: readonly RecipientInput[],
): RecipientInput[] {
  return recipients.map((r) => ({
    name: r.name,
    email: r.email,
    signature_count: r.signature_count,
    // Sent raw, never repaired here: a count the server would refuse must
    // reach the server, or §B7.4's `422` becomes unreachable from the UI.
    meterai_count: r.meterai_count,
  }));
}

export function buildChargePreviewBody(
  recipients: readonly RecipientInput[],
): ChargePreviewRequest {
  return { recipients: toWireRecipients(recipients) };
}

export function fetchChargePreview(
  envelopeId: string,
  recipients: readonly RecipientInput[],
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChargePreviewResponse> {
  return request<ChargePreviewResponse>(
    chargePreviewPath(envelopeId),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildChargePreviewBody(recipients)),
    },
    {
      timeoutMs: CHARGE_PREVIEW_TIMEOUT_MS,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
    },
  );
}
