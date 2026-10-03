/**
 * The 3-pill progress stepper (ADR-005, LD-02).
 *
 * Boards 1, 2 and 3 of the mockup are now all three real steps: Case 2 §A4
 * makes `Place fields` the third one, so the pill that LD-02 rendered visibly
 * locked with `(locked in this exercise)` is an ordinary upcoming/active/
 * complete pill like the other two. `MAX_REACHABLE_STEP` rises from `2` to `3`
 * and the `locked` pill state is gone with the thing it described — a state
 * nothing can enter is worse than no state at all, because a reader cannot tell
 * whether it is a scoped-out step or a bug.
 *
 * **What has NOT changed is that the stepper is display-only**, and that is
 * structural rather than a styling promise: every pill is a plain `<li>`, so
 * there is no button, no link, no click handler and nothing to focus. A
 * keyboard user cannot navigate FROM the stepper, because there is no focusable
 * element in it to activate — which is stronger than `tabIndex={-1}` on a
 * button. Moving between steps is the footer's `Continue`/`Back`, in both
 * directions, where the gate that decides whether a move is allowed already
 * lives.
 *
 * Seam S1: `Step` is `1 | 2 | 3`, never a boolean. Unlocking Step 3 was the one
 * constant below plus the guard in `App.tsx`; no state had to change type.
 */

export type Step = 1 | 2 | 3;

/**
 * Seam S1: the highest step the flow can reach. Case 1 pinned this to `2`;
 * Case 2 §A4 raises it to `3`, which is the last step there is.
 */
export const MAX_REACHABLE_STEP: Step = 3;

interface StepDefinition {
  readonly step: Step;
  readonly label: string;
}

const STEPS: readonly StepDefinition[] = [
  { step: 1, label: 'Upload document' },
  { step: 2, label: 'Set recipients' },
  { step: 3, label: 'Place fields' },
];

type PillState = 'complete' | 'active' | 'upcoming';

function pillStateFor(step: Step, current: Step): PillState {
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
          return (
            <li
              key={step}
              className="stepper__pill"
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="stepper__marker" aria-hidden="true">
                {state === 'complete' ? '✓' : step}
              </span>
              <span className="stepper__label">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
