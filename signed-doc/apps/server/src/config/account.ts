/**
 * The demo account's commercial terms — price and quota.
 *
 * These live here and NOWHERE else (ADR-003). PRD §5 says they are known only
 * to the server, and `packages/shared` is bundled into the browser, so a
 * constant placed there would ship the account's terms to every visitor. The
 * kernel's pricing functions take these as parameters for exactly that reason.
 *
 * The browser learns the price and quota only from a server response: the `201`
 * body of `POST /api/envelopes` and the `200` body of `charge-preview`.
 *
 * Shape note (seam S2): prices and quotas are RECORDS keyed by the resource
 * being charged, not scalars. Case 1 has one key, `signature`. A second priced
 * line becomes an added key rather than a signature change on every caller.
 */

import { parseDecimalString, type Minor } from '@signed-doc/shared';

/** Unit prices in `bigint` minor units. PRD §6 fixture: `"5000.00"` per signature. */
export interface PriceTable {
  readonly signature: Minor;
}

/** Allowances in units of the resource. PRD §6 fixture: 8 signatures. */
export interface QuotaTable {
  readonly signature: number;
}

/**
 * Price per signature, parsed once from its decimal-string fixture so the value
 * is never typed as a float anywhere in the process (ADR-006).
 */
export const PRICES: PriceTable = { signature: parseDecimalString('5000.00') };

/** The demo account's signature allowance. Case 1 never consumes it (LD-18). */
export const QUOTA: QuotaTable = { signature: 8 };

/** What the services are injected with at the composition root. */
export interface AccountConfig {
  readonly prices: PriceTable;
  readonly quotas: QuotaTable;
}

export const ACCOUNT: AccountConfig = { prices: PRICES, quotas: QUOTA };
