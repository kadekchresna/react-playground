/**
 * Written BEFORE the meterai rules in `recipient.ts`. Every expected value is
 * hand-derived from `test_2_en.md` §A3 and §B1:
 *
 *   §B1   `meterai_count` per recipient is an integer `0`-`3`, default `0`.
 *   §A3.2 `meterai_count` must not exceed that recipient's `signature_count` —
 *         one duty stamp sits next to one signature.
 *   §B5   validation order: per recipient -> duplicate emails
 *         -> meterai-vs-signature -> signature quota -> meterai quota.
 *   §B7.4 Rina 2 sig / 3 met -> `METERAI_EXCEEDS_SIGNATURE`, and the FE marks
 *         THAT ROW (so the failure carries `details.recipient_index`), not the
 *         whole form.
 *
 * The Case-1 asymmetry is repeated deliberately: `clampMeteraiCount` (frontend)
 * repairs input so the stepper can never leave state `NaN`/`undefined`, while
 * `isValidMeteraiCount` (backend) refuses it without coercion. They are two
 * functions over the same input set, exactly as the signature pair already is.
 *
 * The meterai PRICE and the meterai QUOTA appear nowhere in this file's
 * subject: those are commercial terms and reach the kernel only as parameters
 * (ADR-003). `0`-`3` is a validation rule, and rules do live here.
 */
import { describe, expect, it } from 'vitest';

import type { ValidationFailure } from '../errors.js';
import {
  MAX_METERAI_COUNT,
  MIN_METERAI_COUNT,
  RECIPIENT_LIST_STAGES,
  clampMeteraiCount,
  isValidMeteraiCount,
  meteraiCountOf,
  meteraiWithinSignatures,
  signatureCountOf,
  validateRecipient,
  validateRecipientList,
} from '../recipient.js';
import type { RecipientInput } from '../types.js';

function recipient(over: Partial<RecipientInput> = {}): RecipientInput {
  return {
    name: 'Rina Halim',
    email: 'rina.halim@example.test',
    signature_count: 2,
    meterai_count: 1,
    ...over,
  };
}

function failureOf(result: ValidationFailure | null): ValidationFailure {
  if (result === null) throw new Error('expected a ValidationFailure, got null');
  return result;
}

/** §B1: anything that is not an integer 0..3. `0` is legal here, unlike signatures. */
const HOSTILE_METERAI_COUNTS: readonly unknown[] = [-1, 2.5, 'abc', '', null, 4, 21];

describe('the meterai rule bounds are kernel constants (§B1)', () => {
  it('is the integer range 0..3', () => {
    expect(MIN_METERAI_COUNT).toBe(0);
    expect(MAX_METERAI_COUNT).toBe(3);
  });
});

describe('isValidMeteraiCount — backend, strict, never coerces (§B1)', () => {
  it('accepts every integer in 0..3, including the 0 default', () => {
    expect(isValidMeteraiCount(0)).toBe(true);
    expect(isValidMeteraiCount(1)).toBe(true);
    expect(isValidMeteraiCount(2)).toBe(true);
    expect(isValidMeteraiCount(3)).toBe(true);
  });

  for (const raw of HOSTILE_METERAI_COUNTS) {
    it(`rejects ${JSON.stringify(raw) ?? String(raw)}`, () => {
      expect(isValidMeteraiCount(raw)).toBe(false);
    });
  }

  it('rejects a numeric string, because coercion is the frontend’s job', () => {
    expect(isValidMeteraiCount('2')).toBe(false);
    expect(isValidMeteraiCount(' 2 ')).toBe(false);
  });

  it('rejects NaN, Infinity and non-scalars', () => {
    expect(isValidMeteraiCount(Number.NaN)).toBe(false);
    expect(isValidMeteraiCount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidMeteraiCount([1])).toBe(false);
    expect(isValidMeteraiCount({ valueOf: () => 1 })).toBe(false);
    expect(isValidMeteraiCount(true)).toBe(false);
    expect(isValidMeteraiCount(false)).toBe(false);
  });

  it('rejects an absent value — absence is the caller’s default, not a valid count', () => {
    expect(isValidMeteraiCount(undefined)).toBe(false);
  });
});

describe('clampMeteraiCount — frontend stepper, never NaN/undefined (§A3, PRD §8.3)', () => {
  it('clamps out-of-range integers into 0..3 instead of discarding them', () => {
    expect(clampMeteraiCount(-1, 2)).toBe(0);
    expect(clampMeteraiCount(-99, 2)).toBe(0);
    expect(clampMeteraiCount(4, 2)).toBe(3);
    expect(clampMeteraiCount(9999, 2)).toBe(3);
  });

  it('accepts 0, which is a legal count and the default', () => {
    expect(clampMeteraiCount(0, 2)).toBe(0);
  });

  it('keeps the previous value for anything that is not an integer', () => {
    expect(clampMeteraiCount(1.5, 2)).toBe(2);
    expect(clampMeteraiCount('abc', 2)).toBe(2);
    expect(clampMeteraiCount('', 2)).toBe(2);
    expect(clampMeteraiCount('1.5', 2)).toBe(2);
    expect(clampMeteraiCount(null, 2)).toBe(2);
    expect(clampMeteraiCount(undefined, 2)).toBe(2);
    expect(clampMeteraiCount(Number.NaN, 2)).toBe(2);
    expect(clampMeteraiCount({}, 2)).toBe(2);
  });

  it('accepts a well-formed numeric string, which is what a number input emits', () => {
    expect(clampMeteraiCount('2', 1)).toBe(2);
    expect(clampMeteraiCount(' 2 ', 1)).toBe(2);
    expect(clampMeteraiCount('0', 1)).toBe(0);
    expect(clampMeteraiCount('007', 1)).toBe(3);
  });

  it('never returns NaN or undefined for any hostile input', () => {
    for (const raw of [...HOSTILE_METERAI_COUNTS, undefined]) {
      const next = clampMeteraiCount(raw, 2);
      expect(Number.isInteger(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(3);
    }
  });

  it('repairs a corrupted previous value rather than propagating it', () => {
    expect(clampMeteraiCount('abc', Number.NaN)).toBe(0);
    expect(clampMeteraiCount('abc', undefined as unknown as number)).toBe(0);
    expect(clampMeteraiCount('abc', 99)).toBe(0);
    expect(clampMeteraiCount('abc', -4)).toBe(0);
  });

  it('does not clamp against signature_count — §A3.2 is an error, not a repair', () => {
    // §B7.4 requires `METERAI_EXCEEDS_SIGNATURE` to be reportable and the row to
    // be marked. A stepper that silently capped at signature_count could never
    // produce that state, so the rule would be untestable from the UI.
    expect(clampMeteraiCount(3, 0)).toBe(3);
  });
});

describe('signatureCountOf / meteraiCountOf — counts as arithmetic can use them', () => {
  it('reads a well-formed pair', () => {
    const r = recipient({ signature_count: 2, meterai_count: 1 });
    expect(signatureCountOf(r)).toBe(2);
    expect(meteraiCountOf(r)).toBe(1);
  });

  it('defaults an absent meterai_count to 0 (§B1 “default 0”)', () => {
    const legacy = { name: 'Budi', email: 'budi@example.test', signature_count: 1 };
    expect(meteraiCountOf(legacy as RecipientInput)).toBe(0);
  });

  it('contributes 0 rather than NaN for a malformed count', () => {
    expect(meteraiCountOf(recipient({ meterai_count: Number.NaN }))).toBe(0);
    expect(meteraiCountOf(recipient({ meterai_count: 9 }))).toBe(0);
    expect(meteraiCountOf(undefined as unknown as RecipientInput)).toBe(0);
    expect(signatureCountOf(recipient({ signature_count: Number.NaN }))).toBe(0);
  });
});

describe('meteraiWithinSignatures — §A3.2, one stamp next to one signature', () => {
  it('allows fewer meterai than signatures', () => {
    expect(meteraiWithinSignatures(recipient({ signature_count: 2, meterai_count: 1 }))).toBe(true);
    expect(meteraiWithinSignatures(recipient({ signature_count: 3, meterai_count: 0 }))).toBe(true);
  });

  it('allows exactly as many meterai as signatures — the boundary is legal', () => {
    expect(meteraiWithinSignatures(recipient({ signature_count: 2, meterai_count: 2 }))).toBe(true);
    expect(meteraiWithinSignatures(recipient({ signature_count: 1, meterai_count: 1 }))).toBe(true);
    expect(meteraiWithinSignatures(recipient({ signature_count: 3, meterai_count: 3 }))).toBe(true);
  });

  it('refuses one more meterai than signatures (§B7.4: Rina 2 sig / 3 met)', () => {
    expect(meteraiWithinSignatures(recipient({ signature_count: 2, meterai_count: 3 }))).toBe(false);
    expect(meteraiWithinSignatures(recipient({ signature_count: 1, meterai_count: 2 }))).toBe(false);
  });

  it('treats an absent meterai_count as 0, which is within any signature count', () => {
    const legacy = { name: 'Budi', email: 'budi@example.test', signature_count: 1 };
    expect(meteraiWithinSignatures(legacy as RecipientInput)).toBe(true);
  });
});

describe('validateRecipient — meterai_count joins the fixed per-recipient order', () => {
  it('passes a recipient carrying meterai within its signature count', () => {
    expect(validateRecipient(recipient({ signature_count: 2, meterai_count: 1 }), 0)).toBeNull();
    expect(validateRecipient(recipient({ meterai_count: 0 }), 0)).toBeNull();
    expect(validateRecipient(recipient({ signature_count: 3, meterai_count: 3 }), 0)).toBeNull();
  });

  it('passes a recipient with no meterai_count at all — absence means 0 (§B1)', () => {
    const legacy = { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 };
    expect(validateRecipient(legacy as RecipientInput, 0)).toBeNull();
  });

  it('rejects a present-but-invalid meterai_count with its own code', () => {
    for (const raw of HOSTILE_METERAI_COUNTS) {
      const failure = failureOf(
        validateRecipient(recipient({ meterai_count: raw as number }), 2),
      );
      expect(failure.code, `expected ${JSON.stringify(raw)} to be rejected`).toBe(
        'METERAI_COUNT_INVALID',
      );
      expect(failure.details?.recipient_index).toBe(2);
    }
  });

  it('reports signature_count before meterai_count when both are wrong', () => {
    const failure = failureOf(
      validateRecipient(recipient({ signature_count: 0, meterai_count: 9 }), 0),
    );
    expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('reports meterai_count before name and email when all three are wrong', () => {
    const failure = failureOf(
      validateRecipient(
        { name: '', email: 'nope', signature_count: 2, meterai_count: 9 } as RecipientInput,
        0,
      ),
    );
    expect(failure.code).toBe('METERAI_COUNT_INVALID');
  });

  it('does NOT report meterai-vs-signature here — that is a later stage (§B5)', () => {
    // 3 is a valid count; it only becomes a failure against this row's
    // signature_count, which the pipeline checks after duplicate emails.
    expect(validateRecipient(recipient({ signature_count: 2, meterai_count: 3 }), 0)).toBeNull();
  });
});

describe('the meterai-vs-signature stage sits in the §B5 order (seam S3)', () => {
  it('registers after duplicates, in the stage array the runner walks', () => {
    expect(RECIPIENT_LIST_STAGES.map((stage) => stage.name)).toEqual([
      'count',
      'per-recipient',
      'duplicates',
      'meterai-vs-signature',
    ]);
  });

  it('accepts the §B7.1 list: Rina 2 sig / 1 met, Budi 1 sig / 0 met', () => {
    expect(
      validateRecipientList([
        recipient({ signature_count: 2, meterai_count: 1 }),
        recipient({
          name: 'Budi Santoso',
          email: 'budi.santoso@example.test',
          signature_count: 1,
          meterai_count: 0,
        }),
      ]),
    ).toBeNull();
  });

  it('refuses §B7.4 — Rina 2 sig / 3 met — and names that row only', () => {
    const failure = failureOf(
      validateRecipientList([
        recipient({
          name: 'Budi Santoso',
          email: 'budi.santoso@example.test',
          signature_count: 1,
          meterai_count: 1,
        }),
        recipient({ signature_count: 2, meterai_count: 3 }),
      ]),
    );
    expect(failure.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(failure.details?.recipient_index).toBe(1);
    expect(failure.details?.recipient_indexes).toBeUndefined();
  });

  it('reports the first offending row in index order', () => {
    const failure = failureOf(
      validateRecipientList([
        recipient({ email: 'a@example.test', signature_count: 1, meterai_count: 2 }),
        recipient({ email: 'b@example.test', signature_count: 1, meterai_count: 3 }),
      ]),
    );
    expect(failure.details?.recipient_index).toBe(0);
  });

  it('runs AFTER duplicate emails: a duplicated pair reports the duplicate', () => {
    const failure = failureOf(
      validateRecipientList([
        recipient({ email: '  Rina.Halim@Example.test ', signature_count: 2, meterai_count: 1 }),
        recipient({ email: 'rina.halim@example.test', signature_count: 1, meterai_count: 3 }),
      ]),
    );
    expect(failure.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('runs AFTER per-recipient: an invalid count reports the count', () => {
    const failure = failureOf(
      validateRecipientList([recipient({ signature_count: 0, meterai_count: 3 })]),
    );
    expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
  });
});
