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
 *    have `"abc"` quietly corrected instead of rejected. Case 2's eMeterai
 *    stepper repeats the pair exactly — `clampMeteraiCount` /
 *    `isValidMeteraiCount` — rather than inventing a third convention.
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
 * `test_2_en.md` §B1: `meterai_count` per recipient is an integer `0`-`3`.
 *
 * This is a VALIDATION RULE, which is why it lives here beside
 * `MIN/MAX_SIGNATURE_COUNT`. The meterai PRICE and the account's meterai QUOTA
 * are commercial terms and are nowhere in this package (ADR-003) — that the
 * quota happens to also be `3` is a coincidence of the fixture, not a shared
 * constant: one bounds a single row, the other bounds a whole document.
 */
export const MIN_METERAI_COUNT = 0;
export const MAX_METERAI_COUNT = 3;

/**
 * Backend rule: an integer 1..20 and nothing else. No coercion, so `"3"`,
 * `true` and `{ valueOf: () => 2 }` are all false.
 */
export function isValidSignatureCount(raw: unknown): boolean {
  return isIntegerWithin(raw, MIN_SIGNATURE_COUNT, MAX_SIGNATURE_COUNT);
}

/**
 * Backend rule for e-meterai: an integer 0..3 and nothing else (§B1).
 *
 * Strict in exactly the way `isValidSignatureCount` is — `undefined` is NOT
 * valid here. Absence is handled one level up, by `meteraiCountOf` and by
 * `validateRecipient`, which apply §B1's documented default of `0`.
 */
export function isValidMeteraiCount(raw: unknown): boolean {
  return isIntegerWithin(raw, MIN_METERAI_COUNT, MAX_METERAI_COUNT);
}

function isIntegerWithin(raw: unknown, min: number, max: number): boolean {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max;
}

/** Whole, optionally signed, no decimal point — what a number input can emit. */
const INTEGER_TEXT = /^[+-]?\d+$/;

/**
 * The one coercion shared by both steppers: always returns a usable integer in
 * `min..max` (PRD §8.3).
 *
 * - An integer outside the range is CLAMPED to the nearest bound.
 * - Anything that is not an integer (mid-typing `""`, `"abc"`, `2.5`, `null`)
 *   leaves the committed value alone by returning `previous`.
 * - A corrupted `previous` is itself repaired to `min`, so the result is never
 *   `NaN` or `undefined` no matter how the caller got into that state.
 */
function clampCount(raw: unknown, previous: unknown, min: number, max: number): number {
  const fallback = isIntegerWithin(previous, min, max) ? (previous as number) : min;

  let candidate: number;
  if (typeof raw === 'number') {
    candidate = raw;
  } else if (typeof raw === 'string' && INTEGER_TEXT.test(raw.trim())) {
    candidate = Number(raw.trim());
  } else {
    return fallback;
  }

  if (!Number.isInteger(candidate)) return fallback;
  if (candidate < min) return min;
  if (candidate > max) return max;
  return candidate;
}

/** Frontend rule: always returns a usable integer in 1..20 (PRD §8.3). */
export function clampSignatureCount(raw: unknown, previous: number): number {
  return clampCount(raw, previous, MIN_SIGNATURE_COUNT, MAX_SIGNATURE_COUNT);
}

/**
 * Frontend rule for the eMeterai stepper: always an integer in 0..3 (§A3, §B1).
 *
 * Deliberately NOT clamped against the row's `signature_count`. §A3.2 is a rule
 * the user must be told about (§B7.4 marks that row and the server answers
 * `422 METERAI_EXCEEDS_SIGNATURE`); a stepper that silently capped itself would
 * make that state unreachable and the rule invisible.
 */
export function clampMeteraiCount(raw: unknown, previous: number): number {
  return clampCount(raw, previous, MIN_METERAI_COUNT, MAX_METERAI_COUNT);
}

/**
 * A row's signature count as arithmetic can use it.
 *
 * The frontend recomputes totals on every keystroke, so a row can be mid-edit
 * and invalid. Such a row contributes 0 instead of poisoning a total with
 * `NaN`; the row is separately marked invalid by `validateRecipient`, and the
 * server refuses the request outright.
 */
export function signatureCountOf(r: RecipientInput): number {
  const count = (r as Partial<RecipientInput> | null)?.signature_count;
  return isValidSignatureCount(count) ? (count as number) : 0;
}

/**
 * A row's meterai count as arithmetic can use it.
 *
 * Same contract as `signatureCountOf`, plus §B1's default: an ABSENT
 * `meterai_count` is `0`, which is also what an invalid one contributes.
 */
export function meteraiCountOf(r: RecipientInput): number {
  const count = (r as Partial<RecipientInput> | null)?.meterai_count;
  return isValidMeteraiCount(count) ? (count as number) : 0;
}

/**
 * §A3.2 — one duty stamp sits next to one signature, so a recipient may carry
 * at most as many meterai as they have signatures. Equality is legal; it is the
 * boundary, not the failure.
 */
export function meteraiWithinSignatures(r: RecipientInput): boolean {
  return meteraiCountOf(r) <= signatureCountOf(r);
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
 * One recipient, checked in the fixed order
 * signature_count -> meterai_count -> name -> email (LD-24, extended for Case 2).
 * First failure wins, so the response names one cause, not a list.
 *
 * The two counts are checked before the identity fields because they are the
 * pair the §A3 rules are about, and because `signature_count` already held that
 * position in Case 1. Note what is NOT checked here: whether `meterai_count`
 * exceeds `signature_count`. §B5 puts that comparison after duplicate emails,
 * so it is its own stage.
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

  // §B1: absent means the default of 0. Present means it must be well-formed —
  // `null`, `"2"` and `4` are mistakes, not defaults, and are refused.
  if (candidate.meterai_count !== undefined && !isValidMeteraiCount(candidate.meterai_count)) {
    return validationFailure(
      'METERAI_COUNT_INVALID',
      `meterai_count must be an integer between ${MIN_METERAI_COUNT} and ${MAX_METERAI_COUNT}`,
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

/**
 * The four parameter-free stages are exported individually as well as inside
 * `RECIPIENT_LIST_STAGES`.
 *
 * Case 2's §B5 does not merely APPEND to Case 1's order, it INTERLEAVES:
 * `step-structure` lands between `duplicates` and `meterai-vs-signature`, and
 * `meterai-step-placement` right after it. A composer that could only spread
 * `RECIPIENT_LIST_STAGES` would have to slice it by index or by name to do
 * that, and either would be a second, fragile statement of the order. Naming
 * the pieces lets `chargePreviewStages` write §B5 out as one array literal.
 *
 * `RECIPIENT_LIST_STAGES` keeps its Case-1 meaning unchanged: the stages that
 * need no parameter, in their own relative order, and the default for a caller
 * that knows nothing about mode or allowance.
 */
export const countStage: RecipientListStage = {
  name: 'count',
  run: (recipients) =>
    recipients.length < MIN_RECIPIENTS || recipients.length > MAX_RECIPIENTS
      ? recipientCountInvalid()
      : null,
};

export const perRecipientStage: RecipientListStage = {
  name: 'per-recipient',
  run: (recipients) => {
    for (let index = 0; index < recipients.length; index += 1) {
      const failure = validateRecipient(recipients[index] as RecipientInput, index);
      if (failure) return failure;
    }
    return null;
  },
};

export const duplicateStage: RecipientListStage = {
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

/**
 * §A3.2 / §B5 — compared only once every row is individually valid and no two
 * rows collide, so the failure the user sees is the deepest true one.
 *
 * Reports the FIRST offending row by index and names it in
 * `details.recipient_index`: §B7.4 requires the frontend to mark that row, not
 * the whole form.
 */
export const meteraiVsSignatureStage: RecipientListStage = {
  name: 'meterai-vs-signature',
  run: (recipients) => {
    for (let index = 0; index < recipients.length; index += 1) {
      const r = recipients[index] as RecipientInput;
      if (!meteraiWithinSignatures(r)) {
        return validationFailure(
          'METERAI_EXCEEDS_SIGNATURE',
          `${meteraiCountOf(r)} eMeterai is more than the ${signatureCountOf(r)} signatures ` +
            'this recipient has - one duty stamp sits next to one signature',
          { recipient_index: index },
        );
      }
    }
    return null;
  },
};

/**
 * The stages that need no parameter, in §B5's order.
 *
 * Case 1 registered three; Case 2 INSERTS `meterai-vs-signature` after
 * duplicates — an entry in this array, never an edit to the runner (seam S3).
 * The two quota stages are absent here on purpose: they need the account's
 * allowance, which this package is never allowed to know (ADR-003), so they are
 * built by `quota.ts` and appended by the caller. `chargePreviewStages` composes
 * the full §B5 P1 order.
 */
export const RECIPIENT_LIST_STAGES: readonly RecipientListStage[] = [
  countStage,
  perRecipientStage,
  duplicateStage,
  meteraiVsSignatureStage,
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
 * Validate a whole recipient list against a stage list.
 *
 * Defaults to the parameter-free stages (count -> per-recipient -> duplicates
 * -> meterai-vs-signature). A caller that knows the account's allowance passes
 * `chargePreviewStages(quota)` instead, which appends the two quota stages in
 * §B5's order.
 *
 * Takes `unknown` because the server hands it a parsed request body. A payload
 * that is not an array fails the same way an empty one does — there is no list
 * to count.
 */
export function validateRecipientList(
  rs: unknown,
  stages: readonly RecipientListStage[] = RECIPIENT_LIST_STAGES,
): ValidationFailure | null {
  if (!Array.isArray(rs)) return recipientCountInvalid();
  return runRecipientStages(rs as readonly RecipientInput[], stages);
}
