/**
 * Step 2 — Set recipients (PRD §8.1–§8.12). Copy from mockup board 2.
 *
 * **Everything numeric on this screen is derived in render.** The per-row
 * combined charge, both totals, both priced lines, the total charge and both
 * remaining quotas all come from `computeCharges` / `quotaRemaining` on the
 * current rows, every render. There is no total in state and no effect that
 * synchronizes one, so the figures cannot drift (PRD §8.6, prompt §4 fact 9,
 * Case 2 §A3.9).
 *
 * **The gate** (PRD §8.8, §A3.5): `Continue` is disabled when any row fails
 * `validateRecipient`, when a row carries more eMeterai than signatures
 * (§A3.2), when a duplicate-email group exists, or when EITHER quota is
 * exceeded. Every active reason is listed as visible text, and the whole list
 * is the `aria-describedby` target — so two simultaneous blockers are both on
 * screen rather than collapsed into one generic message, and a signature
 * shortfall never reads as an eMeterai shortfall.
 *
 * **The staleness guard** (PRD §8.10, seam S5) is read-side as well as
 * write-side: the panel asks `resultFor(key)` for the CURRENT payload key. A
 * server answer computed for any other payload is structurally unreachable
 * from this render, not merely cleared by an effect that has to remember to run.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Dispatch } from 'react';

import {
  MAX_RECIPIENTS,
  findDuplicateEmailGroups,
  validateRecipient,
  type EnvelopeCreatedResponse,
  type Minor,
} from '@signed-doc/shared';

import { fetchChargePreview } from '../../api/charge-preview.js';
import { DisabledControl } from '../../components/DisabledControl.js';
import { deriveTotals } from './derive.js';
import { RecipientRow, meteraiExceedsMessage } from './RecipientRow.js';
import { SummaryPanel, overMeteraiQuotaMessage, overQuotaMessage } from './SummaryPanel.js';
import {
  canAddRecipient,
  canRemoveRecipient,
  toRecipientInputs,
  type RecipientsAction,
  type RecipientsState,
} from './recipients-reducer.js';
import { PreviewController, previewKey, type PreviewTransport } from './preview-controller.js';

const CONTINUE_REASON_ID = 'recipients-continue-reason';
const OVER_QUOTA_ID = 'recipients-over-quota';
/** §A3.5 — its own id, so the two shortfalls are two describedby targets. */
const OVER_METERAI_QUOTA_ID = 'recipients-over-meterai-quota';

/** The real transport. Injectable so the step can be driven without a network. */
const httpTransport: PreviewTransport = (envelopeId, recipients, signal) =>
  fetchChargePreview(envelopeId, recipients, { signal });

export interface RecipientsStepProps {
  readonly envelope: EnvelopeCreatedResponse;
  readonly state: RecipientsState;
  readonly dispatch: Dispatch<RecipientsAction>;
  readonly onBack: () => void;
  readonly previewTransport?: PreviewTransport;
}

export function RecipientsStep({
  envelope,
  state,
  dispatch,
  onBack,
  previewTransport = httpTransport,
}: RecipientsStepProps): JSX.Element {
  // ---------------------------------------------------------------- preview
  const controllerRef = useRef<PreviewController | null>(null);
  controllerRef.current ??= new PreviewController(previewTransport);
  const controller = controllerRef.current;

  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  useSyncExternalStore(subscribe, getSnapshot);

  // ---------------------------------------------------------------- derived
  const recipients = useMemo(() => toRecipientInputs(state), [state]);
  const key = previewKey(envelope.envelope_id, recipients);

  // Seam S5: any change to recipient data changes the key, which both aborts
  // in-flight work and makes the previous server result unreadable below.
  useEffect(() => {
    controller.syncKey(key);
  }, [controller, key]);

  useEffect(() => () => controller.dispose(), [controller]);

  const unitPrice = envelope.price.signature;
  const meteraiPrice = envelope.price.meterai;

  /*
    §A3.9 — every figure below is recomputed here, in render, from the rows as
    they are right now. `deriveTotals` is pure and uncached on purpose: there is
    no memo to invalidate, so a stale number is not merely unlikely, it has
    nowhere to live. §A3.2's per-row verdict comes back from the same call,
    which is why the footer reason and the row's red box cannot disagree.
  */
  const { breakdown, balance, signatureCharge, meteraiCharge, totalCharge, meteraiExceeds } =
    deriveTotals(recipients, envelope);

  // ------------------------------------------------------------- validation
  const rowFailures = recipients.map((recipient, index) => validateRecipient(recipient, index));
  const duplicateGroups = findDuplicateEmailGroups(recipients);
  const duplicateIndexes = new Set(duplicateGroups.flat());
  const overBy = balance.signature.overBy;
  const meteraiOverBy = balance.meterai.overBy;

  const blockers: string[] = [];
  rowFailures.forEach((failure, index) => {
    if (failure) blockers.push(`Recipient ${index + 1}: ${failure.message}`);
  });
  recipients.forEach((recipient, index) => {
    if (meteraiExceeds[index]) {
      blockers.push(`Recipient ${index + 1}: ${meteraiExceedsMessage(recipient)}`);
    }
  });
  for (const group of duplicateGroups) {
    blockers.push(
      `Recipients ${group.map((i) => i + 1).join(' and ')} use the same email address`,
    );
  }
  // §A3.5: two independent quotas, two independent blockers. Both can be on
  // screen at once and neither borrows the other's wording.
  if (overBy > 0) {
    blockers.push(overQuotaMessage(breakdown.totalSignatures, envelope.quota.signature, overBy));
  }
  if (meteraiOverBy > 0) {
    blockers.push(
      overMeteraiQuotaMessage(breakdown.totalMeterai, envelope.quota.meterai, meteraiOverBy),
    );
  }

  const canContinue = blockers.length === 0;

  // --------------------------------------------------- server answer, if any
  // Read-side half of the guard: only this payload's answer is reachable.
  const confirmed = controller.resultFor(key);
  const previewError = controller.errorFor(key);
  const previewLoading = controller.isLoadingFor(key);

  // Rows the SERVER flagged, used for reconciliation and message text only —
  // the primary marking above is local (LD-26).
  const serverFlagged = new Set(previewError?.details?.recipient_indexes ?? []);

  const onContinue = () => {
    void controller.request(envelope.envelope_id, recipients);
  };

  return (
    <main className="board">
      <h1>Who signs it?</h1>
      <p className="board__sub">
        Everyone below is invited at the same time. Fields are placed manually in the next step.
      </p>

      <div className="signer-row signer-row__head" aria-hidden="true">
        <span>Full name</span>
        <span>Email address</span>
        <span>Signatures</span>
        <span>eMeterai</span>
        <span>Charge</span>
        <span />
      </div>

      <div className="signers">
        {state.rows.map((row, index) => (
          <RecipientRow
            key={row.id}
            index={index}
            row={row}
            unitPrice={unitPrice}
            meteraiPrice={meteraiPrice}
            chargeMinor={breakdown.rows[index]?.chargeMinor ?? (0n as Minor)}
            duplicate={duplicateIndexes.has(index) || serverFlagged.has(index)}
            meteraiExceedsSignatures={meteraiExceeds[index] ?? false}
            canRemove={canRemoveRecipient(state)}
            onSetName={(i, value) => dispatch({ type: 'SET_NAME', index: i, value })}
            onSetEmail={(i, value) => dispatch({ type: 'SET_EMAIL', index: i, value })}
            onSetCountRaw={(i, raw) => dispatch({ type: 'SET_COUNT_RAW', index: i, raw })}
            onCommitCount={(i) => dispatch({ type: 'COMMIT_COUNT', index: i })}
            onIncrement={(i) => dispatch({ type: 'INC', index: i })}
            onDecrement={(i) => dispatch({ type: 'DEC', index: i })}
            onSetMeteraiRaw={(i, raw) => dispatch({ type: 'SET_METERAI_RAW', index: i, raw })}
            onCommitMeterai={(i) => dispatch({ type: 'COMMIT_METERAI', index: i })}
            onIncrementMeterai={(i) => dispatch({ type: 'INC_METERAI', index: i })}
            onDecrementMeterai={(i) => dispatch({ type: 'DEC_METERAI', index: i })}
            onRemove={(i) => dispatch({ type: 'REMOVE_ROW', index: i })}
          />
        ))}
      </div>

      <div className="add-signer">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canAddRecipient(state)}
          aria-disabled={canAddRecipient(state) ? undefined : 'true'}
          aria-describedby={canAddRecipient(state) ? undefined : 'add-signer-reason'}
          onClick={() => dispatch({ type: 'ADD_ROW' })}
        >
          <span aria-hidden="true">+ </span>Add signer
        </button>
        {/* LD-16: the ceiling is taught, not hidden. */}
        {canAddRecipient(state) ? null : (
          <span className="add-signer__reason" id="add-signer-reason">
            {`Maximum ${MAX_RECIPIENTS} recipients per document`}
          </span>
        )}
      </div>

      <SummaryPanel
        totalSignatures={breakdown.totalSignatures}
        totalMeterai={breakdown.totalMeterai}
        unitPrice={unitPrice}
        meteraiPrice={meteraiPrice}
        signatureCharge={signatureCharge}
        meteraiCharge={meteraiCharge}
        totalCharge={totalCharge}
        quotaTotal={envelope.quota.signature}
        meteraiQuotaTotal={envelope.quota.meterai}
        remaining={balance.signature.remaining}
        meteraiRemaining={balance.meterai.remaining}
        overBy={overBy}
        meteraiOverBy={meteraiOverBy}
        confirmed={confirmed}
        overQuotaMessageId={OVER_QUOTA_ID}
        overMeteraiQuotaMessageId={OVER_METERAI_QUOTA_ID}
      />

      {previewLoading ? (
        <p className="notice notice--info" role="status">
          Asking the server for the authoritative total&hellip;
        </p>
      ) : null}

      {previewError ? (
        <div className="notice notice--error" role="alert">
          <p className="notice__message">{previewError.message}</p>
          <p className="notice__meta">{`Server response: ${previewError.code}`}</p>
          <div className="notice__actions">
            {/* LD-29: user-driven retry. Nothing re-issues itself. */}
            <button type="button" className="btn btn--ghost" onClick={() => void controller.retry()}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      <div className="footer">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        {/* LD-05: out of scope, rendered honestly rather than removed. */}
        <DisabledControl id="save-as-draft" label="Save as draft" />
        <div className="footer__spacer" />

        {/*
          PRD §8.8 — every active reason is on screen and every one of them is
          part of the `aria-describedby` target. Two blockers stay two blockers.
        */}
        <ul
          className={canContinue ? 'gate-reason gate-reason--neutral' : 'gate-reason'}
          id={CONTINUE_REASON_ID}
        >
          {canContinue ? (
            <li>Ready. Continue asks the server for the authoritative total.</li>
          ) : (
            blockers.map((reason) => <li key={reason}>{reason}</li>)
          )}
        </ul>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!canContinue || previewLoading}
          aria-disabled={canContinue ? undefined : 'true'}
          /*
            §A3.5: each live shortfall adds its OWN message to the accessible
            description, so a screen reader hears "over your quota" and "over
            your eMeterai quota" as two facts rather than one.
          */
          aria-describedby={[
            CONTINUE_REASON_ID,
            overBy > 0 ? OVER_QUOTA_ID : null,
            meteraiOverBy > 0 ? OVER_METERAI_QUOTA_ID : null,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </main>
  );
}
