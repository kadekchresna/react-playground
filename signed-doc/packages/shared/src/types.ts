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
 * Per-resource price table. Seam S2 paid off here: Case 2's second priced line
 * (`test_2_en.md` §A3.6) is an added key, not a signature change on every
 * caller. The values themselves still live only on the server (ADR-003).
 */
export interface PriceRecord {
  readonly signature: Money;
  readonly meterai: Money;
}

/** Per-resource allowance, in units of that resource. Independent per §A3.5. */
export interface QuotaRecord {
  readonly signature: number;
  readonly meterai: number;
}

/** Per-resource money lines making up a total (§A3.7 shows them separately). */
export interface ChargeRecord {
  readonly signature: Money;
  readonly meterai: Money;
}

/**
 * One recipient exactly as it crosses the wire.
 *
 * `meterai_count` is an integer 0-3 (§B1) that may not exceed this recipient's
 * `signature_count` (§A3.2). It is REQUIRED in the type because every producer
 * in this system sets it; at runtime an absent value is read as the documented
 * default of `0` rather than rejected, so a payload written before Case 2 still
 * means what it meant. A present-but-malformed value is `METERAI_COUNT_INVALID`
 * — absence is a default, `null` or `"2"` is a mistake.
 */
export interface RecipientInput {
  name: string;
  email: string;
  signature_count: number;
  meterai_count: number;
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
  /** `test_2_en.md` §B4. Counted the same way `total_signatures` is. */
  readonly total_meterai: number;
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
