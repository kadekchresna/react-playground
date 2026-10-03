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
 * `test_2_en.md` §A2 — how the recipients are invited.
 *
 * `parallel` is the default and is exactly the Case-1 behaviour: everyone is
 * invited at once. `sequential` groups them into steps, and the next step is
 * only invited once every recipient in the previous one is done.
 */
export type OrderMode = 'parallel' | 'sequential';

/**
 * One entry of §B4's `steps` projection: a step number and the recipients
 * invited together in it. Several recipients sharing a step is the normal case,
 * not an edge one (§A2.2) — within a step they sign in parallel.
 *
 * Emails are normalized (trimmed, lowercased), the same form every other
 * comparison in this kernel uses.
 */
export interface StepGroup {
  readonly step: number;
  readonly recipient_emails: readonly string[];
}

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
 *
 * `step` is OPTIONAL because its presence is a function of the mode (§A2.1,
 * §B4): in `sequential` every recipient has one, an integer >= 1; in `parallel`
 * it must not be sent at all, and a payload that sends one is rejected with
 * `UNKNOWN_FIELD` by the server's request allow-list rather than by a rule in
 * the kernel. Optionality is therefore the honest type — a required `step`
 * would make the legal parallel payload unexpressible.
 */
export interface RecipientInput {
  name: string;
  email: string;
  signature_count: number;
  meterai_count: number;
  step?: number;
}

/** A recipient row as the UI holds it: wire fields plus a stable local id. */
export interface Recipient extends RecipientInput {
  readonly id: string;
}

/**
 * `test_2_en.md` §B3 — what kind of box a placed field is.
 *
 * The kind is also the field's GEOMETRY: `signature` is `212 x 88` and
 * `meterai` is `112 x 112` (§B2), so the legal coordinate range differs per
 * kind. There is no shared box.
 */
export type FieldKind = 'signature' | 'meterai';

/**
 * One placed field exactly as it crosses the wire (§B3).
 *
 * `x`/`y` are the field's TOP-LEFT coordinates relative to the `632 x 588`
 * content area, not the viewport, and they are integers. `page` is required and
 * must be `1` — multi-page documents are out of scope (§A4.7, §B9).
 * `recipient_email` is compared after trimming, case-insensitively, the one way
 * this kernel ever compares an email. `id` must be unique across the list; it
 * is the handle a rejection points at (`details.field_id`) and the handle the
 * UI's remove button carries (§A4.4).
 *
 * Every property is REQUIRED: unlike `meterai_count`, no field property has a
 * documented default, and a box with no position or no owner is not a box that
 * was placed. The whole COLLECTION is what is optional (see
 * `ChargePreviewRequest.fields`).
 */
export interface FieldInput {
  id: string;
  kind: FieldKind;
  recipient_email: string;
  page: number;
  x: number;
  y: number;
}

/** A placed field as the UI holds it. The wire shape already carries its id. */
export type Field = FieldInput;

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
  /**
   * §B4. Optional on the wire: a body without it means `parallel`, which is
   * what every Case-1 payload meant. Present-but-outside the two modes is
   * `ORDER_MODE_INVALID`, never a silent fallback.
   */
  order_mode?: OrderMode;
  recipients: RecipientInput[];
  /**
   * §B4. OPTIONAL on the wire, and the optionality is load-bearing in both
   * directions:
   *
   * - ABSENT means "no field collection was submitted" — the Step-2 preview,
   *   where no box has been placed yet and §A4.9 has nothing to compare. Every
   *   Case-1 and P1/P2 payload is that shape, and it must keep validating. The
   *   field rules are vacuous for it, exactly as the step rules are vacuous in
   *   `parallel`.
   * - PRESENT means Step 3, and the reconciliation invariant binds. `fields: []`
   *   is therefore NOT the same as absence: it is a document where nothing has
   *   been placed, and a recipient who asked for a signature makes it invalid
   *   with `FIELD_COUNT_MISMATCH`.
   *
   * Anything present that is not an array is a mistake rather than a default —
   * the same stance `meterai_count: null` already takes — and is read as an
   * empty list, which the reconciliation stage then refuses.
   */
  fields?: FieldInput[];
}

/** `200` body of `POST /api/envelopes/:id/charge-preview`. The server's total is final. */
export interface ChargePreviewResponse {
  /** §B4. Echoed back resolved, so the client never has to infer the default. */
  readonly order_mode: OrderMode;
  /**
   * §B4. Always present, in both modes: in `parallel` it is the single group
   * §A3.4 says a parallel document is, so a consumer has one shape to render
   * rather than two.
   */
  readonly steps: readonly StepGroup[];
  readonly recipient_count: number;
  readonly total_signatures: number;
  /** `test_2_en.md` §B4. Counted the same way `total_signatures` is. */
  readonly total_meterai: number;
  /**
   * §B4 — how many fields the accepted request carried.
   *
   * Reported as what was SENT, never as what the counts required: a `200` only
   * happens once §A4.9 holds, so on a success the two agree, and the figure is
   * there to confirm the server read the same collection the client sent rather
   * than to restate the counts. Always present, including for a payload that
   * sent no `fields` at all, where it is `0`.
   */
  readonly field_count: number;
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
