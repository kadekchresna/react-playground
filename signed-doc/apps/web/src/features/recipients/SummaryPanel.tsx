/**
 * The Step 2 summary (PRD §8.7, §8.9; LD-13, LD-17; Case 2 §A3.5, §A3.7, §A3.8).
 *
 * Every figure here is passed in already derived — computed in render from
 * `computeCharges` / `quotaRemaining` by the step above. Nothing is stored and
 * nothing is synchronized, so the panel cannot disagree with the rows (§8.6,
 * §A3.9).
 *
 * §A3.7's shape, in order: one priced line per resource, then the total.
 * `charges.signature` and `charges.meterai` arrive already summed by the
 * kernel, so neither line is reconstructed here — the panel multiplies nothing.
 * Each line shows its own money as `= Rp…`, which is both how a multiplication
 * line reads and what keeps the signature subtotal distinguishable from the
 * total when a list happens to carry no eMeterai and the two are equal.
 *
 * §A3.8's usage pair (`Signature 3/8`, `eMeterai 1/3`) is rendered as two
 * separate elements, each naming its own resource. §A3.5 is the reason: a
 * shortfall in either quota has to be legible as that quota's shortfall, so the
 * two overage messages below name different resources, carry different ids and
 * are never collapsed into one sentence.
 *
 * Two modes:
 *
 * - **Estimate** (default). The frontend's responsive guess, labelled as such.
 * - **Server-confirmed** (LD-13). After `Continue` returns `200`, the server's
 *   own counts, prices, charges, total and both `quota_remaining` figures
 *   replace the estimate and are labelled as final. Case 1 stopped there,
 *   because Step 3 was out of scope; Case 2 §A4 makes it a real step, so the
 *   confirmed note now says that the NEXT press of `Continue` goes on to place
 *   the boxes. The swap itself still happens without navigating — this panel
 *   appears, in full, on the screen the user is already on.
 *
 * Remaining quota is clamped at 0 by `quotaRemaining`, and each excess is shown
 * separately. Those messages are the `aria-describedby` targets of the disabled
 * `Continue`, which is why their ids are passed in rather than invented here.
 */

import type { ChargePreviewResponse } from '@signed-doc/shared';

import { formatIdr } from '../../format/money-display.js';

export interface SummaryPanelProps {
  readonly totalSignatures: number;
  readonly totalMeterai: number;
  /** Wire decimal strings, server-issued. */
  readonly unitPrice: string;
  readonly meteraiPrice: string;
  /** Wire decimal strings, derived locally from the kernel's per-resource lines. */
  readonly signatureCharge: string;
  readonly meteraiCharge: string;
  readonly totalCharge: string;
  readonly quotaTotal: number;
  readonly meteraiQuotaTotal: number;
  readonly remaining: number;
  readonly meteraiRemaining: number;
  readonly overBy: number;
  readonly meteraiOverBy: number;
  /** Present only after a successful `Continue` for exactly this payload. */
  readonly confirmed: ChargePreviewResponse | null;
  readonly overQuotaMessageId: string;
  readonly overMeteraiQuotaMessageId: string;
}

export function overQuotaMessage(totalSignatures: number, quotaTotal: number, overBy: number): string {
  return `${totalSignatures} of ${quotaTotal} signatures — ${overBy} over your quota`;
}

/**
 * §A3.5 — the eMeterai shortfall, worded so it cannot be mistaken for the
 * signature one: it names eMeterai twice and never says "signatures".
 */
export function overMeteraiQuotaMessage(
  totalMeterai: number,
  quotaTotal: number,
  overBy: number,
): string {
  return `${totalMeterai} of ${quotaTotal} eMeterai — ${overBy} over your eMeterai quota`;
}

export function SummaryPanel({
  totalSignatures,
  totalMeterai,
  unitPrice,
  meteraiPrice,
  signatureCharge,
  meteraiCharge,
  totalCharge,
  quotaTotal,
  meteraiQuotaTotal,
  remaining,
  meteraiRemaining,
  overBy,
  meteraiOverBy,
  confirmed,
  overQuotaMessageId,
  overMeteraiQuotaMessageId,
}: SummaryPanelProps): JSX.Element {
  // LD-13: the server's figures win outright once they exist for this payload.
  const signatures = confirmed ? confirmed.total_signatures : totalSignatures;
  const meterai = confirmed ? confirmed.total_meterai : totalMeterai;
  const price = confirmed ? confirmed.price.signature : unitPrice;
  const meteraiUnit = confirmed ? confirmed.price.meterai : meteraiPrice;
  const signatureLine = confirmed ? confirmed.charges.signature : signatureCharge;
  const meteraiLine = confirmed ? confirmed.charges.meterai : meteraiCharge;
  const total = confirmed ? confirmed.total_charge : totalCharge;
  const quota = confirmed ? confirmed.quota.signature : quotaTotal;
  const meteraiQuota = confirmed ? confirmed.quota.meterai : meteraiQuotaTotal;
  const left = confirmed ? confirmed.quota_remaining.signature : remaining;
  const meteraiLeft = confirmed ? confirmed.quota_remaining.meterai : meteraiRemaining;

  return (
    // Named by its own visible heading, so the title is announced once.
    <section
      className={confirmed ? 'summary summary--confirmed' : 'summary'}
      aria-labelledby="summary-heading"
    >
      <div className="summary__line summary__head">
        <h2 id="summary-heading">Charge summary</h2>
        {confirmed ? <span className="summary__badge">Server-confirmed</span> : <span>Estimate</span>}
      </div>

      {/* §A3.7 line 1 of 3. */}
      <div className="summary__line">
        <span>
          {`${signatures} signatures × ${formatIdr(price)} per signature`}
        </span>
        <span className="summary__amount">{`= ${formatIdr(signatureLine)}`}</span>
      </div>

      {/* §A3.7 line 2 of 3 — its own line, never folded into the signatures one. */}
      <div className="summary__line">
        <span>
          {`${meterai} eMeterai × ${formatIdr(meteraiUnit)} per eMeterai`}
        </span>
        <span className="summary__amount">{`= ${formatIdr(meteraiLine)}`}</span>
      </div>

      {/* §A3.8 — usage against BOTH quotas, each naming its own resource. */}
      <div className="summary__line summary__usage">
        <span>Quota used</span>
        <span>
          <span className={overBy > 0 ? 'quota-chip quota-chip--over' : 'quota-chip'}>
            {`Signature ${signatures}/${quota}`}
          </span>{' '}
          <span className={meteraiOverBy > 0 ? 'quota-chip quota-chip--over' : 'quota-chip'}>
            {`eMeterai ${meterai}/${meteraiQuota}`}
          </span>
        </span>
      </div>

      <div className="summary__line">
        <span>Remaining signature quota</span>
        {/* LD-17: clamped at 0 by `quotaRemaining`; never negative. */}
        <span>{`${left} of ${quota}`}</span>
      </div>

      <div className="summary__line">
        <span>Remaining eMeterai quota</span>
        <span>{`${meteraiLeft} of ${meteraiQuota}`}</span>
      </div>

      {/* §A3.7 line 3 of 3 — the sum of the two lines above. */}
      <div className="summary__line summary__total">
        <span>Total charge</span>
        <span>{formatIdr(total)}</span>
      </div>

      {/* §A3.5: two shortfalls, two messages, two ids. Either can appear alone. */}
      {overBy > 0 && !confirmed ? (
        <p className="summary__over-quota" id={overQuotaMessageId}>
          {overQuotaMessage(totalSignatures, quotaTotal, overBy)}
        </p>
      ) : null}

      {meteraiOverBy > 0 && !confirmed ? (
        <p className="summary__over-quota" id={overMeteraiQuotaMessageId}>
          {overMeteraiQuotaMessage(totalMeterai, meteraiQuotaTotal, meteraiOverBy)}
        </p>
      ) : null}

      <p className="summary__note">
        Deducted from your balances when the document is sent. Signatures and eMeterai are
        separate allowances and are charged separately.
      </p>

      {confirmed ? (
        <p className="summary__note">
          These are the server&rsquo;s figures and they are final; the numbers above the line were
          only an estimate. <code>Continue</code> now goes on to Step 3, where the signature and
          eMeterai boxes are placed on the document — and where the number of boxes has to match
          these counts exactly.
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
