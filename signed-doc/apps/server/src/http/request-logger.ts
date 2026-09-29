/**
 * One structured line per request, and nothing else (`LD-30`).
 *
 * There is no metrics backend, no Prometheus, no OTEL and no dashboard in this
 * exercise; a single JSON line per request is the honest observability floor.
 * It records what a reviewer would actually ask — method, path, status, the
 * error code that was sent, and how long it took.
 *
 * It deliberately never logs a request body, a filename or an email address:
 * PRD §5 forbids real personal data in logs, and the filename is untrusted
 * input that would otherwise be a log-injection carrier.
 */

import type { RequestHandler } from 'express';

import type { ErrorLocals } from './error-mapper.js';

export interface RequestLogLine {
  readonly msg: 'request';
  readonly method: string;
  readonly path: string;
  readonly status: number;
  /** The `ErrorCode` the error mapper sent, or `null` on success. */
  readonly error_code: string | null;
  readonly duration_ms: number;
}

export interface RequestLoggerOptions {
  /** Sink for the finished line. Injected so the format can be asserted. */
  readonly write?: (line: RequestLogLine) => void;
  /** Off under vitest by default, so test output stays the test output. */
  readonly enabled?: boolean;
}

const defaultWrite = (line: RequestLogLine): void => {
  console.log(JSON.stringify(line));
};

export function createRequestLogger({
  write = defaultWrite,
  enabled = process.env['NODE_ENV'] !== 'test',
}: RequestLoggerOptions = {}): RequestHandler {
  return (req, res, next) => {
    if (!enabled) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();

    // `finish` rather than `close`, so the line reflects what was actually sent.
    res.once('finish', () => {
      const elapsedNs = process.hrtime.bigint() - startedAt;
      write({
        msg: 'request',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        error_code: (res.locals as ErrorLocals).errorCode ?? null,
        duration_ms: Number(elapsedNs / 1000n) / 1000,
      });
    });

    next();
  };
}
