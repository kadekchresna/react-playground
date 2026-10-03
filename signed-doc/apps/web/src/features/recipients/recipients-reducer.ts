/**
 * The Step 2 recipient list (PRD §8.1–§8.3).
 *
 * Pure `(state, action) => state`, no React import, so every rule below is
 * asserted without rendering (LD-32).
 *
 * **No total lives here.** There is no `total_charge`, `total_signatures` or
 * `quota_remaining` key in this state, and no action produces one. Totals are
 * computed in render from `computeCharges` / `quotaRemaining`, so there is
 * nothing to keep in sync and nothing that can drift (PRD §8.6).
 *
 * **`countRaw` is why `NaN` is unreachable.** The text the user is typing and
 * the committed integer are two different fields. An empty box, `abc`, `2.5`
 * or `-1` only ever changes the text; the integer changes when the text parses
 * cleanly, or on blur, and both paths go through the shared
 * `clampSignatureCount`, which is total — it always returns an integer in
 * 1..20 (PRD §8.3, prompt §4 fact 7).
 *
 * **Case 2 §A3 repeats that pair verbatim for e-meterai.** `meteraiRaw` is to
 * `meterai_count` what `countRaw` is to `signature_count`, and the committed
 * integer only ever moves through `clampMeteraiCount`, which is total in
 * 0..3. Note what the clamp deliberately does NOT do: it never caps against
 * the row's own `signature_count`. §A3.2 is a rule the user has to be TOLD
 * about — the row is marked and the server answers `422
 * METERAI_EXCEEDS_SIGNATURE` — so a stepper that silently capped itself would
 * make that state unreachable and the rule invisible.
 *
 * **Case 2 §A2 adds the mode, and the mode adds `step`.** `orderMode` is real
 * state (the user picks it), `step` is real state (the user arranges it), and
 * everything derived from them — contiguity, renormalization after a delete,
 * the ordered set of steps — is the kernel's. `renormalizeSteps` is called
 * EAGERLY, on every structural change, so the list on screen is never in a
 * shape the server would answer `STEP_SEQUENCE_INVALID` to.
 *
 * **`step` exists only in `sequential`.** Switching to `parallel` deletes the
 * key from every row rather than parking a value for later. §B4 makes a `step`
 * sent in parallel a hard `422 UNKNOWN_FIELD`, so the safest place for that
 * invariant is the state itself: a parallel row has no step to leak. The cost
 * is that a parallel detour forgets the arrangement, which is a deliberate
 * trade (see `SET_ORDER_MODE`).
 *
 * Every rule is imported from `@signed-doc/shared`. There is no local copy of
 * a bound, a clamp or a count check (PRD §8.5).
 */

import {
  FIRST_STEP,
  MAX_RECIPIENTS,
  MIN_METERAI_COUNT,
  MIN_RECIPIENTS,
  MIN_SIGNATURE_COUNT,
  clampMeteraiCount,
  clampSignatureCount,
  renormalizeSteps,
  stepOf,
  type OrderMode,
  type RecipientInput,
} from '@signed-doc/shared';

export interface RecipientRow extends RecipientInput {
  /** Stable local key. Never sent to the server. */
  readonly id: string;
  /** The text in the signature number input, mid-edit. Never sent either. */
  readonly countRaw: string;
  /** The same, for the eMeterai number input (§A3.6). Never sent. */
  readonly meteraiRaw: string;
}

export interface RecipientsState {
  readonly rows: readonly RecipientRow[];
  /** Id source, kept in state so the reducer stays pure and deterministic. */
  readonly nextId: number;
  /** §A2 — `parallel` (the Case-1 behaviour) or `sequential`. */
  readonly orderMode: OrderMode;
}

/**
 * §A2.6 — which way a reorder goes. Named rather than `-1 | 1` because the two
 * directions are "towards step 1" and "away from step 1", which is what the
 * `aria-label` has to say and what a reader of this file needs to know.
 */
export type StepDirection = 'earlier' | 'later';

export type RecipientsAction =
  | { type: 'SET_NAME'; index: number; value: string }
  | { type: 'SET_EMAIL'; index: number; value: string }
  | { type: 'SET_COUNT_RAW'; index: number; raw: string }
  | { type: 'COMMIT_COUNT'; index: number }
  | { type: 'INC'; index: number }
  | { type: 'DEC'; index: number }
  | { type: 'SET_METERAI_RAW'; index: number; raw: string }
  | { type: 'COMMIT_METERAI'; index: number }
  | { type: 'INC_METERAI'; index: number }
  | { type: 'DEC_METERAI'; index: number }
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; index: number }
  | { type: 'SET_ORDER_MODE'; mode: OrderMode }
  /** §A2.6 — give this recipient a step of their own, one position over. */
  | { type: 'MOVE_STEP'; index: number; direction: StepDirection }
  /** §A2.6 — put this recipient INTO the neighbouring step (parallel in it). */
  | { type: 'MERGE_STEP'; index: number; direction: StepDirection };

export function emptyRow(id: string): RecipientRow {
  return {
    id,
    name: '',
    email: '',
    signature_count: MIN_SIGNATURE_COUNT,
    countRaw: String(MIN_SIGNATURE_COUNT),
    // §A3.1: `meterai_count` defaults to 0.
    meterai_count: MIN_METERAI_COUNT,
    meteraiRaw: String(MIN_METERAI_COUNT),
  };
}

function replaceRow(
  state: RecipientsState,
  index: number,
  update: (row: RecipientRow) => RecipientRow,
): RecipientsState {
  const row = state.rows[index];
  if (!row) return state;
  const next = update(row);
  if (next === row) return state;
  return { ...state, rows: state.rows.map((current, i) => (i === index ? next : current)) };
}

/**
 * Set the count from an already-trusted integer (the +/- buttons and blur).
 * `clampSignatureCount` is total, so `signature_count` cannot leave 1..20.
 */
function withCount(row: RecipientRow, candidate: unknown): RecipientRow {
  const count = clampSignatureCount(candidate, row.signature_count);
  return { ...row, signature_count: count, countRaw: String(count) };
}

/**
 * The eMeterai twin of `withCount` (§A3.6). `clampMeteraiCount` is total, so
 * `meterai_count` cannot leave 0..3 — and is never capped at the row's
 * `signature_count`, so §A3.2 stays reachable and visible.
 */
function withMeterai(row: RecipientRow, candidate: unknown): RecipientRow {
  const count = clampMeteraiCount(candidate, row.meterai_count);
  return { ...row, meterai_count: count, meteraiRaw: String(count) };
}

/**
 * Drop `step` entirely — not set it to anything. §B4: in `parallel` the key
 * must not be sent at all, so a parallel row must not have one to send.
 */
function withoutStep(row: RecipientRow): RecipientRow {
  if (row.step === undefined) return row;
  const { step: _dropped, ...rest } = row;
  return rest;
}

/** The ordered distinct step numbers, read with the kernel's own `stepOf`. */
function distinctSteps(rows: readonly RecipientRow[]): number[] {
  return [...new Set(rows.map((row) => stepOf(row)))].sort((a, b) => a - b);
}

/** Where `ADD_ROW` puts a new signer in `sequential`: at the end of the chain. */
function nextStepAfter(rows: readonly RecipientRow[]): number {
  const steps = rows.map((row) => stepOf(row));
  return steps.length === 0 ? FIRST_STEP : Math.max(...steps) + 1;
}

/**
 * §A2.6 — move ONE recipient one step earlier or later.
 *
 * The arithmetic is a doubling trick, and it exists so that nothing here has to
 * know what "contiguous" means. Double every step and each existing step sits
 * on an even number; an odd number then names a position strictly between two
 * of them. The moved row is placed just before (`2t − 1`) or just after
 * (`2t + 1`) a target step `t`, and the kernel's `renormalizeSteps` collapses
 * the result back to contiguous from 1. No local renumbering, ever.
 *
 * The target is the row's OWN step while it shares that step with somebody —
 * the move then splits it out of the group, which is what "earlier" means for a
 * parallel signer. Once it is alone in its step the target is the NEIGHBOURING
 * step, because a solo step placed next to where it already was has not moved.
 * At either end of the chain, alone, there is nowhere to go and the action is a
 * no-op — which is exactly what `canMoveStep` reports to the button.
 *
 * Only `step` changes. The rows keep their array positions, their ids and every
 * character the user typed (§A2.8); nothing is re-created, re-parsed or
 * re-ordered.
 */
function moveStep(
  state: RecipientsState,
  index: number,
  direction: StepDirection,
): RecipientsState {
  const row = state.rows[index];
  if (!row || state.orderMode !== 'sequential') return state;

  const current = stepOf(row);
  const shared = state.rows.filter((other) => stepOf(other) === current).length > 1;
  const steps = distinctSteps(state.rows);
  const position = steps.indexOf(current);
  const neighbour = direction === 'earlier' ? steps[position - 1] : steps[position + 1];

  const target = shared ? current : neighbour;
  if (target === undefined) return state;

  const doubled = state.rows.map((other, i) =>
    i === index
      ? { ...other, step: direction === 'earlier' ? target * 2 - 1 : target * 2 + 1 }
      : { ...other, step: stepOf(other) * 2 },
  );

  return { ...state, rows: renormalizeSteps(doubled, state.orderMode) };
}

/**
 * §A2.6 — merge ONE recipient into the neighbouring step, so they sign in
 * parallel with everybody already in it (§A2.2). A no-op at either end, and a
 * no-op in `parallel`, where there is only ever one step.
 */
function mergeStep(
  state: RecipientsState,
  index: number,
  direction: StepDirection,
): RecipientsState {
  const row = state.rows[index];
  if (!row || state.orderMode !== 'sequential') return state;

  const steps = distinctSteps(state.rows);
  const position = steps.indexOf(stepOf(row));
  const target = direction === 'earlier' ? steps[position - 1] : steps[position + 1];
  if (target === undefined) return state;

  const merged = state.rows.map((other, i) => (i === index ? { ...other, step: target } : other));
  return { ...state, rows: renormalizeSteps(merged, state.orderMode) };
}

export function recipientsReducer(
  state: RecipientsState,
  action: RecipientsAction,
): RecipientsState {
  switch (action.type) {
    case 'SET_NAME':
      return replaceRow(state, action.index, (row) => ({ ...row, name: action.value }));

    case 'SET_EMAIL':
      return replaceRow(state, action.index, (row) => ({ ...row, email: action.value }));

    /**
     * While typing, the text always updates; the integer updates only when the
     * text is ALREADY exactly a legal value. `clampSignatureCount` is the only
     * parser: if its repaired output round-trips to the same text, the text was
     * legal; otherwise the committed integer is left where it was, so `25`
     * does not snap to `20` under the user's cursor and `2.5` does not become
     * `2` before they have finished typing. Blur (`COMMIT_COUNT`) settles it.
     */
    case 'SET_COUNT_RAW':
      return replaceRow(state, action.index, (row) => {
        const repaired = clampSignatureCount(action.raw, row.signature_count);
        const wasAlreadyLegal = String(repaired) === action.raw.trim();
        return {
          ...row,
          countRaw: action.raw,
          signature_count: wasAlreadyLegal ? repaired : row.signature_count,
        };
      });

    // Blur: settle whatever is in the box to a legal integer, and show it.
    case 'COMMIT_COUNT':
      return replaceRow(state, action.index, (row) => withCount(row, row.countRaw));

    case 'INC':
      return replaceRow(state, action.index, (row) => withCount(row, row.signature_count + 1));

    case 'DEC':
      return replaceRow(state, action.index, (row) => withCount(row, row.signature_count - 1));

    /** The eMeterai column, interaction for interaction identical to the above. */
    case 'SET_METERAI_RAW':
      return replaceRow(state, action.index, (row) => {
        const repaired = clampMeteraiCount(action.raw, row.meterai_count);
        const wasAlreadyLegal = String(repaired) === action.raw.trim();
        return {
          ...row,
          meteraiRaw: action.raw,
          meterai_count: wasAlreadyLegal ? repaired : row.meterai_count,
        };
      });

    case 'COMMIT_METERAI':
      return replaceRow(state, action.index, (row) => withMeterai(row, row.meteraiRaw));

    case 'INC_METERAI':
      return replaceRow(state, action.index, (row) => withMeterai(row, row.meterai_count + 1));

    case 'DEC_METERAI':
      return replaceRow(state, action.index, (row) => withMeterai(row, row.meterai_count - 1));

    // LD-16: a no-op at the ceiling. The button is disabled with a visible
    // reason, and the reducer refuses anyway.
    case 'ADD_ROW': {
      if (state.rows.length >= MAX_RECIPIENTS) return state;
      const fresh = emptyRow(`r${state.nextId}`);
      // §A2.1: in `sequential` every recipient has a step, so a new signer gets
      // one immediately — at the end of the chain, in a step of their own.
      // Routed through the kernel so contiguity is never a local claim.
      const rows =
        state.orderMode === 'sequential'
          ? renormalizeSteps(
              [...state.rows, { ...fresh, step: nextStepAfter(state.rows) }],
              state.orderMode,
            )
          : [...state.rows, fresh];
      return { ...state, rows, nextId: state.nextId + 1 };
    }

    // LD-12: a no-op at the floor. The UI never walks the user into an empty
    // list; the server still defends the empty case with RECIPIENT_COUNT_INVALID.
    //
    // §A2.4 / §B7.8: the survivors go through `renormalizeSteps` EAGERLY, so
    // deleting the sole member of step 1 out of `[1,2,2,3]` leaves `[1,1,2]` on
    // screen rather than a `[2,2,3]` the server would refuse. In `parallel` the
    // kernel's guard makes this a copy and nothing more — no `step` is stamped.
    case 'REMOVE_ROW':
      if (state.rows.length <= MIN_RECIPIENTS) return state;
      if (action.index < 0 || action.index >= state.rows.length) return state;
      return {
        ...state,
        rows: renormalizeSteps(
          state.rows.filter((_, i) => i !== action.index),
          state.orderMode,
        ),
      };

    /**
     * §A2 — the mode selector.
     *
     * To `sequential`: every row is given a step immediately, one each in list
     * order. The alternative — putting everyone in step 1 — is also legal, but
     * it renders identically to `parallel` and makes choosing the mode look
     * like nothing happened; list order is the only ordering information on
     * screen, so it is the only honest seed. The user then merges rows back
     * together, which is one keystroke per row.
     *
     * To `parallel`: `step` is DELETED from every row, not parked. §B4 makes a
     * `step` in a parallel payload a hard `422 UNKNOWN_FIELD`, and a key that
     * does not exist cannot be sent by a projection that forgets to drop it.
     * The price is that a detour through `parallel` forgets the arrangement;
     * that is the trade, taken deliberately.
     */
    case 'SET_ORDER_MODE': {
      if (action.mode === state.orderMode) return state;
      if (action.mode === 'sequential') {
        const seeded = state.rows.map((row, i) => ({ ...row, step: i + FIRST_STEP }));
        return { ...state, orderMode: action.mode, rows: renormalizeSteps(seeded, action.mode) };
      }
      return { ...state, orderMode: action.mode, rows: state.rows.map(withoutStep) };
    }

    case 'MOVE_STEP':
      return moveStep(state, action.index, action.direction);

    case 'MERGE_STEP':
      return mergeStep(state, action.index, action.direction);

    default:
      return state;
  }
}

export function canAddRecipient(state: RecipientsState): boolean {
  return state.rows.length < MAX_RECIPIENTS;
}

export function canRemoveRecipient(state: RecipientsState): boolean {
  return state.rows.length > MIN_RECIPIENTS;
}

/**
 * Whether a reorder control does anything, answered by running the reducer.
 *
 * The button's enabled state and the reducer's behaviour cannot disagree,
 * because they are the same code: a reorder that would change nothing returns
 * the state object it was given, and that identity IS the answer. With at most
 * ten rows this costs nothing worth naming.
 */
export function canMoveStep(
  state: RecipientsState,
  index: number,
  direction: StepDirection,
): boolean {
  return moveStep(state, index, direction) !== state;
}

export function canMergeStep(
  state: RecipientsState,
  index: number,
  direction: StepDirection,
): boolean {
  return mergeStep(state, index, direction) !== state;
}

/**
 * Project rows onto the wire shape. Local-only fields are dropped here.
 *
 * §B4 decides `step` by MODE, not by whether a row happens to carry one: in
 * `sequential` every recipient gets one (read through the kernel's `stepOf`, so
 * a row that somehow lost its step reads as step 1 rather than leaking
 * `undefined`); in `parallel` the key is absent, because sending it is `422
 * UNKNOWN_FIELD`.
 */
export function toRecipientInputs(state: RecipientsState): RecipientInput[] {
  const sequential = state.orderMode === 'sequential';
  return state.rows.map((row) => {
    const wire: RecipientInput = {
      name: row.name,
      email: row.email,
      signature_count: row.signature_count,
      meterai_count: row.meterai_count,
    };
    return sequential ? { ...wire, step: stepOf(row) } : wire;
  });
}

/**
 * The mockup's own accessible-name fallback: a blank name becomes
 * `signer {i+1}` so an icon button is never labelled `Remove ` (PRD §8.12).
 */
export function accessibleNameFor(row: { name: string }, index: number): string {
  const trimmed = row.name.trim();
  return trimmed === '' ? `signer ${index + 1}` : trimmed;
}
