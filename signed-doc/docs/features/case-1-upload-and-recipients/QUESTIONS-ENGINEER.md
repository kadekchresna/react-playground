# Engineering Questions — case-1-upload-and-recipients

**Audience:** engineering / architecture. Implementation-shaped clarifications only.
**Companion file:** [`QUESTIONS-PM.md`](./QUESTIONS-PM.md) — product / business / scope clarifications.
**PRD source:** `signed-doc/test_1_en.md`
**Verified READY by:** Phase 1 (VERIFY) on 2026-09-28 — see [`prd-verify-report.md`](./prd-verify-report.md)
**Cross-check coverage:** `INSUFFICIENT` — 0 similar shipped features available. This is a greenfield standalone repository with no Outline / Engineering Hub connector in this session and no sibling service to compare against. Architectural decisions downstream therefore rest on the PRD text plus the locked inputs, with no historical grounding. Flagged so the reviewer weights ADR confidence accordingly.

> **ID scheme.** IDs follow `Q<category>.<index>` from `prd-intake/references/question-bank.md`. Where this feature needs a question the bank has no entry for, the next free index inside the correct category is used and marked `(extends bank)`. IDs are shared across this file and `QUESTIONS-PM.md` — no ID appears in both.
>
> **Answer discipline.** Every question below carries a **recorded default**. A non-answer ("up to you") means the recorded default becomes the decision, sourced as `Engineer (deferred)`. No question is left blank.

---

## 1. PRD bullet mapping (engineer's read)

Bucket legend: `greenfield-new` (net-new code) · `existing-pattern-reuse` (satisfied by a library/framework, wiring only) · `extension-modify` (existing module gains a variant) · `OOS` (explicitly out of scope).

This is a greenfield repository: there is no prior code, so `extension-modify` is empty by construction and `existing-pattern-reuse` only covers third-party libraries doing the mechanical work.

| # | PRD bullet | Bucket | Reference |
|---|---|---|---|
| 1 | §7.1 Dropzone + `input[type=file]`, exactly one document | greenfield-new | `apps/web/src/features/upload/Dropzone.tsx` |
| 2 | §7.2 Frontend validation, specific message per cause | greenfield-new | `packages/shared/src/validation/file.ts` consumed by `UploadStep.tsx` |
| 3 | §7.3 Backend re-validates every upload rule | greenfield-new | `apps/server/src/services/envelope-service.ts` |
| 4 | §7.4 "Your document" card — filename, `Uploaded · {n} pages · {size}`, remove button with naming `aria-label` | greenfield-new | `apps/web/src/features/upload/DocumentCard.tsx`; mockup board 1 markup carries `aria-label="Remove agreement-vendor-2026.pdf"` |
| 5 | §7.5 Remove returns to empty state; second upload REPLACES the first | greenfield-new | `apps/web/src/features/upload/upload-machine.ts` |
| 6 | §7.6 `Continue` disabled until a valid document exists, reason visible | greenfield-new | `UploadStep.tsx` gating block |
| 7 | §7.7 Loading state during upload; retryable error state without losing page context | greenfield-new | `upload-machine.ts` states `idle/validating/uploading/success/error` |
| 8 | §7.8 Filename is untrusted — strip path components, normalize non-basenames, cap length | greenfield-new | `packages/shared/src/validation/file.ts` `sanitizeFilename()` |
| 9 | §7.9 Extension judged from the **sanitized** filename, never `Content-Type` | greenfield-new | `file.ts` `extensionOf()` + `isAllowedExtension()` |
| 10 | §7.10 File content discarded after validation; metadata only | greenfield-new | `envelope-service.ts` — buffer never escapes the handler frame |
| 11 | §8.1 Recipient rows, min 1 max 10 | greenfield-new | `apps/web/src/features/recipients/recipients-reducer.ts` |
| 12 | §8.2 `Add signer` appends empty row with `signature_count` default 1; remove deletes a row | greenfield-new | `recipients-reducer.ts` |
| 13 | §8.3 `−`/`+` stepper and number input clamp 1–20; never `NaN`/`undefined` | greenfield-new | `packages/shared/src/validation/recipient.ts` `clampSignatureCount()` |
| 14 | §8.4 Per-recipient validation: name trimmed non-empty; email minimum rule; duplicate emails rejected case-insensitively after trim | greenfield-new | `recipient.ts` `validateRecipient()` + `findDuplicateEmailGroups()` |
| 15 | §8.5 Validation written once as a reusable module used by FE and BE | greenfield-new | `packages/shared` npm workspace consumed by both `apps/web` and `apps/server` |
| 16 | §8.6 All totals derived; calculation functions pure and testable without rendering | greenfield-new | `packages/shared/src/pricing.ts` `computeCharges()` |
| 17 | §8.7 Summary panel — total signatures, unit price, total charge, remaining quota | greenfield-new | `apps/web/src/features/recipients/SummaryPanel.tsx` |
| 18 | §8.8 `Continue` disabled on validation error OR over quota, reason visible | greenfield-new | `RecipientsStep.tsx` gating block |
| 19 | §8.9 `Continue` calls backend for the authoritative total; FE number is an estimate | greenfield-new | `apps/web/src/api/charge-preview.ts` |
| 20 | §8.10 Recipient change invalidates prior server result; late response never surfaces | greenfield-new | `apps/web/src/features/recipients/preview-controller.ts` |
| 21 | §8.11 Handle empty list, empty name/email, duplicate email, insufficient quota, failed request, slow request; retry without losing typed data | greenfield-new | `preview-controller.ts` + `RecipientsStep.tsx` |
| 22 | §8.12 Accessibility — `<label>` per input, `aria-label` per icon button, visible keyboard focus | greenfield-new | mockup board 2 markup carries `aria-label="Fewer signatures for …"` / `"More signatures for …"` / `"Remove …"` |
| 23 | §9 `POST /api/envelopes` — multipart field `file`, 201 shape, 422 error envelope | greenfield-new | `apps/server/src/routes/envelopes.ts` |
| 24 | §9 `POST /api/envelopes/:id/charge-preview` — 200 shape, fixed validation order, 404 on unknown envelope | greenfield-new | `apps/server/src/routes/charge-preview.ts` |
| 25 | §9 Server sources price and quota itself; client-sent price/total/quota never used; unknown fields → `422 UNKNOWN_FIELD` | greenfield-new | `apps/server/src/config/account.ts` (server-only; never imported by `apps/web`) |
| 26 | §9 Calculation and business rules in a service/use-case layer separate from the HTTP handler | greenfield-new | `apps/server/src/services/*` vs `apps/server/src/routes/*` |
| 27 | §6/§9 Money as decimal type or integers scaled by 100 with string conversion; never binary floats | greenfield-new | `packages/shared/src/money.ts` — `bigint` minor units |
| 28 | §6 Page count from a fixture table keyed by sanitized filename (case-insensitive), default 1 | greenfield-new | `packages/shared/src/page-count.ts` |
| 29 | §9 In-memory storage → README notes SQL injection is not yet relevant but input validation is still enforced | greenfield-new | `apps/server/src/store/envelope-store.ts` + `README.md` |
| 30 | §11 Cost-calculation + validation-module tests, written before the rules, run with real output saved | greenfield-new | `packages/shared/src/**/__tests__/*` + `docs/verification.md` |
| 31 | §3 Multipart parsing with an in-memory buffer and a hard size limit | existing-pattern-reuse | `multer` `memoryStorage()` with `limits.fileSize`; wired in `apps/server/src/routes/envelopes.ts` |
| 32 | §4 Frontend talks to a real HTTP backend across an origin boundary in dev | existing-pattern-reuse | Vite `server.proxy['/api']` in `apps/web/vite.config.ts` |
| 33 | §3 Step 3 "Place fields" board | OOS | Rendered as a locked stepper pill only (`LD-02`); no routing, no fields UI, no scaffolding |
| 34 | §3 `From cloud` upload source | OOS | Rendered disabled with a visible explanation (`LD-05`) |
| 35 | §3 `Save as draft` | OOS | Rendered disabled with a visible explanation (`LD-05`) |
| 36 | §4 PDF content parsing/rendering, affixing signatures or duty stamps, e-meterai/PKI, payments, email/notifications, SSO, deployment, mobile apps | OOS | — |
| 37 | §5 Authentication / login / multi-tenancy | OOS | Single demo account, no login |
| 38 | §3/§8.12 Pixel-perfect visuals, animation, exact fonts/icons, responsive layout | OOS | Explicitly not assessed |
| 39 | §1 Case 2 requirement change | OOS | Arrives only after the minute-24 checkpoint; do not pre-build |

---

## 2. Questions for engineering review

### Q1.1 — Are recipients persisted server-side, or is `charge-preview` a pure calculation over the request body?

**Question:** `POST /api/envelopes/:id/charge-preview` receives the full recipient list on every call and §8.9 calls it a *preview*. Does the envelope record store the last-previewed recipient list, or does the endpoint stay stateless with respect to recipients (envelope holds document metadata + issued price/quota snapshot only)?
**Why it matters:** decides whether the in-memory store needs a mutable `recipients` field, and whether two browser tabs previewing the same envelope can interfere. It also sets the shape Case 2 will have to bend.
**Recorded default:** **stateless with respect to recipients.** The envelope stores `{ id, filename, size_bytes, page_count, created_at }` only. `charge-preview` is a pure function of `(request body, server-sourced price, server-sourced quota)`. Rationale: §9 says "Case 1 changes no quota", so there is nothing to persist; a stateless preview is trivially idempotent and concurrent-tab safe.
**Trade-off accepted:** if Case 2 introduces a "send" step it will need a persisted recipient list. Adding a `recipients` field to the envelope record later is additive and cheap.
**Answer:** use the default

### Q1.4 — Does the upload endpoint need an idempotency key?

**Question:** §7.7 requires a retryable error state. If the client retries an upload that actually succeeded server-side but whose response was lost, we mint a second envelope. Do we need an `Idempotency-Key` header, or is orphaned-envelope garbage acceptable?
**Why it matters:** an idempotency key store is real work (key → response cache + dedup window) and would consume a meaningful slice of a 24-minute budget.
**Recorded default:** **no idempotency key in Case 1.** Envelopes are in-memory, free to create, and the frontend only ever holds one at a time (§7.5 — a second upload replaces the first). An orphaned envelope is invisible and evaporates on restart.
**Trade-off accepted:** documented as a known gap in `docs/decisions.md`, not silently ignored.
**Answer:** use the default

### Q1.5 — Money representation: `bigint` minor units, or a decimal library? *(extends bank)*

**Question:** §6/§9 permit "a decimal type **or** integers scaled by 100 with string conversion". Which do we take?
**Why it matters:** this choice appears in every layer and is the single most reviewed correctness property in the brief.
**Recorded default:** **`bigint` integer minor units** (1 IDR = `100n`), with `parseDecimalString` / `formatDecimalString` as the only conversion points, and the decimal string as the sole wire format.
**Rationale:** a `bigint` *cannot* hold a fractional value — the type system forbids it. That is a stronger guarantee than a documented convention on `number`, and it needs no dependency. `decimal.js` would also be correct but adds a dependency and still permits a float to leak in through a careless constructor.
**Trade-off accepted:** `BigInt` is not JSON-serializable, so every money value must pass through `formatDecimalString` at the boundary. That friction is a feature here — the contract demands strings anyway, so the compiler enforces the contract.

### Q1.6 — Does the "one shared validation module" requirement force a single-language stack? *(extends bank)*

**Question:** §8.5 allows duplicating rules across languages "as long as there is one clear source of truth and both are tested". The locked input for this workspace is stricter: **one** module used by both sides. Does that stand?
**Why it matters:** it eliminates Go/Python/Rust backends outright and fixes the stack at TypeScript on both ends.
**Recorded default:** **the stricter reading stands** — one TypeScript package (`packages/shared`) imported by both `apps/web` and `apps/server`. One module, one test suite, zero drift.
**Trade-off accepted:** the backend must be Node/TypeScript. Given the 24-minute budget and FE-weighted review (±60% FE), that is the cheaper side to constrain. Recorded in ADR-001.

### Q1.7 — Within per-recipient validation, which field is checked first, and does the response aggregate or stop at the first failure? *(extends bank)*

**Question:** §9 fixes the *stage* order (payload shape → envelope exists → per-recipient → duplicates → quota) but not the order *inside* a recipient, nor whether a 422 reports one failure or all of them.
**Why it matters:** two reviewers running the same acceptance row can get different error codes from the same payload. This is the sharpest genuine ambiguity in §9.
**Recorded default:** iterate recipients in **index order**; within each recipient check **`signature_count` → `name` → `email`**, matching the order §9 lists the rules in. **First failure wins** and returns immediately with a single `{code, message}`; additive `details.recipient_index` names the offending row.
**Trade-off accepted:** the frontend cannot rely on the server to enumerate every problem at once. It does not need to — it runs the same shared module locally and marks every invalid row itself (§8.4). The server 422 is the authority, not the UI driver.
**Related:** the decision to add `details` is `Q1.9`.

### Q1.8 — Filename longer than 200 characters: truncate or reject? *(extends bank)*

**Question:** §6 gives "max filename length `200` characters after sanitization"; §7.8 says "cap the length". "Cap" reads as truncate, but `FILENAME_INVALID` is available.
**Why it matters:** it changes whether a 500-character but otherwise legitimate `.pdf` name is a success or a 422.
**Recorded default:** **truncate, preserving the extension.** Truncate the stem so `stem + "." + ext` is exactly 200 characters. If the extension alone is ≥ 200 characters, reject with `FILENAME_INVALID` — there is no stem left to keep.
**Rationale:** "cap" is the PRD's own verb; a long name is not hostile, it is just long. Rejecting would be stricter than the brief asks.

### Q1.9 — Does the error envelope carry additive `details`? *(extends bank)*

**Question:** §9 fixes `{"error":{"code","message"}}` as the minimum and says "adding more is fine". §10 requires the FE to "mark the colliding rows" on a duplicate-email rejection. Do we return row indexes?
**Why it matters:** without indexes the FE must re-derive the collision locally; with them, the server and UI can be reconciled.
**Recorded default:** **yes, additive and optional** — `error.details.recipient_indexes?: number[]` on `DUPLICATE_RECIPIENT_EMAIL`, `error.details.recipient_index?: number` on `RECIPIENT_INVALID` / `SIGNATURE_COUNT_INVALID`, `error.details.field?: string` on `UNKNOWN_FIELD`. The frontend's **primary** row marking still comes from the shared module running locally; `details` is used for reconciliation and for a clear error message, never as the only source.
**Trade-off accepted:** slightly larger contract surface. Justified because every added field has a stated consumer, per §9's "every code you add must have a rationale".

### Q1.10 — `FILE_TOO_LARGE`: HTTP 422 or 413? *(extends bank)*

**Question:** §9 shows failures as `422` "in a shape the UI can render". A payload over the limit is conventionally `413 Payload Too Large`.
**Why it matters:** the frontend error renderer has to branch on status code if the two differ.
**Recorded default:** **422** with `code: "FILE_TOO_LARGE"`, same envelope as every other upload failure.
**Rationale:** §9's contract is explicit that upload failures are 422 with a renderable body. One status, one shape, one FE branch. The 413 alternative is recorded in ADR-004's Alternatives.
**Note:** the limit itself (25 MB) is already locked — `LD-01`, not re-asked.

### Q5.2 — Client-side request timeout and slow-request behaviour

**Question:** §8.11 names "slow request" as a case that must be handled, but pins no threshold. What is the client-side timeout for `charge-preview` and for upload, and what does the user see when it trips?
**Why it matters:** without a timeout a hung request leaves `Continue` in a permanent loading state with no escape.
**Recorded default:** `charge-preview` **10 s**, upload **60 s** (25 MB over a slow link needs headroom). On timeout: abort, surface an inline retryable error (`"Could not reach the server — try again"`), keep every typed value intact (§8.11). Implemented with the same `AbortController` that drives the staleness guard, so there is one cancellation path, not two.
**Trade-off accepted:** the thresholds are engineer-chosen and recorded as assumptions in `docs/decisions.md`.

### Q5.3 — Retry count and backoff: automatic or user-driven?

**Question:** §7.7 and §8.11 both require retry. Automatic with backoff, or a user-pressed Retry button?
**Why it matters:** automatic retry interacts badly with the staleness rule (§8.10) — a background retry of a stale request is exactly the bug the PRD is testing for.
**Recorded default:** **user-driven retry only. Zero automatic retries.** A visible "Try again" control on the error state. Rationale: §8.10 demands that a late response from older data never surfaces; the smallest correct system has exactly one in-flight request per user intent, and the user owns the intent.
**Trade-off accepted:** a transient blip costs the user one click. Correctness under §8.10 is worth more than that click, and auto-retry would have to be threaded through the sequence guard anyway.

### Q6.1 — Business metrics and observability floor

**Question:** which counters define "this feature is working"?
**Why it matters:** the bank marks this mandatory, but the brief has no observability requirement and deployment is out of scope (§4).
**Recorded default:** **no metrics backend.** Structured `console` logging on the server for each request (method, path, status, error code, duration) and nothing else. No Prometheus, no OTEL, no dashboards.
**Trade-off accepted:** recorded as an explicit gap in `docs/decisions.md` so it reads as a decision, not an oversight.

### Q9.2 — Environment for end-to-end validation

**Question:** where do the acceptance rows in §10 get verified?
**Recorded default:** **local only.** Vitest for the shared kernel and the FE state/controller units; `supertest` against the Express app in-process for the endpoint rows; a short `curl` script plus a manual browser pass for the rows that are only observable in the UI. There is no staging and no deploy (§4).

### Q9.4 — Is a state/controller test plus a manual demo acceptable in place of DOM interaction tests? *(extends bank)*

**Question:** §11 permits "interaction tests **or** state/controller tests accompanied by a manual demo proving the UI is actually wired up". Which do we commit to, and what proves the wiring?
**Why it matters:** it sets the test dependency footprint (`@testing-library/react` + `jsdom` vs none) and therefore setup cost inside a 24-minute budget.
**Recorded default:** **state/controller tests as the primary evidence**, because that is where the PRD's real invariants live — `clampSignatureCount` never yielding `NaN`, the preview controller never surfacing a stale response, `computeCharges` producing exact decimals. Wiring is proven by a manual browser pass recorded in `docs/verification.md` against the §10 acceptance rows.
**Trade-off accepted:** a rendering regression (correct reducer wired to the wrong prop) would not be caught by unit tests. Mitigation: a thin `@testing-library/react` smoke test per step is the first item on the NICE-TO-HAVE list if budget allows. Stated as a gap, not hidden.
**Hard rule regardless of the answer:** validation-module and cost-calculation tests are written **before** the rules they check, expected values are derived by hand from the PRD fixtures — never copied from implementation output — and the suites include negative cases, not only happy paths (§11, §13.3).

### Q10.1 — Commit chunking *(mandatory category)*

**Question:** commit policy — default is 1 commit per subtask, split at logical boundaries when a diff exceeds 300 LOC. Confirm or override.
**Recorded default:** **default accepted.** One commit per subtask. `ST-1.1` (workspace scaffold) and `ST-2.1` (web shell) will exceed 300 LOC and split at their natural boundaries (config vs source). A final commit/tag named `case-1` marks the minute-24 checkpoint per §13.6 / §14.
**Source:** Engineer.

---

## 3. Cross-check notes

- **Cross-check coverage is `INSUFFICIENT` (0 of the required 2 similar shipped features).** No Outline / Engineering Hub connector is available in this session and this is a standalone greenfield repository. Every ADR downstream is grounded in the PRD text and the locked inputs alone, with no historical precedent to lean on. Weight ADR confidence accordingly.
- **No Figma file exists for this feature.** The `context-bundler` Figma MCP pass is skipped in full. `Upload & Recipients Mockup.html` plus PRD §3 are the design source of truth, and §3/§8.12 put colours, spacing, fonts, icons, animation and responsiveness explicitly outside assessment.
- The mockup's own markup already encodes the accessibility contract §8.12 asks for — `<label for>` on every input, and `aria-label` on the stepper and remove buttons (`Fewer signatures for …`, `More signatures for …`, `Remove …`, `Remove agreement-vendor-2026.pdf`). Reuse those strings verbatim rather than inventing new ones.
- The mockup's summary copy reads `{{totalSignatures}} signatures × {{unitPrice}} per signature` with a `Total charge` block — matching §8.7 exactly except for the remaining-quota line, which §8.7 requires and the mockup omits. The implementation adds it.

## 4. Engineer notes (not for PM)

- `packages/shared` **must not export price or quota**. §5 puts both "known only to the server"; anything in the shared package ends up in the browser bundle. Price and quota live in `apps/server/src/config/account.ts` and reach the frontend only through the `POST /api/envelopes` 201 response, which is exactly why that response carries `price` and `quota`. This is a hard boundary and is called out in ADR-003.
- `clampSignatureCount` (frontend UX, coerces) and `isValidSignatureCount` (backend authority, strictly rejects) are **two different functions** in the same module. The backend must never clamp — §10 requires `0`, `-1`, `2.5`, `"abc"`, empty to produce `422 SIGNATURE_COUNT_INVALID`, not a silently corrected value.
- The number input needs a separate raw-text field in row state so a mid-typing empty box does not force the numeric value to `NaN`. The committed numeric value only changes on a valid parse or on blur. This is the concrete mechanism behind §8.3's "never `NaN`/`undefined`".
- `sanitizeFilename` deliberately **preserves** `<` and `>`. §10 requires `<img src=x onerror=alert(1)>.pdf` to be rendered as text; stripping the characters server-side would make that acceptance row pass trivially while leaving the actual defence (text-only rendering in the frontend) untested. Defence lives at the render boundary, where it belongs.
