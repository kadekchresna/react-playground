/**
 * The one channel a service uses to refuse a request.
 *
 * A service never touches `res`, never picks a status line, and never formats
 * an HTTP body — it raises a `ServiceError` carrying a shared `ValidationFailure`
 * and the transport-level status that failure deserves. `http/error-mapper.ts`
 * is the single place that turns it into a response (PRD §9: the handler parses,
 * calls the service, and maps the result).
 *
 * The status is narrowed to `422 | 404` by the type, so a service physically
 * cannot invent a third status without changing this file.
 */

import type { ApiError, ValidationFailure } from '@signed-doc/shared';

/** The only two statuses a business rule can produce (`LD-26`, `LD-27`). */
export type ServiceErrorStatus = 422 | 404;

export class ServiceError extends Error {
  readonly failure: ValidationFailure;
  readonly status: ServiceErrorStatus;

  constructor(failure: ValidationFailure, status: ServiceErrorStatus = 422) {
    super(failure.message);
    this.name = 'ServiceError';
    this.failure = failure;
    this.status = status;
    // Keeps `instanceof` working after TypeScript's ES5-era subclass downlevel
    // and keeps the stack readable.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** The wire envelope every non-2xx response uses (`LD-26`). */
  toApiError(): ApiError {
    const { code, message, details } = this.failure;
    return details === undefined
      ? { error: { code, message } }
      : { error: { code, message, details } };
  }
}

/** A rule rejection: `422`, the status PRD §9 gives every validation failure. */
export function unprocessable(failure: ValidationFailure): ServiceError {
  return new ServiceError(failure, 422);
}

/** A missing resource: `404`, the only non-`422` business status (PRD §9). */
export function notFound(failure: ValidationFailure): ServiceError {
  return new ServiceError(failure, 404);
}

/**
 * Structural check rather than `instanceof` alone, so an error crossing a
 * module-instance boundary (vitest workers, a duplicated dependency tree) is
 * still recognised instead of silently degrading to a `500`.
 */
export function isServiceError(value: unknown): value is ServiceError {
  if (value instanceof ServiceError) return true;
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { name?: unknown; failure?: unknown; status?: unknown };
  return (
    candidate.name === 'ServiceError' &&
    typeof candidate.failure === 'object' &&
    candidate.failure !== null &&
    (candidate.status === 422 || candidate.status === 404)
  );
}
