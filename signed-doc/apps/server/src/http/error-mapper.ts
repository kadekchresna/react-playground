/**
 * The single exit for every failure shape (PRD §9).
 *
 * Registered last, after every router, so nothing can bypass it. Four inputs,
 * one output envelope `{ error: { code, message, details? } }`:
 *
 * - `ServiceError`        -> its own status (`422` or `404`) and its failure.
 * - multer `LIMIT_FILE_SIZE` -> `422 FILE_TOO_LARGE`, not `413` (`LD-27`): PRD §9
 *   makes upload failures `422` with a renderable body, and one status means the
 *   frontend branches on `code` alone.
 * - any other multer limit -> `422 UNKNOWN_FIELD`. A second file or a stray text
 *   part is an unaccepted part of the request, and `UNKNOWN_FIELD` is the
 *   request-level code in the frozen `ErrorCode` union.
 * - a body-parser failure (malformed or oversize JSON) -> `422 UNKNOWN_FIELD`
 *   with `details.field: "body"`, never Express's default HTML error page.
 *
 * Anything else is a bug, not a rule: `500` with a fixed message. No stack, no
 * `err.message`, no internal path ever reaches the client.
 */

import type { ErrorRequestHandler, Request, Response } from 'express';

import type { ApiError, ErrorCode } from '@signed-doc/shared';
import { isServiceError } from '../services/service-error.js';
import { isMulterError } from './upload-middleware.js';

/** Where `request-logger` reads the code from, so it logs what was sent. */
export interface ErrorLocals {
  errorCode?: string;
}

interface BodyParserError {
  readonly type?: string;
  readonly status?: number;
  readonly statusCode?: number;
}

function isBodyParserError(value: unknown): value is BodyParserError {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as BodyParserError).type;
  return typeof type === 'string' && type.startsWith('entity.');
}

function send(res: Response, status: number, body: ApiError): void {
  (res.locals as ErrorLocals).errorCode = body.error.code;
  res.status(status).json(body);
}

function apiError(
  code: ErrorCode,
  message: string,
  details?: ApiError['error']['details'],
): ApiError {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

export const errorMapper: ErrorRequestHandler = (err, _req: Request, res, next) => {
  // The response has already started; only Express can finish it off.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isServiceError(err)) {
    const { code, message, details } = err.failure;
    send(res, err.status, apiError(code, message, details));
    return;
  }

  if (isMulterError(err)) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      send(res, 422, apiError('FILE_TOO_LARGE', 'File is larger than the 25 MB limit'));
      return;
    }
    send(
      res,
      422,
      apiError('UNKNOWN_FIELD', 'Unknown field is not accepted', {
        field: err.field ?? 'file',
      }),
    );
    return;
  }

  if (isBodyParserError(err)) {
    const message =
      err.type === 'entity.too.large'
        ? 'Request body is too large'
        : 'Request body must be valid JSON';
    send(res, 422, apiError('UNKNOWN_FIELD', message, { field: 'body' }));
    return;
  }

  // Unrecognised: a defect. `500` is outside the documented error contract on
  // purpose — every rule rejection is `422` or `404` — and the body carries
  // nothing about what actually broke.
  (res.locals as ErrorLocals).errorCode = 'INTERNAL_ERROR';
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};
