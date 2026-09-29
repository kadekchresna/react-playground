/**
 * Server-enforced size limits.
 *
 * PRD §10 delegates the upload ceiling to the implementer but is emphatic that
 * whatever it is, it is enforced on the SERVER and not only in the browser
 * (PRD §7.3). `LD-01` fixes it at 25 MB; `ADR-004` routes a breach to
 * `422 FILE_TOO_LARGE` rather than `413` so the frontend has one error branch.
 *
 * Like `config/account.ts`, this file is server-only: `apps/web` never imports
 * it. The browser keeps its own copy of the byte limit purely as a UX
 * pre-check, and that copy decides nothing (ADR-003).
 */

import { MAX_RECIPIENTS } from '@signed-doc/shared';

/** `LD-01`: 25 MB, handed straight to multer's `limits.fileSize`. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Ceiling for the `charge-preview` JSON body. Ten recipients of three short
 * strings is well under a kilobyte, so 64 KB is generous while still refusing
 * a body large enough to be an attack rather than a mistake.
 */
export const MAX_JSON_BYTES = 64 * 1024;

/**
 * Re-exported from the kernel rather than restated, so there is exactly one
 * number and the two layers cannot drift (PRD §8.5). It is a validation rule,
 * not a commercial term, which is why it is allowed to live in `shared`.
 */
export { MAX_RECIPIENTS };

/** What the services are injected with at the composition root. */
export interface LimitsConfig {
  readonly maxUploadBytes: number;
  readonly maxJsonBytes: number;
  readonly maxRecipients: number;
}

export const LIMITS: LimitsConfig = {
  maxUploadBytes: MAX_UPLOAD_BYTES,
  maxJsonBytes: MAX_JSON_BYTES,
  maxRecipients: MAX_RECIPIENTS,
};
