/**
 * Composition root 2 of 2 (PLAN.md §Architecture Slice > apps/web).
 *
 * Owns the step, the upload machine, and therefore the `EnvelopeMeta` plus the
 * server-issued `price` and `quota` handed from Step 1 to Step 2. Everything
 * travels as props — no context, no global store, no router.
 *
 * The upload machine lives HERE rather than inside `UploadStep` so that going
 * `Back` from Step 2 finds the document still uploaded (the step components
 * unmount; this one does not).
 *
 * Seam S1: the step is `1 | 2 | 3`, never a boolean, and `3` was unreachable in
 * Case 1 because `MAX_REACHABLE_STEP` was `2`. Case 2 §A4 unlocked Step 3 by
 * raising that one constant — no state changed type, and `goTo` is unchanged.
 *
 * **Case 2 §A4 adds a second long-lived reducer: the placed fields.** They live
 * HERE, beside the recipients and for the same reason: going `Back` to Step 2
 * to fix a count, or to Step 1 to look at the document, must not destroy a box
 * the user placed (§A2.8 says so for a reorder; §A4.13 says so for a count
 * change). The step components unmount; this one does not.
 *
 * **The two reducers do not know about each other, and that IS §A4.13.** No
 * recipient action touches the field list, so lowering a count below the number
 * of placed boxes, or deleting a recipient who owns some (§B7.13), cannot
 * delete anything. The mismatch is reported by the kernel's `reconcileFields`
 * in Step 3's render and flagged on screen for the user to resolve. "Flag,
 * don't auto-drop" is therefore a property of the state's SHAPE rather than a
 * rule a reducer has to remember.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { validateFileMeta } from '@signed-doc/shared';

import { ApiRequestError, UNREACHABLE_MESSAGE, isCancellation } from './api/client.js';
import { uploadEnvelope } from './api/upload.js';
import { MAX_REACHABLE_STEP, Stepper, type Step } from './components/Stepper.js';
import { FieldsStep } from './features/fields/FieldsStep.js';
import { createFieldsState, fieldsReducer } from './features/fields/fields-reducer.js';
import { RecipientsStep } from './features/recipients/RecipientsStep.js';
import { recipientsReducer, toRecipientInputs } from './features/recipients/recipients-reducer.js';
import { createSeedState } from './features/recipients/seed.js';
import { UploadStep } from './features/upload/UploadStep.js';
import {
  initialUploadState,
  uploadReducer,
  uploadedEnvelope,
} from './features/upload/upload-machine.js';

/**
 * A UX-only copy of the server's upload limit (ADR-003).
 *
 * It exists to save the user a 25 MB round trip, nothing more. The server
 * enforces its own limit and is the only authority; bypassing this check
 * changes the user's experience, never the outcome (PRD §7.3, §10 row 5).
 */
const UX_ONLY_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function App(): JSX.Element {
  const [step, setStep] = useState<Step>(1);
  const [upload, dispatchUpload] = useReducer(uploadReducer, initialUploadState);
  // Held here, not in `RecipientsStep`, so `Back` and forward keep every typed
  // value (LD-15 seeds the initial rows; the server never assumes recipients).
  const [recipients, dispatchRecipients] = useReducer(recipientsReducer, undefined, createSeedState);
  // §A4 — the placed boxes, held here so no navigation can lose one.
  const [fields, dispatchFields] = useReducer(fieldsReducer, undefined, createFieldsState);

  // Seam S1: the bound on how far the flow goes. Case 2 raised it to 3.
  const goTo = useCallback((next: Step) => {
    if (next > MAX_REACHABLE_STEP) return;
    setStep(next);
  }, []);

  /**
   * The frontend pre-check (PRD §7.2) — UX only.
   *
   * It runs the SAME shared rules the server runs (`validateFileMeta`), so the
   * message the user sees names the same cause the server would. It is an
   * effect rather than event-handler code so the reducer stays the only place
   * state changes.
   */
  useEffect(() => {
    if (upload.status !== 'validating' || upload.file === null) return;

    const verdict = validateFileMeta({
      filename: upload.file.name,
      sizeBytes: upload.file.size,
      maxSizeBytes: UX_ONLY_MAX_UPLOAD_BYTES,
    });

    if ('code' in verdict) {
      dispatchUpload({ type: 'FE_REJECT', code: verdict.code, message: verdict.message });
    } else {
      dispatchUpload({ type: 'FE_ACCEPT' });
    }
  }, [upload.status, upload.attempt, upload.file]);

  /**
   * The upload itself. Exactly one request per user intent (LD-29): the effect
   * refuses to start an attempt it has already started, which also makes it
   * safe under `StrictMode`'s deliberate double-invocation.
   */
  const uploadRun = useRef<{ attempt: number; controller: AbortController } | null>(null);

  useEffect(() => {
    if (upload.status !== 'uploading' || upload.file === null) return;
    if (uploadRun.current?.attempt === upload.attempt) return;

    uploadRun.current?.controller.abort();
    const controller = new AbortController();
    const attempt = upload.attempt;
    uploadRun.current = { attempt, controller };

    uploadEnvelope(upload.file, { signal: controller.signal })
      .then((envelope) => dispatchUpload({ type: 'UPLOAD_OK', attempt, envelope }))
      .catch((error: unknown) => {
        // A superseded request is silence, not an error banner.
        if (isCancellation(error)) return;
        const failure = error instanceof ApiRequestError ? error : null;
        dispatchUpload({
          type: 'UPLOAD_FAIL',
          attempt,
          code: failure?.code ?? 'NETWORK_ERROR',
          message: failure?.message ?? UNREACHABLE_MESSAGE,
        });
      });
  }, [upload.status, upload.attempt, upload.file]);

  // Abandoned attempts (replaced file, removed document) are cancelled, not
  // merely ignored — the reducer already refuses their results.
  useEffect(() => {
    const run = uploadRun.current;
    if (run && run.attempt !== upload.attempt) {
      run.controller.abort();
      uploadRun.current = null;
    }
  }, [upload.attempt]);

  const envelope = uploadedEnvelope(upload);

  // Losing the envelope (removed or replaced) must not strand the user on a
  // step that has no document behind it — Step 3 no less than Step 2.
  useEffect(() => {
    if (envelope === null && step !== 1) setStep(1);
  }, [envelope, step]);

  // The wire projection of the rows, which is what the field rules compare
  // against. Computed once here rather than twice in two children.
  const recipientInputs = useMemo(() => toRecipientInputs(recipients), [recipients]);

  return (
    <div className="app">
      <Stepper current={step} />

      {step === 1 || envelope === null ? (
        <UploadStep
          state={upload}
          onSelectFile={(file) => dispatchUpload({ type: 'SELECT_FILE', file })}
          onRemove={() => dispatchUpload({ type: 'REMOVE' })}
          onRetry={() => dispatchUpload({ type: 'RETRY' })}
          onContinue={() => goTo(2)}
        />
      ) : step === 2 ? (
        <RecipientsStep
          envelope={envelope}
          state={recipients}
          dispatch={dispatchRecipients}
          onBack={() => goTo(1)}
          onContinueToFields={() => goTo(3)}
        />
      ) : (
        <FieldsStep
          envelope={envelope}
          recipients={recipientInputs}
          orderMode={recipients.orderMode}
          state={fields}
          dispatch={dispatchFields}
          onBack={() => goTo(2)}
        />
      )}
    </div>
  );
}
