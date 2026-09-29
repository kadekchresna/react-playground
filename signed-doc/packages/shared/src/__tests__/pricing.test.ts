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
 * Price and quota are PARAMETERS in every call below. That is the point of
 * ADR-003: this module cannot become authoritative about what things cost,
 * because it is never told unless asked.
 */
import { describe, expect, it } from 'vitest';

import { formatDecimalString, parseDecimalString } from '../money.js';
import { computeCharges, quotaRemaining } from '../pricing.js';
import type { RecipientInput } from '../types.js';

const PRICES = { signature: parseDecimalString('5000.00') };
const QUOTA = { signature: 8 };

function signer(name: string, signature_count: number): RecipientInput {
  return { name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`, signature_count };
}

describe('computeCharges (PRD §8.6, §10 Rina/Budi row)', () => {
  it('derives per-row charges, total signatures and the total charge', () => {
    const breakdown = computeCharges([signer('Rina Halim', 2), signer('Budi Santoso', 1)], PRICES);

    expect(breakdown.totalSignatures).toBe(3);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('15000.00');
    expect(formatDecimalString(breakdown.charges.signature)).toBe('15000.00');

    expect(breakdown.rows).toHaveLength(2);
    expect(breakdown.rows[0]).toEqual({ index: 0, signatures: 2, chargeMinor: 1000000n });
    expect(breakdown.rows[1]).toEqual({ index: 1, signatures: 1, chargeMinor: 500000n });
    expect(formatDecimalString(breakdown.rows[0]!.chargeMinor)).toBe('10000.00');
    expect(formatDecimalString(breakdown.rows[1]!.chargeMinor)).toBe('5000.00');
  });

  it('totals an empty list to zero rather than throwing', () => {
    const breakdown = computeCharges([], PRICES);
    expect(breakdown.rows).toEqual([]);
    expect(breakdown.totalSignatures).toBe(0);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('0.00');
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
    });
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('30000.30');

    // 10000.10 + 20000.20 = 30000.30 across two rows as well.
    const split = computeCharges([signer('Rina Halim', 1), signer('Budi Santoso', 2)], {
      signature: parseDecimalString('10000.10'),
    });
    expect(formatDecimalString(split.totalChargeMinor)).toBe('30000.30');
  });

  it('reads the price from the record it is given, never from a constant', () => {
    const doubled = computeCharges([signer('Rina Halim', 2)], {
      signature: parseDecimalString('10000.00'),
    });
    expect(formatDecimalString(doubled.totalChargeMinor)).toBe('20000.00');
  });

  it('contributes nothing for a row whose count is not a valid integer', () => {
    // The UI can call this mid-edit; a malformed row must not poison the total.
    const breakdown = computeCharges(
      [signer('Rina Halim', 2), { name: 'Budi', email: 'b@example.test', signature_count: Number.NaN }],
      PRICES,
    );
    expect(breakdown.totalSignatures).toBe(2);
    expect(formatDecimalString(breakdown.totalChargeMinor)).toBe('10000.00');
    expect(breakdown.rows[1]).toEqual({ index: 1, signatures: 0, chargeMinor: 0n });
  });
});

describe('quotaRemaining (PRD §8.7, §11.1 quota boundary, LD-17)', () => {
  it('reports the remainder for the PRD §10 Rina + Budi row', () => {
    expect(quotaRemaining({ signature: 3 }, QUOTA)).toEqual({
      signature: { remaining: 5, overBy: 0 },
    });
  });

  it('treats the boundary as inside the quota', () => {
    expect(quotaRemaining({ signature: 8 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 0 },
    });
  });

  it('clamps remaining at 0 and reports how far over the list is', () => {
    expect(quotaRemaining({ signature: 9 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 1 },
    });
    // Two recipients at 3 signatures each is 6 — inside quota.
    expect(quotaRemaining({ signature: 6 }, QUOTA)).toEqual({
      signature: { remaining: 2, overBy: 0 },
    });
    // PRD §10: two recipients at 3 each in a 3-recipient list is 9 — over.
    expect(quotaRemaining({ signature: 200 }, QUOTA)).toEqual({
      signature: { remaining: 0, overBy: 192 },
    });
  });

  it('handles an empty list', () => {
    expect(quotaRemaining({ signature: 0 }, QUOTA)).toEqual({
      signature: { remaining: 8, overBy: 0 },
    });
  });

  it('reads the quota from the record it is given, never from a constant', () => {
    expect(quotaRemaining({ signature: 3 }, { signature: 2 })).toEqual({
      signature: { remaining: 0, overBy: 1 },
    });
    expect(quotaRemaining({ signature: 3 }, { signature: 100 })).toEqual({
      signature: { remaining: 97, overBy: 0 },
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

    const balance = quotaRemaining({ signature: breakdown.totalSignatures }, QUOTA);
    expect(balance.signature.overBy).toBe(1);
    expect(balance.signature.remaining).toBe(0);
  });
});
