/**
 * `POST /api/envelopes` — multipart upload of exactly one document (PRD §9).
 *
 * The body is a `FormData` with a single field named `file`. `Content-Type` is
 * deliberately NOT set: the browser has to write the multipart boundary, and
 * the server judges the extension from the sanitized filename rather than from
 * any declared type anyway (PRD §7.9).
 */

import type { EnvelopeCreatedResponse } from '@signed-doc/shared';

import { request } from './client.js';

/** LD-28. */
export const UPLOAD_TIMEOUT_MS = 60_000;

export const UPLOAD_PATH = '/api/envelopes';

export function uploadEnvelope(
  file: File,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<EnvelopeCreatedResponse> {
  const body = new FormData();
  body.append('file', file, file.name);

  return request<EnvelopeCreatedResponse>(
    UPLOAD_PATH,
    { method: 'POST', body },
    { timeoutMs: UPLOAD_TIMEOUT_MS, signal: options.signal, fetchImpl: options.fetchImpl },
  );
}
