/**
 * Written BEFORE `steps.ts`. Every expected value below is hand-derived from
 * `test_2_en.md` §A2, §A3.3/§A3.4, §B4 and §B5 — never copied out of a run.
 *
 *   §A2    `parallel` (default, the Case-1 behaviour) or `sequential`; an
 *          `order_mode` outside those two is `ORDER_MODE_INVALID`.
 *   §A2.1  every recipient in `sequential` has a `step`, an integer >= 1.
 *   §A2.2  SEVERAL RECIPIENTS MAY SHARE A STEP — they sign in parallel within
 *          it. Supported, not merely tolerated.
 *   §A2.3  step numbers are contiguous from 1. `[1,1,2,3]` is valid;
 *          `[1,3]`, `[2,3]`, `[0,1]` are not.
 *   §A2.4  deleting until a step is empty renormalizes the rest back to
 *          contiguous: `[1,2,2,3]` minus step 1's sole member -> `[1,1,2]`.
 *   §A3.3  a recipient carrying eMeterai may only be in step 1 — the stamp
 *          produces one stamped document before the chain starts.
 *   §A3.4  `parallel` IS a single step, so §A3.3 does not bind there.
 *   §B4    the response projects `steps: [{ step, recipient_emails }]`.
 *   §B5    order: ... order_mode -> per recipient -> duplicate emails
 *          -> step structure -> meterai-vs-signature -> meterai step placement
 *          -> ... -> signature quota -> meterai quota.
 *   §B7.5  Rina step 1, Budi step 2, Citra step 2 -> valid, 2 steps, step 2
 *          holds two emails.
 *   §B7.6  §B7.5 with Citra given 1 meterai -> `METERAI_NOT_IN_FIRST_STEP`.
 *   §B7.7  `[1,3]`, `[2,3]`, `[0,1]` -> `STEP_SEQUENCE_INVALID`.
 *   §B7.8  `[1,2,2,3]`, step 1's sole member deleted -> `[1,1,2]`, other
 *          recipient data intact.
 *
 * Nothing here knows a price or an allowance: the quota fixture below is a
 * PARAMETER handed to the stage factories, exactly as ADR-003 requires.
 */
import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type ValidationFailure } from '../errors.js';
import { chargePreviewStages } from '../quota.js';
import { validateRecipientList } from '../recipient.js';
import {
  DEFAULT_ORDER_MODE,
  FIRST_STEP,
  ORDER_MODES,
  groupByStep,
  isOrderMode,
  isValidStep,
  meteraiStepPlacementStage,
  orderModeOf,
  orderModeStage,
  renormalizeSteps,
  stepOf,
  stepStructureStage,
  validateMeteraiStepPlacement,
  validateOrderMode,
  validateStepSequence,
} from '../steps.js';
import type { RecipientInput } from '../types.js';

/** §B1 fixtures. The kernel is told these; it never sources them (ADR-003). */
const QUOTA = { signature: 8, meterai: 3 };

function signer(
  name: string,
  over: Partial<RecipientInput> = {},
): RecipientInput {
  return {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
    signature_count: 1,
    meterai_count: 0,
    ...over,
  };
}

function failureOf(result: ValidationFailure | null): ValidationFailure {
  if (result === null) throw new Error('expected a ValidationFailure, got null');
  return result;
}

/** A sequential list whose steps are exactly the numbers given, in order. */
function withSteps(steps: readonly unknown[]): RecipientInput[] {
  return steps.map((step, index) =>
    signer(`Signer ${index}`, { step: step as number }),
  );
}

// ---------------------------------------------------------------------------
// §A2 — the mode itself
// ---------------------------------------------------------------------------

describe('order_mode — two modes and nothing else (§A2, §B4)', () => {
  it('is exactly parallel and sequential, parallel first', () => {
    expect(ORDER_MODES).toEqual(['parallel', 'sequential']);
  });

  it('defaults to parallel — the Case-1 behaviour (§A2)', () => {
    expect(DEFAULT_ORDER_MODE).toBe('parallel');
  });

  it('accepts the two modes and refuses everything else', () => {
    expect(isOrderMode('parallel')).toBe(true);
    expect(isOrderMode('sequential')).toBe(true);
    for (const raw of ['Parallel', 'SEQUENTIAL', 'serial', '', ' parallel ', null, 1, {}, [], true]) {
      expect(isOrderMode(raw), `expected ${JSON.stringify(raw)} to be refused`).toBe(false);
    }
  });

  it('refuses an absent mode as a VALUE, because absence is the caller’s default', () => {
    expect(isOrderMode(undefined)).toBe(false);
  });

  it('reads an absent or malformed mode as parallel, so arithmetic never sees junk', () => {
    expect(orderModeOf('sequential')).toBe('sequential');
    expect(orderModeOf('parallel')).toBe('parallel');
    expect(orderModeOf(undefined)).toBe('parallel');
    expect(orderModeOf('Sequential')).toBe('parallel');
    expect(orderModeOf(null)).toBe('parallel');
    expect(orderModeOf(7)).toBe('parallel');
  });
});

describe('validateOrderMode — ORDER_MODE_INVALID (§A2, §B5)', () => {
  it('passes both modes', () => {
    expect(validateOrderMode('parallel')).toBeNull();
    expect(validateOrderMode('sequential')).toBeNull();
  });

  it('passes an ABSENT mode: a Case-1 payload still means parallel', () => {
    expect(validateOrderMode(undefined)).toBeNull();
  });

  it('refuses anything else with ORDER_MODE_INVALID', () => {
    for (const raw of ['Parallel', 'serial', '', ' sequential', null, 0, 1, {}, [], true]) {
      const failure = failureOf(validateOrderMode(raw));
      expect(failure.code, `expected ${JSON.stringify(raw)} to be refused`).toBe(
        'ORDER_MODE_INVALID',
      );
      expect(failure.message).toBe('order_mode must be "parallel" or "sequential"');
    }
  });

  it('names no recipient — the mode is a request-level field, not a row', () => {
    expect(failureOf(validateOrderMode('serial')).details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// §A2.1/§A2.3 — step shape and contiguity
// ---------------------------------------------------------------------------

describe('a step is an integer >= 1 (§A2.1)', () => {
  it('starts at 1', () => {
    expect(FIRST_STEP).toBe(1);
  });

  it('accepts whole numbers from 1 up', () => {
    expect(isValidStep(1)).toBe(true);
    expect(isValidStep(2)).toBe(true);
    expect(isValidStep(10)).toBe(true);
  });

  it('refuses 0, negatives, fractions, strings and absence', () => {
    for (const raw of [0, -1, 1.5, '1', ' 1 ', null, undefined, Number.NaN, {}, [1], true]) {
      expect(isValidStep(raw), `expected ${JSON.stringify(raw) ?? String(raw)} to be refused`).toBe(
        false,
      );
    }
  });

  it('reads a malformed or absent step as step 1, so grouping never sees junk', () => {
    expect(stepOf(signer('Rina Halim', { step: 3 }))).toBe(3);
    expect(stepOf(signer('Rina Halim'))).toBe(1);
    expect(stepOf(signer('Rina Halim', { step: 0 }))).toBe(1);
    expect(stepOf(signer('Rina Halim', { step: 2.5 }))).toBe(1);
    expect(stepOf(undefined as unknown as RecipientInput)).toBe(1);
  });
});

describe('validateStepSequence — contiguous from 1 (§A2.3, §B7.7)', () => {
  it('is vacuous in parallel, however broken the steps are (§A3.4)', () => {
    expect(validateStepSequence(withSteps([1, 3]), 'parallel')).toBeNull();
    expect(validateStepSequence(withSteps([0, 1]), 'parallel')).toBeNull();
    expect(validateStepSequence([signer('Rina Halim')], 'parallel')).toBeNull();
  });

  it('accepts a single step 1', () => {
    expect(validateStepSequence(withSteps([1]), 'sequential')).toBeNull();
  });

  it('accepts SHARED steps — parallel signers inside one step (§A2.2)', () => {
    expect(validateStepSequence(withSteps([1, 1]), 'sequential')).toBeNull();
    expect(validateStepSequence(withSteps([1, 1, 2, 3]), 'sequential')).toBeNull();
    expect(validateStepSequence(withSteps([1, 2, 2, 3]), 'sequential')).toBeNull();
  });

  it('accepts steps declared out of row order — contiguity is about the SET', () => {
    expect(validateStepSequence(withSteps([3, 1, 2, 1]), 'sequential')).toBeNull();
  });

  it('refuses §B7.7 [1,3] — a gap', () => {
    const failure = failureOf(validateStepSequence(withSteps([1, 3]), 'sequential'));
    expect(failure.code).toBe('STEP_SEQUENCE_INVALID');
    expect(failure.message).toBe('Step numbers must be contiguous starting at 1 - got 1, 3');
  });

  it('refuses §B7.7 [2,3] — contiguous but not starting at 1', () => {
    const failure = failureOf(validateStepSequence(withSteps([2, 3]), 'sequential'));
    expect(failure.code).toBe('STEP_SEQUENCE_INVALID');
    expect(failure.message).toBe('Step numbers must be contiguous starting at 1 - got 2, 3');
  });

  it('refuses §B7.7 [0,1] — 0 is not a step at all, and names that row', () => {
    const failure = failureOf(validateStepSequence(withSteps([0, 1]), 'sequential'));
    expect(failure.code).toBe('STEP_SEQUENCE_INVALID');
    expect(failure.message).toBe('step must be a whole number of 1 or more');
    expect(failure.details?.recipient_index).toBe(0);
  });

  it('refuses a recipient with no step at all in sequential (§A2.1)', () => {
    const failure = failureOf(
      validateStepSequence([signer('Rina Halim', { step: 1 }), signer('Budi Santoso')], 'sequential'),
    );
    expect(failure.code).toBe('STEP_SEQUENCE_INVALID');
    expect(failure.details?.recipient_index).toBe(1);
  });

  it('refuses a malformed step without coercing it, and names the FIRST offender', () => {
    for (const raw of ['2', 2.5, -1, null, Number.NaN]) {
      const failure = failureOf(
        validateStepSequence(withSteps([1, raw, raw]), 'sequential'),
      );
      expect(failure.code, `expected ${JSON.stringify(raw) ?? String(raw)} to be refused`).toBe(
        'STEP_SEQUENCE_INVALID',
      );
      expect(failure.details?.recipient_index).toBe(1);
    }
  });

  it('has nothing to say about an empty list — that is the count stage’s job', () => {
    expect(validateStepSequence([], 'sequential')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §B4 — the `steps` projection
// ---------------------------------------------------------------------------

describe('groupByStep — the §B4 `steps` projection', () => {
  it('projects §B7.5: Rina step 1, Budi step 2, Citra step 2', () => {
    const list = [
      signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
      signer('Budi Santoso', { step: 2 }),
      signer('Citra Dewi', { step: 2 }),
    ];
    expect(groupByStep(list, 'sequential')).toEqual([
      { step: 1, recipient_emails: ['rina.halim@example.test'] },
      { step: 2, recipient_emails: ['budi.santoso@example.test', 'citra.dewi@example.test'] },
    ]);
  });

  it('§B7.5 is VALID and has exactly 2 steps, the second holding two emails', () => {
    const list = [
      signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
      signer('Budi Santoso', { step: 2 }),
      signer('Citra Dewi', { step: 2 }),
    ];
    expect(validateRecipientList(list, chargePreviewStages(QUOTA, 'sequential'))).toBeNull();

    const steps = groupByStep(list, 'sequential');
    expect(steps).toHaveLength(2);
    expect(steps[1]?.recipient_emails).toHaveLength(2);
  });

  it('counts parallel as ONE step holding everyone (§A3.4)', () => {
    const list = [signer('Rina Halim'), signer('Budi Santoso')];
    expect(groupByStep(list, 'parallel')).toEqual([
      {
        step: 1,
        recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'],
      },
    ]);
  });

  it('ignores any step a parallel payload carries — parallel has one step by definition', () => {
    const list = [signer('Rina Halim', { step: 9 }), signer('Budi Santoso', { step: 4 })];
    expect(groupByStep(list, 'parallel')).toEqual([
      {
        step: 1,
        recipient_emails: ['rina.halim@example.test', 'budi.santoso@example.test'],
      },
    ]);
  });

  it('orders groups by step ascending, whatever order the rows arrive in', () => {
    const list = [
      signer('Citra Dewi', { step: 3 }),
      signer('Rina Halim', { step: 1 }),
      signer('Budi Santoso', { step: 2 }),
    ];
    expect(groupByStep(list, 'sequential').map((group) => group.step)).toEqual([1, 2, 3]);
  });

  it('keeps row order inside a shared step (§A2.2)', () => {
    const list = [
      signer('Budi Santoso', { step: 2 }),
      signer('Rina Halim', { step: 1 }),
      signer('Citra Dewi', { step: 2 }),
    ];
    expect(groupByStep(list, 'sequential')[1]?.recipient_emails).toEqual([
      'budi.santoso@example.test',
      'citra.dewi@example.test',
    ]);
  });

  it('normalizes emails the way the rest of the kernel does (trim + lowercase)', () => {
    const list = [signer('Rina Halim', { step: 1, email: '  Rina.Halim@Example.TEST ' })];
    expect(groupByStep(list, 'sequential')).toEqual([
      { step: 1, recipient_emails: ['rina.halim@example.test'] },
    ]);
  });

  it('projects an empty list as no steps at all', () => {
    expect(groupByStep([], 'sequential')).toEqual([]);
    expect(groupByStep([], 'parallel')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §A2.4 — renormalization
// ---------------------------------------------------------------------------

describe('renormalizeSteps — §A2.4, §B7.8', () => {
  /** §B7.8's list, with distinguishing data on every row. */
  function b78(): RecipientInput[] {
    return [
      signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
      signer('Budi Santoso', { step: 2, signature_count: 3, meterai_count: 0 }),
      signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 1 }),
      signer('Dewi Lestari', { step: 3, signature_count: 4, meterai_count: 2 }),
    ];
  }

  it('collapses [1,2,2,3] to [1,1,2] when step 1’s sole member is deleted (§B7.8)', () => {
    const remaining = b78().filter((r) => r.name !== 'Rina Halim');
    expect(renormalizeSteps(remaining, 'sequential').map((r) => r.step)).toEqual([1, 1, 2]);
  });

  it('leaves every other field of every remaining recipient intact (§B7.8)', () => {
    const remaining = b78().filter((r) => r.name !== 'Rina Halim');
    expect(renormalizeSteps(remaining, 'sequential')).toEqual([
      {
        name: 'Budi Santoso',
        email: 'budi.santoso@example.test',
        signature_count: 3,
        meterai_count: 0,
        step: 1,
      },
      {
        name: 'Citra Dewi',
        email: 'citra.dewi@example.test',
        signature_count: 1,
        meterai_count: 1,
        step: 1,
      },
      {
        name: 'Dewi Lestari',
        email: 'dewi.lestari@example.test',
        signature_count: 4,
        meterai_count: 2,
        step: 2,
      },
    ]);
  });

  it('keeps row order — renormalizing renumbers, it never reorders', () => {
    const remaining = b78().filter((r) => r.name !== 'Rina Halim');
    expect(renormalizeSteps(remaining, 'sequential').map((r) => r.name)).toEqual([
      'Budi Santoso',
      'Citra Dewi',
      'Dewi Lestari',
    ]);
  });

  it('produces a list that passes the contiguity rule it exists to satisfy', () => {
    const remaining = b78().filter((r) => r.name !== 'Rina Halim');
    expect(failureOf(validateStepSequence(remaining, 'sequential')).code).toBe(
      'STEP_SEQUENCE_INVALID',
    );
    expect(validateStepSequence(renormalizeSteps(remaining, 'sequential'), 'sequential')).toBeNull();
  });

  it('is a no-op on an already-contiguous list, and keeps row identity', () => {
    const rows = withSteps([1, 1, 2, 3]);
    const next = renormalizeSteps(rows, 'sequential');
    expect(next.map((r) => r.step)).toEqual([1, 1, 2, 3]);
    expect(next[0]).toBe(rows[0]);
    expect(next[3]).toBe(rows[3]);
  });

  it('closes a gap anywhere in the list, not only at the front', () => {
    expect(renormalizeSteps(withSteps([1, 3, 3, 4]), 'sequential').map((r) => r.step)).toEqual([
      1, 2, 2, 3,
    ]);
    expect(renormalizeSteps(withSteps([2, 3]), 'sequential').map((r) => r.step)).toEqual([1, 2]);
    expect(renormalizeSteps(withSteps([5]), 'sequential').map((r) => r.step)).toEqual([1]);
    expect(renormalizeSteps(withSteps([3, 1, 1]), 'sequential').map((r) => r.step)).toEqual([
      2, 1, 1,
    ]);
  });

  it('repairs a malformed step into step 1 rather than propagating it', () => {
    expect(renormalizeSteps(withSteps([0, 2]), 'sequential').map((r) => r.step)).toEqual([1, 2]);
    expect(renormalizeSteps(withSteps(['x', 4]), 'sequential').map((r) => r.step)).toEqual([1, 2]);
  });

  it('is a NO-OP in parallel, and never introduces a `step` the server would refuse', () => {
    const rows = [signer('Rina Halim'), signer('Budi Santoso')];
    const next = renormalizeSteps(rows, 'parallel');
    expect(next).toEqual(rows);
    expect(next[0]).toBe(rows[0]);
    expect('step' in (next[0] as object)).toBe(false);
  });

  it('carries local-only row fields through untouched (the FE keeps an id)', () => {
    const rows = [
      { ...signer('Budi Santoso', { step: 2 }), id: 'r1', countRaw: '1' },
      { ...signer('Citra Dewi', { step: 3 }), id: 'r2', countRaw: '1' },
    ];
    const next = renormalizeSteps(rows, 'sequential');
    expect(next.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(next.map((r) => r.countRaw)).toEqual(['1', '1']);
    expect(next.map((r) => r.step)).toEqual([1, 2]);
  });

  it('never mutates the list it is given', () => {
    const rows = withSteps([2, 3]);
    renormalizeSteps(rows, 'sequential');
    expect(rows.map((r) => r.step)).toEqual([2, 3]);
  });

  it('handles an empty list', () => {
    expect(renormalizeSteps([], 'sequential')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §A3.3 / §A3.4 — a meterai carrier may only be in step 1
// ---------------------------------------------------------------------------

describe('meterai step placement — §A3.3, §A3.4, §B7.6', () => {
  /** §B7.5's list, with Citra given 1 meterai -> §B7.6. */
  function b76(): RecipientInput[] {
    return [
      signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
      signer('Budi Santoso', { step: 2, signature_count: 1, meterai_count: 0 }),
      signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 1 }),
    ];
  }

  it('allows a carrier in step 1', () => {
    expect(
      validateMeteraiStepPlacement(
        [
          signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
          signer('Budi Santoso', { step: 2 }),
        ],
        'sequential',
      ),
    ).toBeNull();
  });

  it('allows a NON-carrier in any step — the rule is about the stamp, not the step', () => {
    expect(
      validateMeteraiStepPlacement(
        [signer('Rina Halim', { step: 1 }), signer('Budi Santoso', { step: 2 })],
        'sequential',
      ),
    ).toBeNull();
  });

  it('refuses §B7.6 — Citra carries 1 meterai in step 2', () => {
    const failure = failureOf(validateMeteraiStepPlacement(b76(), 'sequential'));
    expect(failure.code).toBe('METERAI_NOT_IN_FIRST_STEP');
  });

  it('names the offending recipient, not the whole form (§A3.3)', () => {
    const failure = failureOf(validateMeteraiStepPlacement(b76(), 'sequential'));
    expect(failure.details?.recipient_index).toBe(2);
    expect(failure.details?.recipient_email).toBe('citra.dewi@example.test');
    expect(failure.message).toBe(
      'citra.dewi@example.test carries eMeterai but is in step 2 - a duty stamp is ' +
        'affixed before the signing chain starts, so only step 1 may carry eMeterai',
    );
  });

  it('is VACUOUS in parallel — parallel counts as a single step (§A3.4)', () => {
    expect(validateMeteraiStepPlacement(b76(), 'parallel')).toBeNull();
  });

  it('reports the first offending row in index order', () => {
    const failure = failureOf(
      validateMeteraiStepPlacement(
        [
          signer('Rina Halim', { step: 1 }),
          signer('Budi Santoso', { step: 2, meterai_count: 1 }),
          signer('Citra Dewi', { step: 3, meterai_count: 1 }),
        ],
        'sequential',
      ),
    );
    expect(failure.details?.recipient_index).toBe(1);
    expect(failure.details?.recipient_email).toBe('budi.santoso@example.test');
  });

  it('treats a 0 or absent meterai_count as carrying nothing (§B1 default)', () => {
    const legacy = [
      { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 1, step: 1 },
      { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1, step: 2 },
    ] as RecipientInput[];
    expect(validateMeteraiStepPlacement(legacy, 'sequential')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §B5 — where the two new stages sit
// ---------------------------------------------------------------------------

describe('the §B5 validation order stays data, not an if-chain (seam S3)', () => {
  /**
   * P3 inserted `field-shape` and `field-reconciliation` between
   * `meterai-step-placement` and `signature-quota`, exactly where §B5 puts
   * them, so the nine-name equality this assertion was originally written as is
   * superseded by the brief. Its INTENT — the three P2 stages sit at those
   * positions relative to everything else, and nothing moved — is preserved
   * verbatim below as a filter over the composed list.
   */
  it('registers the P2 stages in exactly the brief’s positions', () => {
    const throughP2 = [
      'order-mode',
      'count',
      'per-recipient',
      'duplicates',
      'step-structure',
      'meterai-vs-signature',
      'meterai-step-placement',
      'signature-quota',
      'meterai-quota',
    ];
    expect(
      chargePreviewStages(QUOTA, 'sequential')
        .map((stage) => stage.name)
        .filter((name) => throughP2.includes(name)),
    ).toEqual(throughP2);
  });

  it('registers the P2 stages at those positions in the full eleven-stage order', () => {
    expect(chargePreviewStages(QUOTA, 'sequential').map((stage) => stage.name)).toEqual([
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

  it('registers the same stages in parallel — the ORDER does not vary by mode', () => {
    expect(chargePreviewStages(QUOTA, 'parallel').map((stage) => stage.name)).toEqual(
      chargePreviewStages(QUOTA, 'sequential').map((stage) => stage.name),
    );
  });

  it('defaults to parallel when no mode is given, so a Case-1 caller is unchanged', () => {
    expect(chargePreviewStages(QUOTA).map((stage) => stage.name)).toEqual(
      chargePreviewStages(QUOTA, 'parallel').map((stage) => stage.name),
    );
  });

  it('exposes each new stage on its own, named', () => {
    expect(orderModeStage('sequential').name).toBe('order-mode');
    expect(stepStructureStage('sequential').name).toBe('step-structure');
    expect(meteraiStepPlacementStage('sequential').name).toBe('meterai-step-placement');
  });
});

describe('§B5 order, asserted by collision — the earlier rule must win', () => {
  function check(
    recipients: readonly RecipientInput[],
    mode: unknown = 'sequential',
  ): ValidationFailure | null {
    return validateRecipientList(recipients, chargePreviewStages(QUOTA, mode));
  }

  it('reports order_mode before any recipient rule', () => {
    // An empty list (count), a bad row and a bad mode at once.
    expect(failureOf(check([], 'serial')).code).toBe('ORDER_MODE_INVALID');
    expect(
      failureOf(check([signer('Rina Halim', { signature_count: 0 })], 'serial')).code,
    ).toBe('ORDER_MODE_INVALID');
  });

  it('reports a per-recipient failure before step structure', () => {
    const failure = failureOf(
      check([
        signer('Rina Halim', { step: 1, signature_count: 0 }),
        signer('Budi Santoso', { step: 3 }),
      ]),
    );
    expect(failure.code).toBe('SIGNATURE_COUNT_INVALID');
  });

  it('reports a duplicate email before step structure (§B5)', () => {
    const failure = failureOf(
      check([
        signer('Rina Halim', { step: 1 }),
        signer('Rina Again', { step: 3, email: 'rina.halim@example.test' }),
      ]),
    );
    expect(failure.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });

  it('reports step structure before meterai-vs-signature (§B5)', () => {
    // Rina 1 sig / 2 met is a row rule; the steps [1,3] are a list rule.
    const failure = failureOf(
      check([
        signer('Rina Halim', { step: 1, signature_count: 1, meterai_count: 2 }),
        signer('Budi Santoso', { step: 3 }),
      ]),
    );
    expect(failure.code).toBe('STEP_SEQUENCE_INVALID');
  });

  it('reports meterai-vs-signature before meterai step placement (§B5)', () => {
    // Citra breaks both: 2 meterai on 1 signature, AND she is in step 2.
    const failure = failureOf(
      check([
        signer('Rina Halim', { step: 1 }),
        signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 2 }),
      ]),
    );
    expect(failure.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(failure.details?.recipient_index).toBe(1);
  });

  it('reports meterai step placement before either quota (§B5)', () => {
    // 9 signatures of 8 AND Citra carrying a stamp in step 2.
    const failure = failureOf(
      check([
        signer('Rina Halim', { step: 1, signature_count: 8 }),
        signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 1 }),
      ]),
    );
    expect(failure.code).toBe('METERAI_NOT_IN_FIRST_STEP');
  });

  it('accepts §B7.5 end to end through the composed pipeline', () => {
    expect(
      check([
        signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
        signer('Budi Santoso', { step: 2, signature_count: 1, meterai_count: 0 }),
        signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 0 }),
      ]),
    ).toBeNull();
  });

  it('refuses §B7.6 end to end through the composed pipeline', () => {
    expect(
      failureOf(
        check([
          signer('Rina Halim', { step: 1, signature_count: 2, meterai_count: 1 }),
          signer('Budi Santoso', { step: 2, signature_count: 1, meterai_count: 0 }),
          signer('Citra Dewi', { step: 2, signature_count: 1, meterai_count: 1 }),
        ]),
      ).code,
    ).toBe('METERAI_NOT_IN_FIRST_STEP');
  });

  it('leaves a parallel list exactly as P1 judged it (§A3.4, §B7.21)', () => {
    // The very list that fails in sequential passes in parallel: both new
    // stages are vacuous there, so nothing P1 accepted is newly refused.
    const list = [
      signer('Rina Halim', { signature_count: 2, meterai_count: 1 }),
      signer('Budi Santoso', { signature_count: 1, meterai_count: 0 }),
      signer('Citra Dewi', { signature_count: 1, meterai_count: 1 }),
    ];
    expect(check(list, 'parallel')).toBeNull();
    // ... and with no mode supplied at all, which is the Case-1 call shape.
    expect(validateRecipientList(list, chargePreviewStages(QUOTA))).toBeNull();
  });
});

describe('the new codes join the shared vocabulary (§B5)', () => {
  it('lists all three P2 codes at runtime', () => {
    expect(ERROR_CODES).toContain('ORDER_MODE_INVALID');
    expect(ERROR_CODES).toContain('STEP_SEQUENCE_INVALID');
    expect(ERROR_CODES).toContain('METERAI_NOT_IN_FIRST_STEP');
  });
});
