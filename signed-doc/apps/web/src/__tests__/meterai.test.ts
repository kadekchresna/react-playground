/**
 * E-meterai: the stepper, the per-row rule, the two quotas and the exact money
 * (`test_2_en.md` §A3, §B1, §B7 rows 1–4; priority P1).
 *
 * Nothing is rendered and no React module is imported (LD-32): the figures the
 * screen shows are derived by `deriveTotals`, which is pure, so the numbers are
 * asserted where they are computed rather than through the DOM. The render
 * wiring is separately asserted in `app-smoke.test.tsx`.
 *
 * The headline obligations, mirroring Case 1's `signature_count` matrix:
 *
 * 1. `meterai_count` is never `NaN` or `undefined`, for ANY input (§B1).
 * 2. `meterai_count > signature_count` stays REACHABLE — the stepper must not
 *    cap itself, or §B7 row 4 can never be shown and the server's
 *    `422 METERAI_EXCEEDS_SIGNATURE` can never be provoked (§A3.2).
 * 3. The two quotas are independent, and a shortfall in one never reports as
 *    the other (§A3.5).
 * 4. `"25000.10"` and `"45000.30"` come out exactly — the two figures that
 *    break a float implementation (§B7 rows 1–2, ADR-006).
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_METERAI_COUNT,
  MIN_METERAI_COUNT,
  type PriceRecord,
  type QuotaRecord,
} from '@signed-doc/shared';

import { deriveTotals } from '../features/recipients/derive.js';
import {
  recipientsReducer,
  toRecipientInputs,
  type RecipientsAction,
  type RecipientsState,
} from '../features/recipients/recipients-reducer.js';
import { createSeedState } from '../features/recipients/seed.js';

/** §B1's account terms, as the server issues them in the upload response. */
const PRICE: PriceRecord = { signature: '5000.00', meterai: '10000.10' };
const QUOTA: QuotaRecord = { signature: 8, meterai: 3 };
const ACCOUNT = { price: PRICE, quota: QUOTA };

function run(actions: readonly RecipientsAction[], from = createSeedState()): RecipientsState {
  return actions.reduce(recipientsReducer, from);
}

function totalsOf(state: RecipientsState) {
  return deriveTotals(toRecipientInputs(state), ACCOUNT);
}

/** Put an exact pair of counts on a row without going through the keyboard. */
function setCounts(
  state: RecipientsState,
  index: number,
  signatures: number,
  meterai: number,
): RecipientsState {
  return run(
    [
      { type: 'SET_COUNT_RAW', index, raw: String(signatures) },
      { type: 'COMMIT_COUNT', index },
      { type: 'SET_METERAI_RAW', index, raw: String(meterai) },
      { type: 'COMMIT_METERAI', index },
    ],
    state,
  );
}

describe('the eMeterai stepper (§A3.1, §B1)', () => {
  it('seeds every row at 0 — the column costs the user nothing until they ask', () => {
    for (const row of createSeedState().rows) {
      expect(row.meterai_count).toBe(0);
      expect(row.meteraiRaw).toBe('0');
    }
    expect(totalsOf(createSeedState()).breakdown.totalMeterai).toBe(0);
  });

  const hostile = ['', ' ', 'abc', '2.5', '-1', '4', '7', '1e1', 'NaN', 'undefined', '+1', '٣', '２'];

  for (const raw of hostile) {
    it(`keeps a valid integer after typing ${JSON.stringify(raw)}`, () => {
      const typed = run([{ type: 'SET_METERAI_RAW', index: 0, raw }]);
      const committed = run([
        { type: 'SET_METERAI_RAW', index: 0, raw },
        { type: 'COMMIT_METERAI', index: 0 },
      ]);

      for (const state of [typed, committed]) {
        const count = state.rows[0]?.meterai_count;
        expect(Number.isInteger(count)).toBe(true);
        expect(Number.isNaN(count)).toBe(false);
        expect(count).toBeGreaterThanOrEqual(MIN_METERAI_COUNT);
        expect(count).toBeLessThanOrEqual(MAX_METERAI_COUNT);
        // And nothing downstream can see a NaN either.
        expect(Number.isNaN(totalsOf(state).breakdown.totalMeterai)).toBe(false);
      }
    });
  }

  it('settles the named values on the documented results', () => {
    // The seed row is at 0, so "previous" is 0 everywhere below.
    const settle = (raw: string) =>
      run([
        { type: 'SET_METERAI_RAW', index: 0, raw },
        { type: 'COMMIT_METERAI', index: 0 },
      ]).rows[0];

    expect(settle('-1')?.meterai_count).toBe(0); // clamped up to the floor
    expect(settle('4')?.meterai_count).toBe(3); // clamped down to the ceiling
    expect(settle('2.5')?.meterai_count).toBe(0); // not an integer -> previous
    expect(settle('abc')?.meterai_count).toBe(0); // not a number -> previous
    expect(settle('')?.meterai_count).toBe(0); // empty -> previous
    expect(settle('2')?.meterai_count).toBe(2); // legal -> taken
  });

  it('shows the settled value in the box after blur, so the text cannot lie', () => {
    const state = run([
      { type: 'SET_METERAI_RAW', index: 0, raw: '9' },
      { type: 'COMMIT_METERAI', index: 0 },
    ]);
    expect(state.rows[0]?.meteraiRaw).toBe('3');
    expect(state.rows[0]?.meterai_count).toBe(3);
  });

  it('lets the box be visually empty mid-typing without touching the number', () => {
    const state = run([
      { type: 'SET_METERAI_RAW', index: 0, raw: '2' },
      { type: 'COMMIT_METERAI', index: 0 },
      { type: 'SET_METERAI_RAW', index: 0, raw: '' },
    ]);
    expect(state.rows[0]?.meteraiRaw).toBe('');
    expect(state.rows[0]?.meterai_count).toBe(2);
  });

  it('INC stops at 3 and DEC stops at 0', () => {
    let state = createSeedState();
    for (let i = 0; i < 10; i += 1) state = recipientsReducer(state, { type: 'INC_METERAI', index: 0 });
    expect(state.rows[0]?.meterai_count).toBe(MAX_METERAI_COUNT);
    expect(state.rows[0]?.meteraiRaw).toBe('3');

    for (let i = 0; i < 10; i += 1) state = recipientsReducer(state, { type: 'DEC_METERAI', index: 0 });
    expect(state.rows[0]?.meterai_count).toBe(MIN_METERAI_COUNT);
    expect(state.rows[0]?.meteraiRaw).toBe('0');
  });

  it('repairs a box left mid-edit rather than stepping from the stale text', () => {
    const state = run([
      { type: 'SET_METERAI_RAW', index: 0, raw: 'abc' },
      { type: 'INC_METERAI', index: 0 },
    ]);
    expect(state.rows[0]?.meterai_count).toBe(1);
    expect(state.rows[0]?.meteraiRaw).toBe('1');
  });

  it('moves the eMeterai count and the signature count independently', () => {
    const state = run([
      { type: 'INC_METERAI', index: 0 },
      { type: 'INC', index: 0 },
    ]);
    expect(state.rows[0]?.signature_count).toBe(3);
    expect(state.rows[0]?.meterai_count).toBe(1);
    // ...and the other row is untouched by either.
    expect(state.rows[1]).toEqual(createSeedState().rows[1]);
  });
});

describe('§A3.2 is reachable and marked on the ROW (§B7 row 4)', () => {
  it('does NOT cap the stepper at the row\'s signature_count', () => {
    // Rina at 1 signature, then three clicks of `+` on her eMeterai stepper.
    // A self-capping stepper would stop at 1 and the rule would be invisible.
    const state = run([
      { type: 'SET_COUNT_RAW', index: 0, raw: '1' },
      { type: 'COMMIT_COUNT', index: 0 },
      { type: 'INC_METERAI', index: 0 },
      { type: 'INC_METERAI', index: 0 },
      { type: 'INC_METERAI', index: 0 },
    ]);
    expect(state.rows[0]?.signature_count).toBe(1);
    expect(state.rows[0]?.meterai_count).toBe(3);
  });

  it('marks exactly the offending row and leaves the others clean', () => {
    // §B7 row 4: Rina 2 signatures / 3 eMeterai. Budi stays legal.
    const state = setCounts(createSeedState(), 0, 2, 3);
    expect(totalsOf(state).meteraiExceeds).toEqual([true, false]);
  });

  it('treats equality as the boundary, not the failure', () => {
    const state = setCounts(createSeedState(), 0, 2, 2);
    expect(totalsOf(state).meteraiExceeds).toEqual([false, false]);
  });

  it('marks a second row on its own account, without clearing the first', () => {
    const both = setCounts(setCounts(createSeedState(), 0, 2, 3), 1, 1, 2);
    expect(totalsOf(both).meteraiExceeds).toEqual([true, true]);
  });

  it('clears the mark as soon as the row is made legal again', () => {
    const marked = setCounts(createSeedState(), 0, 2, 3);
    const repaired = run([{ type: 'INC', index: 0 }], marked); // 3 signatures
    expect(totalsOf(repaired).meteraiExceeds).toEqual([false, false]);
    // Raising signatures to clear it is the user's other option, and the bill
    // follows the counts, never the marking.
    expect(totalsOf(repaired).breakdown.totalSignatures).toBe(4);
  });

  it('still prices an over-stamped row — the bill follows the counts (§A4.12)', () => {
    const state = setCounts(createSeedState(), 0, 2, 3);
    // 3 signatures x 5000.00 + 3 meterai x 10000.10
    expect(totalsOf(state).totalCharge).toBe('45000.30');
  });
});

describe('the exact combined cost (§B7 rows 1–2, ADR-006)', () => {
  it('row 1 — Rina 2 sig / 1 met, Budi 1 sig / 0 met', () => {
    const state = setCounts(createSeedState(), 0, 2, 1);
    const { breakdown, balance, signatureCharge, meteraiCharge, totalCharge } = totalsOf(state);

    expect(breakdown.totalSignatures).toBe(3);
    expect(breakdown.totalMeterai).toBe(1);
    expect(signatureCharge).toBe('15000.00');
    expect(meteraiCharge).toBe('10000.10');
    expect(totalCharge).toBe('25000.10');
    expect(balance.signature.remaining).toBe(5);
    expect(balance.meterai.remaining).toBe(2);
    expect(balance.signature.overBy).toBe(0);
    expect(balance.meterai.overBy).toBe(0);
  });

  it('row 1 — the per-row Charge column is each recipient\'s COMBINED cost (§A3.6)', () => {
    const state = setCounts(createSeedState(), 0, 2, 1);
    const { breakdown } = totalsOf(state);

    // Rina: 2 x 5000.00 + 1 x 10000.10 = 20000.10. Budi: 1 x 5000.00.
    expect(breakdown.rows[0]?.chargeMinor).toBe(2000010n);
    expect(breakdown.rows[1]?.chargeMinor).toBe(500000n);
    // ...and the rows sum to the total, so no cell can disagree with the bill.
    const summed = breakdown.rows.reduce((total, row) => total + row.chargeMinor, 0n);
    expect(summed).toBe(breakdown.totalChargeMinor);
  });

  it('row 2 — Rina 2 sig / 2 met, Budi 1 sig / 1 met: exactly at the meterai quota', () => {
    const state = setCounts(setCounts(createSeedState(), 0, 2, 2), 1, 1, 1);
    const { breakdown, balance, totalCharge } = totalsOf(state);

    expect(breakdown.totalMeterai).toBe(3);
    expect(totalCharge).toBe('45000.30');
    // The boundary is ALLOWED: nothing is over, and remaining is exactly 0.
    expect(balance.meterai.remaining).toBe(0);
    expect(balance.meterai.overBy).toBe(0);
  });

  it('keeps the non-zero fraction exact rather than rounding it away', () => {
    // 10000.10 is the value that breaks a float implementation; three of them
    // must be 30000.30 and not 30000.299999...
    const state = setCounts(createSeedState(), 0, 3, 3);
    expect(totalsOf(state).meteraiCharge).toBe('30000.30');
  });
});

describe('the two quotas are independent (§A3.5, §B7 row 3)', () => {
  it('reports a meterai shortfall on its own, with the signature quota untouched', () => {
    // One more than the allowance of 3, while signatures stay well inside 8.
    const state = setCounts(setCounts(createSeedState(), 0, 3, 3), 1, 1, 1);
    const { breakdown, balance } = totalsOf(state);

    expect(breakdown.totalMeterai).toBe(4);
    expect(balance.meterai.overBy).toBe(1);
    expect(balance.meterai.remaining).toBe(0); // clamped, never -1
    expect(balance.signature.overBy).toBe(0); // the other quota is fine
    expect(balance.signature.remaining).toBe(4);
  });

  it('reports a signature shortfall on its own, with the meterai quota untouched', () => {
    const state = setCounts(setCounts(createSeedState(), 0, 6, 0), 1, 3, 0);
    const { balance } = totalsOf(state);

    expect(balance.signature.overBy).toBe(1);
    expect(balance.signature.remaining).toBe(0);
    expect(balance.meterai.overBy).toBe(0);
    expect(balance.meterai.remaining).toBe(3);
  });

  it('reports BOTH when both are busted — neither hides the other', () => {
    const state = setCounts(setCounts(createSeedState(), 0, 6, 3), 1, 3, 1);
    const { balance } = totalsOf(state);

    expect(balance.signature.overBy).toBe(1);
    expect(balance.meterai.overBy).toBe(1);
  });
});

describe('no derived figure is stored (§A3.9)', () => {
  it('state carries counts and text only — no charge, no total, no quota', () => {
    const state = setCounts(createSeedState(), 0, 2, 1);
    const serialized = JSON.stringify(state);
    for (const forbidden of [
      'total_charge',
      'total_meterai',
      'total_signatures',
      'quota_remaining',
      'charge',
      'price',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(state).sort()).toEqual(['nextId', 'rows']);
  });

  it('the same rows always derive the same figures — there is nothing to drift', () => {
    const state = setCounts(createSeedState(), 0, 2, 1);
    expect(totalsOf(state).totalCharge).toBe(totalsOf(state).totalCharge);
    // ...and the price is never sourced locally: zero out the account and the
    // figures follow it, which is what ADR-003 means in practice.
    const free = deriveTotals(toRecipientInputs(state), {
      price: { signature: '0.00', meterai: '0.00' },
      quota: QUOTA,
    });
    expect(free.totalCharge).toBe('0.00');
  });
});
