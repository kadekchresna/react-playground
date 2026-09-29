/**
 * Composition root 2 of 2 (PLAN.md §Architecture Slice > apps/web).
 *
 * Owns the step, and will own the envelope metadata handed from Step 1 to
 * Step 2 plus the server-issued price and quota. Everything travels as props —
 * no context, no global store, no router.
 *
 * Seam S1: the step is `1 | 2 | 3`, never a boolean, and `3` is unreachable in
 * Case 1 because `goTo` refuses it. Case 2 unlocks Step 3 by deleting that one
 * guard, not by changing the type of the state.
 */

import { useCallback, useState } from 'react';

import { MAX_REACHABLE_STEP, Stepper, type Step } from './components/Stepper.js';

export function App(): JSX.Element {
  const [step, setStep] = useState<Step>(1);

  // Seam S1 / ADR-005: the one guard that keeps Step 3 unreachable.
  const goTo = useCallback((next: Step) => {
    if (next > MAX_REACHABLE_STEP) return;
    setStep(next);
  }, []);

  return (
    <div className="app">
      <Stepper current={step} />
      <main className="board">
        <h1>What needs to be signed?</h1>
        <p className="board__sub">
          The upload and recipient steps are wired in the following subtasks.
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => goTo(2)}>
          Continue
        </button>
      </main>
    </div>
  );
}
