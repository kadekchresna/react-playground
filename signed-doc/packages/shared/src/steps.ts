/**
 * Signing order — `test_2_en.md` §A2, §A3.3/§A3.4, §B4 and §B5 (Case 2, P2).
 *
 * One module for everything that depends on the MODE, because the mode is what
 * makes the rest of this file mean anything:
 *
 *   - in `parallel` (the default, and exactly the Case-1 behaviour) every rule
 *     here is VACUOUS. §A3.4 settles it: parallel counts as a single step, so
 *     there is no order to be wrong about and no step 2 for a duty stamp to
 *     stray into. A `step` reaching the server in parallel is `UNKNOWN_FIELD`,
 *     which is the request allow-list's job, not a rule in this file.
 *   - in `sequential` the step numbers are a structure in their own right:
 *     contiguous from 1 (§A2.3), shareable (§A2.2), and renormalized back to
 *     contiguous when deletion empties a step (§A2.4).
 *
 * That is why every function below takes the mode EXPLICITLY, with no default.
 * A caller that has not decided which mode it is in cannot ask a meaningful
 * question about steps, and making them say so at the call site is cheaper than
 * discovering a silently vacuous check in production.
 *
 * The Case-1 asymmetry is repeated once more: `isValidStep` (backend) refuses
 * without coercion, while `stepOf` (arithmetic and grouping) is lenient and
 * reads anything malformed as step 1 — a row can be mid-edit in the browser,
 * and a projection must never produce `NaN` as a group key. The row is
 * separately refused by `validateStepSequence`.
 *
 * Nothing here knows a price or an allowance (ADR-003); nothing here is about
 * fields (P3) or tokens (P4).
 */

import { validationFailure, type ValidationFailure } from './errors.js';
import {
  meteraiCountOf,
  normalizeEmail,
  type RecipientListStage,
} from './recipient.js';
import type { OrderMode, RecipientInput, StepGroup } from './types.js';

export type { OrderMode, StepGroup } from './types.js';

/** §A2: the two modes, default first. */
export const ORDER_MODES = ['parallel', 'sequential'] as const satisfies readonly OrderMode[];

/** §A2: `parallel` is the default — it IS the Case-1 behaviour. */
export const DEFAULT_ORDER_MODE: OrderMode = 'parallel';

/** §A2.1/§A2.3: steps are whole numbers starting here. */
export const FIRST_STEP = 1;

/**
 * Backend rule: one of the two mode strings, exactly. No trimming, no case
 * folding — `order_mode` is an enum on the wire, not user prose, so `"Parallel"`
 * is a client bug worth reporting rather than a typo worth repairing.
 *
 * `undefined` is false here for the same reason `isValidMeteraiCount(undefined)`
 * is: absence is the caller's documented default, not a valid value. The default
 * is applied one level up, by `orderModeOf` and `validateOrderMode`.
 */
export function isOrderMode(raw: unknown): raw is OrderMode {
  return raw === 'parallel' || raw === 'sequential';
}

/**
 * The mode as the rest of the kernel can use it: `sequential` only when that is
 * exactly what was asked for, `parallel` for absence and for anything
 * malformed. A malformed mode is separately refused by `validateOrderMode`;
 * this reader exists so no projection has to carry a third state.
 */
export function orderModeOf(raw: unknown): OrderMode {
  return raw === 'sequential' ? 'sequential' : DEFAULT_ORDER_MODE;
}

/**
 * §A2 / §B5 — `ORDER_MODE_INVALID`.
 *
 * An ABSENT `order_mode` passes: a Case-1 payload carries no mode and means
 * `parallel`, and §A2 names `parallel` the default rather than requiring the
 * key. Present-but-wrong is a rejection, never a silent fallback.
 *
 * Carries no `details`: the mode is a request-level field, so there is no row
 * for the frontend to mark (contrast `METERAI_EXCEEDS_SIGNATURE`, which names
 * one).
 */
export function validateOrderMode(raw: unknown): ValidationFailure | null {
  if (raw === undefined || isOrderMode(raw)) return null;
  return validationFailure('ORDER_MODE_INVALID', 'order_mode must be "parallel" or "sequential"');
}

/** Backend rule: a whole number >= 1 and nothing else (§A2.1). `"2"` is false. */
export function isValidStep(raw: unknown): boolean {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= FIRST_STEP;
}

/**
 * A row's step as grouping and renormalization can use it.
 *
 * Same contract as `signatureCountOf`/`meteraiCountOf`: anything malformed or
 * absent reads as the default — here `FIRST_STEP`, which is also what §A3.4
 * says a parallel document has. The row is separately refused by
 * `validateStepSequence`.
 */
export function stepOf(r: RecipientInput): number {
  const step = (r as Partial<RecipientInput> | null)?.step;
  return isValidStep(step) ? (step as number) : FIRST_STEP;
}

function asList(rs: readonly RecipientInput[]): readonly RecipientInput[] {
  return Array.isArray(rs) ? rs : [];
}

/**
 * §A2.3 / §B7.7 — the step numbers of a `sequential` list must be contiguous
 * from 1. Shared steps are legal and are the point (§A2.2), so what must be
 * contiguous is the SET of distinct steps, not the sequence of rows: `[1,1,2,3]`
 * passes, `[3,1,2,1]` passes, `[1,3]`, `[2,3]` and `[0,1]` do not.
 *
 * Two shapes of failure under one code, because §B7.7 gives one code for all
 * three of its examples and `[0,1]` is in that list:
 *
 *   - a row whose `step` is absent or not a whole number >= 1 — reported with
 *     `details.recipient_index`, because one row is at fault;
 *   - a gap or a start above 1 — reported with no index, because no single row
 *     is at fault and marking one would be a lie.
 *
 * Vacuous in `parallel` (§A3.4).
 */
export function validateStepSequence(
  recipients: readonly RecipientInput[],
  mode: OrderMode,
): ValidationFailure | null {
  if (mode !== 'sequential') return null;

  const list = asList(recipients);
  const steps: number[] = [];

  for (let index = 0; index < list.length; index += 1) {
    const step = (list[index] as Partial<RecipientInput> | null)?.step;
    if (!isValidStep(step)) {
      return validationFailure(
        'STEP_SEQUENCE_INVALID',
        `step must be a whole number of ${FIRST_STEP} or more`,
        { recipient_index: index },
      );
    }
    steps.push(step as number);
  }

  if (steps.length === 0) return null;

  const distinct = [...new Set(steps)].sort((a, b) => a - b);
  const contiguous = distinct.every((step, position) => step === position + FIRST_STEP);

  return contiguous
    ? null
    : validationFailure(
        'STEP_SEQUENCE_INVALID',
        `Step numbers must be contiguous starting at ${FIRST_STEP} - got ${distinct.join(', ')}`,
      );
}

/**
 * §A3.3 / §B7.6 — a recipient carrying eMeterai may only be in step 1.
 *
 * Affixing a duty stamp produces a single stamped version of the document, and
 * that has to happen before the signing chain starts; a carrier in step 2 or
 * later makes the document invalid.
 *
 * Vacuous in `parallel` (§A3.4: parallel IS a single step, so the rule has
 * nothing to bind on). The failure names ONE recipient — by index for the row
 * and by normalized email for the message — because §A3.3 requires the reason
 * to appear on screen pointing at that recipient, not at the whole form.
 */
export function validateMeteraiStepPlacement(
  recipients: readonly RecipientInput[],
  mode: OrderMode,
): ValidationFailure | null {
  if (mode !== 'sequential') return null;

  const list = asList(recipients);

  for (let index = 0; index < list.length; index += 1) {
    const r = list[index] as RecipientInput;
    if (meteraiCountOf(r) === 0) continue;

    const step = stepOf(r);
    if (step === FIRST_STEP) continue;

    const email = normalizeEmail((r as Partial<RecipientInput>)?.email as string);
    return validationFailure(
      'METERAI_NOT_IN_FIRST_STEP',
      `${email} carries eMeterai but is in step ${step} - a duty stamp is affixed before ` +
        `the signing chain starts, so only step ${FIRST_STEP} may carry eMeterai`,
      { recipient_index: index, recipient_email: email },
    );
  }

  return null;
}

/**
 * §A2.4 / §B7.8 — collapse the step numbers back to contiguous from 1, keeping
 * every other field of every recipient exactly as it was.
 *
 * Pure: a new array, with each row's object reused unless its step actually
 * moves, so a React list keeps its identities where nothing changed. The
 * frontend calls this after a delete, so the UI never displays a state the
 * server would reject (`[1,2,2,3]` minus step 1's sole member -> `[1,1,2]`).
 *
 * `mode` is REQUIRED and the function is a no-op in `parallel`. That is not
 * ceremony: parallel rows carry no `step`, and renormalizing them would write
 * `step: 1` onto every row, which the server then refuses as `UNKNOWN_FIELD`
 * (§B4). The guard belongs here, once, rather than at every call site.
 *
 * Generic in the row type so the frontend can renormalize its own richer rows
 * (local id, in-progress text) without losing them on the way through.
 */
export function renormalizeSteps<T extends RecipientInput>(
  recipients: readonly T[],
  mode: OrderMode,
): T[] {
  const list = Array.isArray(recipients) ? [...recipients] : [];
  if (mode !== 'sequential') return list;

  const distinct = [...new Set(list.map((r) => stepOf(r)))].sort((a, b) => a - b);
  const rank = new Map<number, number>(distinct.map((step, position) => [step, position + FIRST_STEP]));

  return list.map((r) => {
    const next = rank.get(stepOf(r)) ?? FIRST_STEP;
    return r.step === next ? r : ({ ...r, step: next } as T);
  });
}

/**
 * §B4 — the `steps` projection: `[{ step, recipient_emails }]`, ordered by step
 * ascending, and inside a step in row order so the UI's grouped view and the
 * server's response agree on who is where.
 *
 * In `parallel` this is ONE group holding everyone, numbered `1`: §A3.4 says
 * parallel counts as a single step, and a response that said otherwise would
 * contradict the rule the meterai placement check is built on. An empty list
 * projects to no groups at all — there is no document to describe.
 *
 * Emails are normalized (trim + lowercase) exactly as every other comparison in
 * this kernel normalizes them, so the projection and the duplicate check can
 * never disagree about who two rows are.
 */
export function groupByStep(
  recipients: readonly RecipientInput[],
  mode: OrderMode,
): readonly StepGroup[] {
  const list = asList(recipients);
  if (list.length === 0) return [];

  const byStep = new Map<number, string[]>();
  for (const r of list) {
    const step = mode === 'sequential' ? stepOf(r) : FIRST_STEP;
    const email = normalizeEmail((r as Partial<RecipientInput>)?.email as string);
    const bucket = byStep.get(step);
    if (bucket) bucket.push(email);
    else byStep.set(step, [email]);
  }

  return [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, recipient_emails]) => ({ step, recipient_emails }));
}

/**
 * §B5 stage 3 — `order_mode`, before any recipient rule.
 *
 * Takes the RAW value off the request rather than an `OrderMode`, because the
 * whole point of the stage is to judge something that may not be one. Ignores
 * the recipient list: this is the one stage in the pipeline that is about the
 * request, not the rows.
 */
export function orderModeStage(raw: unknown): RecipientListStage {
  return {
    name: 'order-mode',
    run: () => validateOrderMode(raw),
  };
}

/** §B5 — step structure, between duplicate emails and meterai-vs-signature. */
export function stepStructureStage(mode: OrderMode): RecipientListStage {
  return {
    name: 'step-structure',
    run: (recipients) => validateStepSequence(recipients, mode),
  };
}

/** §B5 — meterai step placement, immediately after meterai-vs-signature. */
export function meteraiStepPlacementStage(mode: OrderMode): RecipientListStage {
  return {
    name: 'meterai-step-placement',
    run: (recipients) => validateMeteraiStepPlacement(recipients, mode),
  };
}
