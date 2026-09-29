/**
 * The Step 1 upload state machine (PRD §7.5, §7.6, §7.7).
 *
 * A pure `(state, action) => state` function with no React import, so every
 * transition is asserted without rendering anything (LD-32).
 *
 * Two properties are structural rather than remembered:
 *
 * - **At most one document.** The state has exactly one `file` slot, so
 *   `SELECT_FILE` can only replace. Files cannot accumulate because there is
 *   nowhere for a second one to go (PRD §7.5, prompt §4 fact 6).
 * - **No late result can resurrect a stale view.** Every attempt carries an
 *   `attempt` number; `UPLOAD_OK` / `UPLOAD_FAIL` are ignored unless they name
 *   the attempt currently in flight. A response for a file the user already
 *   replaced or removed therefore lands on the floor. This is the same
 *   discipline the preview controller applies with a payload key, applied here
 *   to a resource that has a natural identity.
 *
 * Frontend validation is UX only. `FE_REJECT` saves the user a round trip; it
 * never substitutes for the server's verdict, and a file the browser accepts is
 * still re-validated server-side (PRD §7.3).
 */

import type { EnvelopeCreatedResponse, ErrorCode } from '@signed-doc/shared';

export type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

/**
 * Where a rejection was decided.
 *
 * `client` means the browser pre-check refused the file: re-sending the same
 * bytes would fail identically, so there is nothing to retry — the user picks a
 * different file. `server` means a request was actually made, which is the case
 * `RETRY` exists for (PRD §7.7, LD-29).
 */
export type UploadErrorSource = 'client' | 'server';

export interface UploadFailure {
  readonly code: ErrorCode | string;
  readonly message: string;
  readonly source: UploadErrorSource;
}

export interface UploadState {
  readonly status: UploadStatus;
  /** The one document slot. `null` only in `idle`. */
  readonly file: File | null;
  /** Server metadata; present only in `success`. */
  readonly envelope: EnvelopeCreatedResponse | null;
  /** Present only in `error`. */
  readonly error: UploadFailure | null;
  /** Identifies the in-flight attempt so a late result cannot be applied. */
  readonly attempt: number;
}

export type UploadAction =
  | { type: 'SELECT_FILE'; file: File }
  | { type: 'FE_ACCEPT' }
  | { type: 'FE_REJECT'; code: ErrorCode | string; message: string }
  | { type: 'UPLOAD_OK'; attempt: number; envelope: EnvelopeCreatedResponse }
  | { type: 'UPLOAD_FAIL'; attempt: number; code: ErrorCode | string; message: string }
  | { type: 'RETRY' }
  | { type: 'REMOVE' };

export const initialUploadState: UploadState = {
  status: 'idle',
  file: null,
  envelope: null,
  error: null,
  attempt: 0,
};

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    /**
     * Legal from every state, including `success` — that IS replace-on-reupload
     * (PRD §7.5). The attempt number advances, which orphans any result still
     * in flight for the previous file.
     */
    case 'SELECT_FILE':
      return {
        status: 'validating',
        file: action.file,
        envelope: null,
        error: null,
        attempt: state.attempt + 1,
      };

    case 'FE_ACCEPT':
      if (state.status !== 'validating' || state.file === null) return state;
      return { ...state, status: 'uploading', error: null };

    // Per-cause reason so Step 1 can say WHICH rule refused the file (PRD §7.2).
    case 'FE_REJECT':
      if (state.status !== 'validating') return state;
      return {
        ...state,
        status: 'error',
        envelope: null,
        error: { code: action.code, message: action.message, source: 'client' },
      };

    case 'UPLOAD_OK':
      if (state.status !== 'uploading' || action.attempt !== state.attempt) return state;
      return { ...state, status: 'success', envelope: action.envelope, error: null };

    case 'UPLOAD_FAIL':
      if (state.status !== 'uploading' || action.attempt !== state.attempt) return state;
      return {
        ...state,
        status: 'error',
        envelope: null,
        error: { code: action.code, message: action.message, source: 'server' },
      };

    /**
     * User-driven only, zero automatic retries (LD-29). The held file and every
     * other piece of page context survive, so nothing typed is lost (PRD §7.7).
     * Retrying a client-side rejection is a no-op: the same file would be
     * refused by the same rule.
     */
    case 'RETRY':
      if (state.status !== 'error' || state.file === null) return state;
      if (state.error?.source !== 'server') return state;
      return { ...state, status: 'uploading', error: null, attempt: state.attempt + 1 };

    // Back to the empty state, from anywhere (PRD §7.5).
    case 'REMOVE':
      return { ...initialUploadState, attempt: state.attempt + 1 };

    default:
      return state;
  }
}

/** The envelope, but only while the machine actually holds a successful upload. */
export function uploadedEnvelope(state: UploadState): EnvelopeCreatedResponse | null {
  return state.status === 'success' ? state.envelope : null;
}

/** PRD §7.6 — the Step 1 gate. */
export function canContinueFromUpload(state: UploadState): boolean {
  return uploadedEnvelope(state) !== null;
}

/** LD-29 — `Try again` is offered only where re-sending could change the answer. */
export function canRetryUpload(state: UploadState): boolean {
  return state.status === 'error' && state.file !== null && state.error?.source === 'server';
}
