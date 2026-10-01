/**
 * The charge-preview controller and its staleness guard (PRD §8.9, §8.10).
 *
 * ## Seam S5 — the guard keys on a payload hash, not on a request counter
 *
 * `previewKey` reduces the preview input — the envelope id and the exact
 * `{ name, email, signature_count, meterai_count }` tuples, in order — to one
 * canonical string. Case 2 §A3 put `meterai_count` on the wire, so it is part
 * of the hashed input too: changing an eMeterai count invalidates a pending
 * preview exactly as changing a signature count does, and for the same
 * structural reason rather than by a second rule someone has to remember.
 * That string is stored beside the last result, and a result is only
 * ever readable through `resultFor(key)`, which compares. Three consequences:
 *
 * 1. **A late response for older data can never become the active result.** Its
 *    key does not match the current one, so it is dropped on arrival and, even
 *    if it somehow were not, `resultFor` would refuse to hand it back.
 * 2. **Any change to recipient data invalidates the previous server result.**
 *    Not because something remembered to clear it, but because the key it is
 *    filed under stops matching. This is the same property a request counter
 *    gives, obtained without a counter.
 * 3. **Editing back to a payload that was already confirmed is not stale.**
 *    A counter would discard a correct answer here; a hash keeps it, because
 *    the answer is still the server's answer for exactly this input. That is
 *    the behavioural difference between the two designs, and it is asserted.
 *
 * Case 2 attaches its `preview_token` to the same key (delta §4.5 / P4).
 *
 * ## One cancellation path (LD-28)
 *
 * The controller owns one `AbortController` per request and hands its signal to
 * the transport. `api/client.ts` composes that signal with the 10 s deadline
 * into the single signal `fetch` sees, so a superseded request and a timed-out
 * request abort by exactly the same mechanism. A cancelled request resolves to
 * silence — never an error banner, because the user did not fail at anything.
 *
 * ## No automatic retries (LD-29)
 *
 * `request()` is called from a user intent and from nowhere else. There is no
 * timer, no backoff and no re-issue in this file; `retry()` re-runs the last
 * intent because a person asked.
 *
 * The transport is a constructor parameter, so the whole guard is testable by
 * resolving two promises in a chosen order — no `fetch`, no `setTimeout`, no
 * wall-clock wait, hence no flake.
 */

import type { ChargePreviewResponse, RecipientInput, ValidationFailureDetails } from '@signed-doc/shared';

import { ApiRequestError, UNREACHABLE_MESSAGE, isCancellation } from '../../api/client.js';

export type PreviewTransport = (
  envelopeId: string,
  recipients: readonly RecipientInput[],
  signal: AbortSignal,
) => Promise<ChargePreviewResponse>;

export type PreviewStatus = 'idle' | 'loading' | 'confirmed' | 'error';

export interface PreviewFailure {
  readonly code: string;
  readonly message: string;
  readonly details?: ValidationFailureDetails;
}

export interface PreviewSnapshot {
  readonly status: PreviewStatus;
  /** The payload key the `result` / `error` below belongs to. */
  readonly key: string | null;
  readonly result: ChargePreviewResponse | null;
  readonly error: PreviewFailure | null;
}

const IDLE: PreviewSnapshot = { status: 'idle', key: null, result: null, error: null };

/**
 * The canonical structural key for a preview input.
 *
 * Deliberately the canonical form ITSELF rather than a fixed-width digest of
 * it: a truncated digest can collide, and a collision here would mean showing
 * one payload's total against a different payload. This key is injective by
 * construction, so it cannot. The array-of-tuples form (rather than
 * `JSON.stringify` of the objects) makes it independent of property order and
 * of any local-only field a row happens to carry.
 */
export function previewKey(envelopeId: string, recipients: readonly RecipientInput[]): string {
  return JSON.stringify([
    envelopeId,
    recipients.map((r) => [r.name, r.email, r.signature_count, r.meterai_count]),
  ]);
}

function toFailure(error: unknown): PreviewFailure {
  if (error instanceof ApiRequestError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return { code: 'NETWORK_ERROR', message: UNREACHABLE_MESSAGE };
}

export class PreviewController {
  readonly #transport: PreviewTransport;

  #snapshot: PreviewSnapshot = IDLE;
  #listeners = new Set<() => void>();

  /** The one in-flight request, with the key it was issued for. */
  #inFlight: { key: string; controller: AbortController } | null = null;

  /** The last intent, so `retry()` does not need the caller to repeat itself. */
  #lastIntent: { envelopeId: string; recipients: readonly RecipientInput[] } | null = null;

  constructor(transport: PreviewTransport) {
    this.#transport = transport;
  }

  getSnapshot(): PreviewSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** `useSyncExternalStore` needs a stable reference, so only replace on change. */
  #emit(next: PreviewSnapshot): void {
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }

  /**
   * The result, but only for the key asked for.
   *
   * This is the second half of the guard: even a result that somehow survived
   * in state cannot be rendered against data it was not computed for.
   */
  resultFor(key: string): ChargePreviewResponse | null {
    const { status, key: heldKey, result } = this.#snapshot;
    return status === 'confirmed' && heldKey === key ? result : null;
  }

  /** The failure, but only for the key asked for. Same reasoning. */
  errorFor(key: string): PreviewFailure | null {
    const { status, key: heldKey, error } = this.#snapshot;
    return status === 'error' && heldKey === key ? error : null;
  }

  isLoadingFor(key: string): boolean {
    return this.#snapshot.status === 'loading' && this.#snapshot.key === key;
  }

  /**
   * Tell the controller what the current payload is.
   *
   * Called whenever recipient data changes. A result or error filed under a
   * different key is dropped, and a request issued for a different key is
   * aborted — one request in flight per user intent, never a queue.
   */
  syncKey(key: string): void {
    if (this.#inFlight && this.#inFlight.key !== key) {
      this.#inFlight.controller.abort();
      this.#inFlight = null;
    }
    // A `loading` status belongs to a request that no longer exists, so it is
    // cleared. A `confirmed` or `error` answer is NOT cleared: it stays filed
    // under its own key and is simply unreadable for any other one. That is
    // what makes the result invalid for changed data without destroying a
    // correct answer the user may edit their way back to.
    if (this.#snapshot.status === 'loading' && this.#snapshot.key !== key) {
      this.#emit(IDLE);
    }
  }

  /**
   * Ask the server for the authoritative total. One user intent, one request.
   *
   * Always resolves — failures land in the snapshot, not in the caller's
   * `catch`, because every failure has a rendered home.
   */
  async request(envelopeId: string, recipients: readonly RecipientInput[]): Promise<void> {
    const key = previewKey(envelopeId, recipients);
    const payload = recipients.map((r) => ({
      name: r.name,
      email: r.email,
      signature_count: r.signature_count,
      meterai_count: r.meterai_count,
    }));

    this.#lastIntent = { envelopeId, recipients: payload };

    // Supersede whatever was in flight, whatever its key.
    this.#inFlight?.controller.abort();
    const controller = new AbortController();
    const run = { key, controller };
    this.#inFlight = run;

    this.#emit({ status: 'loading', key, result: null, error: null });

    try {
      const result = await this.#transport(envelopeId, payload, controller.signal);
      // The guard. `run` is the current request only while nothing has
      // superseded or abandoned it, so an out-of-order arrival for older data
      // is dropped right here — regardless of what the transport chose to do
      // with the abort signal.
      if (this.#inFlight !== run) return;
      this.#inFlight = null;
      this.#emit({ status: 'confirmed', key, result, error: null });
    } catch (error) {
      if (isCancellation(error)) return; // superseded: silence, not a banner
      if (this.#inFlight !== run) return;
      this.#inFlight = null;
      this.#emit({ status: 'error', key, result: null, error: toFailure(error) });
    }
  }

  /** User-driven retry (LD-29). Re-runs the last intent; issues nothing on its own. */
  async retry(): Promise<void> {
    const intent = this.#lastIntent;
    if (!intent) return;
    await this.request(intent.envelopeId, intent.recipients);
  }

  /** Abort anything in flight and forget the result. */
  dispose(): void {
    this.#inFlight?.controller.abort();
    this.#inFlight = null;
    this.#listeners.clear();
    this.#snapshot = IDLE;
  }
}
