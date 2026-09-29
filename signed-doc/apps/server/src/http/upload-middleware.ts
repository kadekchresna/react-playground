/**
 * Multipart parsing for `POST /api/envelopes` (ADR-004).
 *
 * `memoryStorage` because the bytes are discarded after validation anyway
 * (PRD §7.10) — writing them to disk would create a temp-file cleanup path and
 * a disk-fill primitive for no requirement coverage (ADR-002).
 *
 * The three limits close three vectors at the parser, before any handler code
 * runs:
 *
 * - `fileSize` — the 25 MB ceiling (`LD-01`). Multer aborts the stream as the
 *   limit is crossed, so a 300 MB upload is refused without buffering 300 MB.
 * - `files: 1`  — one document per request (PRD §7.1).
 * - `fields: 0` — no text parts at all, which is why the `UNKNOWN_FIELD` rule
 *   needs no multipart variant: there is no field for a client to smuggle a
 *   price or total in.
 *
 * There is deliberately NO `fileFilter`. The extension rule belongs to the
 * service, judged from the sanitized filename (PRD §7.9) — a filter here would
 * put a business rule in the parser and would be tempted by `mimetype`, which
 * is client-supplied and must never decide anything.
 */

import multer from 'multer';

import { MAX_UPLOAD_BYTES } from '../config/limits.js';

/** Accepts exactly one part, named `file`. */
export const uploadSingleDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
}).single('file');

/**
 * Multer signals failure with `err.name === 'MulterError'` and a string `code`.
 * Checked structurally rather than with `instanceof` so the mapping survives a
 * duplicated multer instance in the dependency tree.
 */
export interface MulterLikeError {
  readonly name: string;
  readonly code: string;
  readonly field?: string;
}

export function isMulterError(value: unknown): value is MulterLikeError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown };
  return candidate.name === 'MulterError' && typeof candidate.code === 'string';
}
