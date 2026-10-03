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
 * Case 2 §A2 widened the key to the mode and the steps, so picking `sequential`
 * or moving one recipient invalidates a confirmed total for the same reason a
 * signature count does.
 *
 * **§A2.5 — the grouped view.** In `sequential` the rows are rendered inside a
 * labelled region per step; in `parallel` they are the flat Case-1 list, byte
 * for byte. The grouping comes from `stepViews`, which is the kernel's
 * `groupByStep`/`stepOf` plus the row index.
 *
 * **§A2.7 — focus after a move.** A row that changes step changes DOM parent,
 * so React re-creates its subtree and the browser has nothing left to keep
 * focus on. The step therefore restores it explicitly: a reorder records the
 * STABLE id of the control that was pressed (derived from the row's local id,
 * not its position), and a layout effect — before paint, so nothing flickers —
 * puts focus back on it. If that control became disabled by the very move it
 * performed (the row is now at the end of the chain), focus falls to the
 * opposite-direction control and then to the row itself, so there is no path
 * where a keyboard user is dropped onto `<body>`.
 *
 * **§A4 — `Continue` now leads somewhere, and it is TWO-PHASE.**
 *
 * Case 1 made this screen a terminal state: the server confirmed the figures
 * and the flow stopped, because Step 3 was out of scope (LD-13, ADR-005). Step
 * 3 is real now, so `Continue` has somewhere to go — but the server's answer is
 * still the gate, so the button does both jobs in order rather than one instead
 * of the other:
 *
 *   1. no server answer for THIS payload yet -> ask for one (the Case-1
 *      behaviour, byte for byte, including the summary swapping to the server's
 *      figures and the flow staying on this screen);
 *   2. the server has confirmed this exact payload -> go to Step 3.
 *
 * The visible gate text says which of the two the next press will do, so the
 * second press is never a surprise. Editing anything in between changes the
 * payload key, which makes the confirmation unreadable (seam S5) and puts the
 * button back in phase 1 — so a stale confirmation cannot be carried forward
 * and `Continue` cannot advance on figures the server never saw.
 *
 * **`fields` is NOT part of this screen's payload** (§B4). A Step-2 preview
 * submits no field collection at all, which is what makes the whole
 * reconciliation invariant vacuous for it; sending `fields: []` from here would
 * mean "a real Step 3 with nothing placed" and would turn every working Case-1,
 * P1 and P2 preview into `422 FIELD_COUNT_MISMATCH`. The key the panel reads
 * through omits it for exactly the same reason.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Dispatch } from 'react';

import {
  MAX_RECIPIENTS,
  findDuplicateEmailGroups,
  normalizeEmail,
  stepOf,
  validateMeteraiStepPlacement,
  validateRecipient,
  validateStepSequence,
  type EnvelopeCreatedResponse,
  type Minor,
  type OrderMode,
} from '@signed-doc/shared';

import { fetchChargePreview } from '../../api/charge-preview.js';
import { DisabledControl } from '../../components/DisabledControl.js';
import { deriveTotals } from './derive.js';
import { OrderModeSelector } from './OrderModeSelector.js';
import {
  RecipientRow,
  meteraiExceedsMessage,
  meteraiStepMessage,
  rowContainerId,
  stepControlId,
} from './RecipientRow.js';
import { SummaryPanel, overMeteraiQuotaMessage, overQuotaMessage } from './SummaryPanel.js';
import {
  canAddRecipient,
  canMergeStep,
  canMoveStep,
  canRemoveRecipient,
  toRecipientInputs,
  type RecipientsAction,
  type RecipientsState,
  type StepDirection,
} from './recipients-reducer.js';
import { stepGroupLabel, stepViews, type StepMember } from './step-groups.js';
import { PreviewController, previewKey, type PreviewTransport } from './preview-controller.js';

const CONTINUE_REASON_ID = 'recipients-continue-reason';
const OVER_QUOTA_ID = 'recipients-over-quota';
/** §A3.5 — its own id, so the two shortfalls are two describedby targets. */
const OVER_METERAI_QUOTA_ID = 'recipients-over-meterai-quota';

/** The real transport. Injectable so the step can be driven without a network. */
const httpTransport: PreviewTransport = (envelopeId, recipients, orderMode, signal) =>
  fetchChargePreview(envelopeId, recipients, orderMode, { signal });

const OPPOSITE: Record<StepDirection, StepDirection> = { earlier: 'later', later: 'earlier' };

export interface RecipientsStepProps {
  readonly envelope: EnvelopeCreatedResponse;
  readonly state: RecipientsState;
  readonly dispatch: Dispatch<RecipientsAction>;
  readonly onBack: () => void;
  /** §A4 — phase 2 of `Continue`, once the server has confirmed this payload. */
  readonly onContinueToFields: () => void;
  readonly previewTransport?: PreviewTransport;
}

export function RecipientsStep({
  envelope,
  state,
  dispatch,
  onBack,
  onContinueToFields,
  previewTransport = httpTransport,
}: RecipientsStepProps): JSX.Element {
  // ---------------------------------------------------------------- preview
  const controllerRef = useRef<PreviewController | null>(null);
  controllerRef.current ??= new PreviewController(previewTransport);
  const controller = controllerRef.current;

  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  useSyncExternalStore(subscribe, getSnapshot);

  // ------------------------------------------------------------ §A2.7 focus
  /**
   * The ids focus should land on after the next commit, best first. Set by a
   * reorder, consumed once by the layout effect below.
   */
  const pendingFocus = useRef<readonly string[] | null>(null);

  useLayoutEffect(() => {
    const candidates = pendingFocus.current;
    if (candidates === null) return;
    pendingFocus.current = null;

    for (const id of candidates) {
      const element = document.getElementById(id);
      if (!(element instanceof HTMLElement)) continue;
      // A control the move itself disabled cannot hold focus; try the next.
      if (element instanceof HTMLButtonElement && element.disabled) continue;
      element.focus();
      if (document.activeElement === element) return;
    }
  });

  // ---------------------------------------------------------------- derived
  const recipients = useMemo(() => toRecipientInputs(state), [state]);
  const key = previewKey(envelope.envelope_id, recipients, state.orderMode);
  const sequential = state.orderMode === 'sequential';

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

  /*
    §A3.3 per row. The kernel reports only the FIRST offender for a whole list,
    which is right for a server rejection and wrong for a screen that has to
    mark every row at fault — so the same kernel rule is asked once per row, on
    a one-element list. The verdict is still entirely the kernel's; only the
    wording is ours (`meteraiStepMessage`), exactly as §A3.2 already works.
    Vacuous in `parallel`, where the kernel returns `null` outright.
  */
  const meteraiStepFailures = recipients.map((recipient) =>
    validateMeteraiStepPlacement([recipient], state.orderMode),
  );
  // §A2.3 — belt and braces. Every structural action renormalizes through the
  // kernel, so this should never fire; if it ever does, it is a bug in this
  // package and the user is told rather than handed a `422`.
  const stepSequenceFailure = validateStepSequence(recipients, state.orderMode);

  const blockers: string[] = [];
  rowFailures.forEach((failure, index) => {
    if (failure) blockers.push(`Recipient ${index + 1}: ${failure.message}`);
  });
  recipients.forEach((recipient, index) => {
    if (meteraiExceeds[index]) {
      blockers.push(`Recipient ${index + 1}: ${meteraiExceedsMessage(recipient)}`);
    }
    // §A3.3 — its own sentence, naming the step, never folded into §A3.2's.
    if (meteraiStepFailures[index]) {
      blockers.push(`Recipient ${index + 1}: ${meteraiStepMessage(stepOf(recipient))}`);
    }
  });
  if (stepSequenceFailure) blockers.push(stepSequenceFailure.message);
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

  /*
    The singular locators, which the Case-2 rules use: `recipient_index` for the
    step rules and `recipient_email` for §A3.3, which names a recipient because
    an index alone is not enough to word a sentence about one. Kept apart from
    `serverFlagged` above on purpose — that one feeds the email field's
    "already used by another recipient" copy, and a step rejection must not
    borrow it.
  */
  const details = previewError?.details;
  const serverNamed = new Set<number>();
  if (typeof details?.recipient_index === 'number') serverNamed.add(details.recipient_index);
  if (typeof details?.recipient_email === 'string') {
    recipients.forEach((recipient, index) => {
      if (normalizeEmail(recipient.email) === details.recipient_email) serverNamed.add(index);
    });
  }

  /*
    §A4 — phase 2 is unlocked by `confirmed`, which is only non-null for the
    CURRENT payload key. That is the whole guard: there is no separate "is the
    confirmation still valid" flag to keep in sync, because reading the
    confirmation at all requires the key to still match (seam S5).
  */
  const readyToAdvance = confirmed !== null;

  const onContinue = () => {
    if (readyToAdvance) {
      onContinueToFields();
      return;
    }
    void controller.request(envelope.envelope_id, recipients, state.orderMode);
  };

  // --------------------------------------------------------------- §A2.6/§A2.7
  const reorder = (
    kind: 'move' | 'merge',
    index: number,
    direction: StepDirection,
  ): void => {
    const row = state.rows[index];
    if (!row) return;
    pendingFocus.current = [
      stepControlId(kind, direction, row.id),
      stepControlId(kind, OPPOSITE[direction], row.id),
      rowContainerId(row.id),
    ];
    dispatch(
      kind === 'move'
        ? { type: 'MOVE_STEP', index, direction }
        : { type: 'MERGE_STEP', index, direction },
    );
  };

  const onOrderModeChange = (mode: OrderMode): void => {
    pendingFocus.current = [`order-mode-${mode}`];
    dispatch({ type: 'SET_ORDER_MODE', mode });
  };

  const renderRow = ({ row, index }: StepMember): JSX.Element => (
    <RecipientRow
      key={row.id}
      index={index}
      row={row}
      unitPrice={unitPrice}
      meteraiPrice={meteraiPrice}
      chargeMinor={breakdown.rows[index]?.chargeMinor ?? (0n as Minor)}
      duplicate={duplicateIndexes.has(index) || serverFlagged.has(index)}
      meteraiExceedsSignatures={meteraiExceeds[index] ?? false}
      meteraiOutsideFirstStep={Boolean(meteraiStepFailures[index])}
      sequential={sequential}
      canReorder={{
        move: {
          earlier: canMoveStep(state, index, 'earlier'),
          later: canMoveStep(state, index, 'later'),
        },
        merge: {
          earlier: canMergeStep(state, index, 'earlier'),
          later: canMergeStep(state, index, 'later'),
        },
      }}
      serverIssue={serverNamed.has(index) ? previewError?.message ?? null : null}
      onMoveStep={(i, direction) => reorder('move', i, direction)}
      onMergeStep={(i, direction) => reorder('merge', i, direction)}
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
  );

  return (
    <main className="board">
      <h1>Who signs it?</h1>
      <p className="board__sub">
        {sequential
          ? 'Each step is invited only once everybody in the step before it is done. Fields are placed manually in the next step.'
          : 'Everyone below is invited at the same time. Fields are placed manually in the next step.'}
      </p>

      {/* §A2 — the mode selector sits ABOVE the list, as the brief places it. */}
      <OrderModeSelector value={state.orderMode} onChange={onOrderModeChange} />

      <div className="signer-row signer-row__head" aria-hidden="true">
        <span>Full name</span>
        <span>Email address</span>
        <span>Signatures</span>
        <span>eMeterai</span>
        <span>Charge</span>
        <span />
      </div>

      <div className={sequential ? 'signers signers--sequential' : 'signers'}>
        {sequential
          ? stepViews(state).map((group) => (
              /*
                §A2.5 — one labelled region per step, with the header visible
                and the shared-step case spelled out rather than implied.
              */
              <section
                className="step-group"
                key={group.step}
                aria-label={stepGroupLabel(group.step, group.members.length)}
              >
                <h2 className="step-group__head">
                  <span className="step-group__number">{`Step ${group.step}`}</span>
                  <span className="step-group__note">
                    {group.members.length === 1
                      ? '1 recipient'
                      : `${group.members.length} recipients — they sign in parallel within this step`}
                  </span>
                </h2>
                {group.members.map(renderRow)}
              </section>
            ))
          : state.rows.map((row, index) => renderRow({ row, index }))}
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
            <li>
              {readyToAdvance
                ? 'Server-confirmed. Continue goes on to Step 3, where the boxes are placed.'
                : 'Ready. Continue asks the server for the authoritative total.'}
            </li>
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
