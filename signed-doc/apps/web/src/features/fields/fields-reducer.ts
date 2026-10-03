/**
 * The Step 3 placed-field list (`test_2_en.md` §A4, §B2, §B3).
 *
 * Pure `(state, action) => state`, no React import, so every rule below is
 * asserted without rendering — the same shape `recipients-reducer.ts` already
 * has (LD-32).
 *
 * **No geometry is decided here.** Every position this module produces is the
 * return value of the kernel's `clampFieldPosition`, which is total: it pulls a
 * position into the kind's own range (`signature` x 0..420 / y 0..500,
 * `meterai` x 0..520 / y 0..476), rounds a fractional pointer coordinate to a
 * whole number, and never returns `NaN` or `undefined`. There is no local
 * bound, no local `Math.min` and no local arithmetic on a bound anywhere in
 * this file. §B2 is one sentence — "The UI clamps. The API rejects" — and this
 * is the UI half of it; the API half is `validateFieldBounds`, which this
 * package must never call.
 *
 * **The counts are NOT state here, and neither is anything derived from them.**
 * `signature_count` / `meterai_count` live on the recipient rows; the fields
 * are their materialization (§A4.9). Whether the two agree is answered in
 * render by the kernel's `reconcileFields`, so there is no `satisfied` flag, no
 * `missing` counter and no `excess` list in this state to drift from the rows
 * above it (§A3.9 again, one case later).
 *
 * **§A4.13 — FLAG, DO NOT AUTO-DROP.** Nothing in this reducer removes a field
 * because a count changed or a recipient was deleted. There is deliberately no
 * action that could: `REMOVE_FIELD` takes one id and is only ever dispatched by
 * the remove button §A4.4 requires. A count lowered below the number of placed
 * boxes, or a recipient deleted while owning boxes (§B7.13), therefore leaves
 * the boxes exactly where the user put them, and the kernel reports them as
 * `excess_field_ids` / `orphan_field_ids` for the user to act on. Silently
 * destroying placed work is the more destructive default and would need its own
 * undo story to be defensible.
 *
 * **Ownership is an EMAIL, not an index.** A row's position changes when the
 * list is reordered or a row above it is deleted; §B3 makes
 * `recipient_email` the owner, compared after trimming and case-insensitively.
 * So that is what a field stores, normalized through the kernel's
 * `normalizeEmail` — the one way this codebase ever compares an address — which
 * is also what `fieldOwnerOf` and `reconcileFields` compare against.
 */

import {
  CONTENT_AREA,
  FIELD_PAGE,
  clampFieldPosition,
  fieldSizeOf,
  normalizeEmail,
  type FieldInput,
  type FieldKind,
  type FieldPosition,
} from '@signed-doc/shared';

export interface FieldsState {
  readonly fields: readonly FieldInput[];
  /** Id source, kept in state so the reducer stays pure and deterministic. */
  readonly nextId: number;
  /**
   * §A4.1 — who the NEXT placed field belongs to, as a normalized email.
   *
   * An email rather than a row index for the same reason a field's owner is:
   * the index of a row is not stable across a delete or a reorder. `''` means
   * "nothing chosen yet", which `selectedOwnerOf` resolves against the current
   * list; it is never rendered as a selection.
   */
  readonly selectedEmail: string;
}

export type FieldsAction =
  /** §A4.1 — the signer selector. */
  | { type: 'SELECT_SIGNER'; email: string }
  /**
   * §A4.2 — place one box for one owner. `position` is optional: the
   * click-to-place path lets the reducer pick (see `cascadePositionFor`), and
   * the optional drag/move paths hand one in. Either way it is clamped.
   */
  | { type: 'PLACE_FIELD'; kind: FieldKind; owner: string; position?: FieldPosition }
  /** §A4.5 (optional) — move a placed box. Clamping still applies. */
  | { type: 'MOVE_FIELD'; id: string; position: FieldPosition }
  /** §A4.4 — the remove button, and the only way a field ever leaves the list. */
  | { type: 'REMOVE_FIELD'; id: string };

export function createFieldsState(): FieldsState {
  return { fields: [], nextId: 0, selectedEmail: '' };
}

/**
 * How far each successive box is offset from the centre of the content area.
 *
 * Click-to-place has to choose a spot, and §A4.2 only says the click places a
 * field. The mockup's own palette copy answers it — "click to drop it in the
 * centre" — but a literal centre would stack every box of a kind on exactly one
 * spot, so each one steps down-right from there. Any pile-up at the far corner
 * is the clamp doing its job, and §A4.5's move is the way out.
 */
export const PLACEMENT_CASCADE = 24;

/** The nudge one arrow key gives a focused box (§A4.5). */
export const FIELD_NUDGE = 8;

/**
 * Where the n-th placed box of this kind goes: the centre of the content area,
 * stepped down-right by `n`, then clamped by the kernel.
 *
 * The centre is DERIVED from `CONTENT_AREA` and the kind's own size, never
 * written as a number: a signature box is `212 x 88` and a meterai box is
 * `112 x 112`, so they do not share a centre and they do not share a range.
 */
export function cascadePositionFor(kind: FieldKind, placedCount: number): FieldPosition {
  const size = fieldSizeOf(kind);
  const offset = Math.max(0, placedCount) * PLACEMENT_CASCADE;
  return clampFieldPosition(kind, {
    x: (CONTENT_AREA.width - size.width) / 2 + offset,
    y: (CONTENT_AREA.height - size.height) / 2 + offset,
  });
}

function placeField(state: FieldsState, action: Extract<FieldsAction, { type: 'PLACE_FIELD' }>): FieldsState {
  const owner = normalizeEmail(action.owner);
  // A box with no owner is a box §A4.10 already refuses; the palette is
  // disabled with a visible reason in that state, and the reducer agrees.
  if (owner === '') return state;

  const position = action.position
    ? clampFieldPosition(action.kind, action.position)
    : cascadePositionFor(action.kind, state.fields.length);

  const field: FieldInput = {
    // §B3: unique. `nextId` is monotonic and lives in state, so uniqueness is a
    // property of the reducer rather than of a random source.
    id: fieldDomId(state.nextId),
    kind: action.kind,
    recipient_email: owner,
    // §A4.7 / §B3: page 1 is the only page there is.
    page: FIELD_PAGE,
    x: position.x,
    y: position.y,
  };

  return { ...state, fields: [...state.fields, field], nextId: state.nextId + 1 };
}

/** The field id for a given counter value — also the stem of its DOM ids. */
export function fieldDomId(nextId: number): string {
  return `f${nextId}`;
}

export function fieldsReducer(state: FieldsState, action: FieldsAction): FieldsState {
  switch (action.type) {
    case 'SELECT_SIGNER': {
      const email = normalizeEmail(action.email);
      return email === state.selectedEmail ? state : { ...state, selectedEmail: email };
    }

    case 'PLACE_FIELD':
      return placeField(state, action);

    case 'MOVE_FIELD': {
      const current = state.fields.find((f) => f.id === action.id);
      if (!current) return state;
      // Clamped against the MOVED box's own kind, which is the whole reason
      // `fieldBoundsFor` takes a kind: `x = 500` is out of range for a
      // signature and inside it for a meterai.
      const { x, y } = clampFieldPosition(current.kind, action.position);
      if (x === current.x && y === current.y) return state;
      return {
        ...state,
        fields: state.fields.map((f) => (f.id === action.id ? { ...f, x, y } : f)),
      };
    }

    /**
     * §A4.4 — the only removal path there is, and it names one box.
     *
     * Note what is absent: no action removes a field because its owner left the
     * list or because a count was lowered. §A4.13 and §B7.13 are answered by
     * FLAGGING, and this reducer has no way to do otherwise even if a caller
     * wanted it to.
     */
    case 'REMOVE_FIELD': {
      const next = state.fields.filter((f) => f.id !== action.id);
      return next.length === state.fields.length ? state : { ...state, fields: next };
    }

    default:
      return state;
  }
}

/**
 * The signer the next box belongs to, resolved against the CURRENT list.
 *
 * The stored selection can go dangling — the user can go `Back` and change or
 * clear the chosen recipient's email — so it is resolved rather than trusted.
 * The fallback is the first recipient who has an email at all, because a
 * recipient with a blank address can own nothing (§A4.10, and the kernel's
 * `ownerIndexOf` skips them). When nobody has one, the answer is `''` and the
 * palette says so instead of placing an orphan.
 */
export function selectedOwnerOf(
  state: FieldsState,
  recipients: readonly { readonly email: string }[],
): string {
  const owners = recipients.map((r) => normalizeEmail(r.email)).filter((email) => email !== '');
  if (state.selectedEmail !== '' && owners.includes(state.selectedEmail)) return state.selectedEmail;
  return owners[0] ?? '';
}
