/**
 * The one `fetch` wrapper (PLAN.md §Frontend Slice > SDK primitives).
 *
 * Three jobs, and nothing else:
 *
 * 1. **One `AbortController` composition point (LD-28).** A caller's signal —
 *    the staleness guard's, for the preview — and this module's timeout are
 *    merged into a single controller, so there is exactly one cancellation path
 *    per request and a superseded request and a timed-out request abort by the
 *    same mechanism.
 * 2. **One error shape.** A `422`/`404` body is normalized into an
 *    `ApiRequestError` carrying the server's `code`, `message` and additive
 *    `details`. Transport failures get their own codes in a separate namespace
 *    so `code` is never ambiguous.
 * 3. **Zero retries (LD-29).** There is no retry loop in this file. Retrying is
 *    a user action, because an automatic retry is precisely the bug PRD §8.10
 *    tests for.
 *
 * This module knows no business rule, no price, no quota and no size limit
 * (ADR-003).
 */

import type { ApiError, ErrorCode, ValidationFailureDetails } from '@signed-doc/shared';
import { ERROR_CODES } from '@signed-doc/shared';

/**
 * Failures that happen instead of a server verdict. Kept in a namespace
 * disjoint from `ErrorCode` so a branch on `code` is never ambiguous.
 */
export type TransportCode =
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_CANCELLED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'MALFORMED_RESPONSE';

export type FailureCode = ErrorCode | TransportCode;

/** LD-28: the one copy of this string. */
export const UNREACHABLE_MESSAGE = 'Could not reach the server — try again';

export class ApiRequestError extends Error {
  readonly code: FailureCode;
  /** HTTP status, or `0` when no response was received. */
  readonly status: number;
  readonly details?: ValidationFailureDetails;
  /**
   * True when repeating the identical request could plausibly succeed, i.e.
   * transport failures. A `422` is not retryable in this sense — the input has
   * to change first. The UI still offers `Try again` after a rejected upload,
   * because re-sending is the user's call, not ours.
   */
  readonly retryable: boolean;

  constructor(init: {
    code: FailureCode;
    message: string;
    status: number;
    details?: ValidationFailureDetails;
    retryable: boolean;
  }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.retryable = init.retryable;
  }
}

/** True when the failure is this module's marker for "superseded or cancelled". */
export function isCancellation(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'REQUEST_CANCELLED';
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Read a non-2xx body as the shared `{ error: { code, message, details? } }`
 * envelope. Anything else — an HTML error page, a proxy response, a truncated
 * body — degrades to `SERVER_ERROR` rather than surfacing framework text.
 */
function normalizeFailure(status: number, body: unknown): ApiRequestError {
  const envelope = body as Partial<ApiError> | null;
  const error = envelope?.error;

  if (error && isErrorCode(error.code) && typeof error.message === 'string') {
    return new ApiRequestError({
      code: error.code,
      message: error.message,
      status,
      details: error.details,
      retryable: false,
    });
  }

  return new ApiRequestError({
    code: 'SERVER_ERROR',
    message:
      status >= 500
        ? 'The server could not complete the request — try again'
        : `The server rejected the request (HTTP ${status})`,
    status,
    retryable: status >= 500,
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface RequestOptions {
  /** Hard deadline for the whole round trip (LD-28). */
  readonly timeoutMs: number;
  /** The caller's cancellation signal — the staleness guard's, for the preview. */
  readonly signal?: AbortSignal;
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Perform one request. Resolves with the parsed `2xx` body, or rejects with an
 * `ApiRequestError`. Never retries.
 */
export async function request<T>(
  path: string,
  init: RequestInit,
  { timeoutMs, signal, fetchImpl }: RequestOptions,
): Promise<T> {
  const doFetch = fetchImpl ?? globalThis.fetch;

  // A caller that has already given up gets no network round trip at all.
  if (signal?.aborted) {
    throw new ApiRequestError({
      code: 'REQUEST_CANCELLED',
      message: 'Request superseded',
      status: 0,
      retryable: false,
    });
  }

  // The single composition point (LD-28): the caller's signal and the timeout
  // both abort THIS controller, and only its signal ever reaches `fetch`.
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;

  const onExternalAbort = () => {
    cancelled = true;
    controller.abort();
  };

  signal?.addEventListener('abort', onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await doFetch(path, { ...init, signal: controller.signal });

    if (!response.ok) {
      throw normalizeFailure(response.status, await readJson(response));
    }

    const body = await readJson(response);
    if (body === null) {
      throw new ApiRequestError({
        code: 'MALFORMED_RESPONSE',
        message: 'The server returned an unreadable response',
        status: response.status,
        retryable: true,
      });
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

    // Cancellation is checked before the timeout: a caller that abandons the
    // request wants silence, not an error banner.
    if (cancelled) {
      throw new ApiRequestError({
        code: 'REQUEST_CANCELLED',
        message: 'Request superseded',
        status: 0,
        retryable: false,
      });
    }
    if (timedOut) {
      throw new ApiRequestError({
        code: 'REQUEST_TIMEOUT',
        message: UNREACHABLE_MESSAGE,
        status: 0,
        retryable: true,
      });
    }
    throw new ApiRequestError({
      code: 'NETWORK_ERROR',
      message: UNREACHABLE_MESSAGE,
      status: 0,
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
