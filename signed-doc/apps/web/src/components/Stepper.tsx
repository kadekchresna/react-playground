/**
 * The 3-pill progress stepper (ADR-005, LD-02).
 *
 * Boards 1 and 2 of the mockup show two pills; board 3 shows three. LD-02 picks
 * three, with pill 3 `Place fields` rendered visibly locked and display-only.
 *
 * "Display-only" is structural here, not a styling promise: every pill is a
 * plain `<li>`, so there is no button, no link, no click handler and nothing to
 * focus. A keyboard user cannot reach pill 3 because there is no focusable
 * element to reach — which is stronger than `tabIndex={-1}` on a button.
 *
 * Seam S1: `Step` is `1 | 2 | 3`, never a boolean. Case 2 unlocks step 3 by
 * deleting the guard in `App.tsx`; this file already knows how to render it.
 */

export type Step = 1 | 2 | 3;

/** Seam S1: the highest step Case 1 can reach. Case 2 raises it to 3. */
export const MAX_REACHABLE_STEP: Step = 2;

interface StepDefinition {
  readonly step: Step;
  readonly label: string;
}

const STEPS: readonly StepDefinition[] = [
  { step: 1, label: 'Upload document' },
  { step: 2, label: 'Set recipients' },
  { step: 3, label: 'Place fields' },
];

type PillState = 'complete' | 'active' | 'upcoming' | 'locked';

function pillStateFor(step: Step, current: Step): PillState {
  if (step > MAX_REACHABLE_STEP) return 'locked';
  if (step < current) return 'complete';
  if (step === current) return 'active';
  return 'upcoming';
}

export interface StepperProps {
  readonly current: Step;
}

export function Stepper({ current }: StepperProps): JSX.Element {
  return (
    <nav className="stepper" aria-label="Document preparation progress">
      <ol className="stepper__list">
        {STEPS.map(({ step, label }) => {
          const state = pillStateFor(step, current);
          const locked = state === 'locked';
          return (
            <li
              key={step}
              className="stepper__pill"
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
              aria-disabled={locked ? 'true' : undefined}
            >
              <span className="stepper__marker" aria-hidden="true">
                {state === 'complete' ? '✓' : step}
              </span>
              <span className="stepper__label">{label}</span>
              {locked ? <span className="stepper__lock"> (locked in this exercise)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
