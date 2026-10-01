/**
 * Written BEFORE `pricing.ts`. Every expected figure is hand-derived from the
 * PRD §6 fixtures (price per signature `"5000.00"`, signature quota `8`) and
 * from the PRD §10 acceptance rows:
 *
 *   Rina 2 signatures -> 2 * 5000.00 = 10000.00
 *   Budi 1 signature  -> 1 * 5000.00 =  5000.00
 *   total signatures  -> 3
 *   total charge      -> 15000.00
 *   quota remaining   -> 8 - 3 = 5
 *
 *   Quota boundary (PRD §11.1):
 *     used 8 of 8 -> remaining 0, over by 0   (exactly at the limit is allowed)
 *     used 9 of 8 -> remaining 0, over by 1   (remaining clamps at 0, LD-17)
 *
 * CASE 2 (`test_2_en.md` §A3.6, §A3.7, §B1, §B7) adds a second priced line at
 * `"10000.10"` with its own quota of `3`, hand-derived the same way:
 *
 *   §B7.1  Rina 2 sig / 1 met, Budi 1 sig / 0 met
 *          signatures 3 -> 3 * 5000.00  = 15000.00
 *          meterai    1 -> 1 * 10000.10 = 10000.10
 *          total                          25000.10
 *          per row: Rina 10000.00 + 10000.10 = 20000.10; Budi 5000.00
 *          remaining 8 - 3 = 5 signatures, 3 - 1 = 2 meterai
 *
 *   §B7.2  Rina 2 sig / 2 met, Budi 1 sig / 1 met
 *          signatures 3 -> 15000.00
 *          meterai    3 -> 3 * 10000.10 = 30000.30
 *          total                          45000.30
 *          per row: Rina 10000.00 + 20000.20 = 30000.20; Budi 5000.00 + 10000.10 = 15000.10
 *          remaining meterai 3 - 3 = 0, over by 0 — exactly at quota is ALLOWED
 *
 *   §B7.3  one more meterai, 4 of 3 -> remaining 0, over by 1
 *
 * In minor units: `"5000.00"` is `500000n`, `"10000.10"` is `1000010n`. The
 * second price is the one a float implementation gets wrong, which is why
 * `10000.10 * 3 = 30000.30` is asserted directly rather than via a total.
 *
 * Price and quota are PARAMETERS in every call below. That is the point of
 * ADR-003: this module cannot become authoritative about what things cost,
 * because it is never told unless asked.
 */
import { describe, expect, it } from 'vitest';

import { formatDecimalString, parseDecimalString } from '../money.js';
import { computeCharges, quotaRemaining } from '../pricing.js';
import type { RecipientInput } from '../types.js';

const PRICES = {
  signature: parseDecimalString('5000.00'),
  meterai: parseDecimalString('10000.10'),
};
const QUOTA = { signature: 8, meterai: 3 };

function signer(name: string, signature_count: number, meterai_count = 0): RecipientInput {
  return {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
    signature_count,
    meterai_count,
  };
}

describe('computeCharges (PRD §8.6, §10 Rina/Budi row)', () => {
  it('derives per-row charges, total signatures and the total charge', () => {
    const breakdown = computeCharges([signer('Rina Halim', 2), signer('Budi Santoso', 1)], PRICES);

    expect(breakdown.totalSignatures).toBe(3);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('15000.00');
    expect(formatDecimalString(breakdown.charges.signature)).toBe('15000.00');

    expect(breakdown.rows).toHaveLength(2);
    expect(breakdown.rows[0]).toEqual({ index: 0, signatures: 2, meterai: 0, chargeMinor: 1000000n });
    expect(breakdown.rows[1]).toEqual({ index: 1, signatures: 1, meterai: 0, chargeMinor: 500000n });
    expect(formatDecimalString(breakdown.rows[0]!.chargeMinor)).toBe('10000.00');
    expect(formatDecimalString(breakdown.rows[1]!.chargeMinor)).toBe('5000.00');
  });

  it('totals an empty list to zero rather than throwing', () => {
    const breakdown = computeCharges([], PRICES);
    expect(breakdown.rows).toEqual([]);
    expect(breakdown.totalSignatures).toBe(0);
    expect(breakdown.totalMeterai).toBe(0);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('0.00');
    expect(formatDecimalString(breakdown.charges.signature)).toBe('0.00');
    expect(formatDecimalString(breakdown.charges.meterai)).toBe('0.00');
  });

  it('is exact at the maximum a document can reach', () => {
    // 10 recipients * 20 signatures = 200 signatures * 5000.00 = 1000000.00
    const many = Array.from({ length: 10 }, (_, i) => signer(`Signer ${i}`, 20));
    const breakdown = computeCharges(many, PRICES);
    expect(breakdown.totalSignatures).toBe(200);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('1000000.00');
  });

  it('stays exact with a fractional unit price, where a float would drift', () => {
    // 10000.10 * 3 = 30000.30; as floats this is 30000.299999999996.
    const breakdown = computeCharges([signer('Rina Halim', 3)], {
      signature: parseDecimalString('10000.10'),
      meterai: parseDecimalString('10000.10'),
    });
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('30000.30');

    // 10000.10 + 20000.20 = 30000.30 across two rows as well.
    const split = computeCharges([signer('Rina Halim', 1), signer('Budi Santoso', 2)], {
      signature: parseDecimalString('10000.10'),
      meterai: parseDecimalString('10000.10'),
    });
    expect(formatDecimalString(split.totalChargeMinor)).toBe('30000.30');
  });

  it('reads the price from the record it is given, never from a constant', () => {
    const doubled = computeCharges([signer('Rina Halim', 2)], {
      signature: parseDecimalString('10000.00'),
      meterai: parseDecimalString('0.01'),
    });
    expect(formatDecimalString(doubled.totalChargeMinor)).toBe('20000.00');
  });

  it('contributes nothing for a row whose count is not a valid integer', () => {
    // The UI can call this mid-edit; a malformed row must not poison the total.
    const breakdown = computeCharges(
      [
        signer('Rina Halim', 2),
        {
          name: 'Budi',
          email: 'b@example.test',
          signature_count: Number.NaN,
          meterai_count: Number.NaN,
        },
      ],
      PRICES,
    );
    expect(breakdown.totalSignatures).toBe(2);
    expect(breakdown.totalMeterai).toBe(0);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('10000.00');
    expect(breakdown.rows[1]).toEqual({ index: 1, signatures: 0, meterai: 0, chargeMinor: 0n });
  });
});

describe('computeCharges — two priced lines (§A3.6, §A3.7, §B7.1, §B7.2)', () => {
  it('reproduces §B7.1 exactly: 15000.00 + 10000.10 = 25000.10', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 1), signer('Budi Santoso', 1, 0)],
      PRICES,
    );

    expect(breakdown.totalSignatures).toBe(3);
    expect(breakdown.totalMeterai).toBe(1);

    // The summary's two lines, separately (§A3.7).
    expect(formatDecimalString(breakdown.charges.signature)).toBe('15000.00');
    expect(formatDecimalString(breakdown.charges.meterai)).toBe('10000.10');
    // ...and then the combined total.
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('25000.10');
    expect(breakdown.totalChargeMinor).toBe(2500010n);
  });

  it('gives each row its COMBINED cost (§A3.6)', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 1), signer('Budi Santoso', 1, 0)],
      PRICES,
    );

    // Rina: 2 * 5000.00 + 1 * 10000.10 = 20000.10
    expect(breakdown.rows[0]).toEqual({
      index: 0,
      signatures: 2,
      meterai: 1,
      chargeMinor: 2000010n,
    });
    expect(formatDecimalString(breakdown.rows[0]!.chargeMinor)).toBe('20000.10');

    // Budi: 1 * 5000.00 + 0 * 10000.10 = 5000.00
    expect(breakdown.rows[1]).toEqual({
      index: 1,
      signatures: 1,
      meterai: 0,
      chargeMinor: 500000n,
    });
    expect(formatDecimalString(breakdown.rows[1]!.chargeMinor)).toBe('5000.00');
  });

  it('reproduces §B7.2 exactly: 15000.00 + 30000.30 = 45000.30', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 2), signer('Budi Santoso', 1, 1)],
      PRICES,
    );

    expect(breakdown.totalSignatures).toBe(3);
    expect(breakdown.totalMeterai).toBe(3);
    expect(formatDecimalString(breakdown.charges.signature)).toBe('15000.00');
    expect(formatDecimalString(breakdown.charges.meterai)).toBe('30000.30');
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('45000.30');
    expect(breakdown.totalChargeMinor).toBe(4500030n);

    // Rina: 10000.00 + 20000.20 = 30000.20; Budi: 5000.00 + 10000.10 = 15000.10
    expect(formatDecimalString(breakdown.rows[0]!.chargeMinor)).toBe('30000.20');
    expect(formatDecimalString(breakdown.rows[1]!.chargeMinor)).toBe('15000.10');
  });

  it('keeps the two lines summing to the total, cent for cent', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 2), signer('Budi Santoso', 1, 1)],
      PRICES,
    );
    expect(breakdown.charges.signature + breakdown.charges.meterai).toBe(
      breakdown.totalChargeMinor,
    );
    const rowSum = breakdown.rows.reduce((total, row) => total + row.chargeMinor, 0n);
    expect(rowSum).toBe(breakdown.totalChargeMinor);
  });

  it('reads the meterai price from the record it is given, never from a constant', () => {
    const cheap = computeCharges([signer('Rina Halim', 1, 1)], {
      signature: parseDecimalString('5000.00'),
      meterai: parseDecimalString('1.00'),
    });
    expect(formatDecimalString(cheap.charges.meterai)).toBe('1.00');
    expect(formatDecimalString(cheap.totalChargeMinor)).toBe('5001.00');
  });

  it('defaults an absent meterai_count to 0 instead of poisoning the total (§B1)', () => {
    const legacy = [
      { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2 },
      { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1 },
    ] as RecipientInput[];
    const breakdown = computeCharges(legacy, PRICES);
    expect(breakdown.totalMeterai).toBe(0);
    expect(formatDecimalString(breakdown.charges.meterai)).toBe('0.00');
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('15000.00');
  });

  it('ignores a meterai_count outside 0..3 rather than billing it', () => {
    // The strict rules refuse such a row outright; pricing must not meanwhile
    // invent a charge for it.
    const breakdown = computeCharges([signer('Rina Halim', 2, 9)], PRICES);
    expect(breakdown.totalMeterai).toBe(0);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('10000.00');
  });
});

describe('quotaRemaining (PRD §8.7, §11.1 quota boundary, LD-17)', () => {
  it('reports the remainder for the PRD §10 Rina + Budi row', () => {
    expect(quotaRemaining({ signature: 3, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 5, overBy: 0 },
      meterai: { remaining: 3, overBy: 0 },
    });
  });

  it('treats the boundary as inside the quota', () => {
    expect(quotaRemaining({ signature: 8, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 0 },
      meterai: { remaining: 3, overBy: 0 },
    });
  });

  it('clamps remaining at 0 and reports how far over the list is', () => {
    expect(quotaRemaining({ signature: 9, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 1 },
      meterai: { remaining: 3, overBy: 0 },
    });
    // Two recipients at 3 signatures each is 6 — inside quota.
    expect(quotaRemaining({ signature: 6, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 2, overBy: 0 },
      meterai: { remaining: 3, overBy: 0 },
    });
    // PRD §10: two recipients at 3 each in a 3-recipient list is 9 — over.
    expect(quotaRemaining({ signature: 200, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 192 },
      meterai: { remaining: 3, overBy: 0 },
    });
  });

  it('handles an empty list', () => {
    expect(quotaRemaining({ signature: 0, meterai: 0 }, QUOTA)).toEqual({
      signature: { remaining: 8, overBy: 0 },
      meterai: { remaining: 3, overBy: 0 },
    });
  });

  it('reads the quota from the record it is given, never from a constant', () => {
    expect(quotaRemaining({ signature: 3, meterai: 0 }, { signature: 2, meterai: 3 })).toEqual({
      signature: { remaining: 0, overBy: 1 },
      meterai: { remaining: 3, overBy: 0 },
    });
    expect(quotaRemaining({ signature: 3, meterai: 0 }, { signature: 100, meterai: 3 })).toEqual({
      signature: { remaining: 97, overBy: 0 },
      meterai: { remaining: 3, overBy: 0 },
    });
  });
});

describe('quotaRemaining — the meterai quota, separately (§A3.5, §A3.8, §B7)', () => {
  it('reports §B7.1: 5 signatures and 2 meterai left', () => {
    expect(quotaRemaining({ signature: 3, meterai: 1 }, QUOTA)).toEqual({
      signature: { remaining: 5, overBy: 0 },
      meterai: { remaining: 2, overBy: 0 },
    });
  });

  it('reports §B7.2: 3 of 3 meterai leaves 0 and is NOT over', () => {
    expect(quotaRemaining({ signature: 3, meterai: 3 }, QUOTA)).toEqual({
      signature: { remaining: 5, overBy: 0 },
      meterai: { remaining: 0, overBy: 0 },
    });
  });

  it('reports §B7.3: one over the meterai quota, clamped at 0', () => {
    expect(quotaRemaining({ signature: 3, meterai: 4 }, QUOTA)).toEqual({
      signature: { remaining: 5, overBy: 0 },
      meterai: { remaining: 0, overBy: 1 },
    });
  });

  it('keeps the two resources independent in both directions', () => {
    expect(quotaRemaining({ signature: 9, meterai: 1 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 1 },
      meterai: { remaining: 2, overBy: 0 },
    });
    expect(quotaRemaining({ signature: 1, meterai: 9 }, QUOTA)).toEqual({
      signature: { remaining: 7, overBy: 0 },
      meterai: { remaining: 0, overBy: 6 },
    });
  });

  it('reads the meterai allowance from the record it is given', () => {
    expect(quotaRemaining({ signature: 0, meterai: 1 }, { signature: 8, meterai: 1 })).toEqual({
      signature: { remaining: 8, overBy: 0 },
      meterai: { remaining: 0, overBy: 0 },
    });
    expect(quotaRemaining({ signature: 0, meterai: 1 }, { signature: 8, meterai: 0 })).toEqual({
      signature: { remaining: 8, overBy: 0 },
      meterai: { remaining: 0, overBy: 1 },
    });
  });
});

describe('computeCharges + quotaRemaining compose the way charge-preview does', () => {
  it('reproduces the PRD §10 over-quota row end to end', () => {
    // Two recipients at 3 signatures each, plus a third at 3 => 9 of 8.
    const breakdown = computeCharges(
      [signer('Rina Halim', 3), signer('Budi Santoso', 3), signer('Citra Dewi', 3)],
      PRICES,
    );
    expect(breakdown.totalSignatures).toBe(9);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('45000.00');

    const balance = quotaRemaining(
      { signature: breakdown.totalSignatures, meterai: breakdown.totalMeterai },
      QUOTA,
    );
    expect(balance.signature.overBy).toBe(1);
    expect(balance.signature.remaining).toBe(0);
  });

  it('reproduces §B7.1 end to end, totals and both remainders', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 1), signer('Budi Santoso', 1, 0)],
      PRICES,
    );
    const balance = quotaRemaining(
      { signature: breakdown.totalSignatures, meterai: breakdown.totalMeterai },
      QUOTA,
    );

    expect(breakdown.totalSignatures).toBe(3);
    expect(breakdown.totalMeterai).toBe(1);
    expect(formatDecimalString(breakdown.charges.signature)).toBe('15000.00');
    expect(formatDecimalString(breakdown.charges.meterai)).toBe('10000.10');
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('25000.10');
    expect(balance.signature.remaining).toBe(5);
    expect(balance.meterai.remaining).toBe(2);
  });

  it('reproduces §B7.2 end to end: at the meterai quota, allowed', () => {
    const breakdown = computeCharges(
      [signer('Rina Halim', 2, 2), signer('Budi Santoso', 1, 1)],
      PRICES,
    );
    const balance = quotaRemaining(
      { signature: breakdown.totalSignatures, meterai: breakdown.totalMeterai },
      QUOTA,
    );

    expect(breakdown.totalMeterai).toBe(3);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('45000.30');
    expect(balance.meterai.remaining).toBe(0);
    expect(balance.meterai.overBy).toBe(0);
  });
});
