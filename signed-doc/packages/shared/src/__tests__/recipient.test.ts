/**
 * Written BEFORE `recipient.ts`. Expected values are hand-derived from PRD §6
 * (1-10 recipients, signature_count integer 1-20), PRD §8.3 (clamped, never
 * NaN/undefined), PRD §8.4 (duplicate emails compared after trimming and
 * case-insensitively) and PRD §11.2's list of required negative cases.
 *
 * The central design assertion in this file: `clampSignatureCount` (frontend,
 * coercing) and `isValidSignatureCount` (backend, strict) are DIFFERENT
 * functions over the same input set. The browser repairs input; the server
 * refuses it. A single shared "helpful" function would let a hostile client
 * have its value silently corrected instead of rejected.
 */
import { describe, expect, it } from 'vitest';

import { isValidationFailure, type ValidationFailure } from '../errors.js';
import {
  RECIPIENT_LIST_STAGES,
  clampSignatureCount,
  findDuplicateEmailGroups,
  isValidSignatureCount,
  normalizeEmail,
  validateRecipient,
  validateRecipientList,
} from '../recipient.js';
import type { RecipientInput } from '../types.js';

function recipient(over: Partial<RecipientInput> = {}): RecipientInput {
  return { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2, ...over };
}

function failureOf(result: ValidationFailure | null): ValidationFailure {
  if (result === null) throw new Error('expected a ValidationFailure, got null');
  return result;
}

/** PRD §11.2 / §10: the exact hostile input set both count functions must face. */
const HOSTILE_COUNTS: readonly unknown[] = [0, -1, 2.5, 'abc', '', null, undefined, 21];

describe('isValidSignatureCount — backend, strict, never coerces', () => {
  it('accepts only integers 1..20', () => {
    expect(isValidSignatureCount(1)).toBe(true);
    expect(isValidSignatureCount(2)).toBe(true);
    expect(isValidSignatureCount(20)).toBe(true);
  });

  for (const raw of HOSTILE_COUNTS) {
    it(`rejects ${JSON.stringify(raw) ?? String(raw)}`, () => {
      expect(isValidSignatureCount(raw)).toBe(false);
    });
  }

  it('rejects a numeric string, because coercion is the frontend’s job', () => {
    expect(isValidSignatureCount('3')).toBe(false);
    expect(isValidSignatureCount(' 3 ')).toBe(false);
  });

  it('rejects NaN, Infinity and non-scalars', () => {
    expect(isValidSignatureCount(Number.NaN)).toBe(false);
    expect(isValidSignatureCount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidSignatureCount([2])).toBe(false);
    expect(isValidSignatureCount({ valueOf: () => 2 })).toBe(false);
    expect(isValidSignatureCount(true)).toBe(false);
  });
});

describe('clampSignatureCount — frontend, coercing, never NaN/undefined (PRD §8.3)', () => {
  it('clamps out-of-range integers into 1..20 instead of discarding them', () => {
    expect(clampSignatureCount(0, 3)).toBe(1);
    expect(clampSignatureCount(-1, 3)).toBe(1);
    expect(clampSignatureCount(21, 3)).toBe(20);
    expect(clampSignatureCount(9999, 3)).toBe(20);
  });

  it('keeps the previous value for anything that is not an integer', () => {
    expect(clampSignatureCount(2.5, 3)).toBe(3);
    expect(clampSignatureCount('abc', 3)).toBe(3);
    expect(clampSignatureCount('', 3)).toBe(3);
    expect(clampSignatureCount('2.5', 3)).toBe(3);
    expect(clampSignatureCount(null, 3)).toBe(3);
    expect(clampSignatureCount(undefined, 3)).toBe(3);
    expect(clampSignatureCount(Number.NaN, 3)).toBe(3);
    expect(clampSignatureCount({}, 3)).toBe(3);
  });

  it('accepts a well-formed numeric string, which is what a number input emits', () => {
    expect(clampSignatureCount('4', 3)).toBe(4);
    expect(clampSignatureCount(' 4 ', 3)).toBe(4);
    expect(clampSignatureCount('007', 3)).toBe(7);
  });

  it('never returns NaN or undefined for any hostile input', () => {
    for (const raw of HOSTILE_COUNTS) {
      const next = clampSignatureCount(raw, 3);
      expect(Number.isInteger(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(1);
      expect(next).toBeLessThanOrEqual(20);
    }
  });

  it('repairs a corrupted previous value rather than propagating it', () => {
    expect(clampSignatureCount('abc', Number.NaN)).toBe(1);
    expect(clampSignatureCount('abc', undefined as unknown as number)).toBe(1);
    expect(clampSignatureCount('abc', 99)).toBe(1);
  });
});

describe('normalizeEmail (PRD §8.4)', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Rina.Halim@Example.test ')).toBe('rina.halim@example.test');
    expect(normalizeEmail('rina.halim@example.test')).toBe('rina.halim@example.test');
  });

  it('never returns undefined for non-string input', () => {
    expect(normalizeEmail(undefined as unknown as string)).toBe('');
    expect(normalizeEmail(null as unknown as string)).toBe('');
  });
});

describe('validateRecipient — order is signature_count, then name, then email (LD-24)', () => {
  it('passes a well-formed recipient', () => {
    expect(validateRecipient(recipient(), 0)).toBeNull();
    expect(validateRecipient(recipient({ email: '  Rina.Halim@Example.test ' }), 0)).toBeNull();
  });

  it('rejects an empty or whitespace-only name (PRD §11.2)', () => {
    const failure = failureOf(validateRecipient(recipient({ name: '' }), 0));
    expect(failure.code).toBe('RECIPIENT_INVALID');
    expect(failure.details?.recipient_index).toBe(0);
    expect(failureOf(validateRecipient(recipient({ name: '   ' }), 4)).details?.recipient_index).toBe(4);
  });

  it('rejects a malformed email (PRD §11.2)', () => {
    for (const email of [
      '',
      'rina',
      'rina@',
      '@example.test',
      'rina@example',
      'rina@@example.test',
      'rina halim@example.test',
      'rina@example..test',
      'rina@.test',
      'rina@example.',
    ]) {
      const failure = failureOf(validateRecipient(recipient({ email }), 1));
      expect(failure.code, `expected ${JSON.stringify(email)} to be rejected`).toBe(
        'RECIPIENT_INVALID',
      );
      expect(failure.details?.recipient_index).toBe(1);
    }
  });

  it('rejects an out-of-range signature_count with its own code (PRD §11.2)', () => {
    for (const raw of HOSTILE_COUNTS) {
      const failure = failureOf(
        validateRecipient(recipient({ signature_count: raw as number }), 2),
      );
      expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
      expect(failure.details?.recipient_index).toBe(2);
    }
  });

  it('reports signature_count first when several fields are wrong', () => {
    const failure = failureOf(
      validateRecipient({ name: '', email: 'nope', signature_count: 0 } as RecipientInput, 0),
    );
    expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('survives a missing or non-object recipient', () => {
    expect(failureOf(validateRecipient(undefined as unknown as RecipientInput, 0)).code).toBe(
      'SIGNATURE_COUNT_INVALID',
    );
    expect(failureOf(validateRecipient('nope' as unknown as RecipientInput, 0)).code).toBe(
      'SIGNATURE_COUNT_INVALID',
    );
  });
});

describe('findDuplicateEmailGroups (PRD §8.4, §10)', () => {
  it('groups a trimmed, case-variant pair and reports both indexes', () => {
    const groups = findDuplicateEmailGroups([
      recipient({ email: '  Rina.Halim@Example.test ' }),
      recipient({ name: 'Rina again', email: 'rina.halim@example.test' }),
    ]);
    expect(groups).toEqual([[0, 1]]);
  });

  it('returns no groups when every email is distinct', () => {
    expect(
      findDuplicateEmailGroups([
        recipient({ email: 'rina.halim@example.test' }),
        recipient({ name: 'Budi Santoso', email: 'budi.santoso@example.test' }),
      ]),
    ).toEqual([]);
  });

  it('reports every member of a group larger than two', () => {
    const groups = findDuplicateEmailGroups([
      recipient({ email: 'a@example.test' }),
      recipient({ email: 'b@example.test' }),
      recipient({ email: 'A@Example.test' }),
      recipient({ email: ' a@example.test' }),
    ]);
    expect(groups).toEqual([[0, 2, 3]]);
  });

  it('reports multiple independent groups in first-occurrence order', () => {
    const groups = findDuplicateEmailGroups([
      recipient({ email: 'a@example.test' }),
      recipient({ email: 'b@example.test' }),
      recipient({ email: 'b@example.test' }),
      recipient({ email: 'a@example.test' }),
    ]);
    expect(groups).toEqual([
      [0, 3],
      [1, 2],
    ]);
  });

  it('ignores empty emails, which are already a per-recipient failure', () => {
    expect(
      findDuplicateEmailGroups([recipient({ email: '' }), recipient({ email: '   ' })]),
    ).toEqual([]);
  });
});

describe('validateRecipientList — ordered stage pipeline (seam S3, LD-24)', () => {
  it('registers exactly the Case 1 stages, in order', () => {
    expect(RECIPIENT_LIST_STAGES.map((stage) => stage.name)).toEqual([
      'count',
      'per-recipient',
      'duplicates',
    ]);
  });

  it('accepts a valid list', () => {
    expect(
      validateRecipientList([
        recipient({ name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2 }),
        recipient({ name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 }),
      ]),
    ).toBeNull();
  });

  it('rejects an empty list and an over-long list (PRD §6)', () => {
    expect(failureOf(validateRecipientList([])).code).toBe('RECIPIENT_COUNT_INVALID');
    const eleven = Array.from({ length: 11 }, (_, i) =>
      recipient({ email: `signer${i}@example.test` }),
    );
    expect(failureOf(validateRecipientList(eleven)).code).toBe('RECIPIENT_COUNT_INVALID');
    const ten = eleven.slice(0, 10);
    expect(validateRecipientList(ten)).toBeNull();
  });

  it('rejects a payload that is not an array at all', () => {
    expect(failureOf(validateRecipientList(undefined)).code).toBe('RECIPIENT_COUNT_INVALID');
    expect(failureOf(validateRecipientList({ 0: recipient() })).code).toBe(
      'RECIPIENT_COUNT_INVALID',
    );
    expect(failureOf(validateRecipientList('recipients')).code).toBe('RECIPIENT_COUNT_INVALID');
  });

  it('short-circuits on the first failing stage: count before per-recipient', () => {
    // 11 recipients where the first is also invalid — count must win.
    const eleven = Array.from({ length: 11 }, (_, i) =>
      recipient({ email: `signer${i}@example.test` }),
    );
    eleven[0] = recipient({ name: '', email: 'signer0@example.test' });
    expect(failureOf(validateRecipientList(eleven)).code).toBe('RECIPIENT_COUNT_INVALID');
  });

  it('short-circuits on the first failing stage: per-recipient before duplicates', () => {
    // Both rows share an email AND the second row has an invalid count.
    const failure = failureOf(
      validateRecipientList([
        recipient({ email: 'rina.halim@example.test' }),
        recipient({ email: 'RINA.HALIM@example.test', signature_count: 0 }),
      ]),
    );
    expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
    expect(failure.details?.recipient_index).toBe(1);
  });

  it('reports the first offending recipient in index order', () => {
    const failure = failureOf(
      validateRecipientList([
        recipient({ email: 'a@example.test' }),
        recipient({ email: 'b@example.test', name: '' }),
        recipient({ email: 'c@example.test', name: '' }),
      ]),
    );
    expect(failure.details?.recipient_index).toBe(1);
  });

  it('reaches the duplicate stage only when every recipient is individually valid', () => {
    const failure = failureOf(
      validateRecipientList([
        recipient({ email: '  Rina.Halim@Example.test ' }),
        recipient({ name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 1 }),
      ]),
    );
    expect(failure.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
    expect(failure.details?.recipient_indexes).toEqual([0, 1]);
  });

  it('returns a ValidationFailure shape the error mapper can render', () => {
    const failure = failureOf(validateRecipientList([]));
    expect(isValidationFailure(failure)).toBe(true);
    expect(typeof failure.message).toBe('string');
    expect(failure.message.length).toBeGreaterThan(0);
  });
});
