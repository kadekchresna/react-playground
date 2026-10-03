/**
 * §A2 — the signing-order mode selector, above the recipient list.
 *
 * Two native radios inside a `fieldset`/`legend`, not a pair of toggle buttons
 * and not a `<select>`. The reasons are all accessibility ones and all scored
 * elsewhere in this exercise: a radio group is arrow-key navigable with no
 * JavaScript, each option carries its own `<label for>` (PRD §8.12), and the
 * group announces itself by its legend before announcing which option is
 * current. §A2.6's keyboard mandate is about reordering, but a mode selector
 * that needed a mouse would fail the same spirit.
 *
 * Each option states what it DOES, not what it is called, because `parallel`
 * and `sequential` are the wire's words and not the user's. The names are kept
 * in the copy anyway so a reviewer reading §A2 can find them on screen.
 *
 * `ORDER_MODES` comes from the kernel: the list of modes is not this component's
 * to know, and a third mode would appear here without an edit.
 */

import { ORDER_MODES, type OrderMode } from '@signed-doc/shared';

export interface OrderModeSelectorProps {
  readonly value: OrderMode;
  readonly onChange: (mode: OrderMode) => void;
}

const COPY: Record<OrderMode, { readonly label: string; readonly hint: string }> = {
  parallel: {
    label: 'Everyone at the same time (parallel)',
    hint: 'All recipients are invited at once.',
  },
  sequential: {
    label: 'One step after another (sequential)',
    hint: 'Each step is invited only once every recipient in the step before is done.',
  },
};

export function OrderModeSelector({ value, onChange }: OrderModeSelectorProps): JSX.Element {
  return (
    <fieldset className="order-mode">
      <legend className="order-mode__legend">Signing order</legend>
      <div className="order-mode__options">
        {ORDER_MODES.map((mode) => {
          const id = `order-mode-${mode}`;
          return (
            <div className="order-mode__option" key={mode}>
              <input
                id={id}
                type="radio"
                name="order-mode"
                value={mode}
                checked={value === mode}
                aria-describedby={`${id}-hint`}
                onChange={() => onChange(mode)}
              />
              <label htmlFor={id}>{COPY[mode].label}</label>
              <span className="order-mode__hint" id={`${id}-hint`}>
                {COPY[mode].hint}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
