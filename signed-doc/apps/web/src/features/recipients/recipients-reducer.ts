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
 * Every rule is imported from `@signed-doc/shared`. There is no local copy of
 * a bound, a clamp or a count check (PRD §8.5).
 */

import {
  MAX_RECIPIENTS,
  MIN_RECIPIENTS,
  MIN_SIGNATURE_COUNT,
  clampSignatureCount,
  type RecipientInput,
} from '@signed-doc/shared';

export interface RecipientRow extends RecipientInput {
  /** Stable local key. Never sent to the server. */
  readonly id: string;
  /** The text in the number input, which may be mid-edit. Never sent either. */
  readonly countRaw: string;
}

export interface RecipientsState {
  readonly rows: readonly RecipientRow[];
  /** Id source, kept in state so the reducer stays pure and deterministic. */
  readonly nextId: number;
}

export type RecipientsAction =
  | { type: 'SET_NAME'; index: number; value: string }
  | { type: 'SET_EMAIL'; index: number; value: string }
  | { type: 'SET_COUNT_RAW'; index: number; raw: string }
  | { type: 'COMMIT_COUNT'; index: number }
  | { type: 'INC'; index: number }
  | { type: 'DEC'; index: number }
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; index: number };

export function emptyRow(id: string): RecipientRow {
  return {
    id,
    name: '',
    email: '',
    signature_count: MIN_SIGNATURE_COUNT,
    countRaw: String(MIN_SIGNATURE_COUNT),
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

    // LD-16: a no-op at the ceiling. The button is disabled with a visible
    // reason, and the reducer refuses anyway.
    case 'ADD_ROW':
      if (state.rows.length >= MAX_RECIPIENTS) return state;
      return {
        rows: [...state.rows, emptyRow(`r${state.nextId}`)],
        nextId: state.nextId + 1,
      };

    // LD-12: a no-op at the floor. The UI never walks the user into an empty
    // list; the server still defends the empty case with RECIPIENT_COUNT_INVALID.
    case 'REMOVE_ROW':
      if (state.rows.length <= MIN_RECIPIENTS) return state;
      if (action.index < 0 || action.index >= state.rows.length) return state;
      return { ...state, rows: state.rows.filter((_, i) => i !== action.index) };

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

/** Project rows onto the wire shape. Local-only fields are dropped here. */
export function toRecipientInputs(state: RecipientsState): RecipientInput[] {
  return state.rows.map((row) => ({
    name: row.name,
    email: row.email,
    signature_count: row.signature_count,
  }));
}

/**
 * The mockup's own accessible-name fallback: a blank name becomes
 * `signer {i+1}` so an icon button is never labelled `Remove ` (PRD §8.12).
 */
export function accessibleNameFor(row: { name: string }, index: number): string {
  const trimmed = row.name.trim();
  return trimmed === '' ? `signer ${index + 1}` : trimmed;
}
