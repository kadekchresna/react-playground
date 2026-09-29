/**
 * Wire and domain types shared by `apps/server` and `apps/web`.
 *
 * Both sides import these, so a contract mismatch is a compile error instead of
 * a runtime surprise. Property names are the wire names (snake_case) wherever a
 * type crosses HTTP.
 *
 * Price and quota appear here only as *shapes*. Their values live in
 * `apps/server/src/config/account.ts` and reach the browser exclusively through
 * a server response (ADR-003).
 */

import type { ErrorCode, ValidationFailureDetails } from './errors.js';

/** A monetary value on the wire: a decimal string with exactly 2 fraction digits. */
export type Money = string;

/**
 * Per-resource price table. One key in Case 1 (seam S2) — it is a record rather
 * than a scalar so a second priced line is an added key, not a signature change.
 */
export interface PriceRecord {
  readonly signature: Money;
}

/** Per-resource allowance, in units of that resource. */
export interface QuotaRecord {
  readonly signature: number;
}

/** Per-resource money lines making up a total. */
export interface ChargeRecord {
  readonly signature: Money;
}

/** One recipient exactly as it crosses the wire. */
export interface RecipientInput {
  name: string;
  email: string;
  signature_count: number;
}

/** A recipient row as the UI holds it: wire fields plus a stable local id. */
export interface Recipient extends RecipientInput {
  readonly id: string;
}

/** Document metadata retained after the bytes are discarded (ADR-002, PRD §7.10). */
export interface EnvelopeMeta {
  readonly filename: string;
  readonly size_bytes: number;
  readonly page_count: number;
}

/** `201` body of `POST /api/envelopes`. Carries the server-sourced price and quota. */
export interface EnvelopeCreatedResponse {
  readonly envelope_id: string;
  readonly document: EnvelopeMeta;
  readonly price: PriceRecord;
  readonly quota: QuotaRecord;
}

/**
 * Request body of `POST /api/envelopes/:id/charge-preview`.
 *
 * This is the complete accepted surface. Anything else — a client-supplied
 * `total_charge`, `price` or `quota` — is rejected with `UNKNOWN_FIELD` rather
 * than ignored (PRD §9).
 */
export interface ChargePreviewRequest {
  recipients: RecipientInput[];
}

/** `200` body of `POST /api/envelopes/:id/charge-preview`. The server's total is final. */
export interface ChargePreviewResponse {
  readonly recipient_count: number;
  readonly total_signatures: number;
  readonly price: PriceRecord;
  readonly charges: ChargeRecord;
  readonly total_charge: Money;
  readonly quota: QuotaRecord;
  /** Clamped at 0, never negative (LD-17). */
  readonly quota_remaining: QuotaRecord;
}

/** The single error envelope every non-2xx response uses. */
export interface ApiError {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: ValidationFailureDetails;
  };
}
