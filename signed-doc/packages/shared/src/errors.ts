/**
 * The error vocabulary shared by both layers.
 *
 * Every rejection the system can emit is one of these 22 codes. The frontend
 * branches on `code`, never on `message`, so messages stay free to change while
 * behaviour does not. `details` is additive and optional (LD-26): it carries
 * enough to mark the offending row or box, and nothing else.
 *
 * Case 2 adds the three e-meterai codes (`test_2_en.md` §B5, priority P1), the
 * three signing-order ones (§A2, §A3.3 — P2) and the five field-placement ones
 * (§A4, §B2, §B3 — P3). The two `409`s P4 would add are deliberately ABSENT:
 * this list is "every rejection the system can emit", so a code without a rule
 * behind it would be a lie the frontend could branch on.
 *
 * The five P3 codes are exactly the five §B5 names, and each owns a whole
 * DOMAIN of failure rather than a single sentence — §B5 gives no sixth code, so
 * inventing one would break the contract two layers branch on:
 *
 *   - `FIELD_ID_DUPLICATE`      — the field's identity is not usable: repeated,
 *                                 blank, or not a string. §B3 requires `id` to
 *                                 be unique, and an id that is absent cannot be
 *                                 shown to be.
 *   - `FIELD_PAGE_INVALID`      — `page` is not `1` (§B3), including absent and
 *                                 non-integer. Page 1 only (§A4.7).
 *   - `FIELD_OUT_OF_BOUNDS`     — the field cannot be placed at that position:
 *                                 outside the kind's §B2 range, not a whole
 *                                 number, or of a `kind` that has no geometry.
 *   - `FIELD_UNKNOWN_RECIPIENT` — the owner is not in the recipient list, or
 *                                 there is no owner at all (§A4.10).
 *   - `FIELD_COUNT_MISMATCH`    — placed != promised, in either direction
 *                                 (§A4.9, §B7.10/§B7.11).
 *
 * `INSUFFICIENT_SIGNATURE_QUOTA` and `INSUFFICIENT_METERAI_QUOTA` are separate
 * codes on purpose (§A3.5): the two quotas are independent, and a client must
 * be able to tell which one it ran out of without parsing a message.
 */

export type ErrorCode =
  // Upload (PRD §7)
  | 'FILE_REQUIRED'
  | 'FILE_TYPE_NOT_ALLOWED'
  | 'FILENAME_INVALID'
  | 'FILE_TOO_LARGE'
  // Recipients (PRD §8)
  | 'RECIPIENT_COUNT_INVALID'
  | 'SIGNATURE_COUNT_INVALID'
  | 'RECIPIENT_INVALID'
  | 'DUPLICATE_RECIPIENT_EMAIL'
  | 'INSUFFICIENT_SIGNATURE_QUOTA'
  // E-meterai (`test_2_en.md` §A3, §B5 — Case 2 P1)
  | 'METERAI_COUNT_INVALID'
  | 'METERAI_EXCEEDS_SIGNATURE'
  | 'INSUFFICIENT_METERAI_QUOTA'
  // Signing order (`test_2_en.md` §A2, §A3.3, §B5 — Case 2 P2)
  | 'ORDER_MODE_INVALID'
  | 'STEP_SEQUENCE_INVALID'
  | 'METERAI_NOT_IN_FIRST_STEP'
  // Field placement (`test_2_en.md` §A4, §B2, §B3, §B5 — Case 2 P3)
  | 'FIELD_ID_DUPLICATE'
  | 'FIELD_PAGE_INVALID'
  | 'FIELD_OUT_OF_BOUNDS'
  | 'FIELD_UNKNOWN_RECIPIENT'
  | 'FIELD_COUNT_MISMATCH'
  // Request-level (PRD §9)
  | 'UNKNOWN_FIELD'
  | 'ENVELOPE_NOT_FOUND';

/** Every member of `ErrorCode`, for runtime membership checks. */
export const ERROR_CODES = [
  'FILE_REQUIRED',
  'FILE_TYPE_NOT_ALLOWED',
  'FILENAME_INVALID',
  'FILE_TOO_LARGE',
  'RECIPIENT_COUNT_INVALID',
  'SIGNATURE_COUNT_INVALID',
  'RECIPIENT_INVALID',
  'DUPLICATE_RECIPIENT_EMAIL',
  'INSUFFICIENT_SIGNATURE_QUOTA',
  'METERAI_COUNT_INVALID',
  'METERAI_EXCEEDS_SIGNATURE',
  'INSUFFICIENT_METERAI_QUOTA',
  'ORDER_MODE_INVALID',
  'STEP_SEQUENCE_INVALID',
  'METERAI_NOT_IN_FIRST_STEP',
  'FIELD_ID_DUPLICATE',
  'FIELD_PAGE_INVALID',
  'FIELD_OUT_OF_BOUNDS',
  'FIELD_UNKNOWN_RECIPIENT',
  'FIELD_COUNT_MISMATCH',
  'UNKNOWN_FIELD',
  'ENVELOPE_NOT_FOUND',
] as const satisfies readonly ErrorCode[];

/** Additive, optional locators. Never load-bearing on its own (LD-26). */
export interface ValidationFailureDetails {
  /** Index of the single offending recipient. */
  readonly recipient_index?: number;
  /** Every index in a colliding email group. */
  readonly recipient_indexes?: number[];
  /**
   * The offending recipient's normalized email. Added for §A3.3, where the
   * reason must appear on screen pointing at that recipient — an index alone is
   * enough to mark a row, but not enough to word a sentence about one.
   */
  readonly recipient_email?: string;
  /**
   * The offending field's `id`. Added for §A4 (P3), where a rejection must be
   * renderable as a marker on ONE placed box — §B7.11's excess field and
   * §B7.18's colliding id are both "that box there", not "the form".
   *
   * Omitted when no single field is at fault: a per-recipient SHORTFALL
   * (§B7.10) has no box to point at yet, so naming one would be a lie.
   */
  readonly field_id?: string;
  /**
   * The offending field's position in the submitted `fields` array. Carried
   * alongside `field_id` because an id can itself be the thing that is broken
   * (blank, or shared with another field), and an index is unambiguous even
   * then.
   */
  readonly field_index?: number;
  /** The unexpected request property that was rejected. */
  readonly field?: string;
}

/**
 * A rule rejection. Returned — not thrown — by every rule in this package, so
 * callers cannot forget to handle it and a failure is never mistaken for
 * control flow.
 */
export interface ValidationFailure {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: ValidationFailureDetails;
}

/** Construct a failure. `details` is omitted entirely when empty. */
export function validationFailure(
  code: ErrorCode,
  message: string,
  details?: ValidationFailureDetails,
): ValidationFailure {
  return details === undefined ? { code, message } : { code, message, details };
}

/**
 * Narrow a rule's `Result | ValidationFailure` union.
 *
 * Checks the code against `ERROR_CODES` rather than merely probing for a `code`
 * property, so a success value that happens to carry `code` is not mistaken for
 * a failure.
 */
export function isValidationFailure(value: unknown): value is ValidationFailure {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string' &&
    (ERROR_CODES as readonly string[]).includes(candidate.code)
  );
}
