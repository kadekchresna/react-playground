/**
 * The left panel of mockup board 3: the signer selector and the field palette
 * (§A4.1, §A4.2, §A4.11).
 *
 * **§A4.2 — clicking a palette button places a field, and that path is fully
 * keyboard-operable.** Both palette controls are native `<button type="button">`
 * elements with an `onClick`, so `Tab` reaches them and `Enter`/`Space`
 * activates them with no key handler of our own; there is nothing here that
 * only a pointer can do. Drag-and-drop from the palette is optional and is NOT
 * built, which is the deliberate choice: a second placement path that the
 * keyboard cannot reach is how §B7.19 gets failed, and the brief is explicit
 * that click-to-place is the mandatory one.
 *
 * The signer selector is a native `<select>` with a `<label for>` — the
 * mockup's own control, and already arrow-key navigable.
 *
 * **§A4.11 is visible BEFORE a request, not only in a `422`.** The eMeterai
 * button is disabled for a signer the kernel's `canCarryMeteraiField` refuses —
 * in `sequential`, anybody outside step 1 — with the reason as visible text the
 * button points at via `aria-describedby`, which is the `DisabledControl`
 * pattern LD-05 established. The predicate is the kernel's; only the wording is
 * ours.
 *
 * **What is NOT disabled: a kind whose count is already satisfied.** Placing a
 * third signature for a recipient who asked for two has to stay possible, or
 * §A4.13's excess state is unreachable and the flag nobody can produce is a
 * flag nobody can trust. This is the same stance the eMeterai stepper takes on
 * §A3.2 one case earlier, for the same reason.
 */

import {
  FIELD_KINDS,
  canCarryMeteraiField,
  type FieldKind,
  type OrderMode,
  type RecipientInput,
} from '@signed-doc/shared';

import { accessibleNameFor } from '../recipients/recipients-reducer.js';
import { FIELD_KIND_LABEL, fieldSizeHint } from './field-view.js';

export const SIGNER_SELECT_ID = 'field-signer';

/** The DOM id of a palette button — the fallback focus target after a place. */
export function paletteButtonId(kind: FieldKind): string {
  return `field-palette-${kind}`;
}

/** §A4.1 — one option per recipient, identified the way the row header is. */
export interface SignerOption {
  readonly index: number;
  readonly recipient: RecipientInput;
  /** Normalized email; `''` for a row with no address typed yet. */
  readonly email: string;
  readonly label: string;
}

export interface FieldPaletteProps {
  readonly signers: readonly SignerOption[];
  /** The resolved selection, as a normalized email. `''` when nobody can own. */
  readonly selectedEmail: string;
  readonly selectedSigner: SignerOption | null;
  readonly meteraiAllowed: boolean;
  readonly meteraiBlockedReason: string;
  readonly onSelectSigner: (email: string) => void;
  readonly onPlace: (kind: FieldKind) => void;
}

export function FieldPalette({
  signers,
  selectedEmail,
  selectedSigner,
  meteraiAllowed,
  meteraiBlockedReason,
  onSelectSigner,
  onPlace,
}: FieldPaletteProps): JSX.Element {
  // A signer with no email address can own nothing (§A4.10): the kernel skips a
  // blank-email row when it works out who may hold a field, so placing one
  // would create a box that is orphaned the moment it exists.
  const noOwner = selectedEmail === '';
  const noOwnerReason = 'Give this recipient an email address on Step 2 before placing their fields';

  const disabledFor = (kind: FieldKind): string | null => {
    if (noOwner) return noOwnerReason;
    if (kind === 'meterai' && !meteraiAllowed) return meteraiBlockedReason;
    return null;
  };

  return (
    <aside className="palette" aria-label="Signer and field palette">
      <div className="palette__group">
        <label className="palette__legend" htmlFor={SIGNER_SELECT_ID}>
          Signer
        </label>
        <select
          id={SIGNER_SELECT_ID}
          className="palette__select"
          value={selectedEmail}
          aria-describedby={`${SIGNER_SELECT_ID}-hint`}
          onChange={(event) => onSelectSigner(event.target.value)}
        >
          {/*
            Present only while nobody on the list can own a field, so the
            control is never rendered with no selection at all. It disappears as
            soon as one recipient has an email.
          */}
          {noOwner ? <option value="">No recipient with an email address yet</option> : null}
          {signers.map((signer) => (
            <option key={signer.index} value={signer.email} disabled={signer.email === ''}>
              {signer.label}
            </option>
          ))}
        </select>
        <span className="palette__hint" id={`${SIGNER_SELECT_ID}-hint`}>
          The next field you place belongs to this signer.
        </span>
      </div>

      <div className="palette__group">
        <span className="palette__legend" aria-hidden="true">
          Fields
        </span>
        <p className="palette__hint">
          Choose a signer, then activate a field below — with a click or with{' '}
          <kbd>Enter</kbd>. The box lands on the page and keyboard focus moves onto it, so the
          arrow keys can nudge it into place.
        </p>

        {FIELD_KINDS.map((kind) => {
          const reason = disabledFor(kind);
          const reasonId = `${paletteButtonId(kind)}-reason`;
          return (
            <div className="palette__field" key={kind}>
              <button
                type="button"
                id={paletteButtonId(kind)}
                className="palette__button"
                disabled={reason !== null}
                aria-disabled={reason === null ? undefined : 'true'}
                aria-describedby={reason === null ? undefined : reasonId}
                onClick={() => onPlace(kind)}
              >
                <span className="palette__button-label">{FIELD_KIND_LABEL[kind]}</span>
                {/* §B2's box size, read from the kernel rather than restated. */}
                <span className="palette__button-size">{fieldSizeHint(kind)}</span>
              </button>
              {reason === null ? null : (
                <span className="palette__reason" id={reasonId}>
                  {reason}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/*
        Which recipient the two buttons above are about, spelled out where the
        buttons are. The selector says it too, but a disabled eMeterai button
        reads as arbitrary unless the signer it refers to is next to it.
      */}
      {selectedSigner ? (
        <p className="palette__hint palette__hint--owner">
          {`Placing for ${accessibleNameFor(selectedSigner.recipient, selectedSigner.index)}`}
        </p>
      ) : null}
    </aside>
  );
}

/**
 * §A4.11 — may this signer be given an eMeterai box, and if not, why?
 *
 * The verdict is entirely the kernel's `canCarryMeteraiField`; this function
 * only words the refusal, and it words it the way `meteraiStepMessage` words
 * the recipient-level twin of the same rule: name the step they are in and both
 * ways out, because "not allowed" tells a user nothing they can act on.
 */
export function meteraiPaletteVerdict(
  signer: SignerOption | null,
  orderMode: OrderMode,
): { readonly allowed: boolean; readonly reason: string } {
  if (!signer) return { allowed: false, reason: '' };
  if (canCarryMeteraiField(signer.recipient, orderMode)) return { allowed: true, reason: '' };

  const step = signer.recipient.step ?? 1;
  return {
    allowed: false,
    reason:
      `${accessibleNameFor(signer.recipient, signer.index)} is in step ${step}. A duty stamp is ` +
      'affixed before the signing chain starts, so only step 1 may carry eMeterai — move them to ' +
      'step 1 on Step 2, or place this box for somebody who is already there.',
  };
}
