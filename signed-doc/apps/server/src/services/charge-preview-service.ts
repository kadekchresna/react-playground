/**
 * The charge-preview use case (PRD §8.4, §8.9, §9).
 *
 * This is where the server's total becomes final. The frontend's number is a
 * responsive estimate; anything the client sends for price, total or quota is
 * not merely ignored, it is a hard rejection (PRD §9).
 *
 * The validation order is FIXED by PRD §9 and is the contract, not an
 * implementation detail. It is written out as five numbered steps below and
 * asserted by construction in the route suite — a request that violates two
 * rules at once must fail on the earlier one:
 *
 *   1. payload shape   — strict key allow-list      -> `422 UNKNOWN_FIELD`
 *   2. envelope exists                              -> `404 ENVELOPE_NOT_FOUND`
 *   3. per-recipient, index order, `signature_count`
 *      then `name` then `email`, first failure wins -> `422 RECIPIENT_COUNT_INVALID`
 *                                                      / `SIGNATURE_COUNT_INVALID`
 *                                                      / `RECIPIENT_INVALID`
 *   4. duplicate emails, trimmed + case-insensitive -> `422 DUPLICATE_RECIPIENT_EMAIL`
 *   5. quota                                        -> `422 INSUFFICIENT_SIGNATURE_QUOTA`
 *
 * Steps 3 and 4 are the shared kernel's own stage pipeline (`seam S3`), so the
 * frontend marks exactly the rows the server would refuse.
 *
 * Stateless with respect to recipients (`LD-20`): nothing is written, so the
 * call is idempotent and safe from two tabs at once. It consumes no quota —
 * Case 1 never changes quota (`LD-18`), `quota_remaining` is computed per call.
 *
 * `signature_count` is judged by the kernel's STRICT predicate. The kernel's
 * coercing counterpart is a frontend affordance and is deliberately absent from
 * this package: a hostile `"abc"` must be refused, never quietly repaired.
 */

import {
  computeCharges,
  formatDecimalString,
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
 * Case 1 has one accepted shape, so this ignores its argument and returns the
 * same list every time — the behaviour is identical to a constant. The shape is
 * what matters: a later mode in which a key is legal in one mode and rejected
 * in another becomes a branch inside this function, with no change to the stage
 * that consumes it and no change to any caller.
 */
export type AllowListFor = (body: Readonly<Record<string, unknown>>) => RequestAllowList;

export const chargePreviewAllowList: AllowListFor = () => ({
  root: ['recipients'],
  recipient: ['name', 'email', 'signature_count'],
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

      // 3 + 4. Count, then per-recipient in index order, then duplicates —
      //        short-circuiting on the first failure (`LD-24`, seam S3).
      const recipients = isPlainObject(body) ? body['recipients'] : undefined;
      const failure = validateRecipientList(recipients);
      if (failure) throw unprocessable(failure);

      const list = recipients as readonly RecipientInput[];

      // Exact `bigint` arithmetic throughout; the only float-free path there is.
      const breakdown = computeCharges(list, account.prices);
      const balance = quotaRemaining({ signature: breakdown.totalSignatures }, account.quotas);

      // 5. Quota. Last, so an over-quota list with a bad email reports the email.
      if (balance.signature.overBy > 0) {
        throw unprocessable(
          validationFailure(
            'INSUFFICIENT_SIGNATURE_QUOTA',
            `${breakdown.totalSignatures} of ${account.quotas.signature} signatures - ` +
              `${balance.signature.overBy} over your quota`,
          ),
        );
      }

      return {
        recipient_count: list.length,
        total_signatures: breakdown.totalSignatures,
        price: { signature: formatDecimalString(account.prices.signature) },
        charges: { signature: formatDecimalString(breakdown.charges.signature) },
        total_charge: formatDecimalString(breakdown.totalChargeMinor),
        quota: { signature: account.quotas.signature },
        quota_remaining: { signature: balance.signature.remaining },
      };
    },
  };
}
