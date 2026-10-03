/**
 * Field placement — `test_2_en.md` §A4, §B2, §B3 and §B5 (Case 2, P3).
 *
 * `signature_count` and `meterai_count` are STATEMENTS OF INTENT; the fields
 * are their materialization. §A4.9-§A4.12 is the reconciliation invariant, and
 * it is the heart of this case:
 *
 *   - per recipient, the `signature` fields they own == `signature_count`, and
 *     the `meterai` fields they own == `meterai_count` (§A4.9);
 *   - no field belongs to someone outside the recipient list (§A4.10);
 *   - a `meterai` field only belongs to a recipient §A3.3 allows one (§A4.11);
 *   - PRICING STILL COMES FROM THE COUNTS (§A4.12). Mismatched fields make the
 *     document invalid; they do not change the bill. That is why `pricing.ts`
 *     has no field parameter and this module never imports it: the invariant is
 *     structural, not a rule someone has to remember.
 *
 * ## THE TWO-FUNCTION GEOMETRY SPLIT
 *
 * §B2 is one sentence long and it decides the shape of this file:
 *
 *   > **The UI clamps. The API rejects.**
 *
 * So the geometry is TWO functions over the same constants, never one:
 *
 *   - `clampFieldPosition` — FRONTEND ONLY. Pulls a position into range and
 *     always returns a usable whole-number position.
 *   - `isFieldInBounds` / `validateFieldBounds` — BACKEND ONLY. Judge a
 *     position and NEVER repair one.
 *
 * A single "helpful" shared helper is the exact failure §B7.15/§B7.16 are
 * written to catch: the server would quietly turn a hostile `x = 500` into
 * `420` and answer `200`, when the contract says `422 FIELD_OUT_OF_BOUNDS`.
 * The two names are deliberately not interchangeable — one is a verb that
 * returns a position, the other is a question that returns a verdict — and the
 * suite asserts that the backend path rejects rather than repairs.
 *
 * This is the same asymmetry `clampSignatureCount`/`isValidSignatureCount`
 * already established in `recipient.ts`, and `stepOf`/`isValidStep` in
 * `steps.ts`. Third occurrence, same convention, no new one invented.
 *
 * ## §A4.13 — the decision: FLAG, DO NOT AUTO-DROP
 *
 * When a count is lowered below the number of placed fields, the excess fields
 * are FLAGGED for the user to remove (`excess_field_ids`). They are never
 * silently deleted. Silently destroying a user's placed boxes is the more
 * destructive default, and the flagged path reuses the very reconciliation UI
 * §A4.6 already requires (`Signature 1/2`). Auto-drop would need its own undo
 * story to be defensible.
 *
 * §B7.13 — a recipient deleted while owning fields — gets the same answer for
 * the same reason: their fields are ORPHANED and reported in
 * `orphan_field_ids`, not cascade-deleted. Everything this module returns is a
 * fresh value; no function here mutates a field list.
 *
 * Nothing here knows a price or an allowance (ADR-003), and nothing here is
 * about tokens or locking (P4).
 */

import { validationFailure, type ValidationFailure } from './errors.js';
import {
  meteraiCountOf,
  normalizeEmail,
  signatureCountOf,
  type RecipientListStage,
} from './recipient.js';
import { FIRST_STEP, stepOf } from './steps.js';
import type { FieldInput, FieldKind, OrderMode, RecipientInput } from './types.js';

export type { Field, FieldInput, FieldKind } from './types.js';

/** A width/height pair in content-area units. */
export interface FieldSize {
  readonly width: number;
  readonly height: number;
}

/** A field's top-left corner, relative to the content area (§B2). */
export interface FieldPosition {
  readonly x: number;
  readonly y: number;
}

/** The inclusive upper bound of each axis for one kind. The lower bound is 0. */
export interface FieldBounds {
  readonly maxX: number;
  readonly maxY: number;
}

/** §B3: the two kinds, in palette order (§A4.1 lists Signature then eMeterai). */
export const FIELD_KINDS = ['signature', 'meterai'] as const satisfies readonly FieldKind[];

/** §B3/§A4.7: page 1 is the only page. Multi-page documents are out of scope. */
export const FIELD_PAGE = 1;

/** §B2, from the mockup. */
export const PAGE_SIZE: FieldSize = { width: 760, height: 700 };

/** §B2: `56` top/bottom, `64` left/right. */
export const PAGE_PADDING = { top: 56, right: 64, bottom: 56, left: 64 } as const;

/**
 * §B2 — the content area coordinates are relative to, DERIVED rather than
 * restated: `760 - 64 - 64 = 632` and `700 - 56 - 56 = 588`. Writing `632`
 * here as a literal would let the page size and the padding drift away from it
 * without anything noticing.
 */
export const CONTENT_AREA: FieldSize = {
  width: PAGE_SIZE.width - PAGE_PADDING.left - PAGE_PADDING.right,
  height: PAGE_SIZE.height - PAGE_PADDING.top - PAGE_PADDING.bottom,
};

/** §B2 — the only two field sizes. Everything else about range follows. */
export const FIELD_SIZES: Readonly<Record<FieldKind, FieldSize>> = {
  signature: { width: 212, height: 88 },
  meterai: { width: 112, height: 112 },
};

/** §B3 — `"signature"` | `"meterai"`, exactly. No trimming, no case folding. */
export function isFieldKind(raw: unknown): raw is FieldKind {
  return raw === 'signature' || raw === 'meterai';
}

/** The kind's box size (§B2). */
export function fieldSizeOf(kind: FieldKind): FieldSize {
  return FIELD_SIZES[kind];
}

/**
 * The widest and tallest box of any kind. Used as the fallback range for a
 * position whose kind cannot be resolved: the intersection of every kind's
 * legal range, so an unresolvable kind is clamped to somewhere every kind
 * would fit rather than to an arbitrary corner.
 *
 * Only `clampFieldPosition` (frontend) ever reaches this. The backend path
 * REFUSES an unresolvable kind instead — see `validateFieldBounds`.
 */
const LARGEST_FIELD_SIZE: FieldSize = {
  width: Math.max(...FIELD_KINDS.map((kind) => FIELD_SIZES[kind].width)),
  height: Math.max(...FIELD_KINDS.map((kind) => FIELD_SIZES[kind].height)),
};

function boundsForSize(size: FieldSize): FieldBounds {
  return {
    maxX: CONTENT_AREA.width - size.width,
    maxY: CONTENT_AREA.height - size.height,
  };
}

/**
 * §B2 — `0 <= x <= 632 - width`, `0 <= y <= 588 - height`, DERIVED from the
 * content area and the kind's size.
 *
 * `signature` (`212 x 88`) therefore yields `x in [0,420]`, `y in [0,500]`, and
 * `meterai` (`112 x 112`) yields `x in [0,520]`, `y in [0,476]` — §B2's own
 * numbers, computed rather than copied. Both are asserted in the suite, the
 * derivation and the result, so a wrong dimension cannot hide behind a right
 * bound or the reverse.
 *
 * Note that the two ranges CROSS: `x = 500` is illegal for a signature and
 * legal for a meterai, while `y = 500` is the reverse. One shared bound would
 * necessarily get one of the two wrong.
 */
export function fieldBoundsFor(kind: FieldKind): FieldBounds {
  return boundsForSize(isFieldKind(kind) ? FIELD_SIZES[kind] : LARGEST_FIELD_SIZE);
}

/**
 * FRONTEND ONLY (§B2: "The UI clamps").
 *
 * Pulls a position into the kind's range and always returns a usable
 * whole-number `{ x, y }` — out of range is clamped to the nearest bound,
 * fractional is rounded (§B3 says the coordinates are integers, and a pointer
 * does not produce integers), and anything that is not a number at all reads as
 * `0`. The result is never `NaN` or `undefined`, no matter how the caller got
 * into that state: this is the same guarantee `clampSignatureCount` gives the
 * steppers (PRD §8.3).
 *
 * `-Infinity` clamps to `0` and `Infinity` to the bound, which is the honest
 * reading of "below the range" and "above the range".
 *
 * THIS FUNCTION MUST NOT BE CALLED BY THE SERVER. The server's answer to an
 * out-of-range coordinate is `422 FIELD_OUT_OF_BOUNDS` (§B7.15, §B7.16), and a
 * repaired position would turn that rejection into a silent `200`.
 */
export function clampFieldPosition(
  kind: FieldKind,
  position: { readonly x?: unknown; readonly y?: unknown },
): FieldPosition {
  const { maxX, maxY } = fieldBoundsFor(kind);
  const source = (position ?? {}) as { readonly x?: unknown; readonly y?: unknown };
  return {
    x: clampAxis(source.x, maxX),
    y: clampAxis(source.y, maxY),
  };
}

function clampAxis(raw: unknown, max: number): number {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  if (raw <= 0) return 0;
  if (raw >= max) return max;
  return Math.round(raw);
}

/**
 * BACKEND ONLY (§B2: "The API rejects").
 *
 * True when the field's position is a whole number inside the range its KIND
 * allows. No coercion anywhere: `2.5`, `"64"`, `null` and a `kind` outside the
 * two are all false rather than repaired, and the field is left exactly as it
 * arrived.
 *
 * Integrality is part of the question rather than a separate one, because §B3
 * makes "an integer within the range" the whole of what a legal coordinate is.
 */
export function isFieldInBounds(field: FieldInput): boolean {
  const candidate = asField(field);
  if (!isFieldKind(candidate.kind)) return false;

  const { maxX, maxY } = fieldBoundsFor(candidate.kind);
  return isWholeWithin(candidate.x, maxX) && isWholeWithin(candidate.y, maxY);
}

function isWholeWithin(raw: unknown, max: number): boolean {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= max;
}

function asField(field: FieldInput): Partial<FieldInput> {
  return (typeof field === 'object' && field !== null ? field : {}) as Partial<FieldInput>;
}

/** A field's `id` as a rejection can quote it — `''` when it has no usable one. */
function fieldIdOf(field: FieldInput): string {
  const id = asField(field).id;
  return typeof id === 'string' ? id : '';
}

/**
 * The handle `reconcileFields` reports a field by.
 *
 * Normally the field's own `id`. A field with no usable id is reported as
 * `#<position>` so the projection stays total and renderable — the `field-shape`
 * stage refuses such a list outright, so this only ever shows up in the
 * frontend's live view of a half-built state, never in an accepted document.
 */
function displayIdOf(field: FieldInput, index: number): string {
  const id = fieldIdOf(field);
  return id === '' ? `#${index}` : id;
}

/** The owner as this kernel compares emails: trimmed and lowercased (§B3). */
export function fieldOwnerOf(field: FieldInput): string {
  return normalizeEmail(asField(field).recipient_email as string);
}

/**
 * The submitted collection as the rules and the projections can use it.
 *
 * Lenient in exactly the way `stepOf` and `meteraiCountOf` are: absence, `null`
 * and anything that is not an array all read as the empty list, so no
 * projection ever has to carry a third state. Whether an empty list is LEGAL is
 * a different question, answered by the reconciliation stage — for a document
 * that promised two signatures, it is not.
 */
export function fieldListOf(raw: unknown): readonly FieldInput[] {
  return Array.isArray(raw) ? (raw as readonly FieldInput[]) : [];
}

/**
 * Whether the request submitted a field collection at all.
 *
 * `undefined` is the documented default — the Step-2 preview, which places no
 * boxes — and makes both field stages vacuous. Everything else, INCLUDING
 * `null` and `[]`, counts as present and is judged: `null` is a mistake rather
 * than a default (the stance `meterai_count` already takes), and `[]` is a real
 * Step 3 with nothing placed yet.
 */
export function fieldsProvided(raw: unknown): boolean {
  return raw !== undefined;
}

// ---------------------------------------------------------------------------
// §B5 stage: field shape & bounds.
// ---------------------------------------------------------------------------

/**
 * §B3/§B7.18 — identity, checked across the whole list before anything else.
 *
 * Identity comes first because every other rejection in this module names the
 * offending field BY ID (`details.field_id`). A list whose ids are ambiguous
 * cannot be reported on coherently, so the ambiguity is the failure to report.
 *
 * Two shapes under the one code §B5 provides:
 *
 *   - an `id` that is not a non-blank string — it cannot be shown to be unique,
 *     which is what §B3 requires of it;
 *   - two fields sharing an `id`. The SECOND occurrence is named, because the
 *     first is the box the user already had and the collision arrived with the
 *     later one.
 *
 * Ids are compared EXACTLY — no trimming, no case folding. §B3 normalizes
 * `recipient_email` and says only "unique" about `id`, so `"f1"` and `"F1"` are
 * two different fields. A blank-after-trim id is rejected rather than compared.
 */
export function validateFieldIdentity(fields: unknown): ValidationFailure | null {
  const list = fieldListOf(fields);
  const seen = new Set<string>();

  for (let index = 0; index < list.length; index += 1) {
    const id = fieldIdOf(list[index] as FieldInput);

    if (id.trim() === '') {
      return validationFailure('FIELD_ID_DUPLICATE', 'Field id must be a non-empty unique string', {
        field_index: index,
      });
    }

    if (seen.has(id)) {
      return validationFailure('FIELD_ID_DUPLICATE', `Two fields share the id "${id}"`, {
        field_id: id,
        field_index: index,
      });
    }

    seen.add(id);
  }

  return null;
}

/** §B3/§B7.17 — `page` is required and must be `1`. Page 1 only (§A4.7). */
export function validateFieldPage(field: FieldInput, index: number): ValidationFailure | null {
  const page = asField(field).page;
  if (page === FIELD_PAGE) return null;

  return validationFailure(
    'FIELD_PAGE_INVALID',
    `page must be ${FIELD_PAGE} - this document has one page`,
    fieldDetails(field, index),
  );
}

/**
 * §B2/§B7.15/§B7.16 — the position must be a whole number inside the range the
 * field's KIND allows. NEVER clamps: see the file header.
 *
 * A `kind` with no geometry is refused here too, under the same code: §B5 adds
 * no sixth field code, and a box whose kind is unknown has no range it could be
 * inside of. The message says which of the two it is.
 */
export function validateFieldBounds(field: FieldInput, index: number): ValidationFailure | null {
  const candidate = asField(field);

  if (!isFieldKind(candidate.kind)) {
    return validationFailure(
      'FIELD_OUT_OF_BOUNDS',
      'kind must be "signature" or "meterai" - any other kind has no place on the page',
      fieldDetails(field, index),
    );
  }

  if (isFieldInBounds(field)) return null;

  const { maxX, maxY } = fieldBoundsFor(candidate.kind);
  return validationFailure(
    'FIELD_OUT_OF_BOUNDS',
    `A ${candidate.kind} field must sit at whole-number x in 0-${maxX} and y in 0-${maxY} - ` +
      `got x ${String(candidate.x)}, y ${String(candidate.y)}`,
    fieldDetails(field, index),
  );
}

/** One field: page, then position. The first fault wins, as `validateRecipient` does. */
export function validateFieldShape(field: FieldInput, index: number): ValidationFailure | null {
  return validateFieldPage(field, index) ?? validateFieldBounds(field, index);
}

/**
 * §B5 — "field shape & bounds" over the whole list: identity first, then each
 * field in index order.
 *
 * Takes `unknown` because the server hands it a parsed request body, exactly as
 * `validateRecipientList` does.
 */
export function validateFieldList(fields: unknown): ValidationFailure | null {
  const identity = validateFieldIdentity(fields);
  if (identity) return identity;

  const list = fieldListOf(fields);
  for (let index = 0; index < list.length; index += 1) {
    const failure = validateFieldShape(list[index] as FieldInput, index);
    if (failure) return failure;
  }
  return null;
}

function fieldDetails(field: FieldInput, index: number): { field_id?: string; field_index: number } {
  const id = fieldIdOf(field);
  return id === '' ? { field_index: index } : { field_id: id, field_index: index };
}

// ---------------------------------------------------------------------------
// §A4.9-§A4.11 — ownership and reconciliation.
// ---------------------------------------------------------------------------

/** Per-kind figures. The same shape on both sides of the invariant. */
export interface FieldCounts {
  readonly signature: number;
  readonly meterai: number;
}

/**
 * One recipient's line of §A4.6's reconciliation panel —
 * `Rina Halim - Signature 1/2 · eMeterai 0/1` — plus the markers §A4.6 demands
 * for BOTH directions.
 *
 * `required` is the promise (the counts), `placed` is the materialization (the
 * fields). `missing` and `excess` are the two one-sided differences, so the UI
 * never has to decide which way to subtract, and `excess_field_ids` names the
 * specific boxes to remove — that list is the whole of §A4.13's "flag, don't
 * auto-drop" made renderable.
 */
export interface RecipientFieldProgress {
  readonly recipient_index: number;
  /** Normalized, so it matches `fieldOwnerOf` and the `steps` projection. */
  readonly recipient_email: string;
  readonly required: FieldCounts;
  readonly placed: FieldCounts;
  /** `required - placed`, clamped at 0. */
  readonly missing: FieldCounts;
  /** `placed - required`, clamped at 0. */
  readonly excess: FieldCounts;
  /**
   * The ids of this recipient's excess boxes — signatures first, then eMeterai,
   * and within a kind the LATER ones. The first `required` fields of a kind are
   * the ones the count promised; the rest arrived after it was lowered.
   */
  readonly excess_field_ids: readonly string[];
  readonly satisfied: boolean;
}

/** Everything the Step-3 screen needs to render §A4.6, as one value. */
export interface FieldReconciliation {
  /** One row per recipient, in recipient index order. */
  readonly rows: readonly RecipientFieldProgress[];
  /**
   * §A4.10/§B7.13 — fields belonging to nobody in the list, in field order.
   * A recipient deleted while owning fields leaves their boxes HERE; they are
   * never cascade-deleted.
   */
  readonly orphan_field_ids: readonly string[];
  /** §A4.13 — every row's excess, flattened and de-duplicated, in field order. */
  readonly excess_field_ids: readonly string[];
  /** Totals of both sides of the invariant. */
  readonly required: FieldCounts;
  readonly placed: FieldCounts;
  /** How many fields were submitted, orphans and excess included. */
  readonly field_count: number;
  /** True only when every row matches exactly and nothing is orphaned (§A4.9). */
  readonly satisfied: boolean;
}

/**
 * §A4.11 / §A3.3 — may this recipient be given a `meterai` field at all?
 *
 * Affixing a duty stamp produces a single stamped version of the document
 * before the signing chain starts, so in `sequential` only step 1 may carry
 * one. Vacuous in `parallel` (§A3.4: parallel IS a single step).
 *
 * Exported for the frontend: §A4.1's palette can disable its eMeterai button
 * for a signer who may not hold one, which is how the rule becomes visible
 * before a request is ever made rather than only in a `422`.
 */
export function canCarryMeteraiField(r: RecipientInput, mode: OrderMode): boolean {
  return mode !== 'sequential' || stepOf(r) === FIRST_STEP;
}

interface OwnerIndex {
  readonly byEmail: Map<string, number>;
}

/**
 * Who may own a field, by normalized email.
 *
 * A recipient whose email is blank is SKIPPED: a mid-edit row has no identity
 * yet, so it can neither own a field nor adopt an unowned one. That is the same
 * stance `findDuplicateEmailGroups` takes on blank emails.
 *
 * On a duplicate email the FIRST row wins the index. A duplicate list is
 * already refused by the `duplicates` stage, which runs before any field rule;
 * the tie-break exists so the frontend's live projection stays total.
 */
function ownerIndexOf(recipients: readonly RecipientInput[]): OwnerIndex {
  const byEmail = new Map<string, number>();
  const list = Array.isArray(recipients) ? recipients : [];

  list.forEach((r, index) => {
    const email = normalizeEmail((r as Partial<RecipientInput>)?.email as string);
    if (email === '' || byEmail.has(email)) return;
    byEmail.set(email, index);
  });

  return { byEmail };
}

/**
 * §A4.10 / §B7.12 — a field may not belong to someone who is not a recipient.
 *
 * Reported BEFORE any count mismatch, and that ordering is a judgment call
 * worth stating: an orphan field usually ALSO leaves its intended owner short,
 * so both rules fire at once. "This box belongs to nobody" is the deeper and
 * the actionable cause — fixing the email fixes both, while placing another box
 * fixes neither. §A4's numbering is not a validation order (§B5 is, and it has
 * one entry for all of reconciliation), so there is no contract against it.
 *
 * A field with no owner at all falls under the same code: it belongs to nobody
 * in the most literal way.
 */
export function validateFieldOwnership(
  recipients: readonly RecipientInput[],
  fields: unknown,
): ValidationFailure | null {
  const { byEmail } = ownerIndexOf(recipients);
  const list = fieldListOf(fields);

  for (let index = 0; index < list.length; index += 1) {
    const f = list[index] as FieldInput;
    const email = fieldOwnerOf(f);
    if (email !== '' && byEmail.has(email)) continue;

    const message =
      email === ''
        ? 'A field must belong to one of the recipients'
        : `${email} is not in the recipient list - a field cannot belong to someone who is not a recipient`;

    return validationFailure('FIELD_UNKNOWN_RECIPIENT', message, {
      ...fieldDetails(f, index),
      ...(email === '' ? {} : { recipient_email: email }),
    });
  }

  return null;
}

/**
 * §A4.11 — a `meterai` FIELD may only belong to a recipient §A3.3 allows one.
 *
 * Reuses `METERAI_NOT_IN_FIRST_STEP`, because it is the same rule seen from the
 * other side, and §B5 adds no field-specific code for it. The failure names the
 * box as well as the row, which the recipient-level check cannot do.
 *
 * In the full §B5 pipeline this is nearly always SHADOWED: a step-2 recipient
 * with `meterai_count > 0` is already refused by the `meterai-step-placement`
 * stage. What it catches is the one state that gets past that stage — a step-2
 * recipient with count `0` who nonetheless owns a meterai box — which would
 * otherwise be reported as a mere count mismatch and send the user to fix the
 * wrong thing.
 *
 * Vacuous in `parallel` (§A3.4).
 */
export function validateMeteraiFieldPlacement(
  recipients: readonly RecipientInput[],
  fields: unknown,
  mode: OrderMode,
): ValidationFailure | null {
  if (mode !== 'sequential') return null;

  const { byEmail } = ownerIndexOf(recipients);
  const list = fieldListOf(fields);

  for (let index = 0; index < list.length; index += 1) {
    const f = list[index] as FieldInput;
    if (asField(f).kind !== 'meterai') continue;

    const email = fieldOwnerOf(f);
    const ownerIndex = byEmail.get(email);
    if (ownerIndex === undefined) continue; // Already an ownership failure.

    const owner = (recipients[ownerIndex] as RecipientInput) ?? ({} as RecipientInput);
    if (canCarryMeteraiField(owner, mode)) continue;

    const step = stepOf(owner);
    return validationFailure(
      'METERAI_NOT_IN_FIRST_STEP',
      `${email} carries an eMeterai field but is in step ${step} - a duty stamp is affixed ` +
        `before the signing chain starts, so only step ${FIRST_STEP} may carry eMeterai`,
      {
        recipient_index: ownerIndex,
        recipient_email: email,
        ...fieldDetails(f, index),
      },
    );
  }

  return null;
}

const KIND_LABEL: Readonly<Record<FieldKind, string>> = {
  signature: 'signature',
  meterai: 'eMeterai',
};

/**
 * §A4.9 / §B7.10 / §B7.11 — placed must equal promised, per recipient and per
 * kind, in BOTH directions.
 *
 * Walks recipients in index order and, within a recipient, signatures before
 * eMeterai, so the reported failure reads in the same order §A4.6's panel does.
 * Names the row (`recipient_index`, `recipient_email`) always, and the first
 * excess box (`field_id`) when there is one — a SHORTFALL names no field,
 * because there is no box to point at yet.
 */
export function validateFieldCounts(
  recipients: readonly RecipientInput[],
  fields: unknown,
): ValidationFailure | null {
  const report = reconcileFields(recipients, fields);

  for (const row of report.rows) {
    for (const kind of FIELD_KINDS) {
      const placed = row.placed[kind];
      const required = row.required[kind];
      if (placed === required) continue;

      const difference =
        placed < required ? `${required - placed} still to place` : `${placed - required} too many`;
      const [firstExcess] = row.excess_field_ids;

      return validationFailure(
        'FIELD_COUNT_MISMATCH',
        `${row.recipient_email} has ${placed} of ${required} ${KIND_LABEL[kind]} fields placed - ${difference}`,
        {
          recipient_index: row.recipient_index,
          recipient_email: row.recipient_email,
          ...(placed > required && firstExcess !== undefined ? { field_id: firstExcess } : {}),
        },
      );
    }
  }

  return null;
}

/**
 * §B5 — the whole of "field-vs-count reconciliation", in one ordered function:
 * ownership (§A4.10) -> meterai placement (§A4.11) -> counts (§A4.9).
 */
export function validateFieldReconciliation(
  recipients: readonly RecipientInput[],
  fields: unknown,
  mode: OrderMode,
): ValidationFailure | null {
  return (
    validateFieldOwnership(recipients, fields) ??
    validateMeteraiFieldPlacement(recipients, fields, mode) ??
    validateFieldCounts(recipients, fields)
  );
}

/**
 * The reconciliation invariant as a VALUE rather than a verdict — everything
 * §A4.6's panel renders and everything §A4.13 needs to flag.
 *
 * Pure and non-mutating: the submitted list is read, never spliced. That is the
 * §A4.13 decision in code — excess and orphaned fields are reported for the
 * user to remove, and this function has no way to drop one even if a caller
 * wanted it to.
 *
 * Both counts are read through the kernel's LENIENT accessors, so a mid-edit
 * row requires 0 rather than poisoning the panel with `NaN`; the row is
 * separately refused by `validateRecipient`, which runs first in §B5's order.
 * A field whose `kind` is neither of the two counts towards nothing — judging it
 * is the `field-shape` stage's job, not this projection's.
 */
export function reconcileFields(
  recipients: readonly RecipientInput[],
  fields: unknown,
): FieldReconciliation {
  const list = Array.isArray(recipients) ? recipients : [];
  const fieldList = fieldListOf(fields);
  const { byEmail } = ownerIndexOf(list);

  // Fields grouped by owner row and kind, in field order — which is what makes
  // "the LATER ones are the excess" well defined.
  const owned = new Map<number, Record<FieldKind, string[]>>();
  const orphans: string[] = [];

  fieldList.forEach((f, index) => {
    const id = displayIdOf(f, index);
    const email = fieldOwnerOf(f);
    const ownerIndex = email === '' ? undefined : byEmail.get(email);

    if (ownerIndex === undefined) {
      orphans.push(id);
      return;
    }

    const kind = asField(f).kind;
    if (!isFieldKind(kind)) return;

    const bucket = owned.get(ownerIndex) ?? { signature: [], meterai: [] };
    bucket[kind].push(id);
    owned.set(ownerIndex, bucket);
  });

  const rows: RecipientFieldProgress[] = list.map((r, index) => {
    const placedIds = owned.get(index) ?? { signature: [], meterai: [] };
    const required: FieldCounts = {
      signature: signatureCountOf(r),
      meterai: meteraiCountOf(r),
    };
    const placed: FieldCounts = {
      signature: placedIds.signature.length,
      meterai: placedIds.meterai.length,
    };

    const excessIds = FIELD_KINDS.flatMap((kind) => placedIds[kind].slice(required[kind]));

    return {
      recipient_index: index,
      recipient_email: normalizeEmail((r as Partial<RecipientInput>)?.email as string),
      required,
      placed,
      missing: {
        signature: Math.max(0, required.signature - placed.signature),
        meterai: Math.max(0, required.meterai - placed.meterai),
      },
      excess: {
        signature: Math.max(0, placed.signature - required.signature),
        meterai: Math.max(0, placed.meterai - required.meterai),
      },
      excess_field_ids: excessIds,
      satisfied:
        placed.signature === required.signature && placed.meterai === required.meterai,
    };
  });

  // Flattened in FIELD order rather than row order, and de-duplicated: two rows
  // sharing an email (a state the `duplicates` stage refuses, but one the live
  // frontend projection can see mid-edit) would otherwise flag the same box
  // twice.
  const flagged = new Set(rows.flatMap((row) => row.excess_field_ids));
  const seenExcess = new Set<string>();
  const excessInFieldOrder: string[] = [];
  fieldList.forEach((f, index) => {
    const id = displayIdOf(f, index);
    if (!flagged.has(id) || seenExcess.has(id)) return;
    seenExcess.add(id);
    excessInFieldOrder.push(id);
  });

  return {
    rows,
    orphan_field_ids: orphans,
    excess_field_ids: excessInFieldOrder,
    required: totalOf(rows, 'required'),
    placed: totalOf(rows, 'placed'),
    field_count: fieldList.length,
    satisfied: orphans.length === 0 && rows.every((row) => row.satisfied),
  };
}

function totalOf(
  rows: readonly RecipientFieldProgress[],
  side: 'required' | 'placed',
): FieldCounts {
  return rows.reduce<FieldCounts>(
    (total, row) => ({
      signature: total.signature + row[side].signature,
      meterai: total.meterai + row[side].meterai,
    }),
    { signature: 0, meterai: 0 },
  );
}

// ---------------------------------------------------------------------------
// §B5 stages.
// ---------------------------------------------------------------------------

/**
 * §B5 — "field shape & bounds", immediately after `meterai-step-placement`.
 *
 * Closes over the RAW `fields` value off the request, the same way
 * `orderModeStage` closes over the raw mode and the quota stages close over the
 * allowance. That is what lets a stage about fields live in a pipeline whose
 * stage signature is `(recipients) => failure | null` without widening that
 * signature for the ten stages that do not care.
 *
 * Vacuous when no collection was submitted (see `fieldsProvided`), so the
 * pipeline's SHAPE never varies — only its verdicts do.
 */
export function fieldShapeStage(rawFields: unknown): RecipientListStage {
  return {
    name: 'field-shape',
    run: () => (fieldsProvided(rawFields) ? validateFieldList(rawFields) : null),
  };
}

/** §B5 — "field-vs-count reconciliation", between field shape and the quotas. */
export function fieldReconciliationStage(rawFields: unknown, mode: OrderMode): RecipientListStage {
  return {
    name: 'field-reconciliation',
    run: (recipients) =>
      fieldsProvided(rawFields)
        ? validateFieldReconciliation(recipients, rawFields, mode)
        : null,
  };
}

/** Both field stages, shape before reconciliation (§B5). */
export function fieldStages(rawFields: unknown, mode: OrderMode): readonly RecipientListStage[] {
  return [fieldShapeStage(rawFields), fieldReconciliationStage(rawFields, mode)];
}
