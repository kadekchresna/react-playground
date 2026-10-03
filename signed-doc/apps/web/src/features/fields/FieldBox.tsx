/**
 * One placed field on the document (§A4.3, §A4.4, §A4.5, §A4.13).
 *
 * Structure and copy from mockup board 3, including its remove-button label
 * (`Remove {kind} field for {owner}`).
 *
 * **§A4.3 — the box says what it is and whose it is, in text.** Three readable
 * elements, none of them a colour: the kind (`Signature` / `eMeterai`), the
 * owner's initials in the avatar, and the owner's full identity beside them.
 * The avatar is `aria-hidden` because the identity is already spelled out next
 * to it — announcing `RH` and then `Rina Halim` would be the same fact twice.
 *
 * **§A4.4 — the remove button names the kind and the owner.** It is a native
 * `<button>` with an `aria-label`, reachable by `Tab` and operable by
 * `Enter`/`Space`; there is no pointer-only affordance anywhere in this file.
 *
 * **§A4.13 — a flagged box says so in words.** `excess` and `orphan` are
 * rendered as visible text inside the box (`Excess` / `Orphaned`) as well as a
 * `data-flag` attribute, for exactly the reason §A4.3 gives about colour: a
 * red outline is not a notification. Flagged is as far as it goes — nothing in
 * this component or anywhere behind it removes a box on the app's initiative.
 *
 * **§A4.5 (optional) — moving a box by keyboard.** The box itself is focusable
 * and the four arrow keys nudge it. That is an addition to the mandatory
 * click-to-place path (§A4.2), not a substitute for it, and it goes through the
 * same `MOVE_FIELD` action and therefore the same kernel clamp: a box cannot be
 * nudged out of its kind's range. Arrow keys inside a focused widget are the
 * same interaction a slider has, and `preventDefault` stops the page scrolling
 * instead.
 */

import type { KeyboardEvent } from 'react';

import {
  FIELD_KIND_LABEL,
  fieldBoxId,
  fieldBoxLabel,
  fieldStyle,
  initialsOf,
  removeFieldLabel,
} from './field-view.js';
import { FIELD_NUDGE } from './fields-reducer.js';

import type { FieldInput, FieldPosition } from '@signed-doc/shared';

/** §A4.13 / §B7.13 — why this box is marked, if it is. */
export type FieldFlag = 'excess' | 'orphan' | null;

const FLAG_LABEL: Record<Exclude<FieldFlag, null>, string> = {
  excess: 'Excess',
  orphan: 'Orphaned',
};

const FLAG_REASON: Record<Exclude<FieldFlag, null>, string> = {
  excess: 'More boxes of this kind than this recipient asked for — remove it or raise their count',
  orphan: 'This recipient is no longer on the list — remove this box or add them back',
};

/** Arrow key -> the delta it applies, in content-area units. */
const NUDGE: Readonly<Record<string, FieldPosition>> = {
  ArrowLeft: { x: -FIELD_NUDGE, y: 0 },
  ArrowRight: { x: FIELD_NUDGE, y: 0 },
  ArrowUp: { x: 0, y: -FIELD_NUDGE },
  ArrowDown: { x: 0, y: FIELD_NUDGE },
};

export interface FieldBoxProps {
  readonly field: FieldInput;
  /** The owner as a person — their name, or their email when they have none. */
  readonly owner: string;
  readonly flag: FieldFlag;
  readonly onMove: (id: string, position: FieldPosition) => void;
  readonly onRemove: (id: string) => void;
}

export function FieldBox({ field, owner, flag, onMove, onRemove }: FieldBoxProps): JSX.Element {
  const reasonId = `${fieldBoxId(field.id)}-flag`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const delta = NUDGE[event.key];
    if (!delta) return;
    event.preventDefault();
    // Unclamped on purpose: the reducer hands it to `clampFieldPosition`, which
    // is the only thing in this package allowed to know a bound.
    onMove(field.id, { x: field.x + delta.x, y: field.y + delta.y });
  };

  return (
    <div
      className="field-box"
      id={fieldBoxId(field.id)}
      data-kind={field.kind}
      data-flag={flag ?? undefined}
      role="group"
      aria-label={fieldBoxLabel(field, owner)}
      aria-describedby={flag ? reasonId : undefined}
      tabIndex={0}
      style={fieldStyle(field)}
      onKeyDown={onKeyDown}
    >
      <span className="field-box__kind">{FIELD_KIND_LABEL[field.kind]}</span>

      <span className="field-box__owner">
        <span className="field-box__initials" aria-hidden="true">
          {initialsOf(owner, field.recipient_email)}
        </span>
        <span className="field-box__name">{owner}</span>
      </span>

      {/* §A4.13 — the flag is words, not a colour. */}
      {flag ? (
        <span className="field-box__flag">{FLAG_LABEL[flag]}</span>
      ) : null}
      {flag ? (
        <span className="visually-hidden" id={reasonId}>
          {FLAG_REASON[flag]}
        </span>
      ) : null}

      <button
        type="button"
        className="field-box__remove"
        aria-label={removeFieldLabel(field.kind, owner)}
        onClick={() => onRemove(field.id)}
      >
        <span aria-hidden="true">&#215;</span>
      </button>
    </div>
  );
}
