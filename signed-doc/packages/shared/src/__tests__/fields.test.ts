/**
 * Written BEFORE `fields.ts`. Every expected value below is hand-derived from
 * `test_2_en.md` — never copied out of a run.
 *
 *   §A4.8  clamping applies on the frontend AND the backend. §B2 then splits
 *          that sentence in two: "The UI clamps. The API rejects."
 *   §A4.9  per recipient, the number of `signature` fields they own == their
 *          `signature_count`, and the `meterai` fields == `meterai_count`.
 *   §A4.10 no field may belong to someone who is not in the recipient list.
 *   §A4.11 a `meterai` field may only belong to a recipient satisfying §A3.3
 *          (in `sequential`, step 1 only).
 *   §A4.12 PRICING IS STILL COMPUTED FROM THE COUNTS, not from the number of
 *          fields. Mismatched fields make the document invalid; they do not
 *          change the bill.
 *   §A4.13 counts lowered below the number of placed fields: the decision taken
 *          (delta §9.1) is FLAG, not auto-drop. Excess fields are reported for
 *          the user to remove and are never silently deleted.
 *   §B2    page `760 x 700`, padding `56` top/bottom and `64` left/right, so
 *          the content area is `632 x 588`. `signature` is `212 x 88`,
 *          `meterai` is `112 x 112`. Clamping is `0 <= x <= 632 - width` and
 *          `0 <= y <= 588 - height`, which §B2 then states as
 *          `signature: x in [0,420], y in [0,500]` and
 *          `meterai: x in [0,520], y in [0,476]`.
 *          Both halves are asserted below: the ranges are DERIVED from the
 *          dimensions, and the derivation is checked against §B2's own numbers.
 *   §B3    `{ id, kind, recipient_email, page, x, y }`. `recipient_email` is
 *          compared after trimming, case-insensitively; `page` is required and
 *          must be `1`; `x`/`y` are integers; `id` must be unique.
 *   §B4    `fields` is part of the extended request; the response carries
 *          `field_count`.
 *   §B5    order: ... -> meterai step placement -> FIELD SHAPE & BOUNDS ->
 *          FIELD-VS-COUNT RECONCILIATION -> signature quota -> meterai quota.
 *   §B7.10 Rina `signature_count` 2, 1 signature field placed ->
 *          `FIELD_COUNT_MISMATCH`, and the UI can show `Signature 1/2`.
 *   §B7.11 Rina `signature_count` 2, 3 signature fields placed ->
 *          `FIELD_COUNT_MISMATCH`, and the UI can show the excess.
 *   §B7.12 a field whose `recipient_email` is not in the list ->
 *          `FIELD_UNKNOWN_RECIPIENT`.
 *   §B7.13 a recipient deleted while owning fields -> the documented decision:
 *          their fields are ORPHANED and flagged, never cascade-deleted.
 *   §B7.14 `signature_count` lowered below the number of placed fields -> per
 *          §A4.13: flagged as excess, nothing dropped.
 *   §B7.15 a `signature` at `x = 500` -> clamped to `420` in the UI; `500` sent
 *          straight to the API -> `FIELD_OUT_OF_BOUNDS`.
 *   §B7.16 a `meterai` at `y = 600` -> clamped to `476`; `600` sent straight to
 *          the API -> `FIELD_OUT_OF_BOUNDS`.
 *   §B7.17 `page: 2` or `page: 0` -> `FIELD_PAGE_INVALID`.
 *   §B7.18 two fields with the same `id` -> `FIELD_ID_DUPLICATE`.
 *
 * Nothing here knows a price or an allowance: the quota and price fixtures are
 * PARAMETERS handed to the factories, exactly as ADR-003 requires.
 */
import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type ValidationFailure } from '../errors.js';
import {
  CONTENT_AREA,
  FIELD_KINDS,
  FIELD_PAGE,
  FIELD_SIZES,
  PAGE_PADDING,
  PAGE_SIZE,
  canCarryMeteraiField,
  clampFieldPosition,
  fieldBoundsFor,
  fieldListOf,
  fieldOwnerOf,
  fieldReconciliationStage,
  fieldShapeStage,
  fieldSizeOf,
  fieldStages,
  isFieldInBounds,
  isFieldKind,
  reconcileFields,
  validateFieldBounds,
  validateFieldCounts,
  validateFieldList,
  validateFieldOwnership,
  validateFieldReconciliation,
  validateMeteraiFieldPlacement,
} from '../fields.js';
import { parseDecimalString } from '../money.js';
import { computeCharges } from '../pricing.js';
import { chargePreviewStages } from '../quota.js';
import { validateRecipientList } from '../recipient.js';
import type { FieldInput, RecipientInput } from '../types.js';

/** §B1 fixtures. The kernel is told these; it never sources them (ADR-003). */
const QUOTA = { signature: 8, meterai: 3 };
const PRICES = {
  signature: parseDecimalString('5000.00'),
  meterai: parseDecimalString('10000.10'),
};

function signer(name: string, over: Partial<RecipientInput> = {}): RecipientInput {
  return {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
    signature_count: 1,
    meterai_count: 0,
    ...over,
  };
}

function field(
  id: string,
  kind: FieldInput['kind'],
  recipient_email: string,
  over: Partial<FieldInput> = {},
): FieldInput {
  return { id, kind, recipient_email, page: 1, x: 0, y: 0, ...over };
}

function failureOf(result: ValidationFailure | null): ValidationFailure {
  if (result === null) throw new Error('expected a ValidationFailure, got null');
  return result;
}

/** The §B4 example, verbatim. */
const RINA = 'rina.halim@example.test';
const BUDI = 'budi.santoso@example.test';
const B4_RECIPIENTS: readonly RecipientInput[] = [
  signer('Rina Halim', { signature_count: 2, meterai_count: 1, email: RINA }),
  signer('Budi Santoso', { signature_count: 1, meterai_count: 0, email: BUDI }),
];
const B4_FIELDS: readonly FieldInput[] = [
  field('f1', 'signature', RINA, { x: 64, y: 224 }),
  field('f2', 'signature', RINA, { x: 64, y: 340 }),
  field('f3', 'meterai', RINA, { x: 360, y: 224 }),
  field('f4', 'signature', BUDI, { x: 64, y: 440 }),
];

function check(
  recipients: readonly RecipientInput[],
  fields?: unknown,
  mode?: unknown,
): ValidationFailure | null {
  return validateRecipientList(recipients, chargePreviewStages(QUOTA, mode, fields));
}

// ---------------------------------------------------------------------------
// §B2 — geometry. The ranges are DERIVED, then checked against §B2's numbers.
// ---------------------------------------------------------------------------

describe('§B2 geometry is derived from the mockup dimensions, not hand-copied', () => {
  it('derives the content area from the page size and its padding', () => {
    expect(CONTENT_AREA.width).toBe(PAGE_SIZE.width - PAGE_PADDING.left - PAGE_PADDING.right);
    expect(CONTENT_AREA.height).toBe(PAGE_SIZE.height - PAGE_PADDING.top - PAGE_PADDING.bottom);
    // §B2's own figures, as an independent check on the dimensions themselves.
    expect(PAGE_SIZE).toEqual({ width: 760, height: 700 });
    expect(PAGE_PADDING).toEqual({ top: 56, right: 64, bottom: 56, left: 64 });
    expect(CONTENT_AREA).toEqual({ width: 632, height: 588 });
  });

  it('declares the two field sizes §B2 gives', () => {
    expect(FIELD_KINDS).toEqual(['signature', 'meterai']);
    expect(FIELD_SIZES.signature).toEqual({ width: 212, height: 88 });
    expect(FIELD_SIZES.meterai).toEqual({ width: 112, height: 112 });
    expect(fieldSizeOf('signature')).toEqual(FIELD_SIZES.signature);
    expect(fieldSizeOf('meterai')).toEqual(FIELD_SIZES.meterai);
  });

  it('derives every bound as content area minus field size, for every kind', () => {
    for (const kind of FIELD_KINDS) {
      expect(fieldBoundsFor(kind)).toEqual({
        maxX: CONTENT_AREA.width - FIELD_SIZES[kind].width,
        maxY: CONTENT_AREA.height - FIELD_SIZES[kind].height,
      });
    }
  });

  it('lands on exactly the ranges §B2 states', () => {
    // 632 - 212 = 420, 588 - 88 = 500.
    expect(fieldBoundsFor('signature')).toEqual({ maxX: 420, maxY: 500 });
    // 632 - 112 = 520, 588 - 112 = 476.
    expect(fieldBoundsFor('meterai')).toEqual({ maxX: 520, maxY: 476 });
  });

  it('pins page 1 as the only page (§B3, §A4.7 — page 1 only)', () => {
    expect(FIELD_PAGE).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// THE SPLIT — "The UI clamps. The API rejects." (§B2)
// ---------------------------------------------------------------------------

describe('the UI clamps — clampFieldPosition (FRONTEND)', () => {
  it('pulls §B7.15 back to the edge: a signature at x = 500 becomes 420', () => {
    expect(clampFieldPosition('signature', { x: 500, y: 0 })).toEqual({ x: 420, y: 0 });
  });

  it('pulls §B7.16 back to the edge: a meterai at y = 600 becomes 476', () => {
    expect(clampFieldPosition('meterai', { x: 0, y: 600 })).toEqual({ x: 0, y: 476 });
  });

  it('clamps below zero up to zero on both axes', () => {
    expect(clampFieldPosition('signature', { x: -1, y: -999 })).toEqual({ x: 0, y: 0 });
    expect(clampFieldPosition('meterai', { x: -40, y: -1 })).toEqual({ x: 0, y: 0 });
  });

  it('leaves an in-range position exactly where it was', () => {
    expect(clampFieldPosition('signature', { x: 64, y: 224 })).toEqual({ x: 64, y: 224 });
    expect(clampFieldPosition('meterai', { x: 360, y: 224 })).toEqual({ x: 360, y: 224 });
  });

  it('keeps the exact edge as-is, on every bound of every kind', () => {
    for (const kind of FIELD_KINDS) {
      const { maxX, maxY } = fieldBoundsFor(kind);
      expect(clampFieldPosition(kind, { x: maxX, y: maxY })).toEqual({ x: maxX, y: maxY });
      expect(clampFieldPosition(kind, { x: maxX + 1, y: maxY + 1 })).toEqual({ x: maxX, y: maxY });
    }
  });

  it('always returns whole numbers, so §B3 holds for whatever a pointer produced', () => {
    expect(clampFieldPosition('signature', { x: 64.4, y: 223.5 })).toEqual({ x: 64, y: 224 });
    expect(clampFieldPosition('meterai', { x: 519.9, y: 475.4 })).toEqual({ x: 520, y: 475 });
  });

  it('never returns NaN or undefined, however corrupt the input (PRD §8.3 habit)', () => {
    expect(clampFieldPosition('signature', { x: Number.NaN, y: Number.NaN })).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      clampFieldPosition('signature', { x: '64' as unknown as number, y: null as unknown as number }),
    ).toEqual({ x: 0, y: 0 });
    expect(clampFieldPosition('signature', { x: Infinity, y: -Infinity })).toEqual({ x: 420, y: 0 });
  });
});

describe('the API rejects — the backend path never repairs a position (§B2)', () => {
  it('§B7.15: x = 500 sent straight to the API is FIELD_OUT_OF_BOUNDS, not 420', () => {
    const offending = field('f1', 'signature', RINA, { x: 500, y: 0 });
    const failure = failureOf(validateFieldBounds(offending, 0));
    expect(failure.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(failure.details?.field_id).toBe('f1');
    // The whole point of the two-function split: the field is NOT mutated into
    // a legal one on the way through. A shared helper would have returned 420.
    expect(offending.x).toBe(500);
    expect(isFieldInBounds(offending)).toBe(false);
  });

  it('§B7.16: y = 600 sent straight to the API is FIELD_OUT_OF_BOUNDS, not 476', () => {
    const offending = field('f3', 'meterai', RINA, { x: 0, y: 600 });
    expect(failureOf(validateFieldBounds(offending, 0)).code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(offending.y).toBe(600);
  });

  it('rejects through the whole pipeline rather than accepting a clamped field', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 500, y: 224 }),
      field('f2', 'signature', RINA, { x: 64, y: 340 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    const failure = failureOf(check(B4_RECIPIENTS, fields));
    expect(failure.code).toBe('FIELD_OUT_OF_BOUNDS');
    expect(fields[0]?.x).toBe(500);
  });

  it('the clamp of an out-of-range position is the position the API refuses', () => {
    // The two functions see the same geometry and disagree on purpose: the one
    // returns the repaired position, the other returns a rejection for the
    // original. That disagreement IS the contract.
    const original = { x: 500, y: 600 };
    expect(clampFieldPosition('signature', original)).toEqual({ x: 420, y: 500 });
    expect(isFieldInBounds(field('f1', 'signature', RINA, original))).toBe(false);
  });

  it('accepts the exact edge and refuses one past it, on every bound (§B7.15/16)', () => {
    for (const kind of FIELD_KINDS) {
      const { maxX, maxY } = fieldBoundsFor(kind);
      expect(isFieldInBounds(field('f', kind, RINA, { x: maxX, y: maxY }))).toBe(true);
      expect(isFieldInBounds(field('f', kind, RINA, { x: maxX + 1, y: maxY }))).toBe(false);
      expect(isFieldInBounds(field('f', kind, RINA, { x: maxX, y: maxY + 1 }))).toBe(false);
      expect(isFieldInBounds(field('f', kind, RINA, { x: 0, y: 0 }))).toBe(true);
      expect(isFieldInBounds(field('f', kind, RINA, { x: -1, y: 0 }))).toBe(false);
      expect(isFieldInBounds(field('f', kind, RINA, { x: 0, y: -1 }))).toBe(false);
    }
  });

  it('pins the four boundary pairs §B2 names, at the edge and one past it', () => {
    // signature x: 420 in, 421 out.
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 420, y: 0 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 421, y: 0 }))).toBe(false);
    // signature y: 500 in, 501 out.
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 0, y: 500 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 0, y: 501 }))).toBe(false);
    // meterai x: 520 in, 521 out.
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 520, y: 0 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 521, y: 0 }))).toBe(false);
    // meterai y: 476 in, 477 out.
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 0, y: 476 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 0, y: 477 }))).toBe(false);
  });

  it('is the geometry of the KIND, not one shared box: 500 is legal for a meterai', () => {
    // The same x that §B7.15 refuses for a signature is inside a meterai's
    // range (520). A single shared bound would get one of the two wrong.
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 500, y: 0 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 500, y: 0 }))).toBe(false);
    // And the reverse, on y: 500 is legal for a signature, out for a meterai.
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 0, y: 500 }))).toBe(true);
    expect(isFieldInBounds(field('f', 'meterai', RINA, { x: 0, y: 500 }))).toBe(false);
  });

  it('refuses a coordinate that is not a whole number, with no coercion (§B3)', () => {
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 64.5, y: 0 }))).toBe(false);
    expect(isFieldInBounds(field('f', 'signature', RINA, { x: 0, y: 2.5 }))).toBe(false);
    expect(
      isFieldInBounds(field('f', 'signature', RINA, { x: '64' as unknown as number, y: 0 })),
    ).toBe(false);
    expect(failureOf(validateFieldBounds(field('f', 'signature', RINA, { x: 64.5 }), 0)).code).toBe(
      'FIELD_OUT_OF_BOUNDS',
    );
  });

  it('refuses a field whose kind has no geometry at all', () => {
    expect(isFieldKind('signature')).toBe(true);
    expect(isFieldKind('meterai')).toBe(true);
    expect(isFieldKind('initials')).toBe(false);
    expect(isFieldKind(undefined)).toBe(false);
    const alien = { ...field('f', 'signature', RINA), kind: 'initials' } as unknown as FieldInput;
    expect(isFieldInBounds(alien)).toBe(false);
    expect(failureOf(validateFieldBounds(alien, 0)).code).toBe('FIELD_OUT_OF_BOUNDS');
  });
});

// ---------------------------------------------------------------------------
// §B3 — field shape: page, id, owner.
// ---------------------------------------------------------------------------

describe('§B7.17 — page is required and must be 1', () => {
  it('rejects page 2', () => {
    const failure = failureOf(validateFieldList([field('f1', 'signature', RINA, { page: 2 })]));
    expect(failure.code).toBe('FIELD_PAGE_INVALID');
    expect(failure.details?.field_id).toBe('f1');
    expect(failure.details?.field_index).toBe(0);
  });

  it('rejects page 0', () => {
    expect(failureOf(validateFieldList([field('f1', 'signature', RINA, { page: 0 })])).code).toBe(
      'FIELD_PAGE_INVALID',
    );
  });

  it('rejects an absent, null or non-integer page — required means required', () => {
    const noPage = { id: 'f1', kind: 'signature', recipient_email: RINA, x: 0, y: 0 };
    expect(failureOf(validateFieldList([noPage])).code).toBe('FIELD_PAGE_INVALID');
    expect(
      failureOf(validateFieldList([field('f1', 'signature', RINA, { page: null as never })])).code,
    ).toBe('FIELD_PAGE_INVALID');
    expect(
      failureOf(validateFieldList([field('f1', 'signature', RINA, { page: 1.5 })])).code,
    ).toBe('FIELD_PAGE_INVALID');
    expect(
      failureOf(validateFieldList([field('f1', 'signature', RINA, { page: '1' as never })])).code,
    ).toBe('FIELD_PAGE_INVALID');
  });

  it('accepts page 1', () => {
    expect(validateFieldList([field('f1', 'signature', RINA, { page: 1 })])).toBeNull();
  });

  it('reports the page before the position, so one field names one cause', () => {
    // Both wrong: page 2 AND x = 500. Page is the deeper fact — a coordinate on
    // a page that does not exist has nothing to be inside of.
    expect(
      failureOf(validateFieldList([field('f1', 'signature', RINA, { page: 2, x: 500 })])).code,
    ).toBe('FIELD_PAGE_INVALID');
  });
});

describe('§B7.18 — id must be unique, and usable as an identity', () => {
  it('rejects two fields sharing an id', () => {
    const failure = failureOf(
      validateFieldList([
        field('f1', 'signature', RINA, { x: 64, y: 224 }),
        field('f1', 'signature', RINA, { x: 64, y: 340 }),
      ]),
    );
    expect(failure.code).toBe('FIELD_ID_DUPLICATE');
    expect(failure.details?.field_id).toBe('f1');
    // The SECOND occurrence is the one the UI marks: the first is the field the
    // user already had, the collision arrived with the later one.
    expect(failure.details?.field_index).toBe(1);
  });

  it('rejects an id that is not a usable identity at all', () => {
    expect(failureOf(validateFieldList([field('', 'signature', RINA)])).code).toBe(
      'FIELD_ID_DUPLICATE',
    );
    expect(failureOf(validateFieldList([field('   ', 'signature', RINA)])).code).toBe(
      'FIELD_ID_DUPLICATE',
    );
    expect(
      failureOf(validateFieldList([field(7 as unknown as string, 'signature', RINA)])).code,
    ).toBe('FIELD_ID_DUPLICATE');
    expect(failureOf(validateFieldList([null])).code).toBe('FIELD_ID_DUPLICATE');
  });

  it('compares ids exactly — unlike emails, they are not trimmed or case-folded', () => {
    // §B3 normalizes `recipient_email` and says only "unique" about `id`.
    expect(
      validateFieldList([field('f1', 'signature', RINA), field('F1', 'signature', RINA)]),
    ).toBeNull();
    expect(
      validateFieldList([field('f1', 'signature', RINA), field('f1 ', 'signature', RINA)]),
    ).toBeNull();
  });

  it('settles identity before reporting any other fault, so a failure can name a field', () => {
    // A duplicate id AND a bad page. The kernel reports failures BY id; it
    // cannot name a field whose identity is still ambiguous.
    const failure = failureOf(
      validateFieldList([
        field('f1', 'signature', RINA),
        field('f1', 'signature', RINA, { page: 2 }),
      ]),
    );
    expect(failure.code).toBe('FIELD_ID_DUPLICATE');
  });

  it('accepts the §B4 example: four distinct ids', () => {
    expect(validateFieldList(B4_FIELDS)).toBeNull();
  });
});

describe('fieldListOf / fieldOwnerOf — the lenient readers', () => {
  it('reads an absent or malformed list as empty, never throwing', () => {
    expect(fieldListOf(undefined)).toEqual([]);
    expect(fieldListOf(null)).toEqual([]);
    expect(fieldListOf('f1')).toEqual([]);
    expect(fieldListOf({})).toEqual([]);
    expect(fieldListOf([])).toEqual([]);
    expect(fieldListOf(B4_FIELDS)).toEqual(B4_FIELDS);
  });

  it('normalizes an owner email the one way this kernel compares emails (§B3)', () => {
    expect(fieldOwnerOf(field('f1', 'signature', '  RINA.Halim@Example.TEST '))).toBe(RINA);
    expect(fieldOwnerOf(field('f1', 'signature', undefined as unknown as string))).toBe('');
    expect(fieldOwnerOf(null as unknown as FieldInput)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// §A4.10 / §B7.12 / §B7.13 — ownership.
// ---------------------------------------------------------------------------

describe('§B7.12 — a field may not belong to a non-recipient (§A4.10)', () => {
  it('rejects a field whose recipient_email is not in the list', () => {
    const fields = [...B4_FIELDS, field('f5', 'signature', 'citra.dewi@example.test')];
    const failure = failureOf(validateFieldOwnership(B4_RECIPIENTS, fields));
    expect(failure.code).toBe('FIELD_UNKNOWN_RECIPIENT');
    expect(failure.details?.field_id).toBe('f5');
    expect(failure.details?.field_index).toBe(4);
    expect(failure.details?.recipient_email).toBe('citra.dewi@example.test');
  });

  it('matches the owner after trimming, case-insensitively (§B3)', () => {
    const fields = [
      field('f1', 'signature', '  RINA.Halim@Example.TEST  ', { x: 64, y: 224 }),
      field('f2', 'signature', RINA, { x: 64, y: 340 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f4', 'signature', ' Budi.Santoso@EXAMPLE.test', { x: 64, y: 440 }),
    ];
    expect(validateFieldOwnership(B4_RECIPIENTS, fields)).toBeNull();
    expect(check(B4_RECIPIENTS, fields)).toBeNull();
  });

  it('rejects a field with no owner at all', () => {
    const failure = failureOf(validateFieldOwnership(B4_RECIPIENTS, [field('f9', 'signature', '')]));
    expect(failure.code).toBe('FIELD_UNKNOWN_RECIPIENT');
    expect(failure.details?.field_id).toBe('f9');
  });

  it('reports the unknown owner before any count mismatch it also causes', () => {
    // f5's email is a typo of Rina's. That leaves Rina one signature short AND
    // leaves f5 owned by nobody. "Belongs to nobody" is the deeper, actionable
    // cause — fixing the typo fixes both; adding a field fixes neither.
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f5', 'signature', 'rina.halim@exmaple.test', { x: 64, y: 340 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    expect(failureOf(check(B4_RECIPIENTS, fields)).code).toBe('FIELD_UNKNOWN_RECIPIENT');
  });
});

describe('§B7.13 — a recipient deleted while owning fields: ORPHAN AND FLAG (§A4.13)', () => {
  const remaining = [B4_RECIPIENTS[1] as RecipientInput];

  it('orphans their fields and flags them — it does NOT cascade-delete', () => {
    const fields = [...B4_FIELDS];
    const report = reconcileFields(remaining, fields);

    expect(report.orphan_field_ids).toEqual(['f1', 'f2', 'f3']);
    // The decision, made visible: nothing was removed from the list.
    expect(fields).toHaveLength(4);
    expect(fields.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
    expect(report.field_count).toBe(4);
    expect(report.satisfied).toBe(false);
  });

  it('leaves the surviving recipient’s own progress intact and satisfied', () => {
    const report = reconcileFields(remaining, B4_FIELDS);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toEqual({
      recipient_index: 0,
      recipient_email: BUDI,
      required: { signature: 1, meterai: 0 },
      placed: { signature: 1, meterai: 0 },
      missing: { signature: 0, meterai: 0 },
      excess: { signature: 0, meterai: 0 },
      excess_field_ids: [],
      satisfied: true,
    });
  });

  it('makes the document invalid with FIELD_UNKNOWN_RECIPIENT, so the user is told', () => {
    expect(failureOf(check(remaining, B4_FIELDS)).code).toBe('FIELD_UNKNOWN_RECIPIENT');
  });
});

// ---------------------------------------------------------------------------
// §A4.9 / §B7.10 / §B7.11 — the reconciliation invariant.
// ---------------------------------------------------------------------------

describe('§A4.9 — placed fields must equal the counts, exactly', () => {
  it('accepts the §B4 example: every count materialized', () => {
    expect(validateFieldCounts(B4_RECIPIENTS, B4_FIELDS)).toBeNull();
    expect(validateFieldReconciliation(B4_RECIPIENTS, B4_FIELDS, 'parallel')).toBeNull();
    expect(check(B4_RECIPIENTS, B4_FIELDS)).toBeNull();
    expect(reconcileFields(B4_RECIPIENTS, B4_FIELDS).satisfied).toBe(true);
  });

  it('§B7.10 — 1 of 2 signature fields placed is FIELD_COUNT_MISMATCH', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    const failure = failureOf(check(B4_RECIPIENTS, fields));
    expect(failure.code).toBe('FIELD_COUNT_MISMATCH');
    expect(failure.details?.recipient_index).toBe(0);
    expect(failure.details?.recipient_email).toBe(RINA);
    expect(failure.message).toBe(
      `${RINA} has 1 of 2 signature fields placed - 1 still to place`,
    );
  });

  it('§B7.10 — the UI can show `Signature 1/2` before it ever submits', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    const [rina] = reconcileFields(B4_RECIPIENTS, fields).rows;
    expect(rina?.placed.signature).toBe(1);
    expect(rina?.required.signature).toBe(2);
    expect(rina?.missing).toEqual({ signature: 1, meterai: 0 });
    expect(rina?.excess).toEqual({ signature: 0, meterai: 0 });
    expect(rina?.satisfied).toBe(false);
    // §A4.6's `Rina Halim — Signature 1/2 · eMeterai 1/1` comes straight off this.
    expect(rina?.placed.meterai).toBe(1);
    expect(rina?.required.meterai).toBe(1);
  });

  it('§B7.11 — 3 of 2 signature fields placed is FIELD_COUNT_MISMATCH too', () => {
    const fields = [
      ...B4_FIELDS,
      field('f5', 'signature', RINA, { x: 64, y: 20 }),
    ];
    const failure = failureOf(check(B4_RECIPIENTS, fields));
    expect(failure.code).toBe('FIELD_COUNT_MISMATCH');
    expect(failure.details?.recipient_index).toBe(0);
    expect(failure.message).toBe(`${RINA} has 3 of 2 signature fields placed - 1 too many`);
  });

  it('§B7.11 — the UI can show WHICH fields are the excess', () => {
    const fields = [...B4_FIELDS, field('f5', 'signature', RINA, { x: 64, y: 20 })];
    const [rina] = reconcileFields(B4_RECIPIENTS, fields).rows;
    expect(rina?.excess).toEqual({ signature: 1, meterai: 0 });
    // The LAST placed field is the excess one: the first `signature_count` of
    // them are the fields the count promised, the remainder arrived after.
    expect(rina?.excess_field_ids).toEqual(['f5']);
    expect(reconcileFields(B4_RECIPIENTS, fields).excess_field_ids).toEqual(['f5']);
  });

  it('counts the two kinds separately — a meterai field is not a signature field', () => {
    // Rina's 2 signatures "covered" by 1 signature + 1 extra meterai: both wrong.
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f6', 'meterai', RINA, { x: 360, y: 20 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    const [rina] = reconcileFields(B4_RECIPIENTS, fields).rows;
    expect(rina?.placed).toEqual({ signature: 1, meterai: 2 });
    expect(rina?.missing).toEqual({ signature: 1, meterai: 0 });
    expect(rina?.excess).toEqual({ signature: 0, meterai: 1 });
    // Signatures are reported first, so the row reads in §A4.6's order.
    expect(failureOf(validateFieldCounts(B4_RECIPIENTS, fields)).message).toBe(
      `${RINA} has 1 of 2 signature fields placed - 1 still to place`,
    );
  });

  it('reports the eMeterai shortfall in words that name eMeterai, never signatures', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', RINA, { x: 64, y: 340 }),
      field('f4', 'signature', BUDI, { x: 64, y: 440 }),
    ];
    const failure = failureOf(check(B4_RECIPIENTS, fields));
    expect(failure.code).toBe('FIELD_COUNT_MISMATCH');
    expect(failure.message).toBe(`${RINA} has 0 of 1 eMeterai fields placed - 1 still to place`);
    expect(failure.message).not.toContain('signature');
  });

  it('reports the FIRST offending recipient, in index order', () => {
    // Both are short. Rina is row 0.
    const failure = failureOf(check(B4_RECIPIENTS, []));
    expect(failure.details?.recipient_index).toBe(0);
    expect(failure.details?.recipient_email).toBe(RINA);
  });

  it('names an excess field so the UI can point at the box to remove', () => {
    const fields = [...B4_FIELDS, field('f5', 'signature', RINA, { x: 64, y: 20 })];
    expect(failureOf(validateFieldCounts(B4_RECIPIENTS, fields)).details?.field_id).toBe('f5');
    // A shortfall names no field: there is no box to point at yet.
    expect(failureOf(validateFieldCounts(B4_RECIPIENTS, [])).details?.field_id).toBeUndefined();
  });

  it('an empty `fields: []` with counts to materialize is a mismatch, not a pass', () => {
    expect(failureOf(check(B4_RECIPIENTS, [])).code).toBe('FIELD_COUNT_MISMATCH');
  });

  it('a non-array `fields` is read as empty and reconciled, never accepted', () => {
    // `null` is a mistake, not a default — the same stance `meterai_count: null`
    // already takes. Absence is the only documented default.
    expect(failureOf(check(B4_RECIPIENTS, null)).code).toBe('FIELD_COUNT_MISMATCH');
  });

  it('reads a mid-edit count the same lenient way pricing does', () => {
    // An invalid `signature_count` contributes 0 — it is separately refused by
    // `per-recipient`, which runs first in the pipeline anyway.
    const broken = [{ ...signer('Rina Halim', { email: RINA }), signature_count: Number.NaN }];
    const [row] = reconcileFields(broken as RecipientInput[], []).rows;
    expect(row?.required).toEqual({ signature: 0, meterai: 0 });
    expect(row?.satisfied).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §A4.13 / §B7.14 — counts lowered below the placed fields: FLAG, not drop.
// ---------------------------------------------------------------------------

describe('§A4.13 / §B7.14 — lowering a count FLAGS the excess, it never drops it', () => {
  const lowered: readonly RecipientInput[] = [
    signer('Rina Halim', { signature_count: 1, meterai_count: 1, email: RINA }),
    signer('Budi Santoso', { signature_count: 1, meterai_count: 0, email: BUDI }),
  ];

  it('flags the excess field and leaves the list exactly as the user left it', () => {
    const fields = [...B4_FIELDS];
    const report = reconcileFields(lowered, fields);

    expect(report.excess_field_ids).toEqual(['f2']);
    expect(report.rows[0]?.excess).toEqual({ signature: 1, meterai: 0 });
    expect(report.rows[0]?.excess_field_ids).toEqual(['f2']);
    // Nothing was deleted. This is the whole decision, asserted.
    expect(fields).toHaveLength(4);
    expect(fields.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
    expect(report.field_count).toBe(4);
  });

  it('makes the document invalid until the user removes it — never silently valid', () => {
    const failure = failureOf(check(lowered, B4_FIELDS));
    expect(failure.code).toBe('FIELD_COUNT_MISMATCH');
    expect(failure.message).toBe(`${RINA} has 2 of 1 signature fields placed - 1 too many`);
    expect(failure.details?.field_id).toBe('f2');
  });

  it('becomes valid the moment the flagged field is removed', () => {
    const kept = B4_FIELDS.filter((f) => f.id !== 'f2');
    expect(check(lowered, kept)).toBeNull();
    expect(reconcileFields(lowered, kept).satisfied).toBe(true);
    expect(reconcileFields(lowered, kept).excess_field_ids).toEqual([]);
  });

  it('flags the LATER fields when several are excess, keeping the earliest', () => {
    const none: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 1, meterai_count: 0, email: RINA }),
      signer('Budi Santoso', { signature_count: 1, meterai_count: 0, email: BUDI }),
    ];
    const report = reconcileFields(none, B4_FIELDS);
    expect(report.rows[0]?.excess).toEqual({ signature: 1, meterai: 1 });
    expect(report.rows[0]?.excess_field_ids).toEqual(['f2', 'f3']);
    expect(report.excess_field_ids).toEqual(['f2', 'f3']);
  });
});

// ---------------------------------------------------------------------------
// §A4.11 — a meterai field only where §A3.3 allows one.
// ---------------------------------------------------------------------------

describe('§A4.11 — a meterai field may only belong to a §A3.3 recipient', () => {
  const SEQUENTIAL: readonly RecipientInput[] = [
    signer('Rina Halim', { signature_count: 1, meterai_count: 0, email: RINA, step: 1 }),
    signer('Budi Santoso', { signature_count: 1, meterai_count: 0, email: BUDI, step: 2 }),
  ];

  it('tells the frontend who may be given one, so the palette can disable itself', () => {
    expect(canCarryMeteraiField(SEQUENTIAL[0] as RecipientInput, 'sequential')).toBe(true);
    expect(canCarryMeteraiField(SEQUENTIAL[1] as RecipientInput, 'sequential')).toBe(false);
    // §A3.4: parallel IS a single step, so the rule does not bind there.
    expect(canCarryMeteraiField(SEQUENTIAL[1] as RecipientInput, 'parallel')).toBe(true);
  });

  it('refuses a meterai field owned by a step-2 recipient', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', BUDI, { x: 64, y: 340 }),
      field('f3', 'meterai', BUDI, { x: 360, y: 224 }),
    ];
    const failure = failureOf(validateMeteraiFieldPlacement(SEQUENTIAL, fields, 'sequential'));
    expect(failure.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(failure.details?.field_id).toBe('f3');
    expect(failure.details?.recipient_index).toBe(1);
    expect(failure.details?.recipient_email).toBe(BUDI);
    expect(failure.message).toContain('step 2');
  });

  it('is vacuous in parallel (§A3.4)', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', BUDI, { x: 64, y: 340 }),
      field('f3', 'meterai', BUDI, { x: 360, y: 224 }),
    ];
    expect(validateMeteraiFieldPlacement(SEQUENTIAL, fields, 'parallel')).toBeNull();
  });

  it('allows a meterai field in step 1', () => {
    const carriers: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 1, meterai_count: 1, email: RINA, step: 1 }),
      signer('Budi Santoso', { signature_count: 1, meterai_count: 0, email: BUDI, step: 2 }),
    ];
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
      field('f2', 'signature', BUDI, { x: 64, y: 340 }),
    ];
    expect(validateMeteraiFieldPlacement(carriers, fields, 'sequential')).toBeNull();
    expect(check(carriers, fields, 'sequential')).toBeNull();
  });

  it('is shadowed in the pipeline by §A3.3, which judges the COUNT first', () => {
    // A step-2 recipient with `meterai_count: 1` never reaches the field rule:
    // `meterai-step-placement` (§B5 stage 7) has already refused the row. The
    // field-level rule exists for the one state that gets past it — a step-2
    // recipient with count 0 who somehow owns a meterai field.
    const carrierInStepTwo: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 1, meterai_count: 0, email: RINA, step: 1 }),
      signer('Budi Santoso', { signature_count: 1, meterai_count: 1, email: BUDI, step: 2 }),
    ];
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', BUDI, { x: 64, y: 340 }),
      field('f3', 'meterai', BUDI, { x: 360, y: 224 }),
    ];
    const failure = failureOf(check(carrierInStepTwo, fields, 'sequential'));
    expect(failure.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(failure.details?.field_id).toBeUndefined();
  });

  it('is enforced by the reconciliation stage, before the count mismatch it implies', () => {
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', BUDI, { x: 64, y: 340 }),
      field('f3', 'meterai', BUDI, { x: 360, y: 224 }),
    ];
    const failure = failureOf(check(SEQUENTIAL, fields, 'sequential'));
    expect(failure.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    expect(failure.details?.field_id).toBe('f3');
  });
});

// ---------------------------------------------------------------------------
// §A4.12 — pricing comes from the counts, never from the fields.
// ---------------------------------------------------------------------------

describe('§A4.12 — mismatched fields make the document invalid, they never change the bill', () => {
  it('bills the §B7.1 figures from the counts alone', () => {
    const breakdown = computeCharges(B4_RECIPIENTS, PRICES);
    expect(breakdown.totalSignatures).toBe(3);
    expect(breakdown.totalMeterai).toBe(1);
    expect(breakdown.totalChargeMinor).toBe(2500010n); // "25000.10"
    // The invariant restated as a structural fact: pricing takes recipients and
    // prices, and nothing else. A field cannot reach the bill even by mistake,
    // because there is no parameter it could arrive through.
    expect(computeCharges.length).toBe(2);
  });

  it('is invalid-but-identically-priced when a field is missing', () => {
    const fields = B4_FIELDS.filter((f) => f.id !== 'f2');
    expect(failureOf(check(B4_RECIPIENTS, fields)).code).toBe('FIELD_COUNT_MISMATCH');
    expect(computeCharges(B4_RECIPIENTS, PRICES).totalChargeMinor).toBe(2500010n);
  });

  it('is invalid-but-identically-priced when a field is excess', () => {
    const fields = [...B4_FIELDS, field('f5', 'signature', RINA, { x: 64, y: 20 })];
    expect(failureOf(check(B4_RECIPIENTS, fields)).code).toBe('FIELD_COUNT_MISMATCH');
    expect(computeCharges(B4_RECIPIENTS, PRICES).totalChargeMinor).toBe(2500010n);
  });

  it('reports `field_count` as what was SENT, not as what was required', () => {
    expect(reconcileFields(B4_RECIPIENTS, B4_FIELDS).field_count).toBe(4);
    expect(
      reconcileFields(B4_RECIPIENTS, [...B4_FIELDS, field('f5', 'signature', RINA)]).field_count,
    ).toBe(5);
    expect(reconcileFields(B4_RECIPIENTS, []).field_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The reconciliation report the frontend renders (§A4.6).
// ---------------------------------------------------------------------------

describe('§A4.6 — the per-recipient reconciliation report', () => {
  it('gives one row per recipient, in index order, with both counts on it', () => {
    const report = reconcileFields(B4_RECIPIENTS, B4_FIELDS);
    expect(report.rows).toEqual([
      {
        recipient_index: 0,
        recipient_email: RINA,
        required: { signature: 2, meterai: 1 },
        placed: { signature: 2, meterai: 1 },
        missing: { signature: 0, meterai: 0 },
        excess: { signature: 0, meterai: 0 },
        excess_field_ids: [],
        satisfied: true,
      },
      {
        recipient_index: 1,
        recipient_email: BUDI,
        required: { signature: 1, meterai: 0 },
        placed: { signature: 1, meterai: 0 },
        missing: { signature: 0, meterai: 0 },
        excess: { signature: 0, meterai: 0 },
        excess_field_ids: [],
        satisfied: true,
      },
    ]);
  });

  it('totals both sides of the invariant for the whole document', () => {
    const report = reconcileFields(B4_RECIPIENTS, B4_FIELDS);
    expect(report.required).toEqual({ signature: 3, meterai: 1 });
    expect(report.placed).toEqual({ signature: 3, meterai: 1 });
    expect(report.satisfied).toBe(true);
    expect(report.orphan_field_ids).toEqual([]);
    expect(report.excess_field_ids).toEqual([]);
  });

  it('is unsatisfied while anything is short, excess or orphaned', () => {
    expect(reconcileFields(B4_RECIPIENTS, []).satisfied).toBe(false);
    expect(
      reconcileFields(B4_RECIPIENTS, [...B4_FIELDS, field('f5', 'signature', RINA)]).satisfied,
    ).toBe(false);
    expect(
      reconcileFields(B4_RECIPIENTS, [
        ...B4_FIELDS,
        field('f5', 'signature', 'citra.dewi@example.test'),
      ]).satisfied,
    ).toBe(false);
  });

  it('survives an empty document and an empty recipient list', () => {
    expect(reconcileFields([], [])).toEqual({
      rows: [],
      orphan_field_ids: [],
      excess_field_ids: [],
      required: { signature: 0, meterai: 0 },
      placed: { signature: 0, meterai: 0 },
      field_count: 0,
      satisfied: true,
    });
    expect(reconcileFields(undefined as unknown as RecipientInput[], undefined).rows).toEqual([]);
  });

  it('skips a blank-emailed recipient when deciding who owns what', () => {
    // A mid-edit row has no identity yet, so it cannot own a field — and a
    // field with no owner must not be adopted by it.
    const midEdit = [{ ...signer('', { email: '' }), signature_count: 1 }];
    const report = reconcileFields(midEdit, [field('f1', 'signature', '')]);
    expect(report.rows[0]?.placed).toEqual({ signature: 0, meterai: 0 });
    expect(report.orphan_field_ids).toEqual(['f1']);
  });

  it('counts no kind for a field whose kind is not one of the two', () => {
    const alien = { ...field('fx', 'signature', RINA), kind: 'initials' } as unknown as FieldInput;
    const report = reconcileFields(B4_RECIPIENTS, [...B4_FIELDS, alien]);
    expect(report.rows[0]?.placed).toEqual({ signature: 2, meterai: 1 });
    expect(report.field_count).toBe(5);
    // It is the `field-shape` stage's job to refuse it, and it does.
    expect(failureOf(check(B4_RECIPIENTS, [...B4_FIELDS, alien])).code).toBe(
      'FIELD_OUT_OF_BOUNDS',
    );
  });
});

// ---------------------------------------------------------------------------
// §B5 — the two new stages, and where they sit.
// ---------------------------------------------------------------------------

describe('§B5 — the field stages and the validation order', () => {
  it('registers all ELEVEN stages in exactly the brief’s order', () => {
    expect(chargePreviewStages(QUOTA, 'parallel', B4_FIELDS).map((stage) => stage.name)).toEqual([
      'order-mode',
      'count',
      'per-recipient',
      'duplicates',
      'step-structure',
      'meterai-vs-signature',
      'meterai-step-placement',
      'field-shape',
      'field-reconciliation',
      'signature-quota',
      'meterai-quota',
    ]);
  });

  it('registers the same eleven whether or not fields were sent', () => {
    // The pipeline's SHAPE never varies — only its verdicts do. A Case-1 payload
    // runs the field stages and they are vacuous.
    expect(chargePreviewStages(QUOTA).map((s) => s.name)).toEqual(
      chargePreviewStages(QUOTA, 'sequential', B4_FIELDS).map((s) => s.name),
    );
  });

  it('exposes the two field stages on their own, shape before reconciliation', () => {
    expect(fieldStages(B4_FIELDS, 'parallel').map((stage) => stage.name)).toEqual([
      'field-shape',
      'field-reconciliation',
    ]);
    expect(fieldShapeStage(B4_FIELDS).name).toBe('field-shape');
    expect(fieldReconciliationStage(B4_FIELDS, 'parallel').name).toBe('field-reconciliation');
  });

  it('runs field shape & bounds BEFORE field-vs-count reconciliation (§B5)', () => {
    // f2 is out of bounds AND Rina would be one signature short without it.
    const fields = [
      field('f1', 'signature', RINA, { x: 64, y: 224 }),
      field('f2', 'signature', RINA, { x: 500, y: 340 }),
      field('f3', 'meterai', RINA, { x: 360, y: 224 }),
    ];
    expect(failureOf(check(B4_RECIPIENTS, fields)).code).toBe('FIELD_OUT_OF_BOUNDS');
  });

  it('runs the field stages AFTER meterai step placement (§B5)', () => {
    // Citra carries a stamp in step 2 (§B7.6) and no field is placed at all.
    const recipients: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 1, meterai_count: 0, email: RINA, step: 1 }),
      signer('Citra Dewi', { signature_count: 1, meterai_count: 1, step: 2 }),
    ];
    expect(failureOf(check(recipients, [], 'sequential')).code).toBe('METERAI_NOT_IN_FIRST_STEP');
  });

  it('runs the field stages BEFORE either quota (§B5, delta §5.2)', () => {
    // 9 signatures of 8 AND no fields placed. Reconciliation must win.
    const overQuota: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 3, email: RINA }),
      signer('Budi Santoso', { signature_count: 3, email: BUDI }),
      signer('Citra Dewi', { signature_count: 3 }),
    ];
    expect(failureOf(check(overQuota, [])).code).toBe('FIELD_COUNT_MISMATCH');
    // Without fields, the quota failure is still the one Case 1 reported.
    expect(failureOf(check(overQuota)).code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
  });

  it('runs every recipient rule before any field rule (§B5)', () => {
    // A duplicate email AND an orphan field: the recipient rule is earlier.
    const dup: readonly RecipientInput[] = [
      signer('Rina Halim', { signature_count: 1, email: RINA }),
      signer('Rina Again', { signature_count: 1, email: RINA }),
    ];
    expect(failureOf(check(dup, [field('f9', 'signature', 'nobody@example.test')])).code).toBe(
      'DUPLICATE_RECIPIENT_EMAIL',
    );
  });

  it('is VACUOUS when `fields` is absent — a P1/P2 payload still validates', () => {
    // §B4 makes `fields` part of the extended request; a body without it is the
    // Step-2 preview, where no box has been placed yet and §A4.9 has nothing to
    // compare. Absence is the documented default; `[]` is a real empty Step 3.
    expect(check(B4_RECIPIENTS)).toBeNull();
    expect(check(B4_RECIPIENTS, undefined)).toBeNull();
    expect(fieldShapeStage(undefined).run(B4_RECIPIENTS)).toBeNull();
    expect(fieldReconciliationStage(undefined, 'parallel').run(B4_RECIPIENTS)).toBeNull();
    // And with fields present the very same list is judged.
    expect(failureOf(check(B4_RECIPIENTS, [])).code).toBe('FIELD_COUNT_MISMATCH');
  });

  it('a field stage is usable on its own', () => {
    const fields = [field('f1', 'signature', RINA, { x: 500, y: 0 })];
    expect(fieldShapeStage(fields).run(B4_RECIPIENTS)?.code).toBe('FIELD_OUT_OF_BOUNDS');
    // The shape stage ignores the recipients; the reconciliation stage needs them.
    expect(fieldReconciliationStage(fields, 'parallel').run([])?.code).toBe(
      'FIELD_UNKNOWN_RECIPIENT',
    );
  });
});

describe('the five P3 codes are in the shared vocabulary', () => {
  it('exports every code §B5 adds for P3', () => {
    expect(ERROR_CODES).toContain('FIELD_UNKNOWN_RECIPIENT');
    expect(ERROR_CODES).toContain('FIELD_COUNT_MISMATCH');
    expect(ERROR_CODES).toContain('FIELD_OUT_OF_BOUNDS');
    expect(ERROR_CODES).toContain('FIELD_PAGE_INVALID');
    expect(ERROR_CODES).toContain('FIELD_ID_DUPLICATE');
  });

  it('does not export a P4 code — no rule stands behind one yet', () => {
    expect(ERROR_CODES).not.toContain('PREVIEW_STALE');
    expect(ERROR_CODES).not.toContain('ENVELOPE_LOCKED');
  });
});
