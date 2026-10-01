/**
 * The error vocabulary shared by both layers.
 *
 * Every rejection the system can emit is one of these 14 codes. The frontend
 * branches on `code`, never on `message`, so messages stay free to change while
 * behaviour does not. `details` is additive and optional (LD-26): it carries
 * enough to mark the offending row, and nothing else.
 *
 * Case 2 adds the three e-meterai codes (`test_2_en.md` §B5, priority P1). The
 * remaining Case-2 codes — the signing-order ones (P2), the field-placement
 * ones (P3) and the two `409`s (P4) — are deliberately ABSENT: this list is
 * "every rejection the system can emit", so a code without a rule behind it
 * would be a lie the frontend could branch on.
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
  'UNKNOWN_FIELD',
  'ENVELOPE_NOT_FOUND',
] as const satisfies readonly ErrorCode[];

/** Additive, optional locators. Never load-bearing on its own (LD-26). */
export interface ValidationFailureDetails {
  /** Index of the single offending recipient. */
  readonly recipient_index?: number;
  /** Every index in a colliding email group. */
  readonly recipient_indexes?: number[];
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
