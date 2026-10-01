/**
 * The demo account's commercial terms — prices and quotas.
 *
 * These live here and NOWHERE else (ADR-003). PRD §5 says they are known only
 * to the server, and `packages/shared` is bundled into the browser, so a
 * constant placed there would ship the account's terms to every visitor. The
 * kernel's pricing functions take these as parameters for exactly that reason.
 *
 * The browser learns the prices and quotas only from a server response: the
 * `201` body of `POST /api/envelopes` and the `200` body of `charge-preview`.
 *
 * Shape note (seam S2): prices and quotas are RECORDS keyed by the resource
 * being charged, not scalars. Case 1 had one key, `signature`; Case 2's
 * e-meterai (`test_2_en.md` §A3, §B1) is an added key here and nothing else —
 * no caller's signature changed, which is what the seam was for.
 *
 * The two record TYPES are the kernel's own (`PriceTable`, `QuotaTable`), not
 * local look-alikes. A type carries no value, so importing them ships nothing
 * to the browser; what it buys is that a third priced resource would fail to
 * compile HERE, in the one file that is allowed to know a commercial term,
 * instead of at some call site that merely passes the record along.
 */

import { parseDecimalString, type PriceTable, type QuotaTable } from '@signed-doc/shared';

export type { PriceTable, QuotaTable };

/**
 * Unit prices, parsed once from their decimal-string fixtures so neither value
 * is ever typed as a float anywhere in the process (ADR-006).
 *
 * `"10000.10"` (§B1) is precisely the fixture that would expose a float
 * implementation: `3 × 10000.10` is `30000.299999999996` in IEEE-754 and
 * `3000030n` here, which is why §B7.2's `"45000.30"` comes out exact.
 */
export const PRICES: PriceTable = {
  signature: parseDecimalString('5000.00'),
  meterai: parseDecimalString('10000.10'),
};

/**
 * The demo account's allowances: 8 signatures (PRD §6) and 3 e-meterai (§B1).
 *
 * They are INDEPENDENT (§A3.5) — a shortfall in either is blocked on its own —
 * and neither is consumed by a preview (LD-18).
 *
 * The meterai allowance of 3 is numerically equal to the kernel's
 * `MAX_METERAI_COUNT`, and that is a coincidence of the fixture, not a shared
 * constant: one bounds a single row, this one bounds a whole document.
 */
export const QUOTA: QuotaTable = { signature: 8, meterai: 3 };

/** What the services are injected with at the composition root. */
export interface AccountConfig {
  readonly prices: PriceTable;
  readonly quotas: QuotaTable;
}

export const ACCOUNT: AccountConfig = { prices: PRICES, quotas: QUOTA };
