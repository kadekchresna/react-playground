/**
 * Everything Step 2 shows, derived from the recipient list (PRD §8.6, §A3.9).
 *
 * This module exists so that "all of these figures remain derived state" is a
 * property a unit test can hold, not a claim about a component. It is pure, it
 * imports no React, it stores nothing, and it is called fresh on every render:
 * there is no cache to invalidate and no effect to forget to run, so no figure
 * on the screen can drift from the rows above it.
 *
 * **It decides nothing itself.** Every rule comes from `@signed-doc/shared` —
 * `computeCharges` for both priced lines and the per-row combined cost,
 * `quotaRemaining` for the two independent balances, `meteraiWithinSignatures`
 * for §A3.2. The only thing this file adds is the plumbing: turning the
 * server's two wire prices into the kernel's `PriceTable` and the kernel's
 * `bigint` minor units back into wire decimal strings for rendering.
 *
 * **It never sources a price or a quota** (ADR-003). Both arrive in the
 * envelope the server issued at upload time, and both are passed straight
 * through.
 */

import {
  computeCharges,
  formatDecimalString,
  meteraiWithinSignatures,
  parseDecimalString,
  quotaRemaining,
  type ChargeBreakdown,
  type Minor,
  type PriceRecord,
  type QuotaRecord,
  type QuotaStatus,
  type RecipientInput,
} from '@signed-doc/shared';

export interface DerivedTotals {
  /** Per-row combined charges plus both totals and both priced lines (§A3.6). */
  readonly breakdown: ChargeBreakdown;
  /** Both balances, independently (§A3.5). */
  readonly balance: QuotaStatus;
  /** The §A3.7 summary lines, as wire decimal strings. */
  readonly signatureCharge: string;
  readonly meteraiCharge: string;
  readonly totalCharge: string;
  /**
   * §A3.2 per row, in list order: `true` means THIS row carries more duty
   * stamps than signatures. §B7 row 4 marks the row, never the whole form, so
   * this stays a per-row verdict all the way to the input's `aria-invalid`.
   */
  readonly meteraiExceeds: readonly boolean[];
}

/**
 * The price is a server-issued wire string, so a parse failure means the server
 * broke its own contract. Falling back to zero keeps the screen rendering
 * instead of throwing inside render; the figure is then visibly wrong rather
 * than invisibly wrong, and the server's `Continue` answer is unaffected.
 */
export function safeParse(money: string): Minor {
  try {
    return parseDecimalString(money);
  } catch {
    return 0n;
  }
}

export function deriveTotals(
  recipients: readonly RecipientInput[],
  account: { readonly price: PriceRecord; readonly quota: QuotaRecord },
): DerivedTotals {
  // Seam S2: a price TABLE keyed by resource, so Case 2's second priced line
  // was a new key here rather than a new parameter at every call site.
  const breakdown = computeCharges(recipients, {
    signature: safeParse(account.price.signature),
    meterai: safeParse(account.price.meterai),
  });

  const balance = quotaRemaining(
    { signature: breakdown.totalSignatures, meterai: breakdown.totalMeterai },
    { signature: account.quota.signature, meterai: account.quota.meterai },
  );

  return {
    breakdown,
    balance,
    signatureCharge: formatDecimalString(breakdown.charges.signature),
    meteraiCharge: formatDecimalString(breakdown.charges.meterai),
    totalCharge: formatDecimalString(breakdown.totalChargeMinor),
    meteraiExceeds: recipients.map((recipient) => !meteraiWithinSignatures(recipient)),
  };
}
