/**
 * Recipient list rules (PRD §8.1–§8.3, §10 signature_count row).
 *
 * Nothing is rendered and no React module is imported (LD-32).
 *
 * The headline obligation is prompt §4 fact 7: `signature_count` must never be
 * `NaN` or `undefined` for ANY input. That is asserted below over a matrix of
 * hostile strings rather than over the four the PRD happens to name.
 */

import { describe, expect, it } from 'vitest';

import { MAX_RECIPIENTS, MAX_SIGNATURE_COUNT, MIN_SIGNATURE_COUNT } from '@signed-doc/shared';

import {
  accessibleNameFor,
  canAddRecipient,
  canRemoveRecipient,
  recipientsReducer,
  toRecipientInputs,
  type RecipientsAction,
  type RecipientsState,
} from '../features/recipients/recipients-reducer.js';
import { createSeedState } from '../features/recipients/seed.js';

function run(actions: readonly RecipientsAction[], from = createSeedState()): RecipientsState {
  return actions.reduce(recipientsReducer, from);
}

function fill(count: number): RecipientsState {
  let state = createSeedState();
  while (state.rows.length < count) state = recipientsReducer(state, { type: 'ADD_ROW' });
  return state;
}

describe('seed (LD-15, PRD §6)', () => {
  it('seeds Rina Halim and Budi Santoso exactly as the PRD gives them', () => {
    expect(toRecipientInputs(createSeedState())).toEqual([
      { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2 },
      { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 },
    ]);
  });

  it('uses @example.test fixture addresses only (PRD §5)', () => {
    for (const row of createSeedState().rows) {
      expect(row.email.endsWith('@example.test')).toBe(true);
    }
  });

  it('gives every row a stable, distinct id', () => {
    const ids = createSeedState().rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('no derived total is stored (PRD §8.6)', () => {
  it('has no total-shaped key anywhere in the state', () => {
    const state = run([{ type: 'INC', index: 0 }, { type: 'ADD_ROW' }]);
    const serialized = JSON.stringify(state);
    for (const forbidden of ['total_charge', 'total_signatures', 'quota_remaining', 'charge']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(state).sort()).toEqual(['nextId', 'rows']);
  });

  it('a row carries only its own fields plus local id and raw text', () => {
    for (const row of createSeedState().rows) {
      expect(Object.keys(row).sort()).toEqual([
        'countRaw',
        'email',
        'id',
        'name',
        'signature_count',
      ]);
    }
  });
});

describe('SET_NAME / SET_EMAIL', () => {
  it('stores the raw text without trimming — validation trims, editing does not', () => {
    const state = run([{ type: 'SET_NAME', index: 0, value: '  Rina  ' }]);
    expect(state.rows[0]?.name).toBe('  Rina  ');
  });

  it('accepts an empty name so the user can clear a field mid-edit', () => {
    const state = run([{ type: 'SET_NAME', index: 0, value: '' }]);
    expect(state.rows[0]?.name).toBe('');
    expect(state.rows[0]?.signature_count).toBe(2); // untouched
  });

  it('leaves other rows alone', () => {
    const state = run([{ type: 'SET_EMAIL', index: 1, value: 'x@y.test' }]);
    expect(state.rows[0]).toEqual(createSeedState().rows[0]);
    expect(state.rows[1]?.email).toBe('x@y.test');
  });

  it('ignores an out-of-range index', () => {
    const before = createSeedState();
    expect(recipientsReducer(before, { type: 'SET_NAME', index: 9, value: 'x' })).toBe(before);
  });
});

describe('signature_count is never NaN or undefined (PRD §8.3, prompt §4 fact 7)', () => {
  const hostile = ['', ' ', 'abc', '2.5', '-1', '0', '25', '1e3', 'NaN', 'undefined', '+3', '٣', '２'];

  for (const raw of hostile) {
    it(`keeps a valid integer after typing ${JSON.stringify(raw)}`, () => {
      const typed = run([{ type: 'SET_COUNT_RAW', index: 0, raw }]);
      const committed = run([{ type: 'SET_COUNT_RAW', index: 0, raw }, { type: 'COMMIT_COUNT', index: 0 }]);

      for (const state of [typed, committed]) {
        const count = state.rows[0]?.signature_count;
        expect(Number.isInteger(count)).toBe(true);
        expect(Number.isNaN(count)).toBe(false);
        expect(count).toBeGreaterThanOrEqual(MIN_SIGNATURE_COUNT);
        expect(count).toBeLessThanOrEqual(MAX_SIGNATURE_COUNT);
      }
    });
  }

  it('the four values PRD §10 names settle on the documented results', () => {
    const settle = (raw: string) =>
      run([{ type: 'SET_COUNT_RAW', index: 0, raw }, { type: 'COMMIT_COUNT', index: 0 }]).rows[0];

    expect(settle('0')?.signature_count).toBe(1); // clamped up
    expect(settle('-1')?.signature_count).toBe(1); // clamped up
    expect(settle('2.5')?.signature_count).toBe(2); // not an integer -> previous
    expect(settle('abc')?.signature_count).toBe(2); // not a number -> previous
    expect(settle('')?.signature_count).toBe(2); // empty -> previous
    expect(settle('25')?.signature_count).toBe(20); // clamped down
  });

  it('shows the settled value in the box after blur, so the text cannot lie', () => {
    const state = run([
      { type: 'SET_COUNT_RAW', index: 0, raw: '25' },
      { type: 'COMMIT_COUNT', index: 0 },
    ]);
    expect(state.rows[0]?.countRaw).toBe('20');
    expect(state.rows[0]?.signature_count).toBe(20);
  });

  it('lets the box be visually empty mid-typing without touching the number', () => {
    const state = run([{ type: 'SET_COUNT_RAW', index: 0, raw: '' }]);
    expect(state.rows[0]?.countRaw).toBe('');
    expect(state.rows[0]?.signature_count).toBe(2);
  });

  it('does not snap an in-range value under the cursor while typing', () => {
    // Typing "1" then "2" toward 12 must not be rewritten to 20 en route.
    const state = run([
      { type: 'SET_COUNT_RAW', index: 0, raw: '1' },
      { type: 'SET_COUNT_RAW', index: 0, raw: '12' },
    ]);
    expect(state.rows[0]?.signature_count).toBe(12);
    expect(state.rows[0]?.countRaw).toBe('12');
  });

  it('holds the previous number while an over-range value is being typed', () => {
    const state = run([{ type: 'SET_COUNT_RAW', index: 0, raw: '25' }]);
    expect(state.rows[0]?.countRaw).toBe('25'); // what the user sees
    expect(state.rows[0]?.signature_count).toBe(2); // what totals use
  });
});

describe('INC / DEC stop at the bounds (PRD §8.3)', () => {
  it('DEC stops at 1', () => {
    const state = run([{ type: 'DEC', index: 1 }, { type: 'DEC', index: 1 }, { type: 'DEC', index: 1 }]);
    expect(state.rows[1]?.signature_count).toBe(MIN_SIGNATURE_COUNT);
    expect(state.rows[1]?.countRaw).toBe('1');
  });

  it('INC stops at 20', () => {
    let state = createSeedState();
    for (let i = 0; i < 40; i += 1) state = recipientsReducer(state, { type: 'INC', index: 0 });
    expect(state.rows[0]?.signature_count).toBe(MAX_SIGNATURE_COUNT);
    expect(state.rows[0]?.countRaw).toBe('20');
  });

  it('INC from the seed advances by exactly one', () => {
    expect(run([{ type: 'INC', index: 0 }]).rows[0]?.signature_count).toBe(3);
  });

  it('repairs a box left mid-edit rather than stepping from the stale text', () => {
    const state = run([
      { type: 'SET_COUNT_RAW', index: 0, raw: 'abc' },
      { type: 'INC', index: 0 },
    ]);
    expect(state.rows[0]?.signature_count).toBe(3);
    expect(state.rows[0]?.countRaw).toBe('3');
  });
});

describe('list bounds (PRD §8.1, §8.2, LD-12, LD-16)', () => {
  it('ADD_ROW appends an empty row defaulting to 1 signature', () => {
    const state = run([{ type: 'ADD_ROW' }]);
    expect(state.rows).toHaveLength(3);
    expect(state.rows[2]).toMatchObject({ name: '', email: '', signature_count: 1, countRaw: '1' });
  });

  it('ADD_ROW at 10 rows leaves the list at 10', () => {
    const full = fill(MAX_RECIPIENTS);
    expect(full.rows).toHaveLength(MAX_RECIPIENTS);
    expect(canAddRecipient(full)).toBe(false);

    const after = recipientsReducer(full, { type: 'ADD_ROW' });
    expect(after).toBe(full);
    expect(after.rows).toHaveLength(MAX_RECIPIENTS);
  });

  it('REMOVE_ROW at 1 row leaves the list at 1', () => {
    const single = run([{ type: 'REMOVE_ROW', index: 1 }]);
    expect(single.rows).toHaveLength(1);
    expect(canRemoveRecipient(single)).toBe(false);

    const after = recipientsReducer(single, { type: 'REMOVE_ROW', index: 0 });
    expect(after).toBe(single);
    expect(after.rows).toHaveLength(1);
  });

  it('REMOVE_ROW removes the named row and keeps the others intact', () => {
    const state = run([{ type: 'ADD_ROW' }, { type: 'REMOVE_ROW', index: 0 }]);
    expect(state.rows.map((row) => row.name)).toEqual(['Budi Santoso', '']);
  });

  it('never reuses an id, so React keys stay stable across a remove', () => {
    const state = run([{ type: 'ADD_ROW' }, { type: 'REMOVE_ROW', index: 2 }, { type: 'ADD_ROW' }]);
    const ids = state.rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['r0', 'r1', 'r3']);
  });

  it('ignores an out-of-range REMOVE_ROW index', () => {
    const before = run([{ type: 'ADD_ROW' }]);
    expect(recipientsReducer(before, { type: 'REMOVE_ROW', index: 7 })).toBe(before);
  });
});

describe('accessibleNameFor (PRD §8.12 — the mockup\'s own fallback)', () => {
  it('uses the trimmed name when there is one', () => {
    expect(accessibleNameFor({ name: '  Rina Halim ' }, 0)).toBe('Rina Halim');
  });

  it('falls back to signer {i+1} when the name is blank', () => {
    expect(accessibleNameFor({ name: '' }, 2)).toBe('signer 3');
    expect(accessibleNameFor({ name: '   ' }, 0)).toBe('signer 1');
  });
});

describe('the reducer is pure', () => {
  it('never mutates the state it is given', () => {
    const before = createSeedState();
    const snapshot = JSON.stringify(before);
    recipientsReducer(before, { type: 'INC', index: 0 });
    recipientsReducer(before, { type: 'REMOVE_ROW', index: 0 });
    recipientsReducer(before, { type: 'ADD_ROW' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('returns the same reference when nothing changes', () => {
    const before = createSeedState();
    expect(recipientsReducer(before, { type: 'SET_NAME', index: 0, value: 'Rina Halim' })).not.toBe(
      before,
    );
    expect(recipientsReducer(before, { type: 'REMOVE_ROW', index: -1 })).toBe(before);
  });
});
