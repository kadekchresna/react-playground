/**
 * Derived totals (PRD §8.6).
 *
 * Pure, component-free and dependency-free, so "totals are derived state, never
 * separately-synced state" is structurally true rather than a rule someone has
 * to remember: there is no place to store a total here.
 *
 * Prices and quotas arrive as RECORDS keyed by resource, not as scalars
 * (seam S2). In Case 1 the only key is `signature`. A second priced line is
 * then an added key rather than a signature change on every caller.
 *
 * This module never sources a price or a quota (ADR-003) — if it did, the
 * demo account's commercial terms would ship in the browser bundle.
 */

import { multiplyMinor, sumMinor, type Minor } from './money.js';
import { isValidSignatureCount } from './recipient.js';
import type { RecipientInput } from './types.js';

/** Unit prices in minor units, keyed by the resource being charged. */
export interface PriceTable {
  readonly signature: Minor;
}

/** Allowances, keyed by resource. */
export interface QuotaTable {
  readonly signature: number;
}

/** Consumption, keyed by resource — the same shape as `QuotaTable`. */
export interface QuotaUsage {
  readonly signature: number;
}

/** Money lines making up a total, keyed by resource. */
export interface ChargeTable {
  readonly signature: Minor;
}

export interface ChargeRow {
  readonly index: number;
  readonly signatures: number;
  readonly chargeMinor: Minor;
}

export interface ChargeBreakdown {
  readonly rows: readonly ChargeRow[];
  readonly totalSignatures: number;
  /** Per-resource money lines. One key in Case 1 (seam S2). */
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
}

/**
 * A row's signature count as arithmetic can use it.
 *
 * The frontend calls `computeCharges` on every keystroke, so a row can be
 * mid-edit and invalid. Such a row contributes 0 instead of poisoning the total
 * with `NaN`; the row is separately marked invalid by `validateRecipient`, and
 * the server refuses the request outright.
 */
function signatureCountOf(r: RecipientInput): number {
  const count = (r as Partial<RecipientInput> | null)?.signature_count;
  return isValidSignatureCount(count) ? (count as number) : 0;
}

/** Per-row charges plus the totals, all exact (`bigint` throughout). */
export function computeCharges(
  rs: readonly RecipientInput[],
  prices: PriceTable,
): ChargeBreakdown {
  const list = Array.isArray(rs) ? rs : [];

  const rows: ChargeRow[] = list.map((r, index) => {
    const signatures = signatureCountOf(r);
    return { index, signatures, chargeMinor: multiplyMinor(prices.signature, signatures) };
  });

  const totalSignatures = rows.reduce((total, row) => total + row.signatures, 0);
  const signatureCharge = sumMinor(rows.map((row) => row.chargeMinor));

  return {
    rows,
    totalSignatures,
    charges: { signature: signatureCharge },
    totalChargeMinor: sumMinor([signatureCharge]),
  };
}

/**
 * Remaining allowance per resource, clamped at 0, plus how far over the list is
 * (LD-17 — the UI shows `9 of 8 signatures — 1 over your quota`).
 *
 * Case 1 never consumes quota: this is a pure computation over what the list
 * asks for (LD-18).
 */
export function quotaRemaining(used: QuotaUsage, quota: QuotaTable): QuotaStatus {
  return { signature: balance(used.signature, quota.signature) };
}

function balance(used: number, quota: number): QuotaBalance {
  const consumed = Number.isFinite(used) ? used : 0;
  const allowance = Number.isFinite(quota) ? quota : 0;
  return {
    remaining: Math.max(0, allowance - consumed),
    overBy: Math.max(0, consumed - allowance),
  };
}
