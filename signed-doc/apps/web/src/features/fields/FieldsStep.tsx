/**
 * Step 3 — Place fields (`test_2_en.md` §A4). Copy and layout from mockup
 * board 3: left panel (signer selector + field palette), the document canvas in
 * the centre, the reconciliation panel on the right, footer `Back` /
 * `Save as draft` / `Send`.
 *
 * **Everything on this screen is derived in render.** The reconciliation
 * report, every `Signature 1/2`, every flag on every box and the gate's list of
 * reasons all come from one `reconcileFields(recipients, fields)` call per
 * render. There is no report in state and no effect that synchronizes one, so
 * the box outlined as excess and the sentence explaining why cannot disagree
 * (§A3.9, and §A4.9 is the invariant they are both reading).
 *
 * **§A4.12 — pricing is not here at all.** This screen never computes a charge
 * and never sends one. The bill comes from the counts on Step 2, which is why
 * the kernel's `pricing.ts` has no field parameter and why this file does not
 * import it. The invariant is structural rather than a rule someone has to
 * remember.
 *
 * **§A4.2 / §B7.19 — placing a field by keyboard, without losing focus.**
 *
 * The palette's two controls are native buttons, so the mandatory path is
 * `Tab` to one and press `Enter` or `Space`; there is no pointer-only
 * affordance and no drag-and-drop to keep in sync with it. Focus is then
 * restored explicitly, not left to chance: a placement records the DOM id of
 * the box it is about to create — knowable in advance, because the field's id
 * comes from the reducer's monotonic `nextId` — and a LAYOUT effect (before
 * paint, so nothing flickers) puts focus on it. The box is a brand-new element
 * that does not exist when the button is pressed, so this is the only way focus
 * can land there, and disabling the effect provably changes
 * `document.activeElement`. The candidate list falls back to the palette button
 * that was pressed and then to the canvas, so there is no path on which a
 * keyboard user is dropped onto `<body>`.
 *
 * The same mechanism runs after a REMOVAL, where focus loss is not hypothetical:
 * the element that had focus is the element that just stopped existing.
 *
 * This is the third occurrence of the pattern (`RecipientsStep` uses it for
 * §A2.7's reorder), same convention, no new one invented.
 *
 * **§A4.7 — `Preview`, `Save as draft` and `Send` are out of scope and are
 * rendered as such**, through the same `DisabledControl` LD-05 built for `From
 * cloud`: `disabled` AND `aria-disabled`, with the reason as visible text the
 * control points at. `Send`'s only job would be P4's quota reservation, which
 * is not attempted, and its reason says exactly that — including that `Send`
 * would not email, sign or stamp anything even if it were built.
 *
 * What IS live in the footer is `Check charges`: the §B4 preview with `fields`
 * on it. That is not the mockup's canvas `Preview` button (a rendered view of
 * the document, which is the thing §A4.7 scopes out) — it is the Step-2
 * `Continue` request with the P3 half of the payload attached, and it is what
 * makes the server the authority on this screen too. It is gated on the
 * reconciliation invariant holding locally, exactly as Step 2's `Continue` is
 * gated on the quota: the point of §A4.6 is that the user sees `Signature 1/2`
 * and fixes it, rather than pressing a button to be told `422
 * FIELD_COUNT_MISMATCH`.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Dispatch } from 'react';

import {
  normalizeEmail,
  reconcileFields,
  type EnvelopeCreatedResponse,
  type FieldKind,
  type FieldPosition,
  type OrderMode,
  type RecipientInput,
} from '@signed-doc/shared';

import { fetchChargePreview } from '../../api/charge-preview.js';
import { DisabledControl } from '../../components/DisabledControl.js';
import { accessibleNameFor } from '../recipients/recipients-reducer.js';
import { PreviewController, previewKey, type PreviewTransport } from '../recipients/preview-controller.js';
import { FieldBox, type FieldFlag } from './FieldBox.js';
import {
  FieldPalette,
  SIGNER_SELECT_ID,
  meteraiPaletteVerdict,
  paletteButtonId,
  type SignerOption,
} from './FieldPalette.js';
import {
  ReconciliationPanel,
  excessNote,
  shortfallNote,
} from './ReconciliationPanel.js';
import { contentAreaStyle, fieldBoxId, ownerDisplayName, pageStyle } from './field-view.js';
import { fieldDomId, selectedOwnerOf, type FieldsAction, type FieldsState } from './fields-reducer.js';

const CANVAS_ID = 'document-canvas';
const SEND_REASON =
  'Send would only reserve quota and lock the envelope (change D). That is not attempted in ' +
  'this exercise, so there is nothing to press: no email, no signature and no duty stamp is ' +
  'ever applied by this button.';
const PREVIEW_REASON = 'Rendering a preview of the document is outside this exercise';
const GATE_REASON_ID = 'fields-gate-reason';

/** The real transport, with the P3 half of the §B4 payload attached. */
const httpTransport: PreviewTransport = (envelopeId, recipients, orderMode, signal, fields) =>
  fetchChargePreview(envelopeId, recipients, orderMode, { signal, fields });

export interface FieldsStepProps {
  readonly envelope: EnvelopeCreatedResponse;
  /** Already projected onto the wire shape by Step 2's own reducer. */
  readonly recipients: readonly RecipientInput[];
  readonly orderMode: OrderMode;
  readonly state: FieldsState;
  readonly dispatch: Dispatch<FieldsAction>;
  readonly onBack: () => void;
  readonly previewTransport?: PreviewTransport;
}

export function FieldsStep({
  envelope,
  recipients,
  orderMode,
  state,
  dispatch,
  onBack,
  previewTransport = httpTransport,
}: FieldsStepProps): JSX.Element {
  // ---------------------------------------------------------------- preview
  const controllerRef = useRef<PreviewController | null>(null);
  controllerRef.current ??= new PreviewController(previewTransport);
  const controller = controllerRef.current;

  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  useSyncExternalStore(subscribe, getSnapshot);

  // ------------------------------------------------------- §B7.19 focus
  /** The ids focus should land on after the next commit, best first. */
  const pendingFocus = useRef<readonly string[] | null>(null);

  useLayoutEffect(() => {
    const candidates = pendingFocus.current;
    if (candidates === null) return;
    pendingFocus.current = null;

    for (const id of candidates) {
      const element = document.getElementById(id);
      if (!(element instanceof HTMLElement)) continue;
      if (element instanceof HTMLButtonElement && element.disabled) continue;
      element.focus();
      if (document.activeElement === element) return;
    }
  });

  // ---------------------------------------------------------------- derived
  /*
    §A4.9's invariant as a value, recomputed every render. `fields` is the
    staleness key's input as well (below), so one state change moves the panel,
    the flags, the gate and the server's answer together or not at all.
  */
  const report = useMemo(
    () => reconcileFields(recipients, state.fields),
    [recipients, state.fields],
  );

  const key = previewKey(envelope.envelope_id, recipients, orderMode, state.fields);

  // Seam S5: a placed, moved or removed box changes the key, which both aborts
  // in-flight work and makes the previous server answer unreadable below.
  useEffect(() => {
    controller.syncKey(key);
  }, [controller, key]);

  useEffect(() => () => controller.dispose(), [controller]);

  const signers: readonly SignerOption[] = recipients.map((recipient, index) => ({
    index,
    recipient,
    email: normalizeEmail(recipient.email),
    label: `${accessibleNameFor(recipient, index)}${
      normalizeEmail(recipient.email) === '' ? ' (no email yet)' : ` · ${recipient.email.trim()}`
    }`,
  }));

  const selectedEmail = selectedOwnerOf(state, recipients);
  const selectedSigner = signers.find((signer) => signer.email === selectedEmail) ?? null;
  const meterai = meteraiPaletteVerdict(selectedSigner, orderMode);

  /*
    Which boxes are flagged, straight off the kernel's two lists. A `Set` per
    render rather than a `.includes` per box, and nothing else: deciding WHICH
    boxes are excess ("the later ones of a kind, beyond the count") is
    `reconcileFields`'s job and is not re-derived here.
  */
  const excessIds = new Set(report.excess_field_ids);
  const orphanIds = new Set(report.orphan_field_ids);
  const flagFor = (id: string): FieldFlag =>
    orphanIds.has(id) ? 'orphan' : excessIds.has(id) ? 'excess' : null;

  // ------------------------------------------------------------------- gate
  const blockers: string[] = [];
  if (report.orphan_field_ids.length > 0) {
    blockers.push(
      report.orphan_field_ids.length === 1
        ? '1 box belongs to somebody who is not on the recipient list — remove it, or add that recipient back on Step 2'
        : `${report.orphan_field_ids.length} boxes belong to somebody who is not on the recipient list — remove them, or add those recipients back on Step 2`,
    );
  }
  for (const row of report.rows) {
    if (row.satisfied) continue;
    const who = recipients[row.recipient_index]
      ? accessibleNameFor(recipients[row.recipient_index]!, row.recipient_index)
      : row.recipient_email;
    const notes = [
      shortfallNote('signature', row.missing.signature),
      shortfallNote('meterai', row.missing.meterai),
      excessNote('signature', row.excess.signature),
      excessNote('meterai', row.excess.meterai),
    ].filter((note): note is string => note !== null);
    blockers.push(`${who}: ${notes.join('; ')}`);
  }

  const canCheck = blockers.length === 0;

  // --------------------------------------------------- server answer, if any
  const confirmed = controller.resultFor(key);
  const previewError = controller.errorFor(key);
  const previewLoading = controller.isLoadingFor(key);

  // --------------------------------------------------------------- handlers
  const onSelectSigner = (email: string): void => {
    pendingFocus.current = [SIGNER_SELECT_ID];
    dispatch({ type: 'SELECT_SIGNER', email });
  };

  /**
   * §A4.2 — place one box for the selected signer.
   *
   * The new box's DOM id is computed BEFORE the dispatch, from the reducer's
   * `nextId`, which is why focus can be aimed at an element that does not exist
   * yet. The fallbacks keep a keyboard user on the control they pressed if the
   * box somehow fails to mount.
   */
  const onPlace = (kind: FieldKind): void => {
    if (selectedEmail === '') return;
    pendingFocus.current = [
      fieldBoxId(fieldDomId(state.nextId)),
      paletteButtonId(kind),
      CANVAS_ID,
    ];
    dispatch({ type: 'PLACE_FIELD', kind, owner: selectedEmail });
  };

  const onMove = (id: string, position: FieldPosition): void => {
    // The box keeps its identity across a move, so it keeps focus by itself;
    // aiming at it anyway costs nothing and survives a future re-key.
    pendingFocus.current = [fieldBoxId(id)];
    dispatch({ type: 'MOVE_FIELD', id, position });
  };

  const onRemove = (id: string): void => {
    const removed = state.fields.find((f) => f.id === id);
    // The focused element is about to stop existing, so focus has to be sent
    // somewhere deliberately — the palette button for the kind just removed, so
    // an accidental removal is one keypress away from being undone by hand.
    pendingFocus.current = [
      removed ? paletteButtonId(removed.kind) : paletteButtonId('signature'),
      SIGNER_SELECT_ID,
      CANVAS_ID,
    ];
    dispatch({ type: 'REMOVE_FIELD', id });
  };

  const onCheck = (): void => {
    void controller.request(envelope.envelope_id, recipients, orderMode, state.fields);
  };

  return (
    <main className="board board--fields">
      <h1>Place the fields</h1>
      <p className="board__sub">
        Choose a signer, then add their signature and eMeterai boxes to the page. The number of
        boxes has to match the counts you set on Step 2. Page 1 only — this document has one page
        in this exercise.
      </p>

      <div className="place-fields">
        <FieldPalette
          signers={signers}
          selectedEmail={selectedEmail}
          selectedSigner={selectedSigner}
          meteraiAllowed={meterai.allowed}
          meteraiBlockedReason={meterai.reason}
          onSelectSigner={onSelectSigner}
          onPlace={onPlace}
        />

        <div className="place-fields__canvas">
          <div className="place-fields__canvas-bar">
            {/* §A4.7 — the mockup's canvas control, rendered honestly. */}
            <DisabledControl id="fields-preview" label="Preview" reason={PREVIEW_REASON} />
          </div>

          {/*
            §B2 — the page and, inside it, the content area the coordinates are
            relative to. Both are sized from the kernel's constants, so `x` is
            literally `left` and nothing subtracts the padding back out.
          */}
          <div className="doc-page" style={pageStyle}>
            <div
              className="doc-content"
              id={CANVAS_ID}
              style={contentAreaStyle}
              role="group"
              aria-label="Document page 1 — placed fields"
              tabIndex={-1}
            >
              <h2 className="doc-content__title">Vendor Service Agreement</h2>
              <p className="doc-content__body">
                This agreement is entered into between PT Contoh Nusantara and the vendor named
                below. Signatures and eMeterai are affixed in the boxes placed on this page.
              </p>

              {state.fields.map((field) => (
                <FieldBox
                  key={field.id}
                  field={field}
                  owner={ownerDisplayName(field.recipient_email, recipients)}
                  flag={flagFor(field.id)}
                  onMove={onMove}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>

          {state.fields.length === 0 ? (
            <p className="place-fields__empty">
              No boxes yet. Pick a signer on the left and add a Signature or an eMeterai field.
            </p>
          ) : null}
        </div>

        <ReconciliationPanel report={report} recipients={recipients} />
      </div>

      {previewLoading ? (
        <p className="notice notice--info" role="status">
          Asking the server to check the fields against the counts&hellip;
        </p>
      ) : null}

      {confirmed ? (
        <div className="notice notice--success" role="status">
          <p className="notice__message">
            {`The server accepted ${confirmed.field_count} ${
              confirmed.field_count === 1 ? 'field' : 'fields'
            } against ${confirmed.total_signatures} signatures and ${confirmed.total_meterai} eMeterai.`}
          </p>
          {/* §A4.12 again, against the server's own figures this time. */}
          <p className="notice__meta">
            {`Total charge ${confirmed.total_charge} — computed from the counts, not from the ${confirmed.field_count} boxes.`}
          </p>
        </div>
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
        {/* §A4.7 / LD-05: out of scope, rendered honestly rather than removed. */}
        <DisabledControl id="fields-save-as-draft" label="Save as draft" />
        <div className="footer__spacer" />

        <ul className={canCheck ? 'gate-reason gate-reason--neutral' : 'gate-reason'} id={GATE_REASON_ID}>
          {canCheck ? (
            <li>
              Every box matches its count. <code>Check charges</code> asks the server to confirm.
            </li>
          ) : (
            blockers.map((reason) => <li key={reason}>{reason}</li>)
          )}
        </ul>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!canCheck || previewLoading}
          aria-disabled={canCheck ? undefined : 'true'}
          aria-describedby={GATE_REASON_ID}
          onClick={onCheck}
        >
          Check charges
        </button>

        {/* §A4.7 — `Send` does not send, and is not attempted. */}
        <DisabledControl id="fields-send" label="Send" reason={SEND_REASON} />
      </div>
    </main>
  );
}
