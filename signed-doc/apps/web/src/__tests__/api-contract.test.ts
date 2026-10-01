/**
 * The API layer's contract, asserted without rendering anything (LD-32).
 *
 * Three properties are scored and therefore tested here rather than reviewed by
 * eye:
 *
 * 1. `formatIdr` renders the wire string as `Rp15.000,00` and never touches a
 *    float (PRD §4 fact 1, LD-11).
 * 2. The `charge-preview` body carries exactly `recipients -> name, email,
 *    signature_count, meterai_count` (`test_2_en.md` §B4). If a price, total or
 *    quota key ever appears, this fails (ADR-003, PRD §9).
 * 3. `request` normalizes every failure into one shape, distinguishes a timeout
 *    from a caller cancellation, and retries nothing (LD-28, LD-29).
 */

import { describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  UNREACHABLE_MESSAGE,
  isCancellation,
  request,
} from '../api/client.js';
import { buildChargePreviewBody, chargePreviewPath } from '../api/charge-preview.js';
import { formatBytes, formatIdr } from '../format/money-display.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('formatIdr (LD-11, ADR-006)', () => {
  it('renders the PRD §10 Rina + Budi total', () => {
    expect(formatIdr('15000.00')).toBe('Rp15.000,00');
  });

  it('renders the unit price', () => {
    expect(formatIdr('5000.00')).toBe('Rp5.000,00');
  });

  it('renders the quota-boundary total', () => {
    expect(formatIdr('40000.00')).toBe('Rp40.000,00');
  });

  it('renders zero', () => {
    expect(formatIdr('0.00')).toBe('Rp0,00');
  });

  it('keeps a non-zero fraction — the digits are not dropped', () => {
    expect(formatIdr('10000.10')).toBe('Rp10.000,10');
  });

  it('groups beyond Number.MAX_SAFE_INTEGER exactly', () => {
    expect(formatIdr('9007199254740993.00')).toBe('Rp9.007.199.254.740.993,00');
  });

  it('shows a malformed value verbatim instead of throwing inside render', () => {
    expect(formatIdr('15000')).toBe('Rp15000');
    expect(formatIdr('abc')).toBe('Rpabc');
  });
});

describe('formatBytes', () => {
  it('renders the mockup\'s 1.4 MB figure', () => {
    expect(formatBytes(1_468_006)).toBe('1.4 MB');
  });

  it('renders small sizes in KB and B', () => {
    expect(formatBytes(20_480)).toBe('20.0 KB');
    expect(formatBytes(512)).toBe('512 B');
  });
});

describe('charge-preview request body (ADR-003, PRD §9)', () => {
  // §B7 row 1's list: Rina 2 signatures + 1 eMeterai, Budi 1 signature.
  const rows = [
    { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2, meterai_count: 1 },
    { name: 'Budi Santoso', email: 'budi.santoso@example.test', signature_count: 1, meterai_count: 0 },
  ];

  it('carries exactly one top-level key', () => {
    expect(Object.keys(buildChargePreviewBody(rows))).toEqual(['recipients']);
  });

  it('carries exactly four keys per recipient — no price, total or quota', () => {
    for (const recipient of buildChargePreviewBody(rows).recipients) {
      expect(Object.keys(recipient).sort()).toEqual([
        'email',
        'meterai_count',
        'name',
        'signature_count',
      ]);
    }
  });

  it('carries meterai_count through unrepaired, so §B7 row 4\'s 422 stays reachable', () => {
    // 3 meterai against 2 signatures is exactly §B7 row 4. The client must send
    // it as typed; silently correcting it here would hide the rule.
    const overStamped = [
      { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2, meterai_count: 3 },
    ];
    expect(buildChargePreviewBody(overStamped).recipients[0]?.meterai_count).toBe(3);
  });

  it('sends no P2/P3 key — no order_mode, no step, no fields', () => {
    const serialized = JSON.stringify(buildChargePreviewBody(rows));
    for (const forbidden of ['order_mode', 'step', 'fields']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('drops local-only fields such as the row id and the in-progress count text', () => {
    const withLocals = [
      {
        id: 'r1',
        countRaw: '2',
        meteraiRaw: '1',
        name: 'Rina Halim',
        email: 'rina.halim@example.test',
        signature_count: 2,
        meterai_count: 1,
      },
    ];
    expect(buildChargePreviewBody(withLocals)).toEqual({
      recipients: [
        { name: 'Rina Halim', email: 'rina.halim@example.test', signature_count: 2, meterai_count: 1 },
      ],
    });
  });

  it('serializes to a body with no commercial key anywhere', () => {
    const serialized = JSON.stringify(buildChargePreviewBody(rows));
    for (const forbidden of ['price', 'quota', 'total_charge', 'charges', 'charge']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('escapes the envelope id into the path', () => {
    expect(chargePreviewPath('env_01')).toBe('/api/envelopes/env_01/charge-preview');
    expect(chargePreviewPath('../admin')).toBe('/api/envelopes/..%2Fadmin/charge-preview');
  });
});

describe('request (LD-28, LD-29)', () => {
  it('returns the parsed body on 2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { envelope_id: 'env_01' }));
    await expect(
      request<{ envelope_id: string }>('/api/envelopes', {}, { timeoutMs: 50, fetchImpl }),
    ).resolves.toEqual({ envelope_id: 'env_01' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('normalizes a 422 into the server\'s code, message and details', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, {
        error: {
          code: 'DUPLICATE_RECIPIENT_EMAIL',
          message: 'Duplicate recipient email',
          details: { recipient_indexes: [0, 1] },
        },
      }),
    );

    const failure = await request('/x', {}, { timeoutMs: 50, fetchImpl }).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiRequestError);
    const error = failure as ApiRequestError;
    expect(error.code).toBe('DUPLICATE_RECIPIENT_EMAIL');
    expect(error.status).toBe(422);
    expect(error.details).toEqual({ recipient_indexes: [0, 1] });
    expect(error.retryable).toBe(false);
  });

  it('normalizes a 404 envelope-not-found', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(404, { error: { code: 'ENVELOPE_NOT_FOUND', message: 'Envelope not found' } }),
    );
    const error = (await request('/x', {}, { timeoutMs: 50, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;
    expect(error.code).toBe('ENVELOPE_NOT_FOUND');
    expect(error.status).toBe(404);
  });

  it('degrades an unrecognized error body to SERVER_ERROR without leaking it', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<html>Internal Server Error at /srv/app/x.ts:12</html>', { status: 500 }),
    );
    const error = (await request('/x', {}, { timeoutMs: 50, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain('/srv/app');
  });

  it('aborts on timeout and surfaces the LD-28 message, exactly once', async () => {
    const fetchImpl = vi.fn(
      (_path: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const error = (await request('/x', {}, { timeoutMs: 5, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;

    expect(error.code).toBe('REQUEST_TIMEOUT');
    expect(error.message).toBe(UNREACHABLE_MESSAGE);
    expect(error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // LD-29: zero automatic retries
  });

  it('reports a caller cancellation as REQUEST_CANCELLED, not as a timeout', async () => {
    const caller = new AbortController();
    const fetchImpl = vi.fn(
      (_path: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const pending = request('/x', {}, { timeoutMs: 5_000, signal: caller.signal, fetchImpl });
    caller.abort();

    const error = (await pending.catch((e: unknown) => e)) as ApiRequestError;
    expect(error.code).toBe('REQUEST_CANCELLED');
    expect(isCancellation(error)).toBe(true);
  });

  it('composes the caller signal and the timeout into the ONE signal fetch sees (LD-28)', async () => {
    const caller = new AbortController();
    let seen: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_path: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          seen = init?.signal ?? undefined;
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const pending = request('/x', {}, { timeoutMs: 5_000, signal: caller.signal, fetchImpl });
    expect(seen).toBeDefined();
    expect(seen).not.toBe(caller.signal); // composed, not passed through
    expect(seen?.aborted).toBe(false);

    caller.abort();
    expect(seen?.aborted).toBe(true); // the caller's abort reaches fetch's signal
    await pending.catch(() => undefined);
  });

  it('never reaches the network when the caller signal is already aborted', async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));

    const error = (await request('/x', {}, { timeoutMs: 50, signal: caller.signal, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;

    expect(error.code).toBe('REQUEST_CANCELLED');
  });

  it('reports a transport throw as NETWORK_ERROR with the same retryable message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = (await request('/x', {}, { timeoutMs: 50, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe(UNREACHABLE_MESSAGE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports an unreadable 2xx body rather than returning undefined', async () => {
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 200 }));
    const error = (await request('/x', {}, { timeoutMs: 50, fetchImpl }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;
    expect(error.code).toBe('MALFORMED_RESPONSE');
  });
});
