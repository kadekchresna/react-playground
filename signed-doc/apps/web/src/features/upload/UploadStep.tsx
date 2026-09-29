/**
 * Step 1 — Upload document (PRD §7.1–§7.7).
 *
 * Presentational: every state change goes through the reducer in
 * `upload-machine.ts`, which is why the whole step's behaviour is testable
 * without rendering (LD-32).
 *
 * The gate (PRD §7.6): `Continue` is `disabled` until the machine reaches
 * `success`, and the reason is rendered as visible text that `Continue` points
 * at with `aria-describedby`. It is never a tooltip and never hidden.
 */

import { Dropzone } from './Dropzone.js';
import { DocumentCard } from './DocumentCard.js';
import {
  canContinueFromUpload,
  canRetryUpload,
  uploadedEnvelope,
  type UploadState,
} from './upload-machine.js';

const CONTINUE_REASON_ID = 'upload-continue-reason';

export interface UploadStepProps {
  readonly state: UploadState;
  readonly onSelectFile: (file: File) => void;
  readonly onRemove: () => void;
  readonly onRetry: () => void;
  readonly onContinue: () => void;
}

export function UploadStep({
  state,
  onSelectFile,
  onRemove,
  onRetry,
  onContinue,
}: UploadStepProps): JSX.Element {
  const envelope = uploadedEnvelope(state);
  const busy = state.status === 'validating' || state.status === 'uploading';
  const canContinue = canContinueFromUpload(state);

  return (
    <main className="board">
      <h1>What needs to be signed?</h1>
      <p className="board__sub">
        One document per request. The server re-checks every rule after upload.
      </p>

      {envelope ? (
        <DocumentCard
          filename={envelope.document.filename}
          pageCount={envelope.document.page_count}
          sizeBytes={envelope.document.size_bytes}
          onRemove={onRemove}
        />
      ) : (
        <Dropzone onSelectFile={onSelectFile} busy={busy} />
      )}

      {busy ? (
        <p className="notice notice--info" role="status">
          {state.status === 'validating'
            ? `Checking ${state.file?.name ?? 'the file'}…`
            : `Uploading ${state.file?.name ?? 'the file'}…`}
        </p>
      ) : null}

      {state.status === 'error' && state.error ? (
        <div className="notice notice--error" role="alert">
          <p className="notice__message">{state.error.message}</p>
          <p className="notice__meta">
            {state.error.source === 'client'
              ? 'Checked in your browser before sending. Choose a different file.'
              : `Rejected by the server (${state.error.code}).`}
          </p>
          {canRetryUpload(state) ? (
            <div className="notice__actions">
              <button type="button" className="btn btn--ghost" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="footer">
        <div className="footer__spacer" />
        {/* PRD §7.6 — the reason is on screen whenever the gate is shut. */}
        <p className="gate-reason gate-reason--neutral" id={CONTINUE_REASON_ID}>
          {canContinue
            ? 'Ready to set recipients.'
            : 'Upload a valid document to continue. The server decides whether it is valid.'}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canContinue}
          aria-disabled={canContinue ? undefined : 'true'}
          aria-describedby={CONTINUE_REASON_ID}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </main>
  );
}
