/**
 * Written BEFORE `quota.ts`. Every expected value is hand-derived from
 * `test_2_en.md`:
 *
 *   §A3.5 the signature quota and the meterai quota are SEPARATE; a shortfall
 *         in either is blocked on its own, with a message that distinguishes
 *         the two. Per the Case-2 delta §5 that makes them two stages, not one
 *         branch with two messages.
 *   §B5   order: ... -> meterai-vs-signature -> signature quota -> meterai quota.
 *   §B1   fixtures used below: signature quota 8 (unchanged from Case 1),
 *         meterai quota 3.
 *   §B7.1 Rina 2 sig / 1 met + Budi 1 sig / 0 met -> 3 signatures, 1 meterai:
 *         inside both quotas.
 *   §B7.2 Rina 2 sig / 2 met + Budi 1 sig / 1 met -> 3 meterai, EXACTLY the
 *         quota: allowed, remaining 0.
 *   §B7.3 one more meterai (4 of 3) -> `INSUFFICIENT_METERAI_QUOTA`.
 *
 * The quota numbers are PARAMETERS of every stage factory below. That is
 * ADR-003 restated for Case 2: the kernel is told what the allowance is, it
 * never knows.
 */
import { describe, expect, it } from 'vitest';

import type { ValidationFailure } from '../errors.js';
import { chargePreviewStages, meteraiQuotaStage, quotaStages, signatureQuotaStage } from '../quota.js';
import { validateRecipientList } from '../recipient.js';
import type { RecipientInput } from '../types.js';

/** §B1 fixtures. Values live in the server's account config, never in the kernel. */
const QUOTA = { signature: 8, meterai: 3 };

function signer(
  name: string,
  signature_count: number,
  meterai_count: number,
): RecipientInput {
  return {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
    signature_count,
    meterai_count,
  };
}

function failureOf(result: ValidationFailure | null): ValidationFailure {
  if (result === null) throw new Error('expected a ValidationFailure, got null');
  return result;
}

function check(recipients: readonly RecipientInput[], quota = QUOTA): ValidationFailure | null {
  return validateRecipientList(recipients, chargePreviewStages(quota));
}

describe('the §B5 validation order is data, not an if-chain (seam S3)', () => {
  /**
   * P2 INSERTED three stages into this array — `order-mode` at the head, and
   * the two step rules around `meterai-vs-signature` — exactly where §B5 puts
   * them. Nothing P1 registered was renamed, removed or reordered: the six
   * names below still appear in the same relative order they did, which is the
   * property this assertion has always been about.
   */
  it('registers the P1 stages in exactly the brief’s order', () => {
    expect(chargePreviewStages(QUOTA).map((stage) => stage.name)).toEqual([
      'order-mode',
      'count',
      'per-recipient',
      'duplicates',
      'step-structure',
      'meterai-vs-signature',
      'meterai-step-placement',
      'signature-quota',
      'meterai-quota',
    ]);
  });

  it('keeps the P1 stages in their P1 relative order', () => {
    const p1 = [
      'count',
      'per-recipient',
      'duplicates',
      'meterai-vs-signature',
      'signature-quota',
      'meterai-quota',
    ];
    expect(
      chargePreviewStages(QUOTA)
        .map((stage) => stage.name)
        .filter((name) => p1.includes(name)),
    ).toEqual(p1);
  });

  it('exposes the two quota stages separately, signature first', () => {
    expect(quotaStages(QUOTA).map((stage) => stage.name)).toEqual([
      'signature-quota',
      'meterai-quota',
    ]);
    expect(signatureQuotaStage(QUOTA).name).toBe('signature-quota');
    expect(meteraiQuotaStage(QUOTA).name).toBe('meterai-quota');
  });
});

describe('signature quota — Case-1 behaviour, unchanged (§B7.21 regression)', () => {
  it('accepts the §B7.1 list: 3 of 8 signatures', () => {
    expect(check([signer('Rina Halim', 2, 1), signer('Budi Santoso', 1, 0)])).toBeNull();
  });

  it('accepts exactly 8 of 8 — the boundary is inside the quota', () => {
    // 3 + 3 + 2 = 8 signatures, 0 meterai.
    expect(
      check([signer('Rina Halim', 3, 0), signer('Budi Santoso', 3, 0), signer('Citra Dewi', 2, 0)]),
    ).toBeNull();
  });

  it('refuses 9 of 8 with the Case-1 message, word for word', () => {
    const failure = failureOf(
      check([signer('Rina Halim', 3, 0), signer('Budi Santoso', 3, 0), signer('Citra Dewi', 3, 0)]),
    );
    expect(failure.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    expect(failure.message).toBe('9 of 8 signatures - 1 over your quota');
  });

  it('reads the allowance from the record it is given, never from a constant', () => {
    const list = [signer('Rina Halim', 2, 0)];
    expect(check(list, { signature: 2, meterai: 3 })).toBeNull();
    expect(failureOf(check(list, { signature: 1, meterai: 3 })).code).toBe(
      'INSUFFICIENT_SIGNATURE_QUOTA',
    );
    expect(failureOf(check(list, { signature: 1, meterai: 3 })).message).toBe(
      '2 of 1 signatures - 1 over your quota',
    );
  });
});

describe('meterai quota — independent of the signature quota (§A3.5)', () => {
  it('accepts the §B7.1 list: 1 of 3 meterai', () => {
    expect(check([signer('Rina Halim', 2, 1), signer('Budi Santoso', 1, 0)])).toBeNull();
  });

  it('accepts §B7.2 — 3 of 3 meterai, exactly at the quota, is ALLOWED', () => {
    expect(check([signer('Rina Halim', 2, 2), signer('Budi Santoso', 1, 1)])).toBeNull();
  });

  it('refuses §B7.3 — one more meterai, 4 of 3', () => {
    const failure = failureOf(check([signer('Rina Halim', 2, 2), signer('Budi Santoso', 2, 2)]));
    expect(failure.code).toBe('INSUFFICIENT_METERAI_QUOTA');
    expect(failure.message).toBe('4 of 3 eMeterai - 1 over your eMeterai quota');
  });

  it('names eMeterai and never signatures, so the two shortfalls are told apart', () => {
    const meteraiFailure = failureOf(
      check([signer('Rina Halim', 2, 2), signer('Budi Santoso', 2, 2)]),
    );
    expect(meteraiFailure.message).toContain('eMeterai');
    expect(meteraiFailure.message).not.toContain('signature');

    const signatureFailure = failureOf(
      check([signer('Rina Halim', 3, 0), signer('Budi Santoso', 3, 0), signer('Citra Dewi', 3, 0)]),
    );
    expect(signatureFailure.message).toContain('signatures');
    expect(signatureFailure.message).not.toContain('eMeterai');
    expect(signatureFailure.code).not.toBe(meteraiFailure.code);
  });

  it('reads the allowance from the record it is given, never from a constant', () => {
    const list = [signer('Rina Halim', 2, 2)];
    expect(check(list, { signature: 8, meterai: 2 })).toBeNull();
    expect(failureOf(check(list, { signature: 8, meterai: 1 })).code).toBe(
      'INSUFFICIENT_METERAI_QUOTA',
    );
    expect(failureOf(check(list, { signature: 8, meterai: 1 })).message).toBe(
      '2 of 1 eMeterai - 1 over your eMeterai quota',
    );
  });
});

describe('the two quotas fail independently (§A3.5, delta §5.1)', () => {
  it('blocks on signatures alone while meterai is comfortably inside', () => {
    // 9 signatures of 8; 1 meterai of 3.
    const failure = failureOf(
      check([signer('Rina Halim', 3, 1), signer('Budi Santoso', 3, 0), signer('Citra Dewi', 3, 0)]),
    );
    expect(failure.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
  });

  it('blocks on meterai alone while signatures are comfortably inside', () => {
    // 4 signatures of 8; 4 meterai of 3.
    const failure = failureOf(check([signer('Rina Halim', 2, 2), signer('Budi Santoso', 2, 2)]));
    expect(failure.code).toBe('INSUFFICIENT_METERAI_QUOTA');
  });

  it('reports the signature quota first when BOTH are exceeded (§B5 order)', () => {
    // 4 recipients at 3 sig / 3 met: 12 signatures of 8 AND 12 meterai of 3.
    const failure = failureOf(
      check([
        signer('Rina Halim', 3, 3),
        signer('Budi Santoso', 3, 3),
        signer('Citra Dewi', 3, 3),
        signer('Dewi Lestari', 3, 3),
      ]),
    );
    expect(failure.code).toBe('INSUFFICIENT_SIGNATURE_QUOTA');
    expect(failure.message).toBe('12 of 8 signatures - 4 over your quota');
  });

  it('reports meterai-vs-signature before either quota (§B5 order)', () => {
    // Rina 1 sig / 2 met is the row rule; Budi 8 signatures would also blow the
    // signature quota. The earlier stage must win.
    const failure = failureOf(check([signer('Rina Halim', 1, 2), signer('Budi Santoso', 8, 0)]));
    expect(failure.code).toBe('METERAI_EXCEEDS_SIGNATURE');
    expect(failure.details?.recipient_index).toBe(0);
  });

  it('reports a duplicate email before either quota (§B7.21 regression)', () => {
    const failure = failureOf(
      check([signer('Rina Halim', 3, 1), { ...signer('Rina Again', 3, 1), email: 'rina.halim@example.test' }, signer('Citra Dewi', 3, 1)]),
    );
    expect(failure.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
  });
});

describe('a quota stage is usable on its own', () => {
  it('runs the meterai stage without the signature stage', () => {
    const overMeterai = [signer('Rina Halim', 2, 2), signer('Budi Santoso', 2, 2)];
    expect(meteraiQuotaStage(QUOTA).run(overMeterai)?.code).toBe('INSUFFICIENT_METERAI_QUOTA');
    expect(signatureQuotaStage(QUOTA).run(overMeterai)).toBeNull();
  });

  it('treats an absent meterai_count as 0 when totalling (§B1 default)', () => {
    const legacy = [
      { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 3 },
      { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 3 },
    ] as RecipientInput[];
    expect(meteraiQuotaStage({ signature: 8, meterai: 0 }).run(legacy)).toBeNull();
  });
});
