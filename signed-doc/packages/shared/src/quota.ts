/**
 * Quota stages — the last two entries in `test_2_en.md` §B5's validation order.
 *
 * They live in their own module for one reason: they are the ONLY rules in this
 * package that need a commercial value to decide anything. ADR-003 says the
 * kernel never knows a price or an allowance, so each stage is built by a
 * factory that is TOLD the allowance and closes over it. The boundary is then
 * visible in the file list rather than buried in a parameter somewhere.
 *
 * Two independent stages, not one branch (§A3.5, Case-2 delta §5.1):
 *
 *   - signatures and meterai are separate resources with separate allowances;
 *   - a shortfall in either is blocked on its own, with its own code and a
 *     message that names that resource and no other;
 *   - signatures are checked first, so a list that busts both reports the
 *     signature quota — the same resource Case 1 reported.
 *
 * The signature stage's message is Case 1's, word for word
 * (`9 of 8 signatures - 1 over your quota`): moving the check from the server
 * into the kernel must not change a single byte the user can see (§B7.21).
 */

import { validationFailure } from './errors.js';
import { quotaRemaining, type QuotaTable } from './pricing.js';
import {
  RECIPIENT_LIST_STAGES,
  meteraiCountOf,
  signatureCountOf,
  type RecipientListStage,
} from './recipient.js';
import type { RecipientInput } from './types.js';

/** What a list asks for, totalled the same lenient way pricing totals it. */
function usageOf(recipients: readonly RecipientInput[]): { signature: number; meterai: number } {
  let signature = 0;
  let meterai = 0;
  for (const r of recipients) {
    signature += signatureCountOf(r);
    meterai += meteraiCountOf(r);
  }
  return { signature, meterai };
}

/**
 * `INSUFFICIENT_SIGNATURE_QUOTA` when the list asks for more signatures than
 * the account allows. Exactly at the allowance is inside it, never a failure.
 */
export function signatureQuotaStage(quota: QuotaTable): RecipientListStage {
  return {
    name: 'signature-quota',
    run: (recipients) => {
      const used = usageOf(recipients);
      const { signature } = quotaRemaining(used, quota);
      return signature.overBy > 0
        ? validationFailure(
            'INSUFFICIENT_SIGNATURE_QUOTA',
            `${used.signature} of ${quota.signature} signatures - ` +
              `${signature.overBy} over your quota`,
          )
        : null;
    },
  };
}

/**
 * `INSUFFICIENT_METERAI_QUOTA` when the list asks for more duty stamps than the
 * account allows (§B7.3). Exactly at the allowance is ALLOWED — §B7.2's three
 * meterai against a quota of three is a pass, not a boundary failure.
 *
 * The message names eMeterai and never signatures, which is how §A3.5's
 * "distinguishes the two" is satisfied in words as well as in the code.
 */
export function meteraiQuotaStage(quota: QuotaTable): RecipientListStage {
  return {
    name: 'meterai-quota',
    run: (recipients) => {
      const used = usageOf(recipients);
      const { meterai } = quotaRemaining(used, quota);
      return meterai.overBy > 0
        ? validationFailure(
            'INSUFFICIENT_METERAI_QUOTA',
            `${used.meterai} of ${quota.meterai} eMeterai - ` +
              `${meterai.overBy} over your eMeterai quota`,
          )
        : null;
    },
  };
}

/** Both quota stages, signatures first (§B5). */
export function quotaStages(quota: QuotaTable): readonly RecipientListStage[] {
  return [signatureQuotaStage(quota), meteraiQuotaStage(quota)];
}

/**
 * The complete P1 validation order of §B5, as data:
 *
 *   count -> per recipient -> duplicate emails -> meterai-vs-signature
 *   -> signature quota -> meterai quota
 *
 * `RECIPIENT_LIST_STAGES` supplies the prefix that needs no allowance; this
 * function appends the two that do. The steps §B5 lists before them — payload
 * shape and envelope existence — are the server's, because only the server has
 * a request and a store; the kernel owns everything from the recipient list on.
 *
 * The P2/P3 stages (`order_mode`, step structure, meterai step placement, field
 * shape and reconciliation) belong between these entries when they are built;
 * adding them is an insertion into this array.
 */
export function chargePreviewStages(quota: QuotaTable): readonly RecipientListStage[] {
  return [...RECIPIENT_LIST_STAGES, ...quotaStages(quota)];
}
