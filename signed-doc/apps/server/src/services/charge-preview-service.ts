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
 *  10. `signature-quota`                            -> `422 INSUFFICIENT_SIGNATURE_QUOTA`
 *  11. `meterai-quota`                              -> `422 INSUFFICIENT_METERAI_QUOTA`
 *
 * Stages 7 and 9 are VACUOUS in `parallel` (§A3.4: parallel is a single step),
 * so the pipeline's shape does not vary by mode even though its verdicts do.
 * What does vary by mode is the accepted payload — see `chargePreviewAllowList`.
 *
 * Steps 10 and 11 are two stages rather than one branch because §A3.5 requires
 * the two allowances to fail INDEPENDENTLY, with messages that distinguish
 * them. Both are built by the kernel from the allowance this service is
 * injected with — the kernel is told the number, it never sources it (ADR-003).
 *
 * There is deliberately no `if` in this file for any of steps 3-11. A
 * hand-rolled quota check here would be a second place the §B5 order lives, and
 * the two would drift the first time a stage is inserted between them — P2's
 * step rules landed in the MIDDLE of that list (7 and 9, not appended), and
 * P3's reconciliation belongs between 9 and 10.
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
 */

import {
  chargePreviewStages,
  computeCharges,
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
 * `meterai_count` joined the recipient list for Case 2 (§B4). Note that nothing
 * about any of this is a type error: the allow-list is strings, so forgetting a
 * single entry would compile cleanly and reject every Case-2 payload with
 * `UNKNOWN_FIELD`. The route suite pins each one.
 */
export type AllowListFor = (body: Readonly<Record<string, unknown>>) => RequestAllowList;

const RECIPIENT_KEYS = ['name', 'email', 'signature_count', 'meterai_count'] as const;

export const chargePreviewAllowList: AllowListFor = (body) => ({
  root: ['order_mode', 'recipients'],
  recipient:
    orderModeOf(body['order_mode']) === 'sequential'
      ? [...RECIPIENT_KEYS, 'step']
      : [...RECIPIENT_KEYS],
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
 * Stage 1. Walks the body's own keys at both levels and refuses the first one
 * outside the allow-list, naming it in `details.field` so the client can point
 * at the offending property instead of guessing.
 *
 * A body that is not an object has no keys to reject and passes here; it is
 * refused by stage 3, which finds no recipient list.
 */
function checkPayloadShape(body: unknown, allow: RequestAllowList): void {
  if (!isPlainObject(body)) return;

  for (const key of Object.keys(body)) {
    if (!allow.root.includes(key)) unknownField(key);
  }

  const recipients = body['recipients'];
  if (!Array.isArray(recipients)) return;

  recipients.forEach((recipient: unknown, index: number) => {
    if (!isPlainObject(recipient)) return;
    for (const key of Object.keys(recipient)) {
      if (!allow.recipient.includes(key)) unknownField(`recipients[${index}].${key}`);
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

      // 3-11. The whole of §B5 from `order_mode` on, as one short-circuiting
      //       stage list (`LD-24`, seam S3). The account's allowances are handed
      //       to the kernel here; the kernel never sources them.
      //
      //       The mode goes in RAW, not resolved: judging it is the `order-mode`
      //       stage's job, and a resolved `OrderMode` could never be invalid.
      //       Passing the quota alone would compile cleanly and silently make
      //       every request `parallel`, which is to say: it would turn all three
      //       P2 rules into dead code.
      const recipients = isPlainObject(body) ? body['recipients'] : undefined;
      const rawOrderMode = isPlainObject(body) ? body['order_mode'] : undefined;
      const failure = validateRecipientList(
        recipients,
        chargePreviewStages(account.quotas, rawOrderMode),
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
