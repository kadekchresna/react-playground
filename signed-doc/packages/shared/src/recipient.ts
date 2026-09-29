/**
 * Recipient rules — the one shared validation module PRD §8.5 demands.
 *
 * Both layers import this file, which is what makes rule drift impossible
 * rather than merely discouraged. The frontend runs it for UX; the server runs
 * it to decide (PRD §7.3).
 *
 * Two deliberate asymmetries:
 *
 * 1. `clampSignatureCount` (frontend) repairs input so state can never hold
 *    `NaN`/`undefined` (PRD §8.3); `isValidSignatureCount` (backend) refuses it
 *    without coercion. A single "helpful" function would let a hostile client
 *    have `"abc"` quietly corrected instead of rejected.
 * 2. `validateRecipientList` is an ordered array of named stages that
 *    short-circuits on the first failure (seam S3), not an `if` chain. The
 *    order IS the contract (PRD §9), so it is data, and it is asserted in the
 *    test suite.
 */

import { validationFailure, type ValidationFailure } from './errors.js';
import type { RecipientInput } from './types.js';

export type { RecipientInput } from './types.js';

/** PRD §6. */
export const MIN_RECIPIENTS = 1;
export const MAX_RECIPIENTS = 10;
export const MIN_SIGNATURE_COUNT = 1;
export const MAX_SIGNATURE_COUNT = 20;

/**
 * Backend rule: an integer 1..20 and nothing else. No coercion, so `"3"`,
 * `true` and `{ valueOf: () => 2 }` are all false.
 */
export function isValidSignatureCount(raw: unknown): boolean {
  return (
    typeof raw === 'number' &&
    Number.isInteger(raw) &&
    raw >= MIN_SIGNATURE_COUNT &&
    raw <= MAX_SIGNATURE_COUNT
  );
}

/** Whole, optionally signed, no decimal point — what a number input can emit. */
const INTEGER_TEXT = /^[+-]?\d+$/;

/**
 * Frontend rule: always returns a usable integer in 1..20 (PRD §8.3).
 *
 * - An integer outside the range is CLAMPED to the nearest bound.
 * - Anything that is not an integer (mid-typing `""`, `"abc"`, `2.5`, `null`)
 *   leaves the committed value alone by returning `previous`.
 * - A corrupted `previous` is itself repaired, so the result is never `NaN`
 *   or `undefined` no matter how the caller got into that state.
 */
export function clampSignatureCount(raw: unknown, previous: number): number {
  const fallback = isValidSignatureCount(previous) ? previous : MIN_SIGNATURE_COUNT;

  let candidate: number;
  if (typeof raw === 'number') {
    candidate = raw;
  } else if (typeof raw === 'string' && INTEGER_TEXT.test(raw.trim())) {
    candidate = Number(raw.trim());
  } else {
    return fallback;
  }

  if (!Number.isInteger(candidate)) return fallback;
  if (candidate < MIN_SIGNATURE_COUNT) return MIN_SIGNATURE_COUNT;
  if (candidate > MAX_SIGNATURE_COUNT) return MAX_SIGNATURE_COUNT;
  return candidate;
}

/** Trim + lowercase. The only comparison form for emails (PRD §8.4). */
export function normalizeEmail(raw: string): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Structural email check: exactly one at-sign, a non-empty local part, and a
 * domain of at least two non-empty dot-separated labels.
 *
 * Deliberately structural rather than RFC-complete — the goal is to catch the
 * typo the user just made, not to adjudicate the grammar of every legal
 * address.
 */
function isValidEmail(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const email = raw.trim();
  if (email === '' || /\s/.test(email)) return false;

  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;

  const domain = email.slice(at + 1);
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) => label.length > 0);
}

/**
 * One recipient, checked in the fixed order signature_count -> name -> email
 * (LD-24). First failure wins, so the response names one cause, not a list.
 */
export function validateRecipient(r: RecipientInput, index: number): ValidationFailure | null {
  const candidate: Partial<RecipientInput> =
    typeof r === 'object' && r !== null ? r : ({} as Partial<RecipientInput>);

  if (!isValidSignatureCount(candidate.signature_count)) {
    return validationFailure(
      'SIGNATURE_COUNT_INVALID',
      `signature_count must be an integer between ${MIN_SIGNATURE_COUNT} and ${MAX_SIGNATURE_COUNT}`,
      { recipient_index: index },
    );
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    return validationFailure('RECIPIENT_INVALID', 'Full name is required', {
      recipient_index: index,
    });
  }

  if (!isValidEmail(candidate.email)) {
    return validationFailure('RECIPIENT_INVALID', 'Enter a valid email address', {
      recipient_index: index,
    });
  }

  return null;
}

/**
 * Index groups that share a normalized email, in first-occurrence order.
 * Groups of one are not duplicates and are not reported. Blank emails are
 * skipped — they are already a per-recipient failure, and reporting them as
 * "duplicates of each other" would mark the wrong cause.
 */
export function findDuplicateEmailGroups(rs: readonly RecipientInput[]): readonly number[][] {
  if (!Array.isArray(rs)) return [];

  const byEmail = new Map<string, number[]>();
  rs.forEach((r, index) => {
    const email = normalizeEmail((r as Partial<RecipientInput>)?.email as string);
    if (email === '') return;
    const bucket = byEmail.get(email);
    if (bucket) bucket.push(index);
    else byEmail.set(email, [index]);
  });

  const groups: number[][] = [];
  for (const indexes of byEmail.values()) {
    if (indexes.length > 1) groups.push(indexes);
  }
  return groups;
}

/**
 * A named step in the recipient-list pipeline (seam S3).
 *
 * Adding a rule is inserting an entry in `RECIPIENT_LIST_STAGES`; it is never
 * an edit to `validateRecipientList` itself.
 */
export interface RecipientListStage {
  readonly name: string;
  readonly run: (recipients: readonly RecipientInput[]) => ValidationFailure | null;
}

function recipientCountInvalid(): ValidationFailure {
  return validationFailure(
    'RECIPIENT_COUNT_INVALID',
    `A document needs between ${MIN_RECIPIENTS} and ${MAX_RECIPIENTS} recipients`,
  );
}

const countStage: RecipientListStage = {
  name: 'count',
  run: (recipients) =>
    recipients.length < MIN_RECIPIENTS || recipients.length > MAX_RECIPIENTS
      ? recipientCountInvalid()
      : null,
};

const perRecipientStage: RecipientListStage = {
  name: 'per-recipient',
  run: (recipients) => {
    for (let index = 0; index < recipients.length; index += 1) {
      const failure = validateRecipient(recipients[index] as RecipientInput, index);
      if (failure) return failure;
    }
    return null;
  },
};

const duplicateStage: RecipientListStage = {
  name: 'duplicates',
  run: (recipients) => {
    const [first] = findDuplicateEmailGroups(recipients);
    return first
      ? validationFailure('DUPLICATE_RECIPIENT_EMAIL', 'Duplicate recipient email', {
          recipient_indexes: [...first],
        })
      : null;
  },
};

/** Case 1 registers three stages. Case 2 inserts more; the runner never changes. */
export const RECIPIENT_LIST_STAGES: readonly RecipientListStage[] = [
  countStage,
  perRecipientStage,
  duplicateStage,
];

/** Run a stage list, short-circuiting on the first failure. */
export function runRecipientStages(
  recipients: readonly RecipientInput[],
  stages: readonly RecipientListStage[] = RECIPIENT_LIST_STAGES,
): ValidationFailure | null {
  for (const stage of stages) {
    const failure = stage.run(recipients);
    if (failure) return failure;
  }
  return null;
}

/**
 * Validate a whole recipient list: count -> per-recipient -> duplicates.
 *
 * Takes `unknown` because the server hands it a parsed request body. A payload
 * that is not an array fails the same way an empty one does — there is no list
 * to count.
 */
export function validateRecipientList(rs: unknown): ValidationFailure | null {
  if (!Array.isArray(rs)) return recipientCountInvalid();
  return runRecipientStages(rs as readonly RecipientInput[]);
}
