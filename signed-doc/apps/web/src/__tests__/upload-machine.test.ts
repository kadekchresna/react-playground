/**
 * Upload machine transitions (PRD §7.5, §7.6, §7.7).
 *
 * Nothing is rendered and no React module is imported (LD-32) — the reducer is
 * a pure function, so the evidence is the reducer itself.
 */

import { describe, expect, it } from 'vitest';

import type { EnvelopeCreatedResponse } from '@signed-doc/shared';

import {
  canContinueFromUpload,
  canRetryUpload,
  initialUploadState,
  uploadReducer,
  uploadedEnvelope,
  type UploadAction,
  type UploadState,
} from '../features/upload/upload-machine.js';

function file(name: string, size = 1024): File {
  const blob = new File([new Uint8Array(size)], name, { type: 'application/octet-stream' });
  return blob;
}

const envelopeFor = (filename: string, pageCount: number): EnvelopeCreatedResponse => ({
  envelope_id: 'env_01',
  document: { filename, size_bytes: 1_468_006, page_count: pageCount },
  price: { signature: '5000.00' },
  quota: { signature: 8 },
});

/** Drive the machine through a list of actions, left to right. */
function run(actions: readonly UploadAction[], from: UploadState = initialUploadState): UploadState {
  return actions.reduce(uploadReducer, from);
}

const AGREEMENT = 'agreement-vendor-2026.pdf';

function uploadedState(name = AGREEMENT, pageCount = 8): UploadState {
  const selected = uploadReducer(initialUploadState, { type: 'SELECT_FILE', file: file(name) });
  const uploading = uploadReducer(selected, { type: 'FE_ACCEPT' });
  return uploadReducer(uploading, {
    type: 'UPLOAD_OK',
    attempt: uploading.attempt,
    envelope: envelopeFor(name, pageCount),
  });
}

describe('initial state', () => {
  it('starts idle with no document and no error', () => {
    expect(initialUploadState).toEqual({
      status: 'idle',
      file: null,
      envelope: null,
      error: null,
      attempt: 0,
    });
  });

  it('gates Continue shut in the empty state (PRD §7.6)', () => {
    expect(canContinueFromUpload(initialUploadState)).toBe(false);
  });
});

describe('every state is reachable', () => {
  it('reaches validating', () => {
    expect(run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }]).status).toBe('validating');
  });

  it('reaches uploading', () => {
    expect(run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }, { type: 'FE_ACCEPT' }]).status).toBe(
      'uploading',
    );
  });

  it('reaches success', () => {
    expect(uploadedState().status).toBe('success');
  });

  it('reaches error from the frontend pre-check', () => {
    const state = run([
      { type: 'SELECT_FILE', file: file('payload.exe') },
      { type: 'FE_REJECT', code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    ]);
    expect(state.status).toBe('error');
  });

  it('reaches error from the server', () => {
    const uploading = run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }, { type: 'FE_ACCEPT' }]);
    const state = uploadReducer(uploading, {
      type: 'UPLOAD_FAIL',
      attempt: uploading.attempt,
      code: 'FILE_TOO_LARGE',
      message: 'File is larger than the 25 MB limit',
    });
    expect(state.status).toBe('error');
  });

  it('returns to idle', () => {
    expect(uploadReducer(uploadedState(), { type: 'REMOVE' }).status).toBe('idle');
  });
});

describe('SELECT_FILE replaces — files never accumulate (PRD §7.5)', () => {
  it('replaces the held document when a second file is chosen from success', () => {
    const after = uploadReducer(uploadedState('nda-partner.pdf', 3), {
      type: 'SELECT_FILE',
      file: file(AGREEMENT),
    });

    expect(after.status).toBe('validating');
    expect(after.file?.name).toBe(AGREEMENT);
    // One slot: the previous envelope is gone, not kept alongside.
    expect(after.envelope).toBeNull();
  });

  it('the state shape has exactly one document slot', () => {
    const after = uploadReducer(uploadedState(), { type: 'SELECT_FILE', file: file('other.pdf') });
    const fileValuedKeys = Object.entries(after).filter(([, value]) => value instanceof File);
    expect(fileValuedKeys).toHaveLength(1);
  });

  it('replaces from an error state too, clearing the previous cause', () => {
    const rejected = run([
      { type: 'SELECT_FILE', file: file('payload.exe') },
      { type: 'FE_REJECT', code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    ]);
    const after = uploadReducer(rejected, { type: 'SELECT_FILE', file: file(AGREEMENT) });

    expect(after.status).toBe('validating');
    expect(after.error).toBeNull();
    expect(after.file?.name).toBe(AGREEMENT);
  });

  it('replaces mid-upload and orphans the in-flight attempt', () => {
    const uploading = run([{ type: 'SELECT_FILE', file: file('nda-partner.pdf') }, { type: 'FE_ACCEPT' }]);
    const staleAttempt = uploading.attempt;

    const replaced = uploadReducer(uploading, { type: 'SELECT_FILE', file: file(AGREEMENT) });
    const late = uploadReducer(replaced, {
      type: 'UPLOAD_OK',
      attempt: staleAttempt,
      envelope: envelopeFor('nda-partner.pdf', 3),
    });

    expect(late).toBe(replaced); // untouched: the late result was for the replaced file
    expect(late.envelope).toBeNull();
    expect(canContinueFromUpload(late)).toBe(false);
  });
});

describe('REMOVE restores the empty state (PRD §7.5)', () => {
  it('drops the document and the envelope', () => {
    const after = uploadReducer(uploadedState(), { type: 'REMOVE' });
    expect(after.file).toBeNull();
    expect(after.envelope).toBeNull();
    expect(after.error).toBeNull();
    expect(canContinueFromUpload(after)).toBe(false);
  });

  it('clears an error state as well', () => {
    const rejected = run([
      { type: 'SELECT_FILE', file: file('payload.exe') },
      { type: 'FE_REJECT', code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    ]);
    expect(uploadReducer(rejected, { type: 'REMOVE' }).status).toBe('idle');
  });

  it('a result arriving after REMOVE cannot bring the card back', () => {
    const uploading = run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }, { type: 'FE_ACCEPT' }]);
    const removed = uploadReducer(uploading, { type: 'REMOVE' });

    const late = uploadReducer(removed, {
      type: 'UPLOAD_OK',
      attempt: uploading.attempt,
      envelope: envelopeFor(AGREEMENT, 8),
    });

    expect(late.status).toBe('idle');
    expect(uploadedEnvelope(late)).toBeNull();
  });
});

describe('FE_REJECT carries a per-cause reason (PRD §7.2)', () => {
  const causes = [
    { code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    { code: 'FILE_TOO_LARGE', message: 'File is larger than the 25 MB limit' },
    { code: 'FILE_REQUIRED', message: 'A document is required' },
    { code: 'FILENAME_INVALID', message: 'Filename must be a file name, not a path' },
  ] as const;

  for (const cause of causes) {
    it(`keeps the ${cause.code} cause distinct`, () => {
      const state = run([
        { type: 'SELECT_FILE', file: file('whatever.bin') },
        { type: 'FE_REJECT', code: cause.code, message: cause.message },
      ]);
      expect(state.error).toEqual({ ...cause, source: 'client' });
    });
  }

  it('marks the rejection as decided by the client, not by the server', () => {
    const state = run([
      { type: 'SELECT_FILE', file: file('payload.exe') },
      { type: 'FE_REJECT', code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    ]);
    // Frontend validation is UX only (PRD §7.3): the source is recorded so the
    // view can tell "we refused to send" from "the server refused".
    expect(state.error?.source).toBe('client');
    expect(canRetryUpload(state)).toBe(false);
  });

  it('is ignored outside validating — it can never overwrite a successful upload', () => {
    const success = uploadedState();
    const after = uploadReducer(success, {
      type: 'FE_REJECT',
      code: 'FILE_TYPE_NOT_ALLOWED',
      message: 'File type is not supported',
    });
    expect(after).toBe(success);
  });
});

describe('RETRY (PRD §7.7, LD-29)', () => {
  function serverFailure(): UploadState {
    const uploading = run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }, { type: 'FE_ACCEPT' }]);
    return uploadReducer(uploading, {
      type: 'UPLOAD_FAIL',
      attempt: uploading.attempt,
      code: 'SERVER_ERROR',
      message: 'The server could not complete the request — try again',
    });
  }

  it('re-enters uploading and preserves the selected file', () => {
    const failed = serverFailure();
    expect(canRetryUpload(failed)).toBe(true);

    const retried = uploadReducer(failed, { type: 'RETRY' });
    expect(retried.status).toBe('uploading');
    expect(retried.file?.name).toBe(AGREEMENT);
    expect(retried.error).toBeNull();
  });

  it('starts a new attempt so the failed one cannot resolve into it', () => {
    const failed = serverFailure();
    const retried = uploadReducer(failed, { type: 'RETRY' });

    expect(retried.attempt).toBeGreaterThan(failed.attempt);

    const late = uploadReducer(retried, {
      type: 'UPLOAD_OK',
      attempt: failed.attempt,
      envelope: envelopeFor(AGREEMENT, 8),
    });
    expect(late).toBe(retried);
  });

  it('succeeds on the retry, clearing the error and enabling Continue', () => {
    const retried = uploadReducer(serverFailure(), { type: 'RETRY' });
    const ok = uploadReducer(retried, {
      type: 'UPLOAD_OK',
      attempt: retried.attempt,
      envelope: envelopeFor(AGREEMENT, 8),
    });

    expect(ok.status).toBe('success');
    expect(ok.error).toBeNull();
    expect(canContinueFromUpload(ok)).toBe(true);
    expect(ok.envelope?.document.page_count).toBe(8);
  });

  it('is a no-op after a client-side rejection — the same file fails the same rule', () => {
    const rejected = run([
      { type: 'SELECT_FILE', file: file('payload.exe') },
      { type: 'FE_REJECT', code: 'FILE_TYPE_NOT_ALLOWED', message: 'File type is not supported' },
    ]);
    expect(uploadReducer(rejected, { type: 'RETRY' })).toBe(rejected);
  });

  it('is a no-op from idle, validating, uploading and success', () => {
    const validating = run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }]);
    const uploading = uploadReducer(validating, { type: 'FE_ACCEPT' });
    const success = uploadedState();

    for (const state of [initialUploadState, validating, uploading, success]) {
      expect(uploadReducer(state, { type: 'RETRY' })).toBe(state);
    }
  });
});

describe('the gate opens only on a real server success (PRD §7.6)', () => {
  it('stays shut while validating and uploading', () => {
    const validating = run([{ type: 'SELECT_FILE', file: file(AGREEMENT) }]);
    expect(canContinueFromUpload(validating)).toBe(false);
    expect(canContinueFromUpload(uploadReducer(validating, { type: 'FE_ACCEPT' }))).toBe(false);
  });

  it('opens on success and exposes the server metadata', () => {
    const success = uploadedState();
    expect(canContinueFromUpload(success)).toBe(true);
    expect(uploadedEnvelope(success)).toEqual(envelopeFor(AGREEMENT, 8));
  });

  it('carries the server-issued price and quota — the browser has no other source', () => {
    // ADR-003: price and quota reach the browser ONLY inside the 201 body.
    expect(uploadedEnvelope(uploadedState())?.price).toEqual({ signature: '5000.00' });
    expect(uploadedEnvelope(uploadedState())?.quota).toEqual({ signature: 8 });
  });
});

describe('the reducer is pure', () => {
  it('never mutates the state it is given', () => {
    const before = uploadedState();
    const snapshot = { ...before };
    uploadReducer(before, { type: 'SELECT_FILE', file: file('other.pdf') });
    uploadReducer(before, { type: 'REMOVE' });
    expect(before).toEqual(snapshot);
  });

  it('returns the same reference for an action it ignores', () => {
    expect(uploadReducer(initialUploadState, { type: 'FE_ACCEPT' })).toBe(initialUploadState);
    expect(
      uploadReducer(initialUploadState, {
        type: 'UPLOAD_OK',
        attempt: 0,
        envelope: envelopeFor(AGREEMENT, 8),
      }),
    ).toBe(initialUploadState);
  });
});
