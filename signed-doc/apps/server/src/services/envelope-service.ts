/**
 * The upload use case (PRD §7, §9).
 *
 * Every rule the browser already checked is checked again here, because the
 * browser's check is UX and this one is the decision (PRD §7.3). The order is
 * fixed and matters:
 *
 *   1. a file is present                  -> `FILE_REQUIRED`
 *   2. the filename is sanitized          -> `FILENAME_INVALID`
 *   3. the extension is read from the SANITIZED name, never from
 *      `Content-Type`                     -> `FILE_TYPE_NOT_ALLOWED`
 *   4. the size is inside the server's own limit -> `FILE_TOO_LARGE`
 *   5. the page count comes from the fixture table, never from the bytes
 *   6. metadata is stored; the bytes are not
 *
 * Steps 2-4 are `validateFileMeta` from the shared kernel — the same function
 * the frontend calls — so the two layers cannot disagree about what a valid
 * upload is (PRD §8.5).
 *
 * Discard-after-validation (PRD §7.10, ADR-002): `file.buffer` is read exactly
 * once, for its byte length, and is never assigned to a variable that outlives
 * this call, never stored, never logged and never returned.
 */

import {
  isValidationFailure,
  pageCountFor,
  validateFileMeta,
  validationFailure,
  formatDecimalString,
  type EnvelopeCreatedResponse,
} from '@signed-doc/shared';

import type { AccountConfig } from '../config/account.js';
import type { LimitsConfig } from '../config/limits.js';
import type { EnvelopeStore } from '../store/envelope-store.js';
import { unprocessable } from './service-error.js';

/**
 * The subset of multer's file object this service is willing to see. Narrowing
 * it here keeps the service testable without multer and makes it obvious that
 * `mimetype` is not among the inputs — PRD §7.9 forbids trusting it.
 */
export interface UploadedFile {
  readonly originalname: string;
  readonly size: number;
  readonly buffer: Buffer;
}

export interface EnvelopeService {
  createFromUpload(file: UploadedFile | undefined): EnvelopeCreatedResponse;
}

export interface EnvelopeServiceDependencies {
  readonly store: EnvelopeStore;
  readonly account: AccountConfig;
  readonly limits: LimitsConfig;
}

export function createEnvelopeService({
  store,
  account,
  limits,
}: EnvelopeServiceDependencies): EnvelopeService {
  return {
    createFromUpload(file) {
      if (file === undefined || file === null) {
        throw unprocessable(validationFailure('FILE_REQUIRED', 'A document is required'));
      }

      // The real byte count that arrived, not a client-declared one. Multer has
      // already refused anything past `maxUploadBytes`; re-checking below means
      // the rule still holds if the parser is ever reconfigured or replaced.
      const sizeBytes = Buffer.isBuffer(file.buffer) ? file.buffer.byteLength : file.size;

      const meta = validateFileMeta({
        filename: file.originalname,
        sizeBytes,
        maxSizeBytes: limits.maxUploadBytes,
      });

      if (isValidationFailure(meta)) {
        throw unprocessable(meta);
      }

      // Never parsed from content (PRD §4 fact 3): the fixture table is keyed on
      // the sanitized basename, which is also why this takes no buffer.
      const record = store.save({
        filename: meta.filename,
        size_bytes: meta.sizeBytes,
        page_count: pageCountFor(meta.filename),
      });

      // `price` and `quota` are sourced here, server-side. Nothing the client
      // sent is read for either (PRD §9, ADR-003).
      return {
        envelope_id: record.id,
        document: {
          filename: record.filename,
          size_bytes: record.size_bytes,
          page_count: record.page_count,
        },
        price: { signature: formatDecimalString(account.prices.signature) },
        quota: { signature: account.quotas.signature },
      };
    },
  };
}
