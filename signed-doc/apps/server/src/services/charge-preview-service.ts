/**
 * The charge-preview use case (PRD §8.4, §8.9, §9).
 *
 * This is where the server's total becomes final. The frontend's number is a
 * responsive estimate; anything the client sends for price, total or quota is
 * not merely ignored, it is a hard rejection (PRD §9).
 *
 * The validation order is FIXED — by PRD §9 for Case 1 and by `test_2_en.md`
 * §B5 for Case 2 — and it is the contract, not an implementation detail. Only
 * the first two steps are this file's; everything from the recipient list on is
 * the kernel's stage pipeline (`seam S3`), composed by `chargePreviewStages`:
 *
 *   1. payload shape   — strict key allow-list      -> `422 UNKNOWN_FIELD`
 *   2. envelope exists                              -> `404 ENVELOPE_NOT_FOUND`
 *   -- kernel stages, in §B5's order ------------------------------------------
 *   3. `order-mode` (§A2)                           -> `422 ORDER_MODE_INVALID`
 *   4. `count`                                      -> `422 RECIPIENT_COUNT_INVALID`
 *   5. `per-recipient`, index order, `signature_count`
 *      then `meterai_count` then `name` then `email`-> `422 SIGNATURE_COUNT_INVALID`
 *                                                      / `METERAI_COUNT_INVALID`
 *                                                      / `RECIPIENT_INVALID`
 *   6. `duplicates`, trimmed + case-insensitive     -> `422 DUPLICATE_RECIPIENT_EMAIL`
 *   7. `step-structure` (§A2.3)                     -> `422 STEP_SEQUENCE_INVALID`
 *   8. `meterai-vs-signature` (§A3.2)               -> `422 METERAI_EXCEEDS_SIGNATURE`
 *   9. `meterai-step-placement` (§A3.3)             -> `422 METERAI_NOT_IN_FIRST_STEP`
 *  10. `field-shape`, identity then page then bounds-> `422 FIELD_ID_DUPLICATE`
 *      (§B2, §B3)                                      / `FIELD_PAGE_INVALID`
 *                                                      / `FIELD_OUT_OF_BOUNDS`
 *  11. `field-reconciliation` (§A4.9-§A4.11)        -> `422 FIELD_UNKNOWN_RECIPIENT`
 *                                                      / `METERAI_NOT_IN_FIRST_STEP`
 *                                                      / `FIELD_COUNT_MISMATCH`
 *  12. `signature-quota`                            -> `422 INSUFFICIENT_SIGNATURE_QUOTA`
 *  13. `meterai-quota`                              -> `422 INSUFFICIENT_METERAI_QUOTA`
 *
 * Stages 7 and 9 are VACUOUS in `parallel` (§A3.4: parallel is a single step),
 * and stages 10 and 11 are VACUOUS when the request carries no `fields` key at
 * all (§B4: absence is the Step-2 preview, where no box has been placed yet), so
 * the pipeline's shape varies with neither the mode nor the payload even though
 * its verdicts do. What does vary by mode is the accepted payload — see
 * `chargePreviewAllowList`.
 *
 * `fields: []` is NOT absence. It is a Step-3 document with nothing placed, and
 * a recipient who promised a signature makes it `FIELD_COUNT_MISMATCH`. The raw
 * value therefore goes to the kernel exactly as it arrived — `undefined` only
 * when the key is genuinely absent — because that distinction is the whole of
 * what separates a Case-1 payload from an empty Step 3.
 *
 * Steps 12 and 13 are two stages rather than one branch because §A3.5 requires
 * the two allowances to fail INDEPENDENTLY, with messages that distinguish
 * them. Both are built by the kernel from the allowance this service is
 * injected with — the kernel is told the number, it never sources it (ADR-003).
 *
 * Reconciliation sits BEFORE both quotas (§B7.10/§B7.11 expect
 * `FIELD_COUNT_MISMATCH` from a list that would also bust an allowance) and
 * AFTER the shape check (a box that is not on the page materializes nothing).
 * Neither of those orderings is restated here; both live in `chargePreviewStages`.
 *
 * There is deliberately no `if` in this file for any of steps 3-13. A
 * hand-rolled quota check here would be a second place the §B5 order lives, and
 * the two would drift the first time a stage is inserted between them — P2's
 * step rules landed in the MIDDLE of that list (7 and 9, not appended), and
 * P3's two field stages landed in the middle again (10 and 11, between the
 * meterai placement rule and the allowances).
 *
 * The order is asserted by construction in the route suite — a request that
 * violates two rules at once must fail on the earlier one.
 *
 * Stateless with respect to recipients (`LD-20`): nothing is written, so the
 * call is idempotent and safe from two tabs at once. It consumes no quota —
 * a preview never changes quota (`LD-18`), both `quota_remaining` figures are
 * computed per call.
 *
 * Both counts are judged by the kernel's STRICT predicates. The kernel's
 * coercing counterparts are frontend affordances and are deliberately absent
 * from this package: a hostile `"abc"` must be refused, never quietly repaired.
 * `clampFieldPosition` is the same kind of affordance and is likewise absent —
 * §B2 is explicit that the UI clamps and the API REJECTS, so an out-of-range
 * coordinate comes back `FIELD_OUT_OF_BOUNDS` and is never quietly moved onto
 * the page. The server imports `isFieldInBounds`'s side of that split only.
 *
 * §A4.12 — THE BILL COMES FROM THE COUNTS, NOT FROM THE FIELDS. `computeCharges`
 * below is handed the recipient list and nothing else, and `field_count` is a
 * report of what arrived rather than an input to any sum. Mismatched fields
 * invalidate the document (step 11); they cannot move a single digit of the
 * total, and there is no code path here through which they could.
 */

import {
  chargePreviewStages,
  computeCharges,
  fieldListOf,
  formatDecimalString,
  groupByStep,
  orderModeOf,
  quotaRemaining,
  validateRecipientList,
  validationFailure,
  type ChargePreviewResponse,
  type RecipientInput,
} from '@signed-doc/shared';

import type { AccountConfig } from '../config/account.js';
import type { EnvelopeStore } from '../store/envelope-store.js';
import { notFound, unprocessable } from './service-error.js';

/**
 * The complete set of property names this endpoint accepts, at each level.
 * Anything outside it is `UNKNOWN_FIELD` — the request is refused rather than
 * having the surplus silently dropped, which is what stops a client-supplied
 * `total_charge` from ever being mistaken for authoritative (PRD §9).
 */
export interface RequestAllowList {
  readonly root: readonly string[];
  readonly recipient: readonly string[];
  /** §B3 — the accepted shape of one entry in `fields` (Case 2, P3). */
  readonly field: readonly string[];
}

/**
 * Seam S4: the allow-list is a FUNCTION of the request, not a module constant.
 *
 * P2 is what the seam was built for, and it pays off here: `step` is legal in
 * `sequential` and `UNKNOWN_FIELD` in `parallel` (§B4, §B7.9), so the accepted
 * SHAPE now depends on a value inside the body. That is one branch inside this
 * function — no change to the stage that consumes the list, and no change to
 * any caller.
 *
 * Two deliberate asymmetries:
 *
 * - `order_mode` is accepted UNCONDITIONALLY. A malformed mode must reach the
 *   `order-mode` stage and come back as `ORDER_MODE_INVALID`; making the key's
 *   acceptance depend on its own value would mask every typo as `UNKNOWN_FIELD`
 *   and tell the client to delete a field §B4 requires.
 * - `step` is accepted only when the mode is exactly `"sequential"`. Absent,
 *   `"parallel"` and anything malformed all mean "no steps here" — §A3.4 makes
 *   parallel a single step, so a `step` in that payload is a key the server has
 *   no rule for, and §B7.9 requires it to be refused rather than ignored. A
 *   malformed mode therefore reports the surplus `step` first; §B5 puts payload
 *   shape ahead of `order_mode`, and the route suite pins that too.
 *
 * `meterai_count` joined the recipient list for Case 2 (§B4), and P3 added a
 * THIRD level: `fields` at the root, plus the six §B3 properties of one field.
 * Unlike `step`, neither depends on the mode — a document is placed on the same
 * page whoever signs first — so the field level is a module constant and the one
 * branch in this function is still P2's.
 *
 * Note that nothing about any of this is a type error: the allow-list is
 * strings, so forgetting a single entry would compile cleanly and reject every
 * Case-2 payload with `UNKNOWN_FIELD` — omitting `'fields'` would answer
 * `422 UNKNOWN_FIELD: fields` to the whole of §B4. The route suite pins each one.
 */
export type AllowListFor = (body: Readonly<Record<string, unknown>>) => RequestAllowList;

const RECIPIENT_KEYS = ['name', 'email', 'signature_count', 'meterai_count'] as const;

/** §B3 — every property of a field, all six required, none of them optional. */
const FIELD_KEYS = ['id', 'kind', 'recipient_email', 'page', 'x', 'y'] as const;

export const chargePreviewAllowList: AllowListFor = (body) => ({
  root: ['order_mode', 'recipients', 'fields'],
  recipient:
    orderModeOf(body['order_mode']) === 'sequential'
      ? [...RECIPIENT_KEYS, 'step']
      : [...RECIPIENT_KEYS],
  field: [...FIELD_KEYS],
});

export interface ChargePreviewService {
  preview(envelopeId: string, body: unknown): ChargePreviewResponse;
}

export interface ChargePreviewServiceDependencies {
  readonly store: EnvelopeStore;
  readonly account: AccountConfig;
  /** Overridable so the accepted surface can vary by request without a rewrite. */
  readonly allowListFor?: AllowListFor;
}

/** A JSON object, as opposed to an array, `null`, or a primitive. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownField(field: string): never {
  throw unprocessable(
    validationFailure('UNKNOWN_FIELD', 'Unknown field is not accepted', { field }),
  );
}

/**
 * Stage 1. Walks the body's own keys at all THREE levels and refuses the first
 * one outside the allow-list, naming it in `details.field` so the client can
 * point at the offending property instead of guessing.
 *
 * Collections are walked root -> `recipients` -> `fields`, which is §B4's own
 * key order, so a payload with a surplus key in both collections reports the
 * recipient one. A collection that is not an array has no entries to walk and
 * is left to the rules: a missing `recipients` is refused by stage 4, and a
 * `fields` that is present but not an array is read as an empty list and
 * refused by stage 11 (it materializes none of the promised boxes).
 *
 * A body that is not an object has no keys to reject and passes here; it is
 * refused by stage 4, which finds no recipient list.
 */
function checkPayloadShape(body: unknown, allow: RequestAllowList): void {
  if (!isPlainObject(body)) return;

  for (const key of Object.keys(body)) {
    if (!allow.root.includes(key)) unknownField(key);
  }

  checkEntryShapes(body['recipients'], allow.recipient, 'recipients');
  checkEntryShapes(body['fields'], allow.field, 'fields');
}

/** One collection's entries against one allow-list, reported as `<name>[i].<key>`. */
function checkEntryShapes(
  collection: unknown,
  allow: readonly string[],
  name: string,
): void {
  if (!Array.isArray(collection)) return;

  collection.forEach((entry: unknown, index: number) => {
    if (!isPlainObject(entry)) return;
    for (const key of Object.keys(entry)) {
      if (!allow.includes(key)) unknownField(`${name}[${index}].${key}`);
    }
  });
}

export function createChargePreviewService({
  store,
  account,
  allowListFor = chargePreviewAllowList,
}: ChargePreviewServiceDependencies): ChargePreviewService {
  return {
    preview(envelopeId, body) {
      // 1. Payload shape. Runs before the envelope lookup, so a body that is
      //    both malformed and aimed at a missing envelope reports the payload.
      checkPayloadShape(body, allowListFor(isPlainObject(body) ? body : {}));

      // 2. The envelope must exist. Runs before any recipient rule, so a
      //    request for a missing envelope reports `404` even when its recipient
      //    list is also invalid.
      if (store.findById(envelopeId) === undefined) {
        throw notFound(validationFailure('ENVELOPE_NOT_FOUND', 'Envelope not found'));
      }

      // 3-13. The whole of §B5 from `order_mode` on, as one short-circuiting
      //       stage list (`LD-24`, seam S3). The account's allowances are handed
      //       to the kernel here; the kernel never sources them.
      //
      //       The mode and the fields both go in RAW, not resolved: judging them
      //       is the stages' job, and a resolved value could never be invalid.
      //       Passing the quota alone would compile cleanly and silently make
      //       every request `parallel`, which is to say: it would turn all three
      //       P2 rules into dead code. Dropping the third argument does exactly
      //       the same thing to all of P3 — the field stages become vacuous and
      //       the server answers `200` to every one of §B7 rows 10-18. Both
      //       omissions typecheck, so the route suite is what pins them.
      //
      //       `undefined` here means ABSENT, not empty: `body['fields']` is read
      //       straight off the body so an explicit `fields: []` stays a real
      //       Step 3 (§B4) instead of collapsing into a Step-2 preview.
      const recipients = isPlainObject(body) ? body['recipients'] : undefined;
      const rawOrderMode = isPlainObject(body) ? body['order_mode'] : undefined;
      const rawFields = isPlainObject(body) ? body['fields'] : undefined;
      const failure = validateRecipientList(
        recipients,
        chargePreviewStages(account.quotas, rawOrderMode, rawFields),
      );
      if (failure) throw unprocessable(failure);

      const list = recipients as readonly RecipientInput[];
      // Past the `order-mode` stage the raw value is known to be a mode or
      // absent, so resolving it here can only produce what the client asked for.
      const orderMode = orderModeOf(rawOrderMode);

      // Exact `bigint` arithmetic throughout; the only float-free path there is.
      // Nothing below can fail — every rule has already run — so this is pure
      // projection onto the wire shape of §B4.
      const breakdown = computeCharges(list, account.prices);
      const balance = quotaRemaining(
        { signature: breakdown.totalSignatures, meterai: breakdown.totalMeterai },
        account.quotas,
      );

      return {
        // §B4. Echoed back RESOLVED and always accompanied by `steps`, so a
        // client never has to infer the default or branch on the mode to learn
        // who signs with whom: in `parallel` the projection is the single group
        // §A3.4 says a parallel document is.
        order_mode: orderMode,
        steps: groupByStep(list, orderMode),
        recipient_count: list.length,
        total_signatures: breakdown.totalSignatures,
        total_meterai: breakdown.totalMeterai,
        // §B4 — what the accepted request CARRIED, never what the counts
        // required. Past stage 11 the two agree, so this is a confirmation that
        // the server read the same collection the client sent; `0` for a payload
        // with no `fields` key, which is every Case-1, P1 and P2 request. It is
        // reported, not priced (§A4.12).
        field_count: fieldListOf(rawFields).length,
        price: {
          signature: formatDecimalString(account.prices.signature),
          meterai: formatDecimalString(account.prices.meterai),
        },
        // Two priced lines, summed independently and shown separately (§A3.7).
        charges: {
          signature: formatDecimalString(breakdown.charges.signature),
          meterai: formatDecimalString(breakdown.charges.meterai),
        },
        total_charge: formatDecimalString(breakdown.totalChargeMinor),
        quota: { signature: account.quotas.signature, meterai: account.quotas.meterai },
        quota_remaining: {
          signature: balance.signature.remaining,
          meterai: balance.meterai.remaining,
        },
      };
    },
  };
}
