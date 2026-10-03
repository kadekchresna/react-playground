/**
 * The §A2.5 grouped view: recipients bucketed by step, in step order.
 *
 * **This module decides nothing.** Which step a row is in is `stepOf`'s answer;
 * which steps exist and in what order is `groupByStep`'s answer. Both come from
 * `@signed-doc/shared`, so the headers on screen and the `steps` array the
 * server echoes back cannot describe two different arrangements.
 *
 * What it adds is the one thing the kernel deliberately does not carry: the row
 * INDEX. `groupByStep` projects normalized emails, because that is the wire
 * contract (§B4) — but two rows mid-edit can both be blank or both hold the
 * same address, so an email is not an identity the UI can dispatch on. The
 * array index is, and it is what every reducer action takes.
 *
 * Pure, React-free and uncached, like `derive.ts` beside it: it is recomputed
 * in render, so a group can no more drift from the rows than a total can.
 */

import { groupByStep, stepOf } from '@signed-doc/shared';

import { toRecipientInputs, type RecipientRow, type RecipientsState } from './recipients-reducer.js';

export interface StepMember {
  readonly row: RecipientRow;
  /** Position in `state.rows` — the id every action is addressed by. */
  readonly index: number;
}

export interface StepView {
  readonly step: number;
  readonly members: readonly StepMember[];
}

/**
 * The steps, in order, each with its rows in list order.
 *
 * In `parallel` this is the single group §A3.4 says a parallel document is —
 * one step holding everyone. Step 2 does not render it that way (parallel keeps
 * its flat Case-1 list), but the projection stays total so a caller never has
 * two shapes to handle.
 */
export function stepViews(state: RecipientsState): readonly StepView[] {
  const order = groupByStep(toRecipientInputs(state), state.orderMode).map((group) => group.step);
  const members = state.rows.map((row, index) => ({ row, index }));

  return order.map((step) => ({
    step,
    members:
      state.orderMode === 'sequential'
        ? members.filter(({ row }) => stepOf(row) === step)
        : members,
  }));
}

/**
 * §A2.5 — the step header, which has to say two things: which step this is, and
 * that everyone inside it signs AT THE SAME TIME. The second half is the part a
 * reviewer is looking for; "2 recipients" alone would leave the shared-step
 * case (§A2.2) indistinguishable from an accident.
 */
export function stepGroupLabel(step: number, memberCount: number): string {
  return memberCount === 1
    ? `Step ${step} — 1 recipient`
    : `Step ${step} — ${memberCount} recipients signing in parallel`;
}
