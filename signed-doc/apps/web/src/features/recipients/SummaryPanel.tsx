/**
 * The Step 2 summary (PRD §8.7, §8.9; LD-13, LD-17). Copy from mockup board 2.
 *
 * Every figure here is passed in already derived — computed in render from
 * `computeCharges` / `quotaRemaining` by the step above. Nothing is stored and
 * nothing is synchronized, so the panel cannot disagree with the rows (§8.6).
 *
 * Two modes:
 *
 * - **Estimate** (default). The frontend's responsive guess, labelled as such.
 * - **Server-confirmed** (LD-13). After `Continue` returns `200`, the server's
 *   own `total_signatures`, `price`, `total_charge` and `quota_remaining`
 *   replace the estimate and are labelled as final, with an inline note that
 *   Step 3 is outside this exercise. No navigation happens (ADR-005).
 *
 * Remaining quota is clamped at 0 by `quotaRemaining`, and the excess is shown
 * separately as `{total} of {quota} signatures — {over} over your quota`
 * (LD-17). That message is the `aria-describedby` target of the disabled
 * `Continue`, which is why its id is passed in rather than invented here.
 */

import type { ChargePreviewResponse } from '@signed-doc/shared';

import { formatIdr } from '../../format/money-display.js';

export interface SummaryPanelProps {
  readonly totalSignatures: number;
  /** Wire decimal string, server-issued. */
  readonly unitPrice: string;
  /** Wire decimal string, derived locally. */
  readonly totalCharge: string;
  readonly quotaTotal: number;
  readonly remaining: number;
  readonly overBy: number;
  /** Present only after a successful `Continue` for exactly this payload. */
  readonly confirmed: ChargePreviewResponse | null;
  readonly overQuotaMessageId: string;
}

export function overQuotaMessage(totalSignatures: number, quotaTotal: number, overBy: number): string {
  return `${totalSignatures} of ${quotaTotal} signatures — ${overBy} over your quota`;
}

export function SummaryPanel({
  totalSignatures,
  unitPrice,
  totalCharge,
  quotaTotal,
  remaining,
  overBy,
  confirmed,
  overQuotaMessageId,
}: SummaryPanelProps): JSX.Element {
  // LD-13: the server's figures win outright once they exist for this payload.
  const signatures = confirmed ? confirmed.total_signatures : totalSignatures;
  const price = confirmed ? confirmed.price.signature : unitPrice;
  const total = confirmed ? confirmed.total_charge : totalCharge;
  const quota = confirmed ? confirmed.quota.signature : quotaTotal;
  const left = confirmed ? confirmed.quota_remaining.signature : remaining;

  return (
    <section
      className={confirmed ? 'summary summary--confirmed' : 'summary'}
      aria-label="Charge summary"
    >
      <div className="summary__line">
        <span>
          {`${signatures} signatures × ${formatIdr(price)} per signature`}
        </span>
        {confirmed ? <span className="summary__badge">Server-confirmed</span> : <span>Estimate</span>}
      </div>

      <div className="summary__line">
        <span>Remaining signature quota</span>
        {/* LD-17: clamped at 0 by `quotaRemaining`; never negative. */}
        <span>{`${left} of ${quota}`}</span>
      </div>

      <div className="summary__line summary__total">
        <span>Total charge</span>
        <span>{formatIdr(total)}</span>
      </div>

      {overBy > 0 && !confirmed ? (
        <p className="summary__over-quota" id={overQuotaMessageId}>
          {overQuotaMessage(totalSignatures, quotaTotal, overBy)}
        </p>
      ) : null}

      <p className="summary__note">
        Deducted from your signature balance when the document is sent. Materai is billed
        separately.
      </p>

      {confirmed ? (
        <p className="summary__note">
          These are the server&rsquo;s figures and they are final; the number above the line was
          only an estimate. Step 3 (Place fields) is outside this exercise, so the flow stops
          here.
        </p>
      ) : (
        <p className="summary__note">
          An estimate computed in your browser. `Continue` asks the server, whose total is the
          authoritative one.
        </p>
      )}
    </section>
  );
}
