/**
 * Step 3's state and contract, asserted without rendering anything (LD-32).
 *
 * `test_2_en.md` §A4 (place fields), §B2 (geometry), §B3 (the field model) and
 * §B4 (the extended payload). Four properties are scored and therefore tested
 * here rather than reviewed by eye:
 *
 * 1. **The UI clamps, at the exact §B2 bounds, per kind.** `signature`
 *    (`212 x 88`) is `x in 0..420` / `y in 0..500`; `meterai` (`112 x 112`) is
 *    `x in 0..520` / `y in 0..476`. The two ranges CROSS, so one shared bound
 *    would necessarily get one of them wrong, and both edges are asserted.
 * 2. **§A4.13 / §B7.13 — FLAG, DO NOT AUTO-DROP.** Lowering a count below the
 *    number of placed boxes, and deleting a recipient who owns boxes, both
 *    leave the field list byte for byte identical and are reported by the
 *    kernel instead.
 * 3. **§B4's `fields` key is absent on Step 2 and present on Step 3.** Absent
 *    is "no collection submitted" and makes the reconciliation invariant
 *    vacuous; `[]` is a real Step 3 with nothing placed, which the server
 *    refuses. Sending `[]` from Step 2 would break every Case-1/P1/P2 preview.
 * 4. **§A4.12 — pricing comes from the counts.** Nothing in this feature
 *    imports or produces a price, which is asserted structurally.
 */

import { describe, expect, it } from 'vitest';

import {
  fieldBoundsFor,
  reconcileFields,
  type FieldInput,
  type RecipientInput,
} from '@signed-doc/shared';

import { buildChargePreviewBody, toWireFields } from '../api/charge-preview.js';
import {
  FIELD_NUDGE,
  cascadePositionFor,
  createFieldsState,
  fieldsReducer,
  selectedOwnerOf,
  type FieldsAction,
  type FieldsState,
} from '../features/fields/fields-reducer.js';
import {
  FIELD_KIND_LABEL,
  fieldSizeHint,
  initialsOf,
  ownerDisplayName,
  removeFieldLabel,
} from '../features/fields/field-view.js';
import {
  excessNote,
  progressLine,
  shortfallNote,
} from '../features/fields/ReconciliationPanel.js';

const RINA = 'rina.halim@example.test';
const BUDI = 'budi.santoso@example.test';

function recipient(
  name: string,
  email: string,
  signature_count: number,
  meterai_count = 0,
  step?: number,
): RecipientInput {
  return step === undefined
    ? { name, email, signature_count, meterai_count }
    : { name, email, signature_count, meterai_count, step };
}

const LIST: readonly RecipientInput[] = [
  recipient('Rina Halim', RINA, 2, 1),
  recipient('Budi Santoso', BUDI, 1, 0),
];

/** Run a list of actions from the empty state, left to right. */
function run(...actions: readonly FieldsAction[]): FieldsState {
  return actions.reduce(fieldsReducer, createFieldsState());
}

const place = (kind: 'signature' | 'meterai', owner: string, position?: { x: number; y: number }) =>
  ({ type: 'PLACE_FIELD', kind, owner, ...(position ? { position } : {}) }) as FieldsAction;

describe('§B2 geometry — the UI clamps, per kind, at the exact bounds', () => {
  it('derives the brief\'s own bounds from the kernel rather than restating them', () => {
    // §B2 prints these four numbers; the kernel computes them from the content
    // area and each kind's size. Both are asserted so a wrong dimension cannot
    // hide behind a right bound.
    expect(fieldBoundsFor('signature')).toEqual({ maxX: 420, maxY: 500 });
    expect(fieldBoundsFor('meterai')).toEqual({ maxX: 520, maxY: 476 });
  });

  it('§B7 row 15 — a signature placed at x = 500 is clamped to 420', () => {
    const state = run(place('signature', RINA, { x: 500, y: 100 }));
    expect(state.fields[0]?.x).toBe(420);
  });

  it('§B7 row 16 — a meterai placed at y = 600 is clamped to 476', () => {
    const state = run(place('meterai', RINA, { x: 100, y: 600 }));
    expect(state.fields[0]?.y).toBe(476);
  });

  it('clamps BOTH axes at the exact edge, and the two kinds differ', () => {
    const signature = run(place('signature', RINA, { x: 9999, y: 9999 })).fields[0];
    expect([signature?.x, signature?.y]).toEqual([420, 500]);

    const meterai = run(place('meterai', RINA, { x: 9999, y: 9999 })).fields[0];
    expect([meterai?.x, meterai?.y]).toEqual([520, 476]);

    // The ranges cross: 500 is out of range for a signature's x and inside a
    // meterai's; 500 is inside a signature's y and out of range for a meterai's.
    expect(run(place('signature', RINA, { x: 500, y: 500 })).fields[0]).toMatchObject({
      x: 420,
      y: 500,
    });
    expect(run(place('meterai', RINA, { x: 500, y: 500 })).fields[0]).toMatchObject({
      x: 500,
      y: 476,
    });
  });

  it('clamps the lower edge to 0 and rounds a fractional coordinate', () => {
    expect(run(place('signature', RINA, { x: -40, y: -1 })).fields[0]).toMatchObject({ x: 0, y: 0 });
    expect(run(place('signature', RINA, { x: 63.6, y: 223.4 })).fields[0]).toMatchObject({
      x: 64,
      y: 223,
    });
  });

  it('§A4.5 — a move is clamped by the MOVED box\'s own kind', () => {
    const placed = run(place('meterai', RINA, { x: 100, y: 100 }));
    const id = placed.fields[0]!.id;

    const nudgedPastTheEdge = fieldsReducer(placed, {
      type: 'MOVE_FIELD',
      id,
      position: { x: 10_000, y: 10_000 },
    });
    expect(nudgedPastTheEdge.fields[0]).toMatchObject({ x: 520, y: 476 });

    // And the clamp is the meterai one, not the signature one: x = 500 stands.
    const inRangeForMeterai = fieldsReducer(placed, {
      type: 'MOVE_FIELD',
      id,
      position: { x: 500, y: 300 },
    });
    expect(inRangeForMeterai.fields[0]).toMatchObject({ x: 500, y: 300 });
  });

  it('an arrow-key nudge moves by one step and stops dead at the bound', () => {
    const placed = run(place('signature', RINA, { x: 0, y: 0 }));
    const id = placed.fields[0]!.id;

    const right = fieldsReducer(placed, {
      type: 'MOVE_FIELD',
      id,
      position: { x: 0 + FIELD_NUDGE, y: 0 },
    });
    expect(right.fields[0]?.x).toBe(FIELD_NUDGE);

    // Already at 0 and nudged left: the state object itself is returned, so a
    // no-op move cannot even cause a re-render.
    const left = fieldsReducer(placed, {
      type: 'MOVE_FIELD',
      id,
      position: { x: 0 - FIELD_NUDGE, y: 0 },
    });
    expect(left).toBe(placed);
  });

  it('click-to-place cascades from the derived centre of the content area', () => {
    // (632 - 212) / 2 = 210 and (588 - 88) / 2 = 250, computed by the kernel.
    expect(cascadePositionFor('signature', 0)).toEqual({ x: 210, y: 250 });
    // (632 - 112) / 2 = 260 and (588 - 112) / 2 = 238.
    expect(cascadePositionFor('meterai', 0)).toEqual({ x: 260, y: 238 });
    // Each successive box steps down-right so they do not stack exactly.
    expect(cascadePositionFor('signature', 1)).toEqual({ x: 234, y: 274 });
    // And a cascade that would leave the page is clamped, not wrapped.
    expect(cascadePositionFor('signature', 100)).toEqual({ x: 420, y: 500 });
  });
});

describe('§B3 — the field model the reducer produces', () => {
  it('stamps page 1, a unique id and the normalized owner', () => {
    const state = run(place('signature', ' RINA.Halim@Example.Test '), place('meterai', RINA));

    expect(state.fields.map((f) => f.id)).toEqual(['f0', 'f1']);
    expect(new Set(state.fields.map((f) => f.id)).size).toBe(2);
    for (const field of state.fields) {
      expect(field.page).toBe(1);
      // §B3 compares the owner after trimming, case-insensitively, so that is
      // the form stored — the same form `fieldOwnerOf` and `reconcileFields`
      // compare against.
      expect(field.recipient_email).toBe(RINA);
      expect(Number.isInteger(field.x) && Number.isInteger(field.y)).toBe(true);
    }
  });

  it('refuses to place a box for a recipient with no email (§A4.10)', () => {
    const empty = createFieldsState();
    expect(fieldsReducer(empty, place('signature', '   '))).toBe(empty);
    expect(fieldsReducer(empty, place('signature', ''))).toBe(empty);
  });

  it('resolves the selected signer against the CURRENT list', () => {
    const chosen = fieldsReducer(createFieldsState(), { type: 'SELECT_SIGNER', email: BUDI });
    expect(selectedOwnerOf(chosen, LIST)).toBe(BUDI);

    // Budi is gone: the selection falls back to the first owner who exists,
    // rather than placing boxes for somebody off the list.
    expect(selectedOwnerOf(chosen, [LIST[0]!])).toBe(RINA);
    // Nobody has an email at all: there is no owner, and the palette says so.
    expect(selectedOwnerOf(chosen, [recipient('', '', 1)])).toBe('');
  });

  it('removes exactly one box, by id, and nothing else', () => {
    const state = run(place('signature', RINA), place('signature', RINA), place('signature', BUDI));
    const next = fieldsReducer(state, { type: 'REMOVE_FIELD', id: 'f1' });

    expect(next.fields.map((f) => f.id)).toEqual(['f0', 'f2']);
    // Ids are never reused, so a removal cannot resurrect a stale reference.
    expect(fieldsReducer(next, place('signature', RINA)).fields.at(-1)?.id).toBe('f3');
    // An unknown id is a no-op that does not even allocate a new state object.
    expect(fieldsReducer(next, { type: 'REMOVE_FIELD', id: 'nope' })).toBe(next);
  });
});

describe('§A4.13 / §B7 rows 13 and 14 — flag, do not auto-drop', () => {
  it('row 14 — a count lowered below the placed boxes flags the EXCESS and deletes nothing', () => {
    const state = run(place('signature', RINA), place('signature', RINA));

    // Rina asked for 2 and has 2: satisfied.
    expect(reconcileFields(LIST, state.fields).rows[0]).toMatchObject({
      required: { signature: 2, meterai: 1 },
      placed: { signature: 2, meterai: 0 },
      excess: { signature: 0, meterai: 0 },
    });

    // Her count drops to 1. The boxes are untouched...
    const lowered = [recipient('Rina Halim', RINA, 1, 0), LIST[1]!];
    expect(state.fields).toHaveLength(2);

    // ...and the LATER one is the flagged excess, by id.
    const report = reconcileFields(lowered, state.fields);
    expect(report.rows[0]).toMatchObject({
      required: { signature: 1 },
      placed: { signature: 2 },
      excess: { signature: 1 },
      excess_field_ids: ['f1'],
    });
    expect(report.excess_field_ids).toEqual(['f1']);
    expect(report.satisfied).toBe(false);
  });

  it('row 13 — a recipient deleted while owning boxes ORPHANS them, by id', () => {
    const state = run(place('signature', RINA), place('signature', BUDI), place('meterai', RINA));

    const withoutBudi = [recipient('Rina Halim', RINA, 1, 1)];
    const report = reconcileFields(withoutBudi, state.fields);

    expect(state.fields).toHaveLength(3); // nothing was cascade-deleted
    expect(report.orphan_field_ids).toEqual(['f1']);
    expect(report.satisfied).toBe(false);
    // Rina's own line is unaffected by somebody else's orphan.
    expect(report.rows[0]).toMatchObject({ satisfied: true });
  });

  it('the reducer has no action that could drop a box on the app\'s initiative', () => {
    const state = run(place('signature', RINA), place('meterai', RINA));

    /*
      Structural, not incidental: the field reducer is not told about recipients
      at all, so no recipient change can reach it. Every action it DOES accept
      is applied below and only the explicit removal shrinks the list — which is
      what makes "flag, don't auto-drop" a property of the state's shape rather
      than a rule somebody has to remember.
    */
    const everyOtherAction: readonly FieldsAction[] = [
      { type: 'SELECT_SIGNER', email: BUDI },
      place('signature', BUDI),
      { type: 'MOVE_FIELD', id: 'f0', position: { x: 10, y: 10 } },
      { type: 'REMOVE_FIELD', id: 'absent' },
    ];
    for (const action of everyOtherAction) {
      expect(fieldsReducer(state, action).fields.length).toBeGreaterThanOrEqual(
        state.fields.length,
      );
    }

    expect(fieldsReducer(state, { type: 'REMOVE_FIELD', id: 'f0' }).fields).toHaveLength(1);
  });

  it('never mutates the list it was given', () => {
    const state = run(place('signature', RINA));
    const before = state.fields;
    fieldsReducer(state, place('signature', BUDI));
    fieldsReducer(state, { type: 'REMOVE_FIELD', id: 'f0' });
    fieldsReducer(state, { type: 'MOVE_FIELD', id: 'f0', position: { x: 1, y: 1 } });
    expect(state.fields).toBe(before);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ x: 210, y: 250 });
  });

  it('groups boxes by owner the way the kernel compares an address', () => {
    const state = run(place('signature', RINA), place('signature', BUDI), place('meterai', RINA));
    const report = reconcileFields(
      [recipient('Rina Halim', ' Rina.Halim@EXAMPLE.test ', 1, 1), recipient('Budi', BUDI, 1)],
      state.fields,
    );
    // A differently-cased, untrimmed recipient address still owns her boxes.
    expect(report.orphan_field_ids).toEqual([]);
    expect(report.rows[0]).toMatchObject({ placed: { signature: 1, meterai: 1 } });
    expect(report.rows[1]).toMatchObject({ placed: { signature: 1, meterai: 0 } });
  });
});

describe('§B4 — the extended charge-preview body', () => {
  const rows = [
    { name: 'Rina Halim', email: RINA, signature_count: 2, meterai_count: 1 },
    { name: 'Budi Santoso', email: BUDI, signature_count: 1, meterai_count: 0 },
  ];
  const fields: readonly FieldInput[] = [
    { id: 'f1', kind: 'signature', recipient_email: RINA, page: 1, x: 64, y: 224 },
    { id: 'f2', kind: 'meterai', recipient_email: RINA, page: 1, x: 360, y: 224 },
  ];

  it('OMITS the fields key entirely when no collection is given (the Step-2 preview)', () => {
    // The distinction is the whole of §B4's optionality: absent is vacuous,
    // `[]` is a real Step 3 with nothing placed. A Step-2 body that sent `[]`
    // would fail FIELD_COUNT_MISMATCH for any recipient who asked for one.
    const body = buildChargePreviewBody(rows, 'parallel');
    expect(Object.keys(body)).toEqual(['order_mode', 'recipients']);
    expect('fields' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain('fields');
  });

  it('sends the key when a collection IS given, including an empty one', () => {
    expect(Object.keys(buildChargePreviewBody(rows, 'parallel', fields))).toEqual([
      'order_mode',
      'recipients',
      'fields',
    ]);
    // `[]` is deliberate and is preserved rather than collapsed into absence.
    const emptyCollection = buildChargePreviewBody(rows, 'parallel', []);
    expect('fields' in emptyCollection).toBe(true);
    expect(emptyCollection.fields).toEqual([]);
  });

  it('carries exactly the six §B3 keys per field, and no local-only one', () => {
    const local = fields.map((f) => ({ ...f, selected: true, domId: 'field-box-f1' }));
    const body = buildChargePreviewBody(rows, 'parallel', local as FieldInput[]);

    for (const field of body.fields ?? []) {
      expect(Object.keys(field).sort()).toEqual([
        'id',
        'kind',
        'page',
        'recipient_email',
        'x',
        'y',
      ]);
    }
    expect(JSON.stringify(body)).not.toContain('domId');
  });

  it('sends the coordinates UNREPAIRED, so §B7 rows 15-18 stay reachable', () => {
    // The UI clamps where a box is placed or moved. The body builder must not
    // clamp as well, or a hostile or hand-built payload could never produce the
    // `422 FIELD_OUT_OF_BOUNDS` / `FIELD_PAGE_INVALID` the contract promises.
    const hostile: FieldInput[] = [
      { id: 'f1', kind: 'signature', recipient_email: RINA, page: 2, x: 500, y: 600 },
      { id: 'f1', kind: 'meterai', recipient_email: 'nobody@example.test', page: 1, x: -5, y: 0 },
    ];
    expect(toWireFields(hostile)).toEqual(hostile);
    expect(buildChargePreviewBody(rows, 'parallel', hostile).fields).toEqual(hostile);
  });

  it('still proposes no commercial value, with fields on the body', () => {
    const serialized = JSON.stringify(buildChargePreviewBody(rows, 'sequential', fields));
    for (const forbidden of ['price', 'quota', 'total_charge', 'charges', 'field_count']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe('§A4.3/§A4.4/§A4.6 — what the screen says, as strings', () => {
  it('§A4.4 — the remove label names the kind AND the owner', () => {
    expect(removeFieldLabel('signature', 'Rina Halim')).toBe(
      'Remove Signature field for Rina Halim',
    );
    expect(removeFieldLabel('meterai', 'Budi Santoso')).toBe(
      'Remove eMeterai field for Budi Santoso',
    );
  });

  it('§A4.3 — initials are an ADDITION to the name, and are always renderable', () => {
    expect(initialsOf('Rina Halim', RINA)).toBe('RH');
    expect(initialsOf('Citra', 'citra@example.test')).toBe('C');
    expect(initialsOf('  ada  byron  lovelace ', 'a@b.test')).toBe('AB');
    // No name at all: fall back to the address rather than rendering nothing.
    expect(initialsOf('', RINA)).toBe('R');
    expect(initialsOf('', '')).toBe('?');
  });

  it('names the owner as a person, and an orphan by the address it holds', () => {
    expect(ownerDisplayName(RINA, LIST)).toBe('Rina Halim');
    // On the list but unnamed: the address is the only identity there is.
    expect(ownerDisplayName(RINA, [recipient('', RINA, 1)])).toBe(RINA);
    // Off the list entirely — the §B7.13 orphan case.
    expect(ownerDisplayName('ghost@example.test', LIST)).toBe('ghost@example.test');
  });

  it('§A4.6 — the progress line is the brief\'s own example, shortfall included', () => {
    const state = run(place('signature', RINA));
    const report = reconcileFields(LIST, state.fields);
    expect(progressLine('Rina Halim', report.rows[0]!)).toBe(
      'Rina Halim — Signature 1/2 · eMeterai 0/1',
    );
  });

  it('§A4.6 — both directions are worded, and they are not interchangeable', () => {
    expect(shortfallNote('signature', 1)).toBe('1 Signature field still to place');
    expect(shortfallNote('meterai', 2)).toBe('2 eMeterai fields still to place');
    expect(shortfallNote('signature', 0)).toBeNull();

    expect(excessNote('signature', 1)).toContain('1 Signature field too many');
    expect(excessNote('meterai', 2)).toContain('2 eMeterai fields too many');
    expect(excessNote('meterai', 0)).toBeNull();
  });

  it('names both kinds the way the brief, the mockup and the kernel name them', () => {
    expect(FIELD_KIND_LABEL).toEqual({ signature: 'Signature', meterai: 'eMeterai' });
    // §B2's box sizes, read from the kernel rather than restated in the UI.
    expect(fieldSizeHint('signature')).toBe('212 × 88');
    expect(fieldSizeHint('meterai')).toBe('112 × 112');
  });
});

describe('§A4.12 — pricing comes from the counts, never from the fields', () => {
  it('is structural: nothing in this feature can produce a charge', () => {
    // `reconcileFields` is the only thing the screen asks about fields, and it
    // reports no money of any kind. `pricing.ts` has no field parameter and is
    // not reachable from `fields-reducer.ts` at all — a mismatched box makes
    // the document invalid, it does not change the bill.
    const state = run(place('signature', RINA), place('signature', RINA), place('signature', RINA));
    const report = reconcileFields(LIST, state.fields);

    expect(report.field_count).toBe(3);
    expect(report.required).toEqual({ signature: 3, meterai: 1 });
    expect(JSON.stringify(report)).not.toMatch(/charge|price|total_charge|minor/i);
  });
});
