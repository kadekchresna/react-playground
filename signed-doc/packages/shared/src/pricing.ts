/**
 * Derived totals (PRD §8.6).
 *
 * Pure, component-free and dependency-free, so "totals are derived state, never
 * separately-synced state" is structurally true rather than a rule someone has
 * to remember: there is no place to store a total here.
 *
 * Prices and quotas arrive as RECORDS keyed by resource, not as scalars
 * (seam S2). Case 2 collects on that: e-meterai (`test_2_en.md` §A3.6) is an
 * added key here, not a new parameter on every caller.
 *
 * This module never sources a price or a quota (ADR-003) — if it did, the
 * demo account's commercial terms would ship in the browser bundle. It also
 * does no validation: `quota.ts` turns a balance into a rejection, this file
 * only ever computes.
 */

import { multiplyMinor, sumMinor, type Minor } from './money.js';
import { meteraiCountOf, signatureCountOf } from './recipient.js';
import type { RecipientInput } from './types.js';

/** Unit prices in minor units, keyed by the resource being charged. */
export interface PriceTable {
  readonly signature: Minor;
  readonly meterai: Minor;
}

/** Allowances, keyed by resource. The two are independent (§A3.5). */
export interface QuotaTable {
  readonly signature: number;
  readonly meterai: number;
}

/** Consumption, keyed by resource — the same shape as `QuotaTable`. */
export interface QuotaUsage {
  readonly signature: number;
  readonly meterai: number;
}

/** Money lines making up a total, keyed by resource. */
export interface ChargeTable {
  readonly signature: Minor;
  readonly meterai: Minor;
}

/**
 * One recipient's row in the table. `chargeMinor` is that recipient's COMBINED
 * cost (§A3.6) — signatures and meterai together, which is what the per-row
 * `Charge` column shows.
 */
export interface ChargeRow {
  readonly index: number;
  readonly signatures: number;
  readonly meterai: number;
  readonly chargeMinor: Minor;
}

export interface ChargeBreakdown {
  readonly rows: readonly ChargeRow[];
  readonly totalSignatures: number;
  readonly totalMeterai: number;
  /**
   * Per-resource money lines — the `{n} signatures x price` and
   * `{m} eMeterai x price` lines the summary shows separately (§A3.7).
   */
  readonly charges: ChargeTable;
  /** Sum of every line in `charges`. */
  readonly totalChargeMinor: Minor;
}

export interface QuotaBalance {
  /** Never negative — clamped at 0 (LD-17). */
  readonly remaining: number;
  /** How far past the quota the list is; 0 when inside it. */
  readonly overBy: number;
}

/** Per-resource balance, keyed the same way as `QuotaTable`. */
export interface QuotaStatus {
  readonly signature: QuotaBalance;
  readonly meterai: QuotaBalance;
}

/**
 * Per-row charges plus the totals, all exact (`bigint` throughout).
 *
 * Both counts are read through the kernel's lenient accessors: the frontend
 * calls this on every keystroke, so a row can be mid-edit and invalid, and such
 * a row contributes 0 rather than poisoning the total with `NaN`. The row is
 * separately marked invalid by `validateRecipient`, and the server refuses the
 * request outright.
 *
 * The two priced lines are summed independently and only then added together,
 * so `charges.signature`, `charges.meterai` and `totalChargeMinor` are exactly
 * the three figures §A3.7's summary shows — the kernel is not asked to
 * reconstruct a line the UI would otherwise have to recompute.
 */
export function computeCharges(
  rs: readonly RecipientInput[],
  prices: PriceTable,
): ChargeBreakdown {
  const list = Array.isArray(rs) ? rs : [];

  const rows: ChargeRow[] = list.map((r, index) => {
    const signatures = signatureCountOf(r);
    const meterai = meteraiCountOf(r);
    return {
      index,
      signatures,
      meterai,
      // §A3.6: the per-row `Charge` column is this recipient's combined cost.
      chargeMinor:
        multiplyMinor(prices.signature, signatures) + multiplyMinor(prices.meterai, meterai),
    };
  });

  const totalSignatures = rows.reduce((total, row) => total + row.signatures, 0);
  const totalMeterai = rows.reduce((total, row) => total + row.meterai, 0);

  const signatureCharge = multiplyMinor(prices.signature, totalSignatures);
  const meteraiCharge = multiplyMinor(prices.meterai, totalMeterai);

  return {
    rows,
    totalSignatures,
    totalMeterai,
    charges: { signature: signatureCharge, meterai: meteraiCharge },
    totalChargeMinor: sumMinor([signatureCharge, meteraiCharge]),
  };
}

/**
 * Remaining allowance per resource, clamped at 0, plus how far over the list is
 * (LD-17 — the UI shows `9 of 8 signatures — 1 over your quota`).
 *
 * The resources are computed independently and never combined: §A3.5 requires a
 * shortfall in either to be visible on its own, and §A3.8 shows both usages at
 * once (`Signature 3/8` and `eMeterai 1/3`).
 *
 * Case 1 never consumes quota: this is a pure computation over what the list
 * asks for (LD-18).
 */
export function quotaRemaining(used: QuotaUsage, quota: QuotaTable): QuotaStatus {
  return {
    signature: balance(used.signature, quota.signature),
    meterai: balance(used.meterai, quota.meterai),
  };
}

function balance(used: number, quota: number): QuotaBalance {
  const consumed = Number.isFinite(used) ? used : 0;
  const allowance = Number.isFinite(quota) ? quota : 0;
  return {
    remaining: Math.max(0, allowance - consumed),
    overBy: Math.max(0, consumed - allowance),
  };
}
