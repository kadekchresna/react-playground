/**
 * Signing order: the mode, the steps and the reordering (`test_2_en.md` §A2,
 * §A3.3, §B4, §B7 rows 5–9; priority P2).
 *
 * Nothing is rendered and no React module is imported (LD-32). What the screen
 * does with all of this — the grouped view, the `aria-label`s and where focus
 * lands after a move — is asserted in `app-smoke.test.tsx`; what it MEANS is
 * asserted here, where it is computed.
 *
 * The headline obligations:
 *
 * 1. Every reducer action leaves a list the server would accept. `[1,3]` and
 *    `[2,3]` are never on screen waiting to be rejected — `validateStepSequence`
 *    is run after every single action below.
 * 2. §B7 row 8 exactly: `[1,2,2,3]`, delete the sole member of step 1, get
 *    `[1,1,2]`, with every other recipient's data untouched.
 * 3. §A2.8: no reorder loses anything. Every test that moves a row compares the
 *    FULL row contents before and after, not just the names.
 * 4. §B4's asymmetry: `step` on the wire in `sequential`, absent in `parallel`.
 *    Sending it in parallel is `422 UNKNOWN_FIELD`, so it is tested as a
 *    property of the projection rather than left to review.
 *
 * Not one step rule is re-implemented here or in the code under test:
 * contiguity, renormalization, grouping and step placement are all asserted
 * through `@signed-doc/shared`.
 */

import { describe, expect, it } from 'vitest';

import {
  FIRST_STEP,
  groupByStep,
  stepOf,
  validateMeteraiStepPlacement,
  validateStepSequence,
  type OrderMode,
} from '@signed-doc/shared';

import { previewKey, PreviewController, type PreviewTransport } from '../features/recipients/preview-controller.js';
import {
  canMergeStep,
  canMoveStep,
  recipientsReducer,
  toRecipientInputs,
  type RecipientsAction,
  type RecipientsState,
} from '../features/recipients/recipients-reducer.js';
import { createSeedState } from '../features/recipients/seed.js';
import { stepGroupLabel, stepViews } from '../features/recipients/step-groups.js';

const ENVELOPE = 'env_01';

function run(actions: readonly RecipientsAction[], from = createSeedState()): RecipientsState {
  return actions.reduce(recipientsReducer, from);
}

const stepsOf = (state: RecipientsState): number[] => state.rows.map((row) => stepOf(row));

/** The step numbers must be something the server would accept, always. */
function expectAcceptable(state: RecipientsState): void {
  expect(validateStepSequence(toRecipientInputs(state), state.orderMode)).toBeNull();
}

/**
 * Four recipients on steps `[1,2,2,3]` — §B7 row 8's list — every one of them
 * carrying data a reorder could lose: a name, an address, a signature count, a
 * duty-stamp count and an in-progress number box.
 */
function fourOnSteps1223(): RecipientsState {
  const built = run([
    { type: 'ADD_ROW' },
    { type: 'ADD_ROW' },
    { type: 'SET_ORDER_MODE', mode: 'sequential' },
    // [1,2,3,4] -> row 2 joins row 1's step -> [1,2,2,3]
    { type: 'MERGE_STEP', index: 2, direction: 'earlier' },
    { type: 'SET_NAME', index: 2, value: 'Citra Dewi' },
    { type: 'SET_EMAIL', index: 2, value: 'citra.dewi@example.test' },
    { type: 'SET_COUNT_RAW', index: 2, raw: '4' },
    { type: 'SET_NAME', index: 3, value: 'Dimas Prakoso' },
    { type: 'SET_EMAIL', index: 3, value: 'dimas.prakoso@example.test' },
    { type: 'INC_METERAI', index: 3 },
    // Left mid-edit on purpose: a reorder must not settle somebody's box.
    { type: 'SET_COUNT_RAW', index: 1, raw: '1' },
  ]);

  expect(stepsOf(built)).toEqual([1, 2, 2, 3]);
  expectAcceptable(built);
  return built;
}

describe('SET_ORDER_MODE (§A2)', () => {
  it('defaults to parallel, and parallel rows carry no step at all (§B4)', () => {
    const seed = createSeedState();
    expect(seed.orderMode).toBe('parallel');
    for (const row of seed.rows) expect(row.step).toBeUndefined();
    for (const recipient of toRecipientInputs(seed)) {
      expect('step' in recipient).toBe(false);
    }
  });

  it('switching to sequential gives every recipient a contiguous step', () => {
    const state = run([{ type: 'SET_ORDER_MODE', mode: 'sequential' }]);

    expect(state.orderMode).toBe('sequential');
    expect(stepsOf(state)).toEqual([1, 2]);
    expectAcceptable(state);
  });

  it('switching to sequential keeps every typed character (§A2.8)', () => {
    const typed = run([
      { type: 'SET_NAME', index: 0, value: '  Rina  ' },
      { type: 'SET_COUNT_RAW', index: 1, raw: '25' },
      { type: 'INC_METERAI', index: 0 },
    ]);
    const switched = recipientsReducer(typed, { type: 'SET_ORDER_MODE', mode: 'sequential' });

    typed.rows.forEach((before, index) => {
      expect(switched.rows[index]).toEqual({ ...before, step: index + FIRST_STEP });
    });
  });

  it('switching back to parallel DELETES step rather than parking it (§B7 row 9)', () => {
    const state = run([
      { type: 'SET_ORDER_MODE', mode: 'sequential' },
      { type: 'MERGE_STEP', index: 1, direction: 'earlier' },
      { type: 'SET_ORDER_MODE', mode: 'parallel' },
    ]);

    expect(state.orderMode).toBe('parallel');
    for (const row of state.rows) expect('step' in row).toBe(false);
    // Which is what makes the parallel payload structurally unable to carry one.
    expect(JSON.stringify(toRecipientInputs(state))).not.toContain('step');
  });

  it('switching back to parallel keeps every other field (§A2.8)', () => {
    const sequential = fourOnSteps1223();
    const parallel = recipientsReducer(sequential, { type: 'SET_ORDER_MODE', mode: 'parallel' });

    sequential.rows.forEach((before, index) => {
      const { step: _dropped, ...rest } = before;
      expect(parallel.rows[index]).toEqual(rest);
    });
  });

  it('re-selecting the mode already in force changes nothing at all', () => {
    const before = createSeedState();
    expect(recipientsReducer(before, { type: 'SET_ORDER_MODE', mode: 'parallel' })).toBe(before);
  });
});

describe('ADD_ROW in sequential (§A2.1)', () => {
  it('gives the new signer a valid step at the end of the chain', () => {
    const state = run([{ type: 'SET_ORDER_MODE', mode: 'sequential' }, { type: 'ADD_ROW' }]);

    expect(stepsOf(state)).toEqual([1, 2, 3]);
    expect(state.rows[2]?.name).toBe('');
    expectAcceptable(state);
  });

  it('never produces a gap, even when the list was all in one step', () => {
    const state = run([
      { type: 'SET_ORDER_MODE', mode: 'sequential' },
      { type: 'MERGE_STEP', index: 1, direction: 'earlier' }, // both on step 1
      { type: 'ADD_ROW' },
    ]);

    expect(stepsOf(state)).toEqual([1, 1, 2]);
    expectAcceptable(state);
  });

  it('adds no step in parallel — the Case-1 row shape is untouched', () => {
    const state = run([{ type: 'ADD_ROW' }]);
    expect(Object.keys(state.rows[2] ?? {}).sort()).toEqual([
      'countRaw',
      'email',
      'id',
      'meteraiRaw',
      'meterai_count',
      'name',
      'signature_count',
    ]);
  });
});

describe('REMOVE_ROW renormalizes (§A2.4, §B7 row 8)', () => {
  it('[1,2,2,3] minus the sole member of step 1 becomes [1,1,2]', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'REMOVE_ROW', index: 0 });

    expect(stepsOf(after)).toEqual([1, 1, 2]);
    expectAcceptable(after);
  });

  it('...with every surviving recipient\'s data intact, step aside', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'REMOVE_ROW', index: 0 });

    const survivors = before.rows.slice(1);
    after.rows.forEach((row, index) => {
      expect(row).toEqual({ ...survivors[index], step: [1, 1, 2][index] });
    });
    // Named explicitly, because "intact" is the half of §B7 row 8 a
    // renumbering implementation is most likely to break.
    expect(after.rows.map((row) => row.name)).toEqual(['Budi Santoso', 'Citra Dewi', 'Dimas Prakoso']);
    expect(after.rows.map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
    expect(after.rows[1]?.signature_count).toBe(4);
    expect(after.rows[2]?.meterai_count).toBe(1);
    expect(after.rows[0]?.countRaw).toBe('1');
  });

  it('emptying a MIDDLE step renormalizes too', () => {
    const before = fourOnSteps1223();
    // Steps [1,2,2,3]: take out both members of step 2.
    const after = run(
      [
        { type: 'REMOVE_ROW', index: 1 },
        { type: 'REMOVE_ROW', index: 1 },
      ],
      before,
    );

    expect(stepsOf(after)).toEqual([1, 2]);
    expect(after.rows.map((row) => row.name)).toEqual(['Rina Halim', 'Dimas Prakoso']);
    expectAcceptable(after);
  });

  it('stamps no step on a parallel row — the kernel guard is load-bearing', () => {
    const after = run([{ type: 'ADD_ROW' }, { type: 'REMOVE_ROW', index: 0 }]);
    for (const row of after.rows) expect('step' in row).toBe(false);
    expect(JSON.stringify(toRecipientInputs(after))).not.toContain('step');
  });
});

describe('MOVE_STEP — the up/down path (§A2.6)', () => {
  it('splits a recipient OUT of a shared step when moved earlier', () => {
    const before = fourOnSteps1223(); // [1,2,2,3]
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 1, direction: 'earlier' });

    // Row 1 leaves the pair on step 2 and takes a step of its own before it.
    expect(stepsOf(after)).toEqual([1, 2, 3, 4]);
    expectAcceptable(after);
  });

  it('splits a recipient OUT of a shared step when moved later', () => {
    const before = fourOnSteps1223(); // [1,2,2,3]
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 1, direction: 'later' });

    // Row 1 lands after the rest of step 2 but still before the old step 3.
    expect(stepsOf(after)).toEqual([1, 3, 2, 4]);
    expectAcceptable(after);
  });

  it('swaps with the neighbouring step when it is already alone', () => {
    const before = fourOnSteps1223(); // [1,2,2,3]
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 3, direction: 'earlier' });

    // The solo step 3 moves in front of the pair, which slides to step 3.
    expect(stepsOf(after)).toEqual([1, 3, 3, 2]);
    expectAcceptable(after);
  });

  it('is a no-op at either end of the chain, and says so to the UI', () => {
    const state = fourOnSteps1223(); // [1,2,2,3]

    expect(recipientsReducer(state, { type: 'MOVE_STEP', index: 0, direction: 'earlier' })).toBe(state);
    expect(canMoveStep(state, 0, 'earlier')).toBe(false);
    expect(recipientsReducer(state, { type: 'MOVE_STEP', index: 3, direction: 'later' })).toBe(state);
    expect(canMoveStep(state, 3, 'later')).toBe(false);

    // ...and the controls that DO something agree just as exactly.
    expect(canMoveStep(state, 0, 'later')).toBe(true);
    expect(canMoveStep(state, 1, 'earlier')).toBe(true);
  });

  it('is a no-op in parallel — there is only one step to be in (§A3.4)', () => {
    const state = createSeedState();
    expect(recipientsReducer(state, { type: 'MOVE_STEP', index: 0, direction: 'later' })).toBe(state);
    expect(canMoveStep(state, 0, 'later')).toBe(false);
    expect(canMergeStep(state, 0, 'later')).toBe(false);
  });

  it('loses NOTHING but the step number (§A2.8)', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 1, direction: 'later' });

    before.rows.forEach((row, index) => {
      const { step: _before, ...beforeRest } = row;
      const { step: _after, ...afterRest } = after.rows[index]!;
      expect(afterRest).toEqual(beforeRest);
    });
    expect(after.rows).toHaveLength(before.rows.length);
    expect(after.nextId).toBe(before.nextId);
  });
});

describe('MERGE_STEP — recipients signing in parallel within a step (§A2.2, §A2.6)', () => {
  it('merges a recipient into the previous step', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MERGE_STEP', index: 3, direction: 'earlier' });

    expect(stepsOf(after)).toEqual([1, 2, 2, 2]); // three signers on step 2
    expectAcceptable(after);
  });

  it('merges a recipient into the next step, renormalizing the step it emptied', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MERGE_STEP', index: 0, direction: 'later' });

    // Step 1 is now empty, so everything shifts down by one.
    expect(stepsOf(after)).toEqual([1, 1, 1, 2]);
    expectAcceptable(after);
  });

  it('can collapse the whole chain back to a single step', () => {
    const state = run(
      [
        { type: 'MERGE_STEP', index: 3, direction: 'earlier' },
        { type: 'MERGE_STEP', index: 1, direction: 'earlier' },
        { type: 'MERGE_STEP', index: 2, direction: 'earlier' },
        { type: 'MERGE_STEP', index: 3, direction: 'earlier' },
      ],
      fourOnSteps1223(),
    );

    expect(stepsOf(state)).toEqual([1, 1, 1, 1]);
    expectAcceptable(state);
    expect(groupByStep(toRecipientInputs(state), 'sequential')).toHaveLength(1);
  });

  it('is a no-op at either end, and says so to the UI', () => {
    const state = fourOnSteps1223();
    expect(recipientsReducer(state, { type: 'MERGE_STEP', index: 0, direction: 'earlier' })).toBe(state);
    expect(canMergeStep(state, 0, 'earlier')).toBe(false);
    expect(recipientsReducer(state, { type: 'MERGE_STEP', index: 3, direction: 'later' })).toBe(state);
    expect(canMergeStep(state, 3, 'later')).toBe(false);
  });

  it('loses NOTHING but the step number (§A2.8)', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MERGE_STEP', index: 0, direction: 'later' });

    before.rows.forEach((row, index) => {
      const { step: _before, ...beforeRest } = row;
      const { step: _after, ...afterRest } = after.rows[index]!;
      expect(afterRest).toEqual(beforeRest);
    });
  });
});

describe('every reducer path leaves a list the server would accept (§A2.3)', () => {
  const directions = ['earlier', 'later'] as const;

  it('holds for every single-action reorder of [1,2,2,3]', () => {
    const base = fourOnSteps1223();
    for (let index = 0; index < base.rows.length; index += 1) {
      for (const direction of directions) {
        for (const type of ['MOVE_STEP', 'MERGE_STEP'] as const) {
          expectAcceptable(recipientsReducer(base, { type, index, direction }));
        }
      }
    }
  });

  it('holds after any single deletion from [1,2,2,3]', () => {
    const base = fourOnSteps1223();
    for (let index = 0; index < base.rows.length; index += 1) {
      const after = recipientsReducer(base, { type: 'REMOVE_ROW', index });
      expectAcceptable(after);
      expect(after.rows).toHaveLength(base.rows.length - 1);
    }
  });

  it('holds after a long walk of mixed reorders', () => {
    let state = fourOnSteps1223();
    const walk: RecipientsAction[] = [
      { type: 'MOVE_STEP', index: 3, direction: 'earlier' },
      { type: 'MERGE_STEP', index: 0, direction: 'later' },
      { type: 'MOVE_STEP', index: 2, direction: 'later' },
      { type: 'ADD_ROW' },
      { type: 'MERGE_STEP', index: 4, direction: 'earlier' },
      { type: 'REMOVE_ROW', index: 1 },
      { type: 'MOVE_STEP', index: 0, direction: 'later' },
    ];
    for (const action of walk) {
      state = recipientsReducer(state, action);
      expectAcceptable(state);
    }
  });

  it('never mutates the state it is given', () => {
    const before = fourOnSteps1223();
    const snapshot = JSON.stringify(before);
    recipientsReducer(before, { type: 'MOVE_STEP', index: 1, direction: 'later' });
    recipientsReducer(before, { type: 'MERGE_STEP', index: 1, direction: 'earlier' });
    recipientsReducer(before, { type: 'SET_ORDER_MODE', mode: 'parallel' });
    recipientsReducer(before, { type: 'REMOVE_ROW', index: 0 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('§A3.3 — a meterai carrier may only be in step 1', () => {
  it('is clean while the carrier is in step 1', () => {
    const state = run([
      { type: 'SET_ORDER_MODE', mode: 'sequential' },
      { type: 'INC_METERAI', index: 0 }, // Rina, step 1
    ]);
    expect(validateMeteraiStepPlacement(toRecipientInputs(state), 'sequential')).toBeNull();
  });

  it('marks THAT recipient the moment they are moved out of step 1', () => {
    const before = run([
      { type: 'SET_ORDER_MODE', mode: 'sequential' },
      { type: 'INC_METERAI', index: 0 },
    ]);
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 0, direction: 'later' });

    expect(stepsOf(after)).toEqual([2, 1]);
    const failure = validateMeteraiStepPlacement(toRecipientInputs(after), 'sequential');
    expect(failure?.code).toBe('METERAI_NOT_IN_FIRST_STEP');
    // The row, by index AND by name, because §A3.3 has to point at a person.
    expect(failure?.details?.recipient_index).toBe(0);
    expect(failure?.details?.recipient_email).toBe('rina.halim@example.test');
  });

  it('is cleared again by merging the carrier back into step 1', () => {
    const state = run(
      [{ type: 'MERGE_STEP', index: 0, direction: 'earlier' }],
      run([
        { type: 'SET_ORDER_MODE', mode: 'sequential' },
        { type: 'INC_METERAI', index: 0 },
        { type: 'MOVE_STEP', index: 0, direction: 'later' },
      ]),
    );

    expect(stepsOf(state)).toEqual([1, 1]);
    expect(validateMeteraiStepPlacement(toRecipientInputs(state), 'sequential')).toBeNull();
  });

  it('does not bind in parallel, which IS a single step (§A3.4)', () => {
    const state = run([{ type: 'INC_METERAI', index: 1 }]);
    expect(validateMeteraiStepPlacement(toRecipientInputs(state), 'parallel')).toBeNull();
  });
});

describe('the §A2.5 grouped view', () => {
  it('buckets the rows by step, in step order, keeping list order inside a step', () => {
    const state = fourOnSteps1223();
    const views = stepViews(state);

    expect(views.map((view) => view.step)).toEqual([1, 2, 3]);
    expect(views.map((view) => view.members.map((member) => member.index))).toEqual([[0], [1, 2], [3]]);
    expect(views[1]?.members.map((member) => member.row.name)).toEqual(['Budi Santoso', 'Citra Dewi']);
  });

  it('agrees with the kernel projection the server echoes back (§B4)', () => {
    const state = fourOnSteps1223();
    const wire = groupByStep(toRecipientInputs(state), state.orderMode);

    expect(stepViews(state).map((view) => view.step)).toEqual(wire.map((group) => group.step));
    expect(
      stepViews(state).map((view) =>
        view.members.map((member) => member.row.email.trim().toLowerCase()),
      ),
    ).toEqual(wire.map((group) => [...group.recipient_emails]));
  });

  it('spells out that a shared step signs in parallel (§A2.2)', () => {
    expect(stepGroupLabel(2, 2)).toBe('Step 2 — 2 recipients signing in parallel');
    expect(stepGroupLabel(1, 1)).toBe('Step 1 — 1 recipient');
  });
});

describe('the wire projection (§B4, §B7 row 9)', () => {
  it('carries a step for every recipient in sequential', () => {
    const inputs = toRecipientInputs(fourOnSteps1223());
    expect(inputs.map((r) => r.step)).toEqual([1, 2, 2, 3]);
    for (const recipient of inputs) {
      expect(Object.keys(recipient).sort()).toEqual([
        'email',
        'meterai_count',
        'name',
        'signature_count',
        'step',
      ]);
    }
  });

  it('carries no step at all in parallel', () => {
    for (const recipient of toRecipientInputs(createSeedState())) {
      expect(Object.keys(recipient).sort()).toEqual([
        'email',
        'meterai_count',
        'name',
        'signature_count',
      ]);
    }
  });
});

describe('the staleness guard knows about the mode and the steps (seam S5)', () => {
  /** A transport resolved by hand, so nothing races and nothing flakes. */
  function deferred() {
    const calls: {
      recipients: readonly { step?: number }[];
      orderMode: OrderMode;
      resolve: (value: never) => void;
    }[] = [];
    const transport = ((_id, recipients, orderMode) =>
      new Promise((resolve) => {
        calls.push({ recipients: [...recipients], orderMode, resolve: resolve as never });
      })) as PreviewTransport;
    return { transport, calls };
  }

  const keyOf = (state: RecipientsState) =>
    previewKey(ENVELOPE, toRecipientInputs(state), state.orderMode);

  it('changes the key when the mode changes, with identical recipients', () => {
    const parallel = createSeedState();
    const sequential = recipientsReducer(parallel, { type: 'SET_ORDER_MODE', mode: 'sequential' });
    expect(keyOf(sequential)).not.toBe(keyOf(parallel));
  });

  it('changes the key when one recipient moves to another step', () => {
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MERGE_STEP', index: 3, direction: 'earlier' });
    expect(keyOf(after)).not.toBe(keyOf(before));
  });

  it('ignores a leftover step in parallel — it is not part of the input (§B4)', () => {
    const clean = createSeedState();
    const roundTripped = run(
      [
        { type: 'SET_ORDER_MODE', mode: 'sequential' },
        { type: 'MOVE_STEP', index: 1, direction: 'earlier' },
        { type: 'SET_ORDER_MODE', mode: 'parallel' },
      ],
      clean,
    );
    expect(keyOf(roundTripped)).toBe(keyOf(clean));
  });

  it('makes a confirmed total unreadable once the mode changes', async () => {
    const { transport, calls } = deferred();
    const controller = new PreviewController(transport);
    const parallel = createSeedState();
    const sequential = recipientsReducer(parallel, { type: 'SET_ORDER_MODE', mode: 'sequential' });

    const pending = controller.request(ENVELOPE, toRecipientInputs(parallel), parallel.orderMode);
    calls[0]?.resolve({ total_charge: '15000.00' } as never);
    await pending;
    expect(controller.resultFor(keyOf(parallel))).not.toBeNull();

    // The user picks `sequential`. No new request has been made.
    controller.syncKey(keyOf(sequential));
    expect(controller.resultFor(keyOf(sequential))).toBeNull();
  });

  it('aborts a PENDING preview when a recipient is moved to another step', () => {
    const { transport } = deferred();
    const controller = new PreviewController(transport);
    const before = fourOnSteps1223();
    const after = recipientsReducer(before, { type: 'MOVE_STEP', index: 3, direction: 'earlier' });

    void controller.request(ENVELOPE, toRecipientInputs(before), before.orderMode);
    expect(controller.isLoadingFor(keyOf(before))).toBe(true);

    controller.syncKey(keyOf(after));
    expect(controller.getSnapshot().status).toBe('idle');
    expect(controller.resultFor(keyOf(after))).toBeNull();
  });

  it('sends step ONLY in sequential, whatever the rows carry', () => {
    const { transport, calls } = deferred();
    const controller = new PreviewController(transport);
    const sequential = fourOnSteps1223();

    void controller.request(ENVELOPE, toRecipientInputs(sequential), 'sequential');
    expect(calls[0]?.orderMode).toBe('sequential');
    expect(calls[0]?.recipients.map((r) => r.step)).toEqual([1, 2, 2, 3]);

    // The same rows, still carrying a step, requested in parallel: not sent.
    void controller.request(ENVELOPE, toRecipientInputs(sequential), 'parallel');
    expect(calls[1]?.orderMode).toBe('parallel');
    for (const recipient of calls[1]?.recipients ?? []) {
      expect('step' in recipient).toBe(false);
    }
  });
});
