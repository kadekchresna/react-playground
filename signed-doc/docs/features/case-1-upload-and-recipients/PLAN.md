# PLAN.md — case-1-upload-and-recipients

> Rich implementation plan. Source of truth for `downstream`. Read top-to-bottom — every section is load-bearing.

- **Feature title:** `case-1-upload-and-recipients`
- **Namespace:** `subproject-a` (local name `sign-doc`; mapped to the fixed upstream enum as `sign-doc -> subproject-a`)
- **Created:** 2026-09-28T00:00:00Z
- **Status:** Proposed (Stage 2a) — flips to Accepted on engineer sign-off, then In Progress (Stage 3)
- **Workspace:** `/Users/kuro/project/react/react-playground/signed-doc/docs/features/case-1-upload-and-recipients/`
- **Workspace mode:** `single-service` (workspace root `/Users/kuro/project/react/react-playground/signed-doc`)
- **PRD source:** `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md` (local file; verdict READY — see `prd-verify-report.md`)
- **Binding engineering spec:** `/Users/kuro/project/react/react-playground/signed-doc/docs/prompt.md` (Section 4 "Critical Facts" and Section 7 "Success Criteria" are binding; Section 5a supplies the requirement IDs traced through this plan)
- **Design source:** `/Users/kuro/project/react/react-playground/signed-doc/Upload & Recipients Mockup.html` plus PRD section 3. No Figma file exists (`LD-10`).
- **Git:** branch `feat/case-1-upload-and-recipients`, already cut from `main`, worked in place inside `signed-doc/`. No worktree (`LD-07`).

---

## Context

> Synthesized by `context-bundler` (Step 3). Read-only pass over the local workspace plus the PRD and the mockup. Locked: 2026-09-28T00:00:00Z.

### Scope

| Input | Value |
|---|---|
| Primary repo absolute path | `/Users/kuro/project/react/react-playground/signed-doc` (role tag `FULLSTACK` — one repo carries FE, BE and the shared kernel) |
| Related repo paths in scope | None. Single-repo feature. The parent directory `/Users/kuro/project/react/react-playground/` holds roughly a dozen unrelated untracked projects and is deliberately NOT in scope and NOT scanned. |
| PRD source | `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md` (local file) |
| Affected namespace(s) | `subproject-a` (local name `sign-doc`) |
| Frontend in scope? | Yes — review weight is FE approximately 60 percent / BE approximately 40 percent (PRD section 4) |
| Feature title | `case-1-upload-and-recipients` |
| Workspace mode | `single-service` — docs live inside the repo at `signed-doc/docs/features/case-1-upload-and-recipients/` |

### PRD Snapshot

Build the "Upload document -> Set recipients" flow (Steps 1 and 2 of a 3-step e-signature simulation) as a runnable fullstack app with a real HTTP backend. Single demo account, no login, no multi-tenancy. Storage may be in-memory. Every business rule must be enforced server-side; frontend validation is UX only.

Acceptance criteria are PRD section 10 (12 scenario rows), restated as binding success criteria in `docs/prompt.md` section 7 (15 rows). Fixtures (PRD section 6): price per signature `"5000.00"`, signature quota `8`, max 10 recipients, `signature_count` integer 1-20, allowed extensions `pdf/jpg/jpeg/png/doc/docx` case-insensitive, max filename length 200 after sanitization, page count from a fixture table keyed on the sanitized filename (`agreement-vendor-2026.pdf` -> 8, `nda-partner.pdf` -> 3, `berita-acara.docx` -> 1, anything else -> 1).

NFR thresholds, normalized:

| Threshold | Value | Source |
|---|---|---|
| Max recipients per document | 10 | PRD section 6 / 8.1 |
| Signatures per recipient | integer 1-20 | PRD section 6 / 8.3 |
| Max filename length after sanitization | 200 characters | PRD section 6 / 7.8 |
| Signature quota (demo account) | 8 | PRD section 6 |
| Price per signature | `"5000.00"` decimal string | PRD section 6 / 9 |
| Max upload size | 25 MB, enforced server-side | `LD-01` (PRD section 10 delegates the number to the implementer) |
| charge-preview client timeout | 10 s | `LD-28` |
| Upload client timeout | 60 s | `LD-28` |
| Latency / throughput / availability SLO | None stated anywhere in the brief | `prd-verify-report.md` row 4 note |
| Total implementation budget | 24 minutes wall clock (PRD section 1) | PRD section 1 / 13.6 |

### Repo: signed-doc (greenfield — nothing to scan)

This is the honest output of `context-bundler/references/repo-scan-recipe.md`: **there is nothing to scan.** Verified once with a single `find` over `/Users/kuro/project/react/react-playground/signed-doc`:

```
Upload & Recipients Mockup.html
test_1_en.md
test_2_en.md
docs/prompt.md
docs/prompt.resume.md
docs/prompt.seed.md
docs/features/case-1-upload-and-recipients/QUESTIONS-ENGINEER.md
docs/features/case-1-upload-and-recipients/QUESTIONS-PM.md
docs/features/case-1-upload-and-recipients/prd-verify-report.md
```

Nine files: eight markdown plus one HTML mockup. Consequences, stated rather than papered over:

- **Section 1 (top-level layout fingerprint):** no `cmd/`, `internal/`, `src/`, `package.json`, `next.config.*`, `Makefile`, lockfile or `compose*.yml`. No stack exists yet. Every expected directory is absent.
- **Section 2 (PRD-keyword entry points):** zero hits. There is no source file for any of the eight domain keywords (upload, envelope, recipient, signature, charge, quota, sanitize, preview) to hit.
- **Section 3 (conventions):** no convention can be sampled, because there are no source files to deep-read. No error-wrapping idiom, no logger convention, no DI site, no state-management choice exists to extend. Every convention in this plan is therefore **introduced**, not extended — which is why the Architecture Slice is unusually prescriptive.
- **Section 4 (UI Kit catalog):** no UI Kit or design-system repo is in scope. No component catalog, no token file, no theme file.
- **Section 5 (read-only invariant):** honoured. The only reads performed were `find`, `cat`/`sed` over the eight markdown files, and an in-memory decode of the mockup bundle. Nothing inside the repo was written except this planning workspace.

The stack is therefore taken from `docs/prompt.md` plus `LD-23` (one shared TypeScript validation module used by both sides), not from repository evidence. See `ADR-001`.

### Service: signed-doc (single in-process service)

- **Service Overview:** `?` — no Outline / Engineering Hub connector is available in this session, so no `Services/<namespace>/<service>/Overview` page could be fetched. The service does not exist yet in any case.
- **Domain blurb (derived from the PRD, not from Outline):** one Express process serving two business endpoints plus a health probe, backed by an in-memory envelope store. Price and signature quota are server-only constants.
- **Owners:** solo engineer (`kadekchresna@gmail.com`). No squad-of-record exists.
- **Integration contracts:** none. No consumers, no publishers, no message bus, no external HTTP dependency.
- **Known gotchas:** `?` — none recorded anywhere, because there is no history.

### Conventions

- **Outline / Engineering Hub recon: not performed — `?`.** No tool ending in `list_collections` is available in this session, so `Conventions/subproject-a` pages could not be read. `QUESTIONS-ENGINEER.md` records the same gap and grades cross-check coverage `INSUFFICIENT` (0 of the required 2 similar shipped features). ADR confidence in this plan rests on the PRD text plus the locked decisions alone, with no historical grounding. Weight it accordingly.
- Conventions that this plan **introduces** (there was nothing to honour):
  - Money never touches `number`. `bigint` minor units internally, decimal string with exactly 2 fraction digits on the wire (`LD-22`, `ADR-006`).
  - Validation lives in exactly one package (`packages/shared`) imported by both sides. No validation `if` inside a React component and none inside an Express handler (`LD-23`, PRD section 8.5).
  - HTTP handlers parse, delegate, and map. All rules live in `apps/server/src/services/*` (PRD section 9).
  - Server-only facts (price, quota, limits) live under `apps/server/src/config/` and are never imported by `apps/web` or exported from `packages/shared` (`ADR-003`).
  - Error envelope is always `{ "error": { "code", "message", "details?" } }`. Upload and preview failures are `422`; unknown envelope is `404` (`LD-26`, `LD-27`).
  - Tests for the validation module and the cost calculation are written **before** the rules they check, with expected values derived by hand from the PRD fixtures (PRD section 11 / 13.3, `LD-32`).

### Related ADRs

None found. No Outline connector, no prior ADR corpus, no sibling service. Every ADR in this plan is net-new and local-only (see Next Action for the publication decision).

### Figma

**Omitted deliberately — the Figma MCP pass was skipped in full.** Reason: no Figma file exists for this feature (`LD-10`, answer to `Q8.1`). `context-bundler` Section 3.2 permits this path; Sections 6 and 7 are therefore replaced by the mockup-derived inventory below rather than left blank. The substituted design source is:

- `Upload & Recipients Mockup.html` — a self-contained bundle. Its markup is gzip+base64 encoded inside three nested `<script type="__bundler/manifest">` blocks, one per board (`Step 1 — Upload document`, `Step 2 — Set recipients`, `Step 3 — Place fields`). It was decoded in memory to read structure, copy and accessibility attributes. No file was written.
- PRD section 3 — the authoritative list of what must be taken from the mockup.

Structure and copy recovered from the mockup, verbatim (this is the design contract):

**Board 1 — Step 1 Upload document**

- Stepper: two pills only — `1 Upload document` (active) and `2 Set recipients`.
- `<h1>` `What needs to be signed?`; field label `Upload document`.
- Dropzone: upload glyph, `Drop your file here or Browse` (`Browse` is an anchor), helper text `One document per request. PDF, JPG, JPEG, PNG, DOC or DOCX.`, an `OR` divider, and a `From cloud` anchor.
- `Your document` card: file glyph, `agreement-vendor-2026.pdf`, `Uploaded · 8 pages · 1.4 MB`, and `<button type="button" aria-label="Remove agreement-vendor-2026.pdf">`.
- Footer: a single `Continue` control.

**Board 2 — Step 2 Set recipients**

- Stepper: `Upload document` shown complete (check glyph), `2 Set recipients` active.
- `<h1>` `Who signs it?`; sub-copy `Everyone below is invited at the same time. Fields are placed manually in the next step.`
- Signer row grid `minmax(0,1fr) minmax(0,1fr) 170px 118px 44px`, columns: `Full name` / `Email address` / `Signatures` / `Charge` / remove.
- Every input carries `<label for>`: ids `signer-name-{i}`, `signer-email-{i}`, `signer-count-{i}`. Placeholders `e.g. Rina Halim` and `name@company.com`.
- Stepper controls: `<button aria-label="Fewer signatures for {name}">−</button>`, `<input type="number" min="1" max="20">`, `<button aria-label="More signatures for {name}">+</button>`. Remove is `aria-label="Remove {name}"`. The mockup's own `a11yName` falls back to `signer {i+1}` when the name is blank — reuse that.
- `Add signer` button with a plus glyph.
- Summary panel: `{totalSignatures} signatures × {unitPrice} per signature`, sub-copy `Deducted from your signature balance when the document is sent. Materai is billed separately.`, then `Total charge` / `{totalCharge}`.
- Footer: `Back` / `Save as draft` / `Continue`.
- The mockup's own inline logic already encodes three of the PRD's rules and is worth copying: money as integer minor units (`IDR x 100`, "no binary float"), `Rp` + `toLocaleString('id-ID')` + `,` + 2-digit fraction for display, and a `parseCount` that rejects non-integer text by keeping the previous value.
- Focus ring is already specified: `input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #4B4EDE; outline-offset: 2px; }` — satisfies PRD section 8.12's "keyboard focus is visible".

**Board 3 — Step 3 Place fields (out of scope)**

- Its stepper shows three pills: `Upload document` (complete), `Set recipients` (complete), `3 Place fields` (active). This is the only place in the mockup where a third pill exists, and it is why `LD-02` chooses a 3-pill stepper with pill 3 locked rather than the 2-pill stepper boards 1 and 2 show. Recorded as a deliberate, documented divergence from boards 1-2.
- Nothing else from board 3 is used. No palette, no drag-and-drop, no signer select, no canvas.

### Design System Gap

Per `context-bundler/references/design-system-gap.md` Section 6 output rules, **both** exemption cases apply here:

- No Figma -> the Figma-side input of the diff does not exist.
- No UI Kit / design-system repo in scope -> **`FE in scope but no UI Kit repo declared — gap analysis skipped.`**

There is consequently no `Reusable` bucket and no `Needs extension` bucket: nothing exists to reuse or extend. Everything is `To build`. The inventory below is derived from the decoded mockup markup above, not invented, and is labelled as a substitute for the normal diff.

| To build (component) | Props | States | Events | Accessibility needs | Token dependencies |
|---|---|---|---|---|---|
| `stepper` | `steps[]`, `activeIndex`, `lockedIndexes[]` | active, complete, upcoming, locked | none | `aria-current="step"` on active; locked pill `aria-disabled="true"` and not focusable | accent `#4B4EDE`, muted `#8A93A0`, rule `#D8DCE3` |
| `dropzone` | `accept`, `disabled`, `onFile` | idle, hover, dragover (optional), invalid | `onFile` | keyboard-reachable `Browse` control bound to a visually hidden `input[type=file]` with a `<label>` | dashed border `#C7CDD8`, surface `#FBFCFD` |
| `document-card` | `filename`, `pageCount`, `sizeLabel`, `onRemove` | default | `onRemove` | remove button `aria-label="Remove {filename}"`; filename rendered as text only, never HTML | border `#E4E7EC` |
| `recipient-row` | `index`, `value`, `errors`, handlers | default, invalid-name, invalid-email, duplicate-email | `onChange`, `onRemove`, `onInc`, `onDec` | `<label for>` on all three inputs; `aria-label` on both stepper buttons and remove; `aria-invalid` plus `aria-describedby` on invalid fields | error red (engineer-chosen — no design exists) |
| `signature-stepper` | `value`, `min=1`, `max=20`, `onChange` | default, at-min, at-max | `onChange` | `aria-label="Fewer/More signatures for {name}"`; number input keeps `min`/`max` | — |
| `summary-panel` | `totalSignatures`, `unitPrice`, `totalCharge`, `quotaRemaining`, `overBy`, `confirmedByServer` | estimate, over-quota, server-confirmed | none | over-quota message is the `aria-describedby` target of the disabled `Continue` | — |
| `disabled-control` | `label`, `reason` | disabled only | none | `disabled` plus `aria-disabled="true"`, reason text adjacent and programmatically associated | — |
| `inline-error` / `retry-banner` | `message`, `onRetry` | error | `onRetry` | `role="alert"` so the retry reason is announced | — |

**Design tokens to add:** no token file exists in code, so every value is new. The eight colours recovered from the mockup (`#4B4EDE` accent, `#3A3DBF` accent-hover, `#1E1F24` text, `#5B6472` / `#8A93A0` muted, `#E4E7EC` / `#D8DCE3` / `#C7CDD8` borders, `#FBFCFD` / `#FFFFFF` surfaces, `#E8F5EE` / `#2A8B5F` success) plus the `Inter` family are carried as plain CSS custom properties in `apps/web/src/styles.css`. PRD section 3 and 8.12 remove colours, spacing, fonts, icons, animation and responsiveness from assessment, so no token system is built.

**Five states have no design at all** and are engineer-designed to the PRD's functional text (`LD-10`): empty dropzone, upload loading, upload error/retry, per-row validation error, over-quota banner.

### Files Touched (predicted)

Everything is new. Nothing is modified, because nothing exists.

| Repo | File / directory | Reason |
|---|---|---|
| `signed-doc` | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json` | Workspace root; single lockfile for all three packages |
| `signed-doc` | `packages/shared/src/**` | The one shared validation + pricing + money kernel (PRD 8.5, 8.6) |
| `signed-doc` | `apps/server/src/**` | Two endpoints plus service layer plus in-memory store (PRD 9) |
| `signed-doc` | `apps/web/src/**` | Step 1 and Step 2 UI (PRD 7, 8) |
| `signed-doc` | `README.md`, `AGENTS.md`, `docs/decisions.md`, `docs/verification.md`, `docs/ai-log.md`, `docs/evidence/*` | Deliverables (PRD 12). Not created by this plan — created in Stage 3. |

### Existing Patterns to Follow

There are no existing code patterns in this repository. The only pre-existing artifacts worth following are the mockup's own conventions, which are treated as the house style for this feature:

- `Existing pattern: accessible-by-construction markup` -> `Where: Upload & Recipients Mockup.html` boards 1-2 -> `Why follow: the mockup already ships the exact aria-label and label-for strings PRD section 8.12 demands. Reuse them verbatim instead of inventing new copy.`
- `Existing pattern: money as integer minor units with id-ID display` -> `Where: mockup board 2 inline logic (money(cents), IDR x 100)` -> `Why follow: it is the mockup's own answer to PRD section 6's no-binary-floats rule and matches LD-22.`
- `Existing pattern: non-integer input keeps the previous value` -> `Where: mockup board 2 parseCount(raw, previous)` -> `Why follow: it is the mechanism that makes PRD section 8.3's never-NaN rule true, and it is already proven in the design.`
- `Existing pattern: questions answered with a recorded default, never blank` -> `Where: QUESTIONS-PM.md / QUESTIONS-ENGINEER.md` -> `Why follow: the Locked Decisions table below inherits that discipline; no row is left unresolved.`

### Open Questions and Gaps

- `Gap: Outline / Engineering Hub MCP is not connected in this session.` -> `Suggested action: accept. Namespace conventions, service overviews and prior ADRs were unreadable; this plan states so instead of inventing them. No action is possible inside the 24-minute budget.`
- `Gap: cross-check coverage is INSUFFICIENT (0 of 2 similar shipped features).` -> `Suggested action: accept, and weight ADR confidence down. Recorded identically in QUESTIONS-ENGINEER.md.`
- `Gap: no Figma; five required UI states have no design.` -> `Suggested action: accept (LD-10). PRD sections 3 and 8.12 exclude visual fidelity from assessment.`
- `Gap: no UI Kit repo, so the design-system diff cannot run.` -> `Suggested action: accept. The mockup-derived To-build inventory above substitutes for it.`
- `Gap: the repo has zero source files, so no convention could be sampled and every convention is introduced.` -> `Suggested action: accept, and treat the Architecture Slice below as normative rather than descriptive — the executor has nothing else to imitate.`
- `Gap: the 24-minute budget is far smaller than this plan's SP total.` -> `Suggested action: follow LD-19's MUST-HAVE order and report the remainder as a specific gap list at the minute-24 checkpoint (PRD section 14). Tracked as a risk in Open Items / Risks.`

### Risks

- Three packages share one `pnpm-lock.yaml`. Parallel stories that each add dependencies would collide on it. Mitigated architecturally: Story `ST-1` owns every manifest and the lockfile, and declares the full dependency set for all three packages up front (`ADR-007`).
- `packages/shared` is bundled into the browser. Anything price- or quota-shaped that leaks into it leaks into the frontend bundle, violating PRD section 5. Formalized as `ADR-003` and re-asserted in the Breaking-Change Checklist.
- The stale-response rule (PRD section 8.10) is the single most-tested behaviour in PRD section 10 and lives entirely in one file (`preview-controller.ts`). Concentration is deliberate so it can be unit-tested without rendering, but it also means one file carries an outsized share of the score.

---

## Locked Decisions

> One row per answered clarifying question, plus the workspace-level decisions fixed at upstream Step 1. `LD-ID` is the stable identifier other documents in this workspace already cite (`prd-verify-report.md` cites `LD-01` and `LD-14`; `QUESTIONS-ENGINEER.md` cites `LD-01`, `LD-02`, `LD-05`). `Q-ID` traces back to `QUESTIONS-PM.md` / `QUESTIONS-ENGINEER.md`. No row is unresolved.

| LD-ID | Q-ID | Question | Decision | Source |
|---|---|---|---|---|
| LD-01 | — | Max upload file size, which PRD section 10 delegates to the implementer | **25 MB**, enforced **server-side** via `multer` `limits.fileSize`, surfaced as `422 FILE_TOO_LARGE`. The browser also pre-checks for UX only. Recorded as an assumption in `docs/decisions.md`. | Engineer (PRD delegates) |
| LD-02 | — | Does the stepper show 2 steps or a locked 3rd? | **3 steps.** Pill 3 `Place fields` renders visibly locked/disabled, display-only. No routing, no fields UI, no scaffolding, not focusable. | Engineer |
| LD-03 | — | Storage model | **In-memory only.** File bytes are discarded after validation; only metadata is kept. Decision recorded in `README.md` per PRD section 7.10. | PRD sections 4 / 7.10 |
| LD-04 | — | Namespace and workspace mode | Namespace `sign-doc`, mapped to the fixed enum as `sign-doc -> subproject-a`. Workspace mode `single-service`, root `/Users/kuro/project/react/react-playground/signed-doc`. | Engineer |
| LD-05 | Q4.3 | `From cloud` and `Save as draft`: remove, or show disabled? | **Render disabled with visible explanatory text** `Not available in this exercise`, `disabled` plus `aria-disabled="true"`, no click handler. | PM |
| LD-06 | Q10.1 | Commit chunking | One commit per subtask, Conventional Commits. Split diffs over 300 LOC at the config/source boundary. A final commit tagged `case-1` marks the minute-24 checkpoint. | Engineer |
| LD-07 | — | Git strategy | Work in place inside `signed-doc/` on the existing branch `feat/case-1-upload-and-recipients`, already cut from `main`. **No worktree.** | Engineer |
| LD-08 | — | Story-point unit | `1 SP = 30 min`, baseline measured **without** AI acceleration. Each subtask SP includes its own test effort. | Engineer |
| LD-09 | — | Where the deliverable docs live | `signed-doc/README.md`, `signed-doc/AGENTS.md`, `signed-doc/docs/decisions.md`, `signed-doc/docs/verification.md`, `signed-doc/docs/ai-log.md`. Created in Stage 3, not by this plan. | PRD section 12 |
| LD-10 | Q8.1 | Figma availability and completeness | **No Figma file exists.** `Upload & Recipients Mockup.html` plus PRD section 3 are the design source of truth. The Figma MCP pass is skipped in full. Five states (empty dropzone, upload loading, upload error, per-row validation error, over-quota banner) have no design and are engineer-designed to the PRD text. | PM |
| LD-11 | Q8.3 | Language and currency formatting | **English UI copy taken verbatim from the mockup**, money **displayed** as `Rp15.000,00` via `id-ID` formatting. No i18n framework. The **API contract value stays a plain decimal string** (`"15000.00"`) in every direction; formatting happens only at the last render step. | PM |
| LD-12 | Q2.4 | Can the user delete the last recipient row? | Remove stays **visible but `disabled`** with `aria-disabled="true"` and the hint `At least one recipient is required`. The empty-list path is still handled defensively server-side: a zero-length array returns `422 RECIPIENT_COUNT_INVALID`. | PM |
| LD-13 | Q2.5 | Terminal state after Step 2 `Continue` succeeds | Replace the locally-estimated summary with the **server's authoritative figures** (`total_signatures`, `price.signature`, `total_charge`, `quota_remaining`), label them as server-confirmed, and show an inline note that Step 3 is outside this exercise. **No navigation.** The locked Step 3 pill stays locked. | PM |
| LD-14 | Q4.1 | Feature-flag default state | **No feature flag.** No deploy surface, no rollout, no tenant to scope a flag to. If one were ever added, the default is OFF. Documented resolution of `prd-verify-report.md` checklist row 5. | Engineer (PM deferred) |
| LD-15 | Q2.6 | Are the seeded recipients pre-filled on first load? | **Seed both exactly as given**: Rina Halim / rina.halim@example.test / 2, and Budi Santoso / budi.santoso@example.test / 1. Frontend initial state only — the server never assumes recipients exist. | PM |
| LD-16 | Q2.7 | Behaviour at the 10-recipient ceiling | `Add signer` stays **visible but `disabled`**, with the reason shown next to it: `Maximum 10 recipients per document`. | PM |
| LD-17 | Q2.8 | Remaining-quota display when the list exceeds quota | Remaining quota is **clamped at `0`**, shown alongside an explicit over-quota message naming the numbers, e.g. `9 of 8 signatures — 1 over your quota`. `Continue` is disabled and `aria-describedby` points at that message. | PM |
| LD-18 | Q3.3 | Does Case 1 ever consume quota? | **No.** `charge-preview` is read-only with respect to quota; `quota_remaining` is computed, never stored. The mockup's "when the document is sent" copy refers to a send action that does not exist in Case 1. | PRD section 8.9 |
| LD-19 | Q3.4 | Priority order if the 24-minute budget runs out | MUST-HAVE, in order: (1) shared validation + cost-calculation module with tests written first and real output saved; (2) both backend endpoints with the exact PRD section 9 contract, codes and validation order; (3) Step 1 upload UI end-to-end against the real backend; (4) Step 2 recipients UI with derived totals and gated `Continue`; (5) the stale-response guard. NICE-TO-HAVE, dropped first: drag-and-drop, DOM interaction tests on top of state/controller tests, visual polish. | PM |
| LD-20 | Q1.1 | Are recipients persisted server-side? | **Stateless with respect to recipients.** The envelope stores `{ id, filename, size_bytes, page_count, created_at }` only. `charge-preview` is a pure function of `(request body, server-sourced price, server-sourced quota)` — idempotent and concurrent-tab safe. | Engineer |
| LD-21 | Q1.4 | Does upload need an idempotency key? | **No idempotency key in Case 1.** Envelopes are in-memory and free to create; the frontend holds at most one. An orphaned envelope is invisible and evaporates on restart. Documented as a known gap in `docs/decisions.md`. | Engineer |
| LD-22 | Q1.5 | Money representation | **`bigint` integer minor units** (1 IDR = `100n`), with `parseDecimalString` / `formatDecimalString` as the **only** conversion points and the decimal string as the sole wire format. No `decimal.js`, no `number`. | Engineer |
| LD-23 | Q1.6 | Does "one shared validation module" force a single-language stack? | **Yes — the stricter reading stands.** One TypeScript package (`packages/shared`) imported by both `apps/web` and `apps/server`. One module, one test suite, zero drift. The backend is therefore Node/TypeScript. | Engineer |
| LD-24 | Q1.7 | Per-recipient field order, and aggregate-vs-first-failure | Iterate recipients in **index order**; within each recipient check **`signature_count` -> `name` -> `email`**. **First failure wins**, returns immediately with a single `{code, message}` plus additive `details.recipient_index`. | Engineer |
| LD-25 | Q1.8 | Filename longer than 200 characters | **Truncate, preserving the extension** so `stem + "." + ext` is exactly 200 characters. If the extension alone is 200 characters or longer, reject with `FILENAME_INVALID`. | Engineer |
| LD-26 | Q1.9 | Does the error envelope carry additive `details`? | **Yes, additive and optional:** `details.recipient_indexes?: number[]` on `DUPLICATE_RECIPIENT_EMAIL`, `details.recipient_index?: number` on `RECIPIENT_INVALID` / `SIGNATURE_COUNT_INVALID`, `details.field?: string` on `UNKNOWN_FIELD`. The frontend's primary row marking still comes from the shared module running locally. | Engineer |
| LD-27 | Q1.10 | `FILE_TOO_LARGE`: 422 or 413? | **`422`** with `code: "FILE_TOO_LARGE"`, same envelope as every other upload failure. One status, one shape, one frontend branch. The 413 alternative is recorded in `ADR-004`. | Engineer |
| LD-28 | Q5.2 | Client timeout and slow-request behaviour | `charge-preview` **10 s**, upload **60 s**. On timeout: abort, surface an inline retryable error `Could not reach the server — try again`, keep every typed value intact. Implemented with the **same `AbortController`** that drives the staleness guard, so there is one cancellation path. Thresholds recorded as assumptions in `docs/decisions.md`. | Engineer |
| LD-29 | Q5.3 | Retry: automatic or user-driven? | **User-driven only. Zero automatic retries.** A visible `Try again` control on the error state. Exactly one in-flight request per user intent, because auto-retry is precisely the bug PRD section 8.10 tests for. | Engineer |
| LD-30 | Q6.1 | Observability floor | **No metrics backend.** Structured `console` logging on the server per request (method, path, status, error code, duration) and nothing else. No Prometheus, no OTEL, no dashboards. Recorded as an explicit gap in `docs/decisions.md`. | Engineer |
| LD-31 | Q9.2 | Environment for end-to-end validation | **Local only.** Vitest for the shared kernel and the frontend state/controller units; `supertest` against the Express app in-process for the endpoint rows; a short `curl` script plus a manual browser pass for UI-only rows. No staging, no deploy. | Engineer |
| LD-32 | Q9.4 | State/controller tests plus manual demo, or DOM interaction tests? | **State/controller tests are the primary evidence**; wiring is proven by a manual browser pass recorded in `docs/verification.md` against the PRD section 10 rows. A thin `@testing-library/react` smoke test per step is the first NICE-TO-HAVE if budget allows. Hard rule regardless: validation and cost-calculation tests are written **before** the rules, expected values derived by hand from PRD fixtures, negative cases included. | Engineer |

---

## Problem Statement

A reviewer must be able to clone this repository, run two commands from `README.md`, and drive the document-preparation flow end to end: upload exactly one document, see it validated and described, then name 1-10 signers with a signature count each and get an authoritative charge from the server. The feature exists to prove that business rules survive a hostile client — the browser may pre-check, but the server sanitizes the filename, judges the extension from the sanitized name, enforces its own 25 MB limit, sources price and quota from its own side, and rejects any client-supplied total. Nothing is persisted: the file's bytes are discarded after validation and only metadata survives.

Done means, measurably: `agreement-vendor-2026.pdf` returns `201` with `page_count: 8` and enables `Continue`; `.exe` and `.pdf.exe` are rejected by both layers with `FILE_TYPE_NOT_ALLOWED`; `../../etc/passwd.pdf` comes back as a bare basename; `<img src=x onerror=alert(1)>.pdf` renders as inert text; Rina (2) plus Budi (1) yields `total_signatures: 3`, `total_charge: "15000.00"` and `quota_remaining: 5`; 9 signatures against a quota of 8 disables `Continue` with a visible reason and returns `422 INSUFFICIENT_SIGNATURE_QUOTA` if forced; and a preview response for stale recipient data never becomes the active result. All 15 rows of `docs/prompt.md` section 7 pass, with real test output saved in `docs/verification.md`.

---

## ADR Section

> Seven ADRs. All `Proposed` until engineer sign-off. IDs are stable and already cited elsewhere in this workspace: `QUESTIONS-ENGINEER.md` `Q1.6` cites `ADR-001`, its Engineer-notes section cites `ADR-003`, and `Q1.10` cites `ADR-004`.

### ADR-001: One TypeScript workspace — React/Vite frontend, Express backend, one shared kernel

**Status:** Proposed

**Context:**
PRD section 8.5 requires validation written once as a reusable module used by both frontend and backend. The brief permits duplicating rules across languages provided there is one clear source of truth, but `LD-23` takes the stricter reading: **one** module, imported by both sides. That single constraint eliminates every polyglot option — a Go, Python or Rust backend cannot import a TypeScript module. PRD section 4 additionally requires the frontend to talk to a **real HTTP backend** across a process boundary, so a browser-only app is not acceptable either. The repository is greenfield (see Context > Repo), so there is no incumbent stack to honour.

**Decision:**
Ship a single `pnpm` workspace at `signed-doc/` with three packages: `packages/shared` (the validation, pricing, money and sanitization kernel), `apps/server` (Express + TypeScript + `multer` memory storage, run with `tsx`), and `apps/web` (React + Vite + TypeScript, with `server.proxy['/api']` pointing at the Express port in dev). `packages/shared` is consumed by both apps as a workspace dependency. Tests run on Vitest everywhere; endpoint tests use `supertest` in-process.

**Consequences:**
- Positive: the shared kernel is literally one file set with one test suite. Rule drift between layers becomes impossible rather than merely discouraged.
- Positive: one language, one type system, one test runner. The `ChargePreviewRequest` / `ChargePreviewResponse` types are shared, so a contract mismatch is a compile error rather than a runtime surprise.
- Positive: Vite's dev proxy keeps the frontend talking to a real HTTP origin (satisfying PRD section 4) without CORS ceremony.
- Negative / trade-off: the backend is constrained to Node. Given review weight of roughly 60 percent frontend and a 24-minute budget, the backend is the cheaper side to constrain.
- Negative / trade-off: a `pnpm` workspace with three packages costs a few minutes of scaffolding before a single business rule is written. Mitigated by making that scaffold the first subtask of `ST-1` and pinning all dependencies once (`ADR-007`).
- Operational impact: two processes in dev (`vite` and `tsx watch`), one `pnpm dev` script at the root to start both.
- Reversal cost: **medium.** Swapping the backend language later means reimplementing and re-testing the kernel on the other side, which is exactly the drift `LD-23` exists to prevent.

**Alternatives Considered:**
1. **Next.js single-process fullstack (route handlers).** PRD section 4 explicitly permits it, and it would remove the proxy and the second process. Rejected because the brief's hardest scoring property is that business rules do **not** live only in the browser, and a single Next.js bundle makes the client/server boundary a convention (`'use server'`, `server-only`) rather than a package boundary. `ADR-003`'s "price and quota must never reach the browser bundle" becomes enforceable by inspection with two separate packages, and merely reviewable with one. The framework's own build/dev overhead is also larger than a Vite plus Express pair inside a 24-minute budget.
2. **Go backend with the validation rules duplicated in Go and TypeScript.** PRD section 8.5 permits duplication with one source of truth. Rejected on `LD-23` plus arithmetic: two implementations means two test suites for the same rules, doubling the section 11 "minimum tests" obligation, and the duplicate is the most likely place for a drift bug — which is the failure mode the requirement is written to catch.
3. **Frontend-only app with mocked HTTP.** Rejected outright: PRD section 4 forbids it, and PRD section 7.3 makes server re-validation the point of the exercise.

**Related ADRs:** ADR-003, ADR-006, ADR-007
**Locked Decision link:** `LD-23`, `LD-04`

### ADR-002: Envelopes live in an in-memory map; file bytes are discarded after validation

**Status:** Proposed

**Context:**
PRD section 4 states storage may be in-memory and no database is required. PRD section 7.10 goes further: file content does not need to be stored permanently, it may be discarded after validation with only metadata kept, and that decision must be recorded in the README. `LD-20` additionally fixes `charge-preview` as stateless with respect to recipients, so the only thing needing a home is document metadata. PRD section 9 requires a note about SQL injection when storage is in-memory.

**Decision:**
`apps/server/src/store/envelope-store.ts` holds a module-level `Map<string, EnvelopeRecord>` where `EnvelopeRecord = { id, filename, size_bytes, page_count, created_at }`. The uploaded buffer is read by `envelope-service` for size and (nothing else — page count comes from the fixture table, not the bytes) and then goes out of scope inside the handler frame; no reference to it is ever stored, logged, or returned. Envelope ids are sequential and opaque (`env_01`, `env_02`, ...), matching the PRD's own example. Recipients are never persisted (`LD-20`).

**Consequences:**
- Positive: satisfies PRD section 7.10 exactly and makes the "no real personal data at rest" posture of PRD section 5 trivially true — a process restart is a complete erasure.
- Positive: no migration, no schema, no container, no connection pool. `pnpm test` needs no external service.
- Positive: because the bytes never escape the handler frame, there is no temp-file cleanup path to get wrong and no path-traversal write primitive anywhere in the system.
- Negative / trade-off: envelopes vanish on restart, so a reviewer who restarts the server mid-demo must re-upload. Called out in `README.md`.
- Negative / trade-off: no `Content-Type` sniffing or magic-byte check is possible on a discarded buffer beyond the upload request itself — acceptable, because PRD section 7.9 explicitly judges the extension from the sanitized filename and forbids trusting `Content-Type`.
- Operational impact: `README.md` must state that SQL injection is not yet relevant because there is no SQL, while input validation is still fully enforced (PRD section 9).
- Reversal cost: **low.** The store is a single module behind a two-method surface (`save`, `findById`); a real repository can replace it without touching the services.

**Alternatives Considered:**
1. **SQLite (file-backed) with parameterized queries.** Would let the plan demonstrate the parameterized-query discipline PRD section 9 mentions. Rejected: it adds a dependency, a schema, a migration and a cleanup story for zero requirement coverage, inside a 24-minute budget, when the brief says a database is not required. The security point is instead made explicitly in the README as the brief asks.
2. **Keep the uploaded buffer in memory alongside the metadata** (so a future "send" step could use it). Rejected: PRD section 7.10 invites discarding it, a 25 MB buffer per envelope with no eviction policy is an unbounded leak in a long-running demo process, and retaining bytes creates a data-at-rest question the brief explicitly lets us avoid.

**Related ADRs:** ADR-004
**Locked Decision link:** `LD-03`, `LD-20`, `LD-21`

### ADR-003: Price and quota are server-only; `packages/shared` must never export them

**Status:** Proposed

**Context:**
PRD section 5 states price and quota belong to the single demo account and are **known only to the server**. PRD section 9 reinforces it: the server sources price and quota from its own side, client-sent price/total/quota are never used, and unknown input fields produce `422 UNKNOWN_FIELD`. But `packages/shared` is imported by `apps/web` and therefore ends up in the browser bundle. Any constant placed there for convenience silently violates section 5. This is the sharpest architectural hazard created by `ADR-001`'s single-language choice.

**Decision:**
Price (`"5000.00"`) and signature quota (`8`) live in `apps/server/src/config/account.ts` and nowhere else. `packages/shared` exports **rules and pure functions only** — `computeCharges` takes the unit price as a parameter and never sources it. The frontend learns price and quota exclusively from the `POST /api/envelopes` `201` body (which is precisely why that response carries `price` and `quota`) and treats them as opaque server-issued values used for the on-screen estimate. The 25 MB limit and the client timeouts live in `apps/server/src/config/limits.ts` and `apps/web/src/api/client.ts` respectively — the browser's copy of the size limit is a UX pre-check only and carries a comment saying so.

**Consequences:**
- Positive: PRD section 5's "known only to the server" becomes verifiable by grep — `grep -rn "5000" packages/shared apps/web/src` should return nothing but formatting fixtures in tests.
- Positive: the `UNKNOWN_FIELD` rule gets a natural home. The request schema for `charge-preview` accepts exactly `{ recipients: [{ name, email, signature_count }] }`; any other key at any level is rejected with `details.field`, so a client attempting to supply `total_charge` or `quota` is refused rather than ignored.
- Negative / trade-off: `computeCharges(recipients, unitPriceMinor)` has one more parameter than a version that reads a constant. That is the point — the function cannot accidentally become authoritative.
- Negative / trade-off: the frontend cannot compute any estimate before an upload succeeds, since it has no price until the `201` lands. Acceptable: Step 2 is unreachable before Step 1 completes.
- Operational impact: a review checklist line in `AGENTS.md` under "input trust boundaries".
- Reversal cost: **low** to tighten, **high** to reverse — once a price constant is in the shared package it is in the bundle, and removing it later means auditing every import.

**Alternatives Considered:**
1. **Put the fixtures in `packages/shared/src/fixtures.ts` and import from both sides.** Simplest and most DRY. Rejected because it ships the demo account's commercial terms to the browser, directly contradicting PRD section 5, and because it makes it far too easy for a frontend estimate to be mistaken for the authoritative total that PRD section 8.9 insists must come from the server.
2. **Expose a `GET /api/pricing` endpoint the frontend calls on load.** Rejected: it adds a third endpoint and a load-order dependency for no gain, because the `POST /api/envelopes` `201` response already carries `price` and `quota` by contract (PRD section 9).

**Related ADRs:** ADR-001, ADR-006
**Locked Decision link:** `LD-03`, `LD-11`

### ADR-004: The 25 MB upload limit is enforced server-side and reported as `422 FILE_TOO_LARGE`

**Status:** Proposed

**Context:**
PRD section 10's large-file row says behaviour follows the limit **you** define, that whatever the limit is it must be enforced **on the server** and not only in the browser, and that it must be recorded as an assumption in `docs/decisions.md`. `LD-01` fixes the number at 25 MB. PRD section 9 shows upload failures as `422` in a shape the UI can render, while HTTP convention would suggest `413 Payload Too Large` — `LD-27` resolves that in favour of `422`.

**Decision:**
`multer` is configured with `memoryStorage()` and `limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 0 }` in `apps/server/src/http/upload-middleware.ts`. Multer's `LIMIT_FILE_SIZE` error is translated by `apps/server/src/http/error-mapper.ts` into `422 { error: { code: "FILE_TOO_LARGE", message: "File is larger than the 25 MB limit" } }`. The stream is aborted by multer as the limit is crossed, so a 300 MB upload is refused without ever buffering 300 MB. The frontend performs the same size check before sending purely to save the user a round trip, and the limit is restated as an assumption in `docs/decisions.md`.

**Consequences:**
- Positive: PRD section 7 row 5 of `docs/prompt.md` section 7 passes by construction, and it passes on the server even if the browser check is bypassed with `curl`.
- Positive: one HTTP status and one envelope shape for every upload failure means the frontend error renderer has a single branch (`response.status === 422 -> render error.code`), which is what `LD-27` optimizes for.
- Positive: `files: 1, fields: 0` closes the multi-file and extra-field vectors at the parser, before any handler code runs — which also means the `UNKNOWN_FIELD` rule does not need a multipart variant.
- Negative / trade-off: `422` for an oversize payload is not the conventional status. A reviewer expecting `413` will notice. Mitigated by documenting it in `README.md`'s endpoint mapping and here.
- Negative / trade-off: 25 MB of a hostile upload is still buffered in memory before rejection in the worst case. Acceptable for a single-user demo with no concurrency requirement; noted in `docs/decisions.md`.
- Operational impact: none — no reverse proxy exists in this setup, so no second limit needs to agree.
- Reversal cost: **low.** One constant in one config file plus one line in the docs.

**Alternatives Considered:**
1. **`413 Payload Too Large` with the same envelope.** More conventional and arguably more correct HTTP. Rejected per `LD-27`: PRD section 9 is explicit that upload failures are `422` with a renderable body, and splitting the status forces the frontend to branch on status before it can branch on code, for no user-visible benefit.
2. **Enforce in the browser only, and let the server accept anything.** Rejected outright — PRD section 10 names this as the failure mode ("not only in the browser"), and PRD section 7.3 makes the server the decision-maker for every upload rule.
3. **Stream to a temp file and check size on disk.** Rejected: it contradicts `ADR-002`'s discard-after-validation posture, introduces a cleanup path, and gives an attacker a disk-fill primitive for no requirement coverage.

**Related ADRs:** ADR-002
**Locked Decision link:** `LD-01`, `LD-27`

### ADR-005: Step 3 is a locked, display-only stepper pill — no route, no scaffold

**Status:** Proposed

**Context:**
PRD section 3's bullet list asks for "a 2-step stepper", but the mockup's own board 3 renders a three-pill stepper with `3 Place fields`. `docs/prompt.md` section 6 flags this as needing confirmation; `LD-02` resolves it in favour of three pills with the third locked. Meanwhile PRD sections 3 and 4 are emphatic that the Step 3 board is out of scope for Case 1, that it must not be started, and that doing it early earns nothing. PRD section 3 separately forbids leaving out-of-scope controls as dead controls that appear to work.

**Decision:**
`apps/web/src/components/Stepper.tsx` renders exactly three pills: `1 Upload document`, `2 Set recipients`, `3 Place fields`. Pill 3 is rendered with the locked visual treatment, carries `aria-disabled="true"`, is removed from the tab order, and has no click handler and no route behind it. There is no `apps/web/src/features/place-fields/` directory, no route entry, no reducer, no type, and no `TODO` referring to it. The only other Step 3 surface is `LD-13`'s inline note on the Step 2 success state saying Step 3 is outside this exercise. `From cloud` and `Save as draft` follow the same pattern through a shared `DisabledControl` component (`LD-05`).

**Consequences:**
- Positive: the three-step shape communicates where the flow goes without spending a single line on it, and the locked pill is self-documenting — a reviewer reads "deliberately scoped out" rather than "unfinished".
- Positive: `aria-disabled` plus removal from the tab order means a keyboard user cannot reach a dead end, satisfying PRD section 8.12's spirit as well as its letter.
- Positive: the "no scaffolding" rule is verifiable: `grep -ril "place.fields" apps/web/src` should return only `Stepper.tsx` and the Step 2 success note.
- Negative / trade-off: the stepper diverges from mockup boards 1-2, which show only two pills. Recorded as a deliberate divergence in Context > Figma and in `docs/decisions.md`.
- Operational impact: none.
- Reversal cost: **low.** Dropping the third pill is a one-line change; adding Step 3 later is a new feature either way.

**Alternatives Considered:**
1. **Two-pill stepper, matching PRD section 3's prose and mockup boards 1-2.** Defensible and literally compliant. Rejected per `LD-02`: it hides the fact that the flow has a third step, which makes the Step 2 terminal state (`LD-13`) read as an abrupt end rather than a deliberate stop, and it discards information the mockup's board 3 actually gives us.
2. **Three pills where pill 3 is a clickable route to an "out of scope" placeholder page.** Rejected: a route is scaffolding, and PRD sections 3 and 4 forbid scaffolding Step 3. It would also be a dead control that appears to work, which PRD section 3 names explicitly as the thing not to do.

**Related ADRs:** none
**Locked Decision link:** `LD-02`, `LD-05`, `LD-13`

### ADR-006: Money is `bigint` minor units internally and a 2-decimal string on every boundary

**Status:** Proposed

**Context:**
`docs/prompt.md` section 4 fact 1 is binding: every monetary value in the API contract is a decimal string with exactly 2 fraction digits, never a JSON number, and money must use a decimal type or integers scaled by 100 with string conversion — never binary floats, on both frontend and backend. PRD section 6 adds that there is no tax, discount, cash balance or intermediate rounding, which removes the need for a full decimal arithmetic library. `LD-22` chooses `bigint` minor units. The mockup's own inline logic independently arrived at integer minor units with `id-ID` display, so this is also the house style.

**Decision:**
`packages/shared/src/money.ts` defines `type Minor = bigint` (1 IDR = `100n`) plus exactly two conversion functions: `parseDecimalString(s: string): Minor` (strict — requires `^\d+\.\d{2}$`, throws otherwise) and `formatDecimalString(m: Minor): string` (always 2 fraction digits). All arithmetic — per-row charge, total charge — is `bigint` multiplication and addition, so it is exact by construction. `apps/web/src/format/money-display.ts` is the only place that renders `Rp15.000,00`, built from `formatDecimalString` output split on `.` with `Intl.NumberFormat('id-ID')` on the integer part; it is display-only and never feeds a calculation (`LD-11`).

**Consequences:**
- Positive: a `bigint` **cannot** hold a fractional value — the type system forbids it. That is a stronger guarantee than a documented convention on `number`, and it needs no dependency.
- Positive: `BigInt` is not JSON-serializable, so the compiler forces every money value through `formatDecimalString` at the boundary. The friction is the feature: the contract demands strings anyway.
- Positive: the quota-boundary test cases PRD section 11.1 demands become exact-equality assertions on strings, with no epsilon anywhere.
- Negative / trade-off: `bigint` literals and mixed-type arithmetic errors are a small ergonomic tax, and `signature_count` (a plain `number`) must be widened with `BigInt(n)` at each multiplication site.
- Negative / trade-off: display formatting is hand-rolled rather than `Intl.NumberFormat(..., { style: 'currency' })`, because the latter operates on `number`. The hand-rolled path is 4 lines and is unit-tested.
- Operational impact: `tsconfig` target must be `ES2020` or later for `bigint` literals.
- Reversal cost: **low** — the conversion surface is two functions in one file.

**Alternatives Considered:**
1. **`decimal.js` / `big.js`.** Also correct and more general. Rejected per `LD-22`: it adds a dependency, and it still permits a float to leak in through a careless `new Decimal(0.1)` constructor. `bigint` makes that unrepresentable.
2. **`number` with a documented "always integer minor units" convention.** Zero dependency, zero ergonomic tax. Rejected because it relies on discipline rather than the type system, and `docs/prompt.md` section 4 fact 1 is the single most reviewed correctness property in the brief — a convention is exactly what a reviewer would probe.
3. **Strings all the way down, parsing at each arithmetic site.** Rejected: it multiplies the number of parse sites, which multiplies the number of places a malformed string can be mishandled.

**Related ADRs:** ADR-003
**Locked Decision link:** `LD-22`, `LD-11`

### ADR-007: Module boundaries are drawn so three stories are file-disjoint; the shared kernel's API is frozen before implementation

**Status:** Proposed

**Context:**
Stage 3 runs in parallel mode: independent agents work concurrently and each may only edit files it owns. Two agents touching one file is a merge conflict at best and a lost edit at worst. The natural decomposition of this feature (shared kernel / backend / frontend) has two shared-file hazards that would break parallelism if left alone: (1) a single `pnpm-lock.yaml` plus three `package.json` manifests, which every story would otherwise touch to add its own dependencies; and (2) the deliverable docs of PRD section 12, which all three stories have something to say about. There is also a logical dependency — `apps/server` and `apps/web` both import `packages/shared` — that would serialize the work if it were allowed to become a file dependency.

**Decision:**
Draw the boundaries so that **no file has two owners**, and break the logical dependency with a frozen contract instead of an ordering constraint:

1. **`ST-1` owns every manifest, every tsconfig, every test-runner config, and the single lockfile** — including `apps/server/package.json` and `apps/web/package.json`. It declares the complete dependency set for all three packages up front. `ST-2` and `ST-3` are therefore pure `src/**` stories and never touch a manifest or the lockfile.
2. **The public API of `packages/shared` is frozen in this plan** (see Architecture Slice > Port interfaces). `ST-2` and `ST-3` code against those exact signatures from minute zero; they do not wait for `ST-1` to finish. Any signature disagreement surfaces as a compile error at the Wave 3 integration gate, routed back to the owning story's files.
3. **Deliverable docs are split by single owner:** `ST-1` owns `README.md`, `docs/decisions.md` and `docs/ai-log.md`; `ST-2` owns `AGENTS.md` and `docs/evidence/server-tests.txt`; `ST-3` owns `docs/verification.md`, `docs/evidence/web-tests.txt`. `ST-1` also owns `docs/evidence/shared-tests.txt`. `docs/verification.md` references the evidence files by path rather than inlining another story's output.
4. **`TASK.md` is the one deliberate exception** to file-disjointness. It is the shared status board, governed by the race-safe protocol: an agent edits only lines under its own story header, always with unique-context `Edit`, never `replace_all`.

**Consequences:**
- Positive: three stories of 18, 21 and 26 SP run genuinely concurrently with zero file contention and no cross-story rebases.
- Positive: freezing the kernel API in the plan forces the hardest design thinking (what exactly does `validateRecipient` return? what shape does a duplicate group take?) to happen before three agents encode three different guesses.
- Positive: single-owner manifests mean the lockfile is written exactly once, so `pnpm install --frozen-lockfile` is reproducible from a clean checkout as PRD section 12 requires.
- Negative / trade-off: `ST-1` reaches into `apps/server/` and `apps/web/` for their manifests, so directory ownership and file ownership do not coincide. The file-ownership lists in Execution Waves are therefore normative and must be read literally.
- Negative / trade-off: a frozen contract that turns out wrong costs a coordinated fix across two stories. Mitigated by keeping the kernel API small (5 modules, 12 exported symbols) and fully specified below.
- Negative / trade-off: `docs/verification.md` cannot be finalized until the other two stories' evidence files exist. It is the last subtask of `ST-3` and the only cross-story read dependency in the plan — read-only, so still not a file conflict.
- Operational impact: the Wave 3 integration gate is the single place where cross-story type errors are resolved, and fixes are routed to owners rather than applied in place.
- Reversal cost: **low** during planning, **high** once Stage 3 starts — re-drawing ownership mid-flight is what this ADR exists to avoid.

**Alternatives Considered:**
1. **Serial execution: kernel, then backend, then frontend.** Simplest and removes the contract-freeze burden entirely. Rejected because Stage 3 is specified to run in parallel mode, and because the critical path would become the sum of all three stories (65 SP) instead of the longest (26 SP).
2. **Split by layer inside each package instead (one story per PRD section: 7, 8, 9).** Rejected: PRD section 7's requirements land in `packages/shared/src/file.ts`, `apps/server/src/services/envelope-service.ts` and `apps/web/src/features/upload/*` simultaneously, so a section-shaped story owns files in all three packages and collides with every other section-shaped story. Requirement boundaries and file boundaries do not coincide here; file boundaries win because they are what parallelism actually depends on.
3. **Let every story edit the manifests and resolve the lockfile at merge.** Rejected: `pnpm-lock.yaml` conflicts are not meaningfully resolvable by hand, and a mis-resolved lockfile breaks the clean-checkout requirement of PRD section 12.

**Related ADRs:** ADR-001
**Locked Decision link:** `LD-06`, `LD-07`, `LD-09`

---

## Architecture Slice per Repo

> One repo is in scope. Because it is greenfield, this section is normative rather than descriptive: the executor has nothing to imitate, so every file below is specified. Sub-slices are given per workspace package. PRD requirement IDs from `docs/prompt.md` §5a are carried inline.

### Repo: /Users/kuro/project/react/react-playground/signed-doc

- **Role:** FULLSTACK (FE + BE + shared kernel in one `pnpm` workspace)
- **Branch:** `feat/case-1-upload-and-recipients` (already cut from `main`; worked in place, no worktree — `LD-07`)

**Directory layout** (every path is new; nothing is modified):

```
signed-doc/
├── package.json                      [ST-1] root workspace manifest + dev/test/build scripts
├── pnpm-workspace.yaml               [ST-1] packages: ['apps/*', 'packages/*']
├── pnpm-lock.yaml                     [ST-1] single lockfile — sole owner (ADR-007)
├── tsconfig.base.json                [ST-1] strict, target ES2022, moduleResolution bundler
├── .npmrc                            [ST-1] shamefully-hoist=false, engine-strict
├── .gitignore                        [ST-1] node_modules, dist, coverage
├── README.md                         [ST-1] <=15 lines (PRD §12)
├── AGENTS.md                         [ST-2] <=20 lines (PRD §12)
├── docs/
│   ├── decisions.md                  [ST-1] questions, plan, trade-offs, assumptions (PRD §12)
│   ├── verification.md               [ST-3] commands + actual output (PRD §12, §14)
│   ├── ai-log.md                     [ST-1] agent transcript excerpts (PRD §12)
│   └── evidence/
│       ├── shared-tests.txt          [ST-1] raw vitest output, packages/shared
│       ├── server-tests.txt          [ST-2] raw vitest output, apps/server
│       └── web-tests.txt             [ST-3] raw vitest output, apps/web
├── packages/shared/
│   ├── package.json                  [ST-1]
│   ├── tsconfig.json                 [ST-1]
│   ├── vitest.config.ts              [ST-1]
│   └── src/
│       ├── index.ts                  [ST-1] barrel — the frozen public API
│       ├── types.ts                  [ST-1] wire + domain types
│       ├── errors.ts                  [ST-1] error code union + ValidationFailure
│       ├── money.ts                  [ST-1] bigint minor units (ADR-006)
│       ├── file.ts                   [ST-1] filename sanitization + extension rules
│       ├── recipient.ts              [ST-1] name/email/count/duplicate rules
│       ├── pricing.ts                [ST-1] pure derived totals
│       ├── page-count.ts             [ST-1] fixture table lookup
│       └── __tests__/                [ST-1] 5 suites, written before the rules (LD-32)
├── apps/server/
│   ├── package.json                  [ST-1]
│   ├── tsconfig.json                 [ST-1]
│   ├── vitest.config.ts              [ST-1]
│   └── src/
│       ├── index.ts                  [ST-2] process bootstrap / listen
│       ├── app.ts                    [ST-2] composition root — builds the Express app
│       ├── config/account.ts         [ST-2] price + quota, server-only (ADR-003)
│       ├── config/limits.ts          [ST-2] 25 MB, json body cap (ADR-004)
│       ├── store/envelope-store.ts   [ST-2] in-memory Map (ADR-002)
│       ├── services/service-error.ts [ST-2] ServiceError carrying a shared error code
│       ├── services/envelope-service.ts       [ST-2] upload use case
│       ├── services/charge-preview-service.ts [ST-2] preview use case
│       ├── http/upload-middleware.ts [ST-2] multer memoryStorage + limits
│       ├── http/error-mapper.ts      [ST-2] ServiceError/multer -> HTTP envelope
│       ├── http/request-logger.ts    [ST-2] structured console line (LD-30)
│       ├── routes/envelopes.ts       [ST-2] POST /api/envelopes + GET /api/health
│       ├── routes/charge-preview.ts  [ST-2] POST /api/envelopes/:id/charge-preview
│       └── __tests__/                [ST-2] 3 suites (supertest in-process)
└── apps/web/
    ├── package.json                  [ST-1]
    ├── tsconfig.json                 [ST-1]
    ├── vite.config.ts                [ST-1] server.proxy['/api'] -> :3001
    ├── index.html                    [ST-3] app shell
    └── src/
        ├── main.tsx                  [ST-3] React root
        ├── App.tsx                   [ST-3] step orchestration (no router)
        ├── styles.css                [ST-3] mockup-derived CSS custom properties
        ├── components/Stepper.tsx     [ST-3] 3 pills, pill 3 locked (ADR-005)
        ├── components/DisabledControl.tsx [ST-3] From cloud / Save as draft (LD-05)
        ├── api/client.ts             [ST-3] fetch + AbortController + timeouts (LD-28)
        ├── api/upload.ts             [ST-3] POST /api/envelopes
        ├── api/charge-preview.ts     [ST-3] POST .../charge-preview
        ├── format/money-display.ts   [ST-3] Rp15.000,00 via id-ID (LD-11)
        ├── features/upload/          [ST-3] UploadStep, Dropzone, DocumentCard, upload-machine
        ├── features/recipients/      [ST-3] RecipientsStep, RecipientRow, SummaryPanel, reducer, preview-controller, seed
        └── __tests__/                [ST-3] 3 suites (state/controller — LD-32)
```

#### Package: `packages/shared` — the frozen kernel (owner `ST-1`)

**New files, one line each:**

| File | Purpose | PRD IDs |
|---|---|---|
| `src/index.ts` | Barrel re-exporting exactly the public API below. Nothing else is importable. | §8.5 |
| `src/types.ts` | `Recipient`, `RecipientInput`, `EnvelopeMeta`, `ChargePreviewRequest`, `ChargePreviewResponse`, `ApiError`. Shared by both apps so the contract is compiler-checked. | §9 |
| `src/errors.ts` | `ErrorCode` string union (`FILE_REQUIRED`, `FILE_TYPE_NOT_ALLOWED`, `FILENAME_INVALID`, `FILE_TOO_LARGE`, `RECIPIENT_COUNT_INVALID`, `SIGNATURE_COUNT_INVALID`, `RECIPIENT_INVALID`, `DUPLICATE_RECIPIENT_EMAIL`, `INSUFFICIENT_SIGNATURE_QUOTA`, `UNKNOWN_FIELD`, `ENVELOPE_NOT_FOUND`) plus the `ValidationFailure` shape carrying optional `details`. | §9, §10 |
| `src/money.ts` | `Minor = bigint`; `parseDecimalString`, `formatDecimalString`, `multiplyMinor`, `sumMinor`. The only conversion points in the system. | §6, §9 |
| `src/file.ts` | `sanitizeFilename` (strip `/`, `\`, `..`, reject non-basenames, truncate to 200 preserving extension), `extensionOf` (on the sanitized name), `isAllowedExtension`, `validateFileMeta`. | §7.8, §7.9, §10 path-traversal + XSS rows |
| `src/recipient.ts` | `clampSignatureCount` (FE, coercing), `isValidSignatureCount` (BE, strict), `validateRecipient`, `findDuplicateEmailGroups`, `normalizeEmail`, `validateRecipientList`. | §8.3, §8.4, §8.5 |
| `src/pricing.ts` | `computeCharges(recipients, unitPriceMinor)` -> per-row charges, `totalSignatures`, `totalChargeMinor`; `quotaRemaining(totalSignatures, quota)` clamped at 0 with `overBy`. Pure, no imports from React or Express. | §8.6, §8.7, §10 Rina/Budi row |
| `src/page-count.ts` | `pageCountFor(sanitizedFilename)` — case-insensitive fixture lookup, default `1`. Never reads file content. | §6 |
| `src/__tests__/*.test.ts` | Five suites: `money`, `file`, `recipient`, `pricing`, `page-count`. Written **before** the rules; expected values derived by hand from PRD §6. | §11.1, §11.2, §13.3 |

**Port interfaces — the frozen public API (`ADR-007` item 2). `ST-2` and `ST-3` code against these exact signatures:**

```ts
// money.ts
export type Minor = bigint;                            // 1 IDR === 100n
export function parseDecimalString(s: string): Minor;   // strict /^\d+\.\d{2}$/, throws RangeError otherwise
export function formatDecimalString(m: Minor): string;  // always 2 fraction digits, e.g. 15000n*100n -> "15000.00"
export function multiplyMinor(m: Minor, n: number): Minor;
export function sumMinor(xs: readonly Minor[]): Minor;

// file.ts
export interface SanitizedFilename { readonly value: string; readonly truncated: boolean }
export function sanitizeFilename(raw: string): SanitizedFilename | ValidationFailure;
export function extensionOf(sanitized: string): string;          // lowercased, without the dot, "" when absent
export function isAllowedExtension(ext: string): boolean;        // pdf jpg jpeg png doc docx
export function validateFileMeta(raw: { filename: string; sizeBytes: number; maxSizeBytes: number })
  : { filename: string; sizeBytes: number } | ValidationFailure;

// recipient.ts
export interface RecipientInput { name: string; email: string; signature_count: number }
export function clampSignatureCount(raw: unknown, previous: number): number;   // FE: never NaN/undefined
export function isValidSignatureCount(raw: unknown): boolean;                   // BE: integer 1..20, no coercion
export function normalizeEmail(raw: string): string;                            // trim + toLowerCase
export function validateRecipient(r: RecipientInput, index: number): ValidationFailure | null;
export function findDuplicateEmailGroups(rs: readonly RecipientInput[]): readonly number[][];
export function validateRecipientList(rs: unknown): ValidationFailure | null;   // order: count -> per-recipient -> duplicates

// pricing.ts
export interface ChargeBreakdown {
  readonly rows: readonly { readonly index: number; readonly signatures: number; readonly chargeMinor: Minor }[];
  readonly totalSignatures: number;
  readonly totalChargeMinor: Minor;
}
export function computeCharges(rs: readonly RecipientInput[], unitPriceMinor: Minor): ChargeBreakdown;
export function quotaRemaining(totalSignatures: number, quota: number)
  : { readonly remaining: number; readonly overBy: number };   // remaining clamped at 0 (LD-17)

// page-count.ts
export function pageCountFor(sanitizedFilename: string): number;   // fixture table, case-insensitive, default 1

// errors.ts
export interface ValidationFailure {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: { recipient_index?: number; recipient_indexes?: number[]; field?: string };
}
```

**DI composition root sites:** none inside this package by design. `packages/shared` has **zero** runtime dependencies and imports nothing from either app. It never reads price, quota or the size limit — every such value arrives as a parameter (`ADR-003`).

**DB schema / indexes:** none. Not a persistence layer.

#### Package: `apps/server` — HTTP + service layer (owner `ST-2`)

**New files, one line each:**

| File | Purpose | PRD IDs |
|---|---|---|
| `src/index.ts` | Reads `PORT` (default `3001`), calls `createApp()`, listens. The only file with a side effect at import time. | §9 |
| `src/app.ts` | Composition root. Builds the store, injects it into both services, mounts `requestLogger`, `express.json({ limit })`, both routers, then `errorMapper` last. Exported as `createApp()` so `supertest` can drive it in-process without a port. | §9, §11 |
| `src/config/account.ts` | `PRICE_PER_SIGNATURE = parseDecimalString("5000.00")`, `SIGNATURE_QUOTA = 8`. Server-only; never imported by `apps/web` (`ADR-003`). | §5, §6, §9 |
| `src/config/limits.ts` | `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`, `MAX_JSON_BYTES = 64 * 1024`, `MAX_RECIPIENTS = 10`. | §10 large-file row, `LD-01` |
| `src/store/envelope-store.ts` | `createEnvelopeStore()` -> `{ save, findById }` over a `Map`. Sequential ids `env_01`. Holds metadata only (`ADR-002`). | §4, §7.10 |
| `src/services/service-error.ts` | `ServiceError extends Error` carrying `ValidationFailure` plus an HTTP status (`422` or `404`). The only channel from service to handler. | §9 |
| `src/services/envelope-service.ts` | Upload use case: require a file -> `sanitizeFilename` -> `extensionOf` + `isAllowedExtension` -> size check -> `pageCountFor` -> `store.save`. Returns the `201` body including server-sourced `price` and `quota`. The buffer is never assigned to anything outside this function. | §7.3, §7.8, §7.9, §7.10, §9 |
| `src/services/charge-preview-service.ts` | Preview use case in the fixed order: payload shape (strict key allow-list -> `UNKNOWN_FIELD`) -> envelope exists (`404`) -> per-recipient (`signature_count` -> `name` -> `email`, first failure wins) -> duplicates -> quota. Then `computeCharges` + `quotaRemaining`. Stateless w.r.t. recipients (`LD-20`). | §8.4, §8.9, §9, §10 |
| `src/http/upload-middleware.ts` | `multer({ storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 } }).single('file')`. | §7.1, §10 large-file row |
| `src/http/error-mapper.ts` | Express error middleware. `ServiceError` -> its status + envelope; multer `LIMIT_FILE_SIZE` -> `422 FILE_TOO_LARGE`; malformed JSON -> `422`; anything else -> `500` with no leaked internals. | §9, `LD-27` |
| `src/http/request-logger.ts` | One structured `console.log` per request: method, path, status, error code, duration ms. No metrics backend (`LD-30`). | §9 |
| `src/routes/envelopes.ts` | `POST /api/envelopes` (upload middleware -> service -> `201`) and `GET /api/health` (`{status:"ok"}`, so the README's run instructions are checkable). Parses and maps only. | §9 |
| `src/routes/charge-preview.ts` | `POST /api/envelopes/:id/charge-preview`. Parses and maps only. | §9 |
| `src/__tests__/envelope-service.test.ts` | Service-level unit tests incl. discard-after-validation and the fixture page counts. | §11 |
| `src/__tests__/envelopes.route.test.ts` | `supertest`: `agreement-vendor-2026.pdf` -> `201`/8 pages; `.exe` and `.pdf.exe` -> `422 FILE_TYPE_NOT_ALLOWED`; `../../etc/passwd.pdf` -> sanitized basename; `<img src=x onerror=alert(1)>.pdf` -> stored verbatim as a basename; missing file -> `FILE_REQUIRED`; oversize -> `FILE_TOO_LARGE`. | §10 rows 1-5 |
| `src/__tests__/charge-preview.route.test.ts` | `supertest`: Rina+Budi -> `3 / "15000.00" / 5`; 9 signatures -> `INSUFFICIENT_SIGNATURE_QUOTA`; trimmed case-variant duplicate -> `DUPLICATE_RECIPIENT_EMAIL` with `details.recipient_indexes`; `signature_count` of `0/-1/2.5/"abc"/null` -> `SIGNATURE_COUNT_INVALID`; extra `total_charge` / `quota` -> `UNKNOWN_FIELD` with `details.field`; `env_999` -> `404`; empty array -> `RECIPIENT_COUNT_INVALID`; 11 recipients -> `RECIPIENT_COUNT_INVALID`. | §10 rows 6-11 |

**DI composition root sites (5 — all inside `src/app.ts`):**

1. `const store = createEnvelopeStore()` — the single store instance.
2. `const envelopeService = createEnvelopeService({ store, account: ACCOUNT, limits: LIMITS })` — injects server-only config.
3. `const chargePreviewService = createChargePreviewService({ store, account: ACCOUNT, limits: LIMITS })`.
4. `app.use(requestLogger)` then `app.use('/api', envelopesRouter({ envelopeService }))` and `app.use('/api', chargePreviewRouter({ chargePreviewService }))` — routers are factories taking their service, so tests can substitute.
5. `app.use(errorMapper)` — registered last, after every router.

**Port interfaces (server-side):**

```ts
export interface EnvelopeRecord {
  readonly id: string; readonly filename: string;
  readonly size_bytes: number; readonly page_count: number; readonly created_at: string;
}
export interface EnvelopeStore {
  save(meta: Omit<EnvelopeRecord, 'id' | 'created_at'>): EnvelopeRecord;
  findById(id: string): EnvelopeRecord | undefined;
}
export interface EnvelopeService {
  createFromUpload(file: { originalname: string; size: number; buffer: Buffer } | undefined): EnvelopeCreatedResponse;
}
export interface ChargePreviewService {
  preview(envelopeId: string, body: unknown): ChargePreviewResponse;
}
```

**DB schema:** none — in-memory `Map<string, EnvelopeRecord>` (`ADR-002`). The record shape above is the whole "schema".

**Indexes:** none. Lookup is by primary key through `Map.get`, which is the only query path in the system. No secondary access pattern exists, so no index is warranted.

**Migration pointer:** see §DB Migration Plan — no migration exists; the section states why.

#### Package: `apps/web` — Step 1 and Step 2 UI (owner `ST-3`)

Detailed in §Frontend Slice below. Summary: no router (a two-value step state in `App.tsx` is sufficient and avoids scaffolding a Step 3 route — `ADR-005`), no global state library (`useReducer` per feature is enough and keeps the reducers unit-testable without rendering, as `LD-32` requires), no UI kit.

**DI composition root sites (2):** `src/main.tsx` (React root + `styles.css` import) and `src/App.tsx` (owns `step`, the `EnvelopeMeta` handed from Step 1 to Step 2, and the server-issued `price`/`quota`; passes them down as props — no context, no store).

**DB schema / indexes:** N/A — browser package.

---

## New Endpoints — Route Table

> One repo, one service. Every route is NEW; nothing is modified, so no `(MOD)` rows exist. There is no authn/authz layer anywhere: PRD §5 specifies a single demo account with no login, and inventing auth would be out of scope.

### Repo: /Users/kuro/project/react/react-playground/signed-doc (`apps/server`)

| Method | Path | Middleware | Handler | Request | Response | Authz |
|---|---|---|---|---|---|---|
| POST | `/api/envelopes` | `requestLogger`, `uploadMiddleware` (`multer.memoryStorage`, `fileSize=25MB`, `files=1`, `fields=0`), `errorMapper` | `envelopes.create` -> `envelopeService.createFromUpload` | `multipart/form-data`, single field `file` | `201 EnvelopeCreatedResponse`; `422 ApiError` (`FILE_REQUIRED`, `FILE_TYPE_NOT_ALLOWED`, `FILENAME_INVALID`, `FILE_TOO_LARGE`) | none — single demo account, no auth (PRD §5) |
| POST | `/api/envelopes/:id/charge-preview` | `requestLogger`, `express.json({ limit: 64kb })`, `errorMapper` | `chargePreview.create` -> `chargePreviewService.preview` | `ChargePreviewRequest` — `{ recipients: [{ name, email, signature_count }] }`, strict key allow-list | `200 ChargePreviewResponse`; `404 ApiError` (`ENVELOPE_NOT_FOUND`); `422 ApiError` (`UNKNOWN_FIELD`, `RECIPIENT_COUNT_INVALID`, `SIGNATURE_COUNT_INVALID`, `RECIPIENT_INVALID`, `DUPLICATE_RECIPIENT_EMAIL`, `INSUFFICIENT_SIGNATURE_QUOTA`) | none |
| GET | `/api/health` | `requestLogger` | `envelopes.health` | none | `200 { "status": "ok" }` | none |

Notes:

- Paths match PRD §9 exactly, so no endpoint remapping needs to be documented in `README.md`. `GET /api/health` is additive and exists so the README's run instructions are verifiable in one `curl`.
- Validation order on `charge-preview` is fixed and tested: payload shape -> envelope exists -> per-recipient -> duplicates -> quota (PRD §9, `LD-24`).
- `express.json` is mounted **per-router**, not globally, so the multipart route is never touched by the JSON body parser.

---

## Frontend Slice

> `apps/web` — React 18 + Vite + TypeScript. Owner `ST-3`. Figma references are N/A for every row: no Figma file exists (`LD-10`); the design reference is the decoded mockup structure recorded in §Context > Figma, and the copy strings there are normative.

**Pages** (no router — `App.tsx` switches on a `step` value, which is also how Step 3 stays unscaffolded per `ADR-005`):

| Route / view | Component file | Notes | PRD IDs |
|---|---|---|---|
| Step 1 view | `src/features/upload/UploadStep.tsx` | `What needs to be signed?` heading, dropzone, document card, gated `Continue` | §7.1-§7.7 |
| Step 2 view | `src/features/recipients/RecipientsStep.tsx` | `Who signs it?` heading, recipient rows, `Add signer`, summary panel, `Back`/`Save as draft`(disabled)/`Continue` | §8.1-§8.12 |
| Step 3 | none — intentionally absent | Rendered only as a locked pill in `Stepper.tsx` | §3, `ADR-005` |

**Components** (parent -> child):

```
App.tsx
├── Stepper.tsx                          3 pills; pill 3 locked, aria-disabled, not focusable   (ADR-005)
├── UploadStep.tsx                       §7.1-§7.7
│   ├── Dropzone.tsx                     "Drop your file here or Browse" + helper text; hidden
│   │                                    input[type=file] bound to a <label>; FE pre-validation
│   ├── DisabledControl.tsx  ("From cloud")   disabled + aria-disabled + visible reason (LD-05)
│   └── DocumentCard.tsx                 filename as TEXT ONLY, "Uploaded · {n} pages · {size}",
│                                        remove button aria-label="Remove {filename}"   (§7.4, §10 XSS row)
└── RecipientsStep.tsx                   §8.1-§8.12
    ├── RecipientRow.tsx  (x1..10)       label-for on all 3 inputs; aria-label on -, +, remove;
    │                                    aria-invalid + aria-describedby on invalid fields
    ├── SummaryPanel.tsx                 "{n} signatures × {price} per signature", "Total charge",
    │                                    remaining quota clamped at 0 + over-by message  (LD-17)
    └── DisabledControl.tsx  ("Save as draft")                                            (LD-05)
```

**State slices** (no Zustand, no Redux, no Context — `useReducer` per feature so every reducer is testable without rendering, per `LD-32`):

| Slice | File | Shape / actions | PRD IDs |
|---|---|---|---|
| Upload machine | `src/features/upload/upload-machine.ts` | states `idle -> validating -> uploading -> success -> error`; actions `SELECT_FILE`, `FE_REJECT`, `UPLOAD_OK`, `UPLOAD_FAIL`, `RETRY`, `REMOVE`. A second `SELECT_FILE` **replaces** — the state holds at most one document, so files cannot accumulate. | §7.5, §7.6, §7.7 |
| Recipients | `src/features/recipients/recipients-reducer.ts` | `rows: { id, name, email, signature_count, countRaw }[]`; actions `SET_NAME`, `SET_EMAIL`, `SET_COUNT_RAW`, `COMMIT_COUNT`, `INC`, `DEC`, `ADD_ROW`, `REMOVE_ROW`. `countRaw` is a separate string field so a mid-typing empty box never forces the numeric value to `NaN`; the numeric value changes only on a valid parse or on blur. `ADD_ROW` is a no-op at 10 rows; `REMOVE_ROW` is a no-op at 1 row (`LD-12`, `LD-16`). | §8.1-§8.3, §10 signature_count row |
| Recipients seed | `src/features/recipients/seed.ts` | Rina Halim / 2 and Budi Santoso / 1, exactly as PRD §6 gives them. Frontend initial state only. | `LD-15` |
| Preview controller | `src/features/recipients/preview-controller.ts` | Holds a monotonically increasing `requestSeq` plus the live `AbortController`. Any recipient change increments `requestSeq` and aborts the in-flight request; a response is accepted **only** if its sequence equals the current one. Same `AbortController` also carries the 10 s timeout (`LD-28`). Zero automatic retries (`LD-29`). | §8.9, §8.10, §10 last row |
| Derived values | none — computed in render from `computeCharges` / `quotaRemaining` | Never stored, never synced. This is the mechanism behind PRD §8.6. | §8.6, §8.7 |

**SDK primitives** (there is no separate SDK package; the API layer inside `apps/web` plays that role — all three are NEW):

| Function | File | Notes |
|---|---|---|
| `request<T>(path, init, timeoutMs, signal?)` | `src/api/client.ts` | One `fetch` wrapper. Owns `AbortController` composition and the timeout, and normalizes a `422`/`404` body into a typed `ApiError`. The single cancellation path (`LD-28`). |
| `uploadEnvelope(file, signal)` | `src/api/upload.ts` | `FormData` with field `file`; 60 s timeout. |
| `fetchChargePreview(envelopeId, recipients, signal)` | `src/api/charge-preview.ts` | Sends **only** `{ recipients: [{ name, email, signature_count }] }` — never price, total or quota (`ADR-003`); 10 s timeout. |
| `formatIdr(decimalString)` | `src/format/money-display.ts` | `"15000.00"` -> `Rp15.000,00` via `Intl.NumberFormat('id-ID')` on the integer part. Display-only; never feeds a calculation (`LD-11`). |

**Gating and accessibility contract (explicit, because these are scored rows):**

- Step 1 `Continue` is `disabled` until the upload machine is in `success`, with the reason rendered adjacent and referenced by `aria-describedby` (§7.6).
- Step 2 `Continue` is `disabled` when any row fails `validateRecipient`, when a duplicate group exists, or when `totalSignatures > quota`; the reason text is always on screen and is the `aria-describedby` target (§8.8, `LD-17`).
- On Step 2 `Continue` success, the summary swaps to the server's figures labelled as server-confirmed, with an inline note that Step 3 is outside this exercise, and **no navigation occurs** (`LD-13`).
- Duplicate rows are marked from the shared module running locally; `error.details.recipient_indexes` from the server is used for reconciliation and message text only, never as the sole source (`LD-26`).
- Every input has a `<label for>`; every icon button has an `aria-label`, reusing the mockup's own strings verbatim (`Fewer signatures for {name}`, `More signatures for {name}`, `Remove {name}`, `Remove {filename}`), including the mockup's `signer {i+1}` fallback when the name is blank. Focus ring: `outline: 2px solid #4B4EDE; outline-offset: 2px` on `:focus-visible` (§8.12).
- The filename is rendered as a text node only — never `dangerouslySetInnerHTML`, never an attribute-interpolated `innerHTML`. `sanitizeFilename` deliberately **preserves** `<` and `>` so this defence is actually exercised by the §10 XSS row rather than passing trivially.

---

## API Spec — OpenAPI YAML

> Every route in §New Endpoints appears here and the two views agree. Deviations from the house conventions in `adr-planner/references/openapi-spec-template.md` are deliberate and listed after the block.

```yaml
openapi: 3.0.3
info:
  title: case-1-upload-and-recipients API
  version: 0.1.0
  description: |
    Endpoints for Case 1 (Upload document + Set recipients).
    Single demo account, no authentication (PRD section 5).
    Every monetary value is a decimal string with exactly 2 fraction digits, never a JSON number (PRD section 6).
    The server sources price and quota itself; client-sent price, total or quota values are never used.
servers:
  - url: http://localhost:3001
    description: Local development (Express). The Vite dev server proxies /api here.
paths:
  /api/health:
    get:
      summary: Liveness probe
      operationId: getHealth
      tags: [ops]
      responses:
        '200':
          description: Server is up
          content:
            application/json:
              schema:
                type: object
                required: [status]
                properties:
                  status:
                    type: string
                    enum: [ok]
  /api/envelopes:
    post:
      summary: Upload exactly one document and create an envelope
      operationId: createEnvelope
      tags: [envelopes]
      description: |
        Multipart upload with a single field named file.
        Server-side order: file present -> filename sanitized -> extension judged from the
        sanitized filename -> size limit (25 MB) -> page count from the fixture table.
        File bytes are discarded after validation; only metadata is retained.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
            encoding:
              file:
                contentType: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
      responses:
        '201':
          description: Envelope created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EnvelopeCreated'
        '422':
          description: |
            Upload rejected. code is one of FILE_REQUIRED, FILE_TYPE_NOT_ALLOWED,
            FILENAME_INVALID, FILE_TOO_LARGE.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                fileTypeNotAllowed:
                  value:
                    error:
                      code: FILE_TYPE_NOT_ALLOWED
                      message: File type is not supported
                fileTooLarge:
                  value:
                    error:
                      code: FILE_TOO_LARGE
                      message: File is larger than the 25 MB limit
  /api/envelopes/{id}/charge-preview:
    post:
      summary: Compute the authoritative charge for a recipient list
      operationId: createChargePreview
      tags: [envelopes]
      description: |
        Stateless with respect to recipients: nothing is persisted and no quota is consumed.
        Fixed validation order: payload shape -> envelope exists -> per-recipient
        (signature_count, then name, then email; first failure wins) -> duplicates -> quota.
        Any property outside the documented allow-list yields 422 UNKNOWN_FIELD.
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
          description: Envelope id returned by createEnvelope, for example env_01
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChargePreviewRequest'
            examples:
              rinaAndBudi:
                value:
                  recipients:
                    - name: Rina Halim
                      email: rina.halim@example.test
                      signature_count: 2
                    - name: Budi Santoso
                      email: budi.santoso@example.test
                      signature_count: 1
      responses:
        '200':
          description: Authoritative totals. The server value is final; any frontend number is an estimate.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChargePreview'
              examples:
                rinaAndBudi:
                  value:
                    recipient_count: 2
                    total_signatures: 3
                    price:
                      signature: '5000.00'
                    charges:
                      signature: '15000.00'
                    total_charge: '15000.00'
                    quota:
                      signature: 8
                    quota_remaining:
                      signature: 5
        '404':
          description: Envelope does not exist
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                notFound:
                  value:
                    error:
                      code: ENVELOPE_NOT_FOUND
                      message: Envelope not found
        '422':
          description: |
            Validation failed. code is one of UNKNOWN_FIELD, RECIPIENT_COUNT_INVALID,
            SIGNATURE_COUNT_INVALID, RECIPIENT_INVALID, DUPLICATE_RECIPIENT_EMAIL,
            INSUFFICIENT_SIGNATURE_QUOTA.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                unknownField:
                  value:
                    error:
                      code: UNKNOWN_FIELD
                      message: Unknown field is not accepted
                      details:
                        field: total_charge
                duplicateEmail:
                  value:
                    error:
                      code: DUPLICATE_RECIPIENT_EMAIL
                      message: Duplicate recipient email
                      details:
                        recipient_indexes: [0, 1]
                signatureCountInvalid:
                  value:
                    error:
                      code: SIGNATURE_COUNT_INVALID
                      message: signature_count must be an integer between 1 and 20
                      details:
                        recipient_index: 0
                insufficientQuota:
                  value:
                    error:
                      code: INSUFFICIENT_SIGNATURE_QUOTA
                      message: 9 of 8 signatures - 1 over your quota
components:
  schemas:
    Money:
      type: string
      pattern: '^[0-9]+\.[0-9]{2}$'
      description: Decimal string with exactly 2 fraction digits. Never a JSON number.
      example: '5000.00'
    EnvelopeCreated:
      type: object
      required: [envelope_id, document, price, quota]
      properties:
        envelope_id:
          type: string
          example: env_01
        document:
          type: object
          required: [filename, size_bytes, page_count]
          properties:
            filename:
              type: string
              maxLength: 200
              description: Sanitized basename. No path components. Rendered as text by the client.
              example: agreement-vendor-2026.pdf
            size_bytes:
              type: integer
              format: int64
              example: 1468006
            page_count:
              type: integer
              minimum: 1
              description: From the fixture table keyed on the sanitized filename. Never parsed from content.
              example: 8
        price:
          type: object
          required: [signature]
          properties:
            signature:
              $ref: '#/components/schemas/Money'
        quota:
          type: object
          required: [signature]
          properties:
            signature:
              type: integer
              example: 8
    RecipientInput:
      type: object
      additionalProperties: false
      required: [name, email, signature_count]
      properties:
        name:
          type: string
          minLength: 1
          description: Trimmed, must be non-empty after trimming.
        email:
          type: string
          description: Trimmed. Exactly one at-sign, non-empty local part, domain containing a dot with non-empty parts on both sides.
        signature_count:
          type: integer
          minimum: 1
          maximum: 20
    ChargePreviewRequest:
      type: object
      additionalProperties: false
      required: [recipients]
      properties:
        recipients:
          type: array
          minItems: 1
          maxItems: 10
          items:
            $ref: '#/components/schemas/RecipientInput'
    ChargePreview:
      type: object
      required:
        - recipient_count
        - total_signatures
        - price
        - charges
        - total_charge
        - quota
        - quota_remaining
      properties:
        recipient_count:
          type: integer
          example: 2
        total_signatures:
          type: integer
          example: 3
        price:
          type: object
          required: [signature]
          properties:
            signature:
              $ref: '#/components/schemas/Money'
        charges:
          type: object
          required: [signature]
          properties:
            signature:
              $ref: '#/components/schemas/Money'
        total_charge:
          $ref: '#/components/schemas/Money'
        quota:
          type: object
          required: [signature]
          properties:
            signature:
              type: integer
              example: 8
        quota_remaining:
          type: object
          required: [signature]
          properties:
            signature:
              type: integer
              minimum: 0
              description: Clamped at 0. Never negative.
              example: 5
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              enum:
                - FILE_REQUIRED
                - FILE_TYPE_NOT_ALLOWED
                - FILENAME_INVALID
                - FILE_TOO_LARGE
                - RECIPIENT_COUNT_INVALID
                - SIGNATURE_COUNT_INVALID
                - RECIPIENT_INVALID
                - DUPLICATE_RECIPIENT_EMAIL
                - INSUFFICIENT_SIGNATURE_QUOTA
                - UNKNOWN_FIELD
                - ENVELOPE_NOT_FOUND
            message:
              type: string
            details:
              type: object
              description: Additive and optional. Every member has a named consumer.
              properties:
                recipient_index:
                  type: integer
                recipient_indexes:
                  type: array
                  items:
                    type: integer
                field:
                  type: string
```

Deliberate deviations from the house OpenAPI conventions, each with a reason:

- **No `bearerAuth` security scheme, no `401`/`403` responses.** PRD §5 specifies a single demo account with no login. Documenting auth that does not exist would be fiction.
- **No `/v1/` version prefix.** PRD §9 fixes the paths as `/api/envelopes` and `/api/envelopes/:id/charge-preview`. Renaming them would force an endpoint-mapping table in `README.md` for zero benefit.
- **Ids are `env_01`-style sequential strings, not ULIDs.** PRD §9's own example uses `env_01`, and the store is in-memory and single-process (`ADR-002`).
- **No pagination.** There is no collection GET in this feature.
- **`created_at` is not returned.** It exists on the stored record but PRD §9's required response fields do not include it, and adding it to the contract buys nothing.

---

## DB Migration Plan

**N/A — there is no database.** Storage is an in-memory `Map` (`LD-03`, `ADR-002`), so there is no schema, no DDL, no index and nothing to roll back. PRD §4 states a database is not required.

The nearest equivalent, recorded here so the section is not merely empty:

### "Migration" 20260928000000-in-memory-envelope-store (not a migration — store initialization)

- **Up:** `createEnvelopeStore()` allocates `new Map<string, EnvelopeRecord>()` and a sequence counter at `1`. Called exactly once from `apps/server/src/app.ts`. No pre-existing state to transform.
- **Rollback:** process restart. The entire store is garbage-collected; nothing survives. There is no data to lose, so no rollback script is needed and none is written.
- **Pre-deploy verification:** `pnpm --filter @signed-doc/server test` (the `supertest` suites construct the app and therefore the store in-process) and `curl -s localhost:3001/api/health`.
- **Reviewer-facing note required by PRD §9:** `README.md` must state that SQL injection is not yet relevant because there is no SQL and no query string is ever built, while input validation is nevertheless fully enforced on every field.

If Case 2 introduces persistence, this section becomes real and `ADR-002`'s reversal cost (`low` — the store sits behind a two-method port) is what pays for it.

---

## Service Change Map

> Every TASK.md subtask derives from exactly one row here. `Story` names the single owning story, which is what makes the file-disjoint split in §Execution Waves enforceable.

| Repo | Layer | Change | New / Modified | Owner | Story | PRD IDs |
|---|---|---|---|---|---|---|
| `signed-doc` | Workspace | `pnpm` workspace root: manifests, lockfile, `tsconfig.base.json`, `.npmrc`, `.gitignore` | New | FULLSTACK | ST-1 | §12 |
| `signed-doc` | Workspace | Per-package manifests + tsconfigs + vitest configs for all three packages (single-owner, per `ADR-007`) | New | FULLSTACK | ST-1 | §12 |
| `packages/shared` | Domain (money) | `money.ts` — `Minor` bigint, `parseDecimalString`, `formatDecimalString`, `multiplyMinor`, `sumMinor` | New | SHARED | ST-1 | §6, §9 |
| `packages/shared` | Domain (files) | `file.ts` — `sanitizeFilename`, `extensionOf`, `isAllowedExtension`, `validateFileMeta` | New | SHARED | ST-1 | §7.8, §7.9 |
| `packages/shared` | Domain (recipients) | `recipient.ts` — `clampSignatureCount`, `isValidSignatureCount`, `normalizeEmail`, `validateRecipient`, `findDuplicateEmailGroups`, `validateRecipientList` | New | SHARED | ST-1 | §8.3, §8.4, §8.5 |
| `packages/shared` | Domain (pricing) | `pricing.ts` — `computeCharges`, `quotaRemaining` (pure, component-free) | New | SHARED | ST-1 | §8.6, §8.7 |
| `packages/shared` | Domain (fixtures) | `page-count.ts` — fixture-table lookup, case-insensitive, default 1 | New | SHARED | ST-1 | §6 |
| `packages/shared` | Contract | `types.ts` + `errors.ts` — wire types and the `ErrorCode` union shared by both apps | New | SHARED | ST-1 | §9 |
| `packages/shared` | Tests | Five suites written **before** the rules, expected values hand-derived from PRD §6 | New | SHARED | ST-1 | §11.1, §11.2, §13.3 |
| `signed-doc` | Docs | `README.md`, `docs/decisions.md`, `docs/ai-log.md`, `docs/evidence/shared-tests.txt` | New | FULLSTACK | ST-1 | §7.10, §12 |
| `apps/server` | Config (server-only) | `config/account.ts` (price, quota) and `config/limits.ts` (25 MB, JSON cap, max recipients) | New | BE | ST-2 | §5, §6, §10 |
| `apps/server` | Adapter (store) | `store/envelope-store.ts` — in-memory `Map`, metadata only | New | BE | ST-2 | §4, §7.10 |
| `apps/server` | Service | `services/envelope-service.ts` — upload use case, buffer discarded | New | BE | ST-2 | §7.3, §7.8, §7.9, §7.10 |
| `apps/server` | Service | `services/charge-preview-service.ts` — fixed validation order, unknown-field rejection, quota check | New | BE | ST-2 | §8.4, §8.9, §9 |
| `apps/server` | Service | `services/service-error.ts` — the only service-to-handler error channel | New | BE | ST-2 | §9 |
| `apps/server` | HTTP middleware | `http/upload-middleware.ts` — multer memoryStorage + limits | New | BE | ST-2 | §7.1, §10 |
| `apps/server` | HTTP middleware | `http/error-mapper.ts` — `ServiceError`/multer/JSON -> HTTP envelope | New | BE | ST-2 | §9, §10 |
| `apps/server` | HTTP middleware | `http/request-logger.ts` — one structured line per request | New | BE | ST-2 | §9 |
| `apps/server` | Primary handler | `routes/envelopes.ts` — `POST /api/envelopes` + `GET /api/health` | New | BE | ST-2 | §9 |
| `apps/server` | Primary handler | `routes/charge-preview.ts` — `POST /api/envelopes/:id/charge-preview` | New | BE | ST-2 | §9 |
| `apps/server` | Composition root | `app.ts` + `index.ts` — 5 wiring sites, `createApp()` exported for in-process tests | New | BE | ST-2 | §9, §11 |
| `apps/server` | Tests | 3 suites: service unit + two `supertest` route suites covering §10 rows 1-11 | New | BE | ST-2 | §10, §11 |
| `signed-doc` | Docs | `AGENTS.md`, `docs/evidence/server-tests.txt` | New | BE | ST-2 | §12 |
| `apps/web` | App shell | `index.html`, `main.tsx`, `App.tsx`, `styles.css` | New | FE | ST-3 | §3 |
| `apps/web` | Component | `components/Stepper.tsx` — 3 pills, pill 3 locked and display-only | New | FE | ST-3 | §3, `ADR-005` |
| `apps/web` | Component | `components/DisabledControl.tsx` — `From cloud`, `Save as draft` | New | FE | ST-3 | §3, `LD-05` |
| `apps/web` | API layer | `api/client.ts`, `api/upload.ts`, `api/charge-preview.ts` | New | FE | ST-3 | §8.9, §8.11, `LD-28` |
| `apps/web` | Formatter | `format/money-display.ts` — `Rp15.000,00` via `id-ID`, display only | New | FE | ST-3 | §9, `LD-11` |
| `apps/web` | State | `features/upload/upload-machine.ts` — 5 states, replace-on-reupload | New | FE | ST-3 | §7.5, §7.6, §7.7 |
| `apps/web` | Page (Step 1) | `features/upload/UploadStep.tsx`, `Dropzone.tsx`, `DocumentCard.tsx` | New | FE | ST-3 | §7.1, §7.2, §7.4, §7.6 |
| `apps/web` | State | `features/recipients/recipients-reducer.ts` + `seed.ts` — `countRaw` field, min 1 / max 10 | New | FE | ST-3 | §8.1-§8.3, `LD-12`, `LD-15`, `LD-16` |
| `apps/web` | Page (Step 2) | `features/recipients/RecipientsStep.tsx`, `RecipientRow.tsx`, `SummaryPanel.tsx` | New | FE | ST-3 | §8.4, §8.7, §8.8, §8.12, `LD-13`, `LD-17` |
| `apps/web` | Controller | `features/recipients/preview-controller.ts` — sequence guard + AbortController | New | FE | ST-3 | §8.10, §8.11, `LD-29` |
| `apps/web` | Tests | 3 suites: upload machine, recipients reducer, preview controller (state/controller — `LD-32`) | New | FE | ST-3 | §11 |
| `signed-doc` | Docs | `docs/verification.md`, `docs/evidence/web-tests.txt` | New | FE | ST-3 | §12, §14 |

---

## Critical Files / Touchpoints per Repo

> Read these before touching the feature. One block per workspace package, 10 or fewer each.

### Repo: /Users/kuro/project/react/react-playground/signed-doc — `packages/shared`

- `packages/shared/src/index.ts` — the frozen public API. If a symbol is not exported here, neither app may use it.
- `packages/shared/src/money.ts` — the only place a decimal string becomes a number-like value. Every money bug lives or dies here.
- `packages/shared/src/recipient.ts` — note that `clampSignatureCount` (frontend, coercing) and `isValidSignatureCount` (backend, strict) are **two different functions on purpose**. The backend must never clamp: PRD §10 requires `0`, `-1`, `2.5`, `"abc"` and empty to produce `422 SIGNATURE_COUNT_INVALID`, not a silently corrected value.
- `packages/shared/src/file.ts` — `sanitizeFilename` deliberately **preserves** `<` and `>`. Stripping them would make the §10 XSS row pass trivially while leaving the real defence (text-only rendering) untested.
- `packages/shared/src/pricing.ts` — pure. If it ever imports React, Express or a config module, the §8.6 requirement is broken.
- `packages/shared/src/errors.ts` — the `ErrorCode` union is the contract between the service layer, the HTTP mapper and the frontend renderer.
- `packages/shared/src/__tests__/` — written before the rules. Do not regenerate expected values from implementation output (`LD-32`, PRD §13.3).

### Repo: /Users/kuro/project/react/react-playground/signed-doc — `apps/server`

- `apps/server/src/app.ts` — composition root. The 5 wiring sites and the middleware order (logger, body parser, routers, error mapper **last**) live here.
- `apps/server/src/config/account.ts` — price and quota. Server-only. If this file is ever imported from `apps/web` or `packages/shared`, `ADR-003` is violated and PRD §5 with it.
- `apps/server/src/config/limits.ts` — the 25 MB constant, the one that must be enforced server-side (`LD-01`).
- `apps/server/src/services/charge-preview-service.ts` — the fixed validation order and the strict key allow-list. The `UNKNOWN_FIELD` row and the ordering rows in §10 both land here.
- `apps/server/src/services/envelope-service.ts` — sanitize-then-judge-extension order, and the point where the buffer goes out of scope (§7.10).
- `apps/server/src/http/error-mapper.ts` — single exit for every failure shape, including multer's `LIMIT_FILE_SIZE` -> `422 FILE_TOO_LARGE`.
- `apps/server/src/http/upload-middleware.ts` — `files: 1, fields: 0` closes the multi-file and extra-field vectors at the parser.
- `apps/server/src/store/envelope-store.ts` — the entire persistence story, and the id generator.
- `apps/server/src/__tests__/charge-preview.route.test.ts` — the densest acceptance coverage in the repo (§10 rows 6-11).

### Repo: /Users/kuro/project/react/react-playground/signed-doc — `apps/web`

- `apps/web/src/App.tsx` — owns `step`, the envelope metadata handed from Step 1 to Step 2, and the server-issued `price`/`quota`. No router, no global store.
- `apps/web/src/features/recipients/preview-controller.ts` — the stale-response guard (§8.10). The single most-tested behaviour in §10.
- `apps/web/src/features/recipients/recipients-reducer.ts` — the `countRaw` mechanism that makes "never `NaN`" true (§8.3).
- `apps/web/src/features/upload/upload-machine.ts` — replace-on-reupload, remove-to-empty, retry without losing context (§7.5, §7.7).
- `apps/web/src/api/client.ts` — the one `AbortController` and timeout path shared by the staleness guard and the timeout rule (`LD-28`).
- `apps/web/src/components/Stepper.tsx` — the only file in `apps/web` allowed to mention Step 3 (`ADR-005`).
- `apps/web/src/features/upload/DocumentCard.tsx` — filename as a text node only; `aria-label="Remove {filename}"`.
- `apps/web/src/features/recipients/SummaryPanel.tsx` — derived totals only, plus the over-quota message that doubles as §8.8's visible reason.
- `apps/web/src/format/money-display.ts` — display-only formatting. If a value from here ever re-enters a calculation, `ADR-006` is broken.
- `apps/web/vite.config.ts` — the `/api` proxy, which is what makes "the frontend talks to a real HTTP backend" true in dev (PRD §4).

---

## Blast Radius

> Single repository, solo engineer, no deploy surface, no external consumer. The table is filled honestly rather than padded: the only genuinely affected downstream party is Case 2, which continues on this same codebase.

| Affected service / SDK / package | Squad owner | Impact | Coordination needed | Notes |
|---|---|---|---|---|
| `signed-doc/packages/shared` | Solo engineer (`kadekchresna@gmail.com`) | High | Yes — it is the contract two other packages compile against | Net-new. Its API is frozen in this plan (`ADR-007`); a signature change after Stage 3 starts breaks both `ST-2` and `ST-3`. |
| `signed-doc/apps/server` | Solo engineer | High | Yes — owner of this plan | Net-new. Owns every business rule that actually counts (PRD §7.3). |
| `signed-doc/apps/web` | Solo engineer | High | Yes — owner of this plan | Net-new. Carries roughly 60 percent of the review weight (PRD §4). |
| Case 2 requirement change (PRD §1, `test_2_en.md` present in the repo but not read) | Interviewer, handed over at minute 24 | High | No — cannot be coordinated; it is deliberately withheld | The main reason `LD-20` keeps `charge-preview` stateless and `ADR-002` keeps the store behind a two-method port. Reversal cost is the currency Case 2 will spend. |
| `Upload & Recipients Mockup.html` | Interviewer (design source) | None | Inform only | Read-only design reference. Never modified. |
| `test_1_en.md` (PRD) | Interviewer | None | No | Immutable, externally issued brief. Engineering cannot amend it (`prd-verify-report.md` Deviations row 1). |
| Parent directory `/Users/kuro/project/react/react-playground/` and its roughly 12 sibling projects | Various / unrelated | None | No | Explicitly out of scope and never scanned. Work stays inside `signed-doc/`. |
| The `case-1` commit/tag on `feat/case-1-upload-and-recipients` | Solo engineer | Medium | Inform only | It is the minute-24 checkpoint artifact (PRD §13.6, §14). Case 2 branches forward from it. |

No row requires cross-squad sign-off, because no other squad exists. The `High` rows are all self-owned, so `ADR` status flips on the engineer's own review alone.

---

## Breaking-Change Checklist

> Every row is `No`. This is a greenfield repository with no released surface and no consumer: there is nothing an existing caller could fail to ignore. The rows are still enumerated rather than collapsed, because two of them (`#3` and `#6`) are where Case 2 will first apply pressure, and one (`#11`) is this feature's real invariant.

| # | Surface | Breaking? | Mitigation / note |
|---|---|---|---|
| 1 | Public REST API (existing endpoints) | No | No endpoint exists yet. `POST /api/envelopes` and `POST /api/envelopes/:id/charge-preview` are both net-new and match PRD §9's paths exactly, so no remapping table is needed in `README.md`. |
| 2 | Public REST API (request schema — new required field) | No | `ChargePreviewRequest` is introduced with `additionalProperties: false` from day one, so tightening later is impossible — it is already maximally strict (`UNKNOWN_FIELD`). |
| 3 | DB schema (existing tables / collections) | No | No database (`ADR-002`). If Case 2 adds persistence it starts from an empty schema, so the first migration has no backfill. Watch this row in Case 2. |
| 4 | SDK method signature (existing methods) | No | No SDK package. The `apps/web/src/api/*` layer is internal to one app. |
| 5 | Message bus contract | No | No bus, no events, no consumer. |
| 6 | Env vars / config (removed, renamed, defaults changed) | No | Exactly one optional variable: `PORT` (default `3001`). No `.env` file is required; if one is added it must contain obviously dummy values (PRD §5). Watch this row in Case 2. |
| 7 | Default behaviour (existing endpoint's response or side effects) | No | Nothing exists to change the behaviour of. |
| 8 | Auth / authz (scopes, role mappings, token shape) | No | No authentication anywhere. Single demo account, no login (PRD §5). Introducing auth would be out of scope. |
| 9 | Rate limits / quotas (tighter for existing callers) | No | The signature quota (8) is a business fixture, not a rate limit, and Case 1 consumes none of it (`LD-18`). No HTTP rate limiting exists. |
| 10 | Public documentation other teams rely on | No | `README.md` / `AGENTS.md` are net-new. The PRD and the mockup are read-only inputs and are never edited. |
| 11 | Trust-boundary invariant: price and quota never reach the browser bundle (`ADR-003`) | No — and it must stay No | Not a conventional breaking-change row, listed because it is the invariant most easily broken by a convenience import. Verification: `grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src` must return nothing outside test fixtures. Any `Yes` here is a PRD §5 violation and blocks the plan. |

**Gate outcome:** no `Yes` rows, so nothing external blocks the flip from `Proposed` to `Accepted`. The ADRs stay `Proposed` only until the engineer signs off on this plan.

---

## Story-Point Calibration

> Unit convention: `1 SP = 30 min` (`LD-08`), measured **without** AI acceleration. "Focused" means uninterrupted and fully primed on context; cold-start cost is amortised across the day, not added per subtask.
>
> **SP scope (load-bearing):** every subtask's SP **includes** writing the code, writing its unit tests, writing its layer-appropriate integration/endpoint test, and running them green. A 2 SP "simple CRUD endpoint" includes the handler **and** its tests. Testing-only subtasks are annotated `testing-only`. **Confirmed: every subtask SP below includes its own unit-test and endpoint-test effort.**

### Baseline table (reproduced verbatim)

| Size | Realistic (no AI) | AI-Accelerated | Examples |
|---|---|---|---|
| 1 SP | 30 min | 10 min | One CRUD endpoint with happy-path test |
| 2 SP | 1 hour | 20 min | One endpoint with retry/error handling + 2 negative tests |
| 3 SP | 1.5 hour | 30 min | New port + adapter pair + tests |
| 5 SP | 2.5 hour | 50 min | New domain entity with full hex slice + migration |
| 8 SP | 4 hour | 1.5 hour | Cross-service flow with new contract + integration test |
| 13+ SP | — | — | Split into smaller subtasks; reject this estimate |

### Work-type rows used from the shared calibration table

| Work type | Realistic SP | AI-Accelerated SP | Where used |
|---|---:|---:|---|
| Add domain entity + 2-4 invariants (methods) | 2 | 1 | `ST-1.5`, `ST-1.6` |
| Add domain service (orchestrates 2+ entities) | 3 | 1.5 | `ST-2.1` |
| Simple CRUD endpoint (POST, single entity) | 2 | 1 | folded into `ST-2.6` |
| Upload endpoint (multipart) | 4 | 2 | `ST-2.4` |
| Mutation endpoint with side effects | 3 | 1.5 | `ST-2.6` |
| DI composition root wiring | 0.5 | 0.25 | folded into `ST-2.1`, `ST-2.2` |
| Form field component (controlled, with validation) | 2 | 1 | folded into `ST-3.4`, `ST-3.6` |
| New page (route + layout + 1-2 components reused) | 2 | 1 | folded into `ST-3.4`, `ST-3.6` |
| Page with state (slice + 2-3 actions) | 4 | 2 | `ST-3.5`, `ST-3.6` |
| Add SDK method (1 endpoint wrapper) | 1 | 0.5 | folded into `ST-3.2` |
| Add structured logging to a new handler | 0.5 | 0.25 | folded into `ST-2.1` |

### Feature-specific rows added to the table

Added because no baseline row matches; each carries its rationale, as the calibration rules require.

| Work type (new row) | Realistic SP | AI-Accelerated SP | Rationale |
|---|---:|---:|---|
| Monorepo workspace scaffold (pnpm, 3 packages, single lockfile, shared strict tsconfig, test-runner configs, dev script starting two processes) | 3 | 1.5 | Larger than the baseline "feature-flag scaffold" (1 SP) because it is three manifests plus a lockfile plus a working `pnpm dev` across two processes, and `ADR-007` makes it single-owner for all three packages. |
| Money value-object module (bigint minor units, strict parse/format, exhaustive decimal + boundary tests) | 3 | 1.5 | Comparable to "port + adapter pair + tests" (3 SP). The code is small; the test matrix (exact decimals, quota boundary, malformed strings, no-float proof) is not. |
| Untrusted-input sanitizer module with adversarial test matrix (path traversal, non-basename, length cap preserving extension, extension from sanitized name) | 3 | 1.5 | No baseline row covers security-shaped pure functions. Sized at 3 SP because four §10 acceptance rows depend on this one file and each needs its own negative test. |
| Validation module, 4 rule families with a negative-case matrix (name, email, signature-count strict vs coercing, case-insensitive duplicate groups) | 3 | 1.5 | Two deliberately different signature-count functions plus duplicate-group detection; PRD §11.2 names six required negative cases for this module alone. |
| Pure calculation module (derived totals + clamped quota remainder + over-by) | 2 | 1 | Mapped onto "domain entity + 2-4 invariants". Two functions, but the exact-decimal and quota-boundary assertions of PRD §11.1 are mandatory. |
| Contract + fixture module set (wire types, error-code union, fixture-table lookup, public barrel) | 2 | 1 | Mechanical but wide: it is the frozen API surface two other stories compile against (`ADR-007`). |
| State machine module with 5 states and replace/remove/retry transitions, unit-tested without rendering | 3 | 1.5 | Between "form field component" (2 SP) and "page with state" (4 SP). No rendering, but the replace-on-reupload and retry-without-losing-context transitions each need their own test. |
| Stale-response guard (monotonic sequence + AbortController, with tests proving an older response is dropped) | 3 | 1.5 | No baseline row. 3 SP because the test is the hard part: it must interleave two in-flight requests deterministically. This is the single most-tested behaviour in PRD §10. |
| Accessible step view assembled from 3 new components (labels, aria-labels, aria-invalid/describedby, gated action with visible reason) | 4 | 2 | Mapped onto "data table with sort + filter" (4 SP) for breadth. Includes the accessibility checks PRD §8.12 requires. |
| Deliverable-doc set (constrained-length README/AGENTS plus a free-form docs file and a raw evidence file) | 1 | 0.5 | PRD §12 caps README at 15 lines and AGENTS at 20; brevity is the work. |
| Verification aggregation (run all suites, save real output, manual browser pass against the §10 acceptance rows, write the gap list) | 2 | 1 | `testing-only`. PRD §14 requires actual output plus a specific gap list; the manual pass over 15 acceptance rows is the bulk of it. |

### Per-story rollup

| Story | Subtasks | Realistic SP | AI-Accelerated SP | Meets the 10 SP floor? |
|---|---:|---:|---:|---|
| `ST-1` — Shared kernel + workspace scaffold + root docs | 7 | **18** | 9 | Yes |
| `ST-2` — Backend HTTP service (routes, services, store, config) | 7 | **21** | 10.5 | Yes |
| `ST-3` — Frontend (Step 1 + Step 2 UI, API layer, controllers) | 8 | **26** | 13 | Yes |
| **EPIC total** | 22 | **65** | 32.5 | — |

Per-subtask SP (TASK.md is generated directly from this):

| Subtask | Title | SP | Calibration row |
|---|---|---:|---|
| ST-1.1 | pnpm workspace scaffold: root manifests, lockfile, all three package manifests + tsconfigs + vitest configs | 3 | Monorepo workspace scaffold |
| ST-1.2 | `money.ts` — bigint minor units, strict parse/format, arithmetic (tests first) | 3 | Money value-object module |
| ST-1.3 | `file.ts` — sanitizeFilename, extensionOf, isAllowedExtension, validateFileMeta (tests first) | 3 | Untrusted-input sanitizer module |
| ST-1.4 | `recipient.ts` — clamp vs strict count, name/email rules, duplicate groups (tests first) | 3 | Validation module, 4 rule families |
| ST-1.5 | `pricing.ts` — computeCharges, quotaRemaining (tests first) | 2 | Pure calculation module |
| ST-1.6 | `types.ts` + `errors.ts` + `page-count.ts` + `index.ts` barrel (tests first) | 2 | Contract + fixture module set |
| ST-1.7 | `README.md`, `docs/decisions.md`, `docs/ai-log.md`, `docs/evidence/shared-tests.txt` | 2 | Deliverable-doc set (x2) |
| ST-2.1 | `app.ts` + `index.ts` + `request-logger.ts` + `error-mapper.ts` — composition root, middleware order, 5 wiring sites | 3 | Add domain service + DI wiring + structured logging |
| ST-2.2 | `config/account.ts`, `config/limits.ts`, `store/envelope-store.ts`, `services/service-error.ts` | 2 | Add domain entity + 2-4 invariants + DI wiring |
| ST-2.3 | `envelope-service.ts` — upload use case incl. discard-after-validation, + unit tests | 4 | Upload endpoint (multipart) |
| ST-2.4 | `upload-middleware.ts` + `routes/envelopes.ts` + `envelopes.route.test.ts` (§10 rows 1-5) | 4 | Upload endpoint (multipart) |
| ST-2.5 | `charge-preview-service.ts` — fixed order, key allow-list, duplicates, quota, + unit coverage | 4 | Upload endpoint row reused for rule density; see note |
| ST-2.6 | `routes/charge-preview.ts` + `charge-preview.route.test.ts` (§10 rows 6-11) | 3 | Mutation endpoint with side effects |
| ST-2.7 | `AGENTS.md`, `docs/evidence/server-tests.txt` | 1 | Deliverable-doc set |
| ST-3.1 | `index.html`, `main.tsx`, `App.tsx`, `styles.css`, `Stepper.tsx`, `DisabledControl.tsx` | 3 | New page + inline UI primitives |
| ST-3.2 | `api/client.ts`, `api/upload.ts`, `api/charge-preview.ts`, `format/money-display.ts` | 3 | Add SDK method x3 + formatter |
| ST-3.3 | `upload-machine.ts` + `upload-machine.test.ts` | 3 | State machine module with 5 states |
| ST-3.4 | `UploadStep.tsx`, `Dropzone.tsx`, `DocumentCard.tsx` | 4 | Accessible step view from 3 components |
| ST-3.5 | `recipients-reducer.ts`, `seed.ts` + `recipients-reducer.test.ts` | 4 | Page with state (slice + actions) |
| ST-3.6 | `RecipientsStep.tsx`, `RecipientRow.tsx`, `SummaryPanel.tsx` | 4 | Accessible step view from 3 components |
| ST-3.7 | `preview-controller.ts` + `preview-controller.test.ts` | 3 | Stale-response guard |
| ST-3.8 | `docs/verification.md`, `docs/evidence/web-tests.txt`, manual browser pass, gap list | 2 | Verification aggregation (`testing-only`) |

Note on `ST-2.5`: it is 4 SP rather than the 3 SP of "add domain service" because it implements five ordered validation stages plus the strict key allow-list, and six §10 acceptance rows depend on it. No subtask exceeds 4 SP, so the "SP >= 10 on a single subtask" split rule is never triggered.

---

## Execution Waves

> Tracks separated by `∥` are parallel. Parallelism here is **file-level**, not merely conceptual: the three Wave 2 tracks own disjoint file sets (listed below) and are dispatched concurrently by `downstream` parallel mode. `ADR-007` explains how the two shared-file hazards (single lockfile, deliverable docs) were removed architecturally rather than coordinated at runtime.

| Wave | Tracks (`∥` = parallel) | Blocks |
|---|---|---|
| 1 | Contract freeze — shared-kernel public API + OpenAPI contract + file-ownership map **(no code; completed inside this plan at Stage 2a)** | All of Wave 2. Nothing may be dispatched until the kernel signatures in §Architecture Slice are signed off. |
| 2 | `ST-1` shared kernel + workspace scaffold + root docs ∥ `ST-2` backend HTTP service ∥ `ST-3` frontend Step 1 + Step 2 | Wave 3. All three must be `DONE` before integration. |
| 3 | Integration gate — root `pnpm install --frozen-lockfile`, workspace-wide typecheck, all suites green, `curl` acceptance script, manual browser pass, `docs/verification.md` finalized, gap list written, `case-1` commit + tag | Nothing — ship. This is the minute-24 checkpoint (PRD §13.6, §14). |
| 4 | — *(skipped — no work. Step 3 "Place fields" is out of scope and deliberately unscaffolded per `ADR-005`.)* | — |
| 5 | — *(skipped — no work. No async/heavy endpoints, no AI integration, no Playwright: `LD-31` fixes verification at local Vitest + supertest + manual pass, and `LD-32` chooses state/controller tests over DOM interaction tests.)* | — |
| 6 | — *(skipped — no work. No reporting/export surface. Deferred NICE-TO-HAVE items from `LD-19` are recorded in the gap list instead of padded into a wave.)* | — |

Wave 3 rule: any cross-story type error found at the integration gate is fixed **by the owning story's agent in the owning story's files**. No agent edits a file it does not own, even to unblock itself. `TASK.md` is the sole shared file, governed by the race-safe protocol (edit only lines under your own story header, unique-context `Edit`, never `replace_all`).

### Wave 2 — file ownership (normative; disjointness is the contract)

**`ST-1` — Shared validation and pricing kernel, workspace scaffold, root docs. 18 SP. 32 files.**

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
.npmrc
.gitignore
README.md
docs/decisions.md
docs/ai-log.md
docs/evidence/shared-tests.txt
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/vitest.config.ts
packages/shared/src/index.ts
packages/shared/src/types.ts
packages/shared/src/errors.ts
packages/shared/src/money.ts
packages/shared/src/file.ts
packages/shared/src/recipient.ts
packages/shared/src/pricing.ts
packages/shared/src/page-count.ts
packages/shared/src/__tests__/money.test.ts
packages/shared/src/__tests__/file.test.ts
packages/shared/src/__tests__/recipient.test.ts
packages/shared/src/__tests__/pricing.test.ts
packages/shared/src/__tests__/page-count.test.ts
apps/server/package.json
apps/server/tsconfig.json
apps/server/vitest.config.ts
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
```

**`ST-2` — Backend HTTP service: routes, services, store, server-only config. 21 SP. 18 files.**

```text
AGENTS.md
docs/evidence/server-tests.txt
apps/server/src/index.ts
apps/server/src/app.ts
apps/server/src/config/account.ts
apps/server/src/config/limits.ts
apps/server/src/store/envelope-store.ts
apps/server/src/services/service-error.ts
apps/server/src/services/envelope-service.ts
apps/server/src/services/charge-preview-service.ts
apps/server/src/http/upload-middleware.ts
apps/server/src/http/error-mapper.ts
apps/server/src/http/request-logger.ts
apps/server/src/routes/envelopes.ts
apps/server/src/routes/charge-preview.ts
apps/server/src/__tests__/envelope-service.test.ts
apps/server/src/__tests__/envelopes.route.test.ts
apps/server/src/__tests__/charge-preview.route.test.ts
```

**`ST-3` — Frontend: Step 1 upload, Step 2 recipients, API layer, controllers, verification. 26 SP. 25 files.**

```text
docs/verification.md
docs/evidence/web-tests.txt
apps/web/index.html
apps/web/src/main.tsx
apps/web/src/App.tsx
apps/web/src/styles.css
apps/web/src/components/Stepper.tsx
apps/web/src/components/DisabledControl.tsx
apps/web/src/api/client.ts
apps/web/src/api/upload.ts
apps/web/src/api/charge-preview.ts
apps/web/src/format/money-display.ts
apps/web/src/features/upload/UploadStep.tsx
apps/web/src/features/upload/Dropzone.tsx
apps/web/src/features/upload/DocumentCard.tsx
apps/web/src/features/upload/upload-machine.ts
apps/web/src/features/recipients/RecipientsStep.tsx
apps/web/src/features/recipients/RecipientRow.tsx
apps/web/src/features/recipients/SummaryPanel.tsx
apps/web/src/features/recipients/recipients-reducer.ts
apps/web/src/features/recipients/preview-controller.ts
apps/web/src/features/recipients/seed.ts
apps/web/src/__tests__/upload-machine.test.ts
apps/web/src/__tests__/recipients-reducer.test.ts
apps/web/src/__tests__/preview-controller.test.ts
```

**Disjointness proof:** 32 + 18 + 25 = 75 paths, all distinct. No path appears in two lists. Directory ownership deliberately does **not** coincide with file ownership: `ST-1` owns `apps/server/package.json` and `apps/web/package.json` (and their tsconfig / vite / vitest configs) so the single `pnpm-lock.yaml` has exactly one author (`ADR-007` item 1). Read the lists literally.

**Cross-story dependencies (all read-only — none is a file conflict):**

- `ST-2` and `ST-3` both import `packages/shared` and compile against the frozen signatures in §Architecture Slice > Port interfaces. They do not wait for `ST-1`.
- `ST-2` and `ST-3` both depend on manifests authored by `ST-1`. Until `ST-1.1` lands, they write source against the declared dependency set and defer `pnpm install` to the Wave 3 gate.
- `ST-3.8` (`docs/verification.md`) references `docs/evidence/shared-tests.txt` and `docs/evidence/server-tests.txt` by path. It is the last subtask of `ST-3` and reads those files rather than editing them.

---

## Open Items / Risks

- **The 24-minute budget is far smaller than the 65 SP this plan describes.** Trigger: immediately — it is true at minute zero. Even at AI-accelerated rates (32.5 SP, roughly 16 hours) the arithmetic does not close. Mitigation: `LD-19`'s MUST-HAVE order is the build order, not a post-hoc apology — shared kernel with tests first, then both endpoints, then Step 1 UI, then Step 2 UI, then the stale-response guard. Everything unreached is named specifically by feature in the gap list at the checkpoint (PRD §14 forbids "some things are missing"). This plan is deliberately sized for correctness-first execution, and the checkpoint is expected to ship a `PARTIAL` epic.
- **Frozen kernel API turns out to be wrong mid-flight.** Trigger: `ST-2` or `ST-3` needs a signature that §Architecture Slice does not provide. Mitigation: the owner raises it rather than adding an export locally; the change lands in `ST-1`'s files only, and both consumers adapt at the Wave 3 gate. Keeping the API to 5 modules and roughly 20 exported symbols bounds the exposure (`ADR-007`).
- **Price or quota leaks into `packages/shared` or `apps/web` as a convenience constant.** Trigger: any moment someone wants a frontend estimate before the `201` lands. Mitigation: `ADR-003` plus Breaking-Change row 11's grep check, run at the Wave 3 gate: `grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src` must be empty outside test fixtures.
- **The backend accidentally clamps `signature_count` instead of rejecting it.** Trigger: an implementer reuses `clampSignatureCount` on the server because the names are adjacent. Mitigation: the two functions are documented as deliberately different in §Critical Files, and `charge-preview.route.test.ts` asserts `422 SIGNATURE_COUNT_INVALID` for `0`, `-1`, `2.5`, `"abc"` and empty — a clamp makes those tests fail loudly.
- **`sanitizeFilename` over-sanitizes and strips `<` / `>`.** Trigger: a security-minded reviewer or implementer "hardens" the function. Mitigation: stated explicitly in §Critical Files and in `ADR` context — stripping makes the §10 XSS row pass trivially while leaving the actual defence (text-only rendering) untested. The file test suite asserts that `<img src=x onerror=alert(1)>.pdf` survives sanitization unchanged as a basename.
- **The stale-response test is flaky.** Trigger: writing `preview-controller.test.ts` with real timers or real `fetch`. Mitigation: the controller takes its transport as a parameter so the test can resolve two promises in a controlled order; no `setTimeout`, no wall-clock waits.
- **Cross-check coverage is `INSUFFICIENT` (0 of 2 similar shipped features), and no Outline / Engineering Hub access exists.** Trigger: any ADR whose confidence a reviewer probes. Mitigation: stated plainly in Context > Conventions and in `QUESTIONS-ENGINEER.md`. Every ADR is grounded in PRD text plus locked decisions, with no historical precedent; weight confidence accordingly. Not resolvable inside this session.
- **Five UI states have no design** (empty dropzone, upload loading, upload error, per-row validation error, over-quota banner). Trigger: at implementation, for each state. Mitigation: `LD-10` accepts that they will look plain; PRD §3 and §8.12 remove colours, spacing, fonts, icons, animation and responsiveness from assessment, so effort goes to behaviour.
- **Drag-and-drop on the dropzone may be dropped.** Trigger: budget pressure. Mitigation: PRD §7.1 explicitly makes it optional **provided it is named in the gap list**. `LD-19` already classifies it NICE-TO-HAVE and first to go. `Dropzone.tsx` ships the `input[type=file]` path regardless.
- **No DOM interaction tests, so a wiring regression (correct reducer bound to the wrong prop) would not be caught.** Trigger: any refactor of a step component. Mitigation: `LD-32` — the manual browser pass recorded in `docs/verification.md` is the wiring evidence, and a thin `@testing-library/react` smoke test per step is the first NICE-TO-HAVE if budget allows. Recorded as a gap, not hidden.
- **An orphaned envelope can be created by a retried upload whose first response was lost.** Trigger: a flaky network during the demo. Mitigation: accepted (`LD-21`). Envelopes are in-memory and invisible; documented as a known gap in `docs/decisions.md` rather than solved with an idempotency-key store.
- **Case 2's requirement change is withheld until minute 24 and lands on this codebase.** Trigger: minute 24. Mitigation: the two decisions most likely to be bent are already cheap to reverse — `charge-preview` is stateless with respect to recipients (`LD-20`, additive to change) and the store sits behind a two-method port (`ADR-002`, reversal cost low). No pre-building is done, per PRD §1 and §13.6.

---

## Verification Plan per Repo

> One repo, three packages. All commands run from `/Users/kuro/project/react/react-playground/signed-doc`. No env var is required; `PORT` defaults to `3001`. No database, no container, no replica set, no bucket, no staging (`LD-31`).

### Repo: /Users/kuro/project/react/react-playground/signed-doc

```bash
# One-time, from a clean checkout (PRD section 12: runnable by a reviewer)
pnpm install --frozen-lockfile

# Workspace-wide gates — this is the Wave 3 integration gate
pnpm -r typecheck                      # tsc --noEmit in all three packages
pnpm -r test                           # vitest run in all three packages
pnpm --filter @signed-doc/shared test  # PRD section 11.1 + 11.2 — the minimum-tests floor
pnpm --filter @signed-doc/server test  # supertest, in-process, section 10 rows 1-11
pnpm --filter @signed-doc/web test     # state/controller suites (LD-32)
pnpm --filter @signed-doc/web build    # vite build — proves the bundle compiles

# Run the app (two processes; `pnpm dev` starts both)
pnpm dev                               # Express on :3001, Vite on :5173 proxying /api
curl -s localhost:3001/api/health      # {"status":"ok"}

# Trust-boundary check (ADR-003, Breaking-Change row 11) — must print nothing
grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src

# Step-3-not-scaffolded check (ADR-005) — must match only Stepper.tsx and the Step 2 success note
grep -ril "place.fields" apps/web/src

# Server-side enforcement spot checks (the browser is bypassed on purpose)
curl -s -o /dev/null -w '%{http_code}\n' -F file=@/dev/null localhost:3001/api/envelopes
curl -s -X POST localhost:3001/api/envelopes/env_999/charge-preview \
  -H 'content-type: application/json' \
  -d '{"recipients":[{"name":"Rina Halim","email":"rina.halim@example.test","signature_count":2}]}'
```

Per-package notes:

- `packages/shared` — pure functions, zero runtime dependencies, no setup. Its suites are the PRD §11 floor and must be green before anything else is believed. Raw output saved to `docs/evidence/shared-tests.txt`.
- `apps/server` — `supertest` drives `createApp()` in-process, so no port is bound and no server needs starting for tests. Raw output saved to `docs/evidence/server-tests.txt`.
- `apps/web` — state/controller suites only; no `jsdom` requirement for the committed tests (`LD-32`). Raw output saved to `docs/evidence/web-tests.txt`.
- **Manual pass (required — it is the wiring evidence):** walk all 15 rows of `docs/prompt.md` §7 in the browser, plus the two UI-only rows (`Continue` gating with a visible reason, and changing recipients while a preview is in flight). Record the result of each row in `docs/verification.md`, including anything that remains unverified.
- **Deliverables the verification writes into** (created in Stage 3, not by this plan — `LD-09`): `README.md` (install/run/test commands, port, endpoint mapping, the file-content-discard decision per PRD §7.10, and the in-memory / SQL-injection note per PRD §9), `AGENTS.md` (folder map, entry points, validation commands, business invariants, input trust boundaries), `docs/decisions.md` (clarifying questions and answers, this plan, trade-offs, and the engineer's own assumptions — at minimum the 25 MB limit per `LD-01`, the 10 s / 60 s timeouts per `LD-28`, no-idempotency-key per `LD-21`, and no-metrics per `LD-30`), `docs/verification.md` (commands plus **actual** output, tests passed/failed, manual checks, what remains unverified), `docs/ai-log.md` (agent transcript excerpts).

---

## Out-of-Scope

- **Step 3 "Place fields" board** -> won't fix in Case 1 (PRD §3, §4: do not implement, do not scaffold). Present only as a locked, display-only stepper pill (`ADR-005`) and as one inline note on the Step 2 success state (`LD-13`).
- **`From cloud` upload source** -> won't fix (PRD §3). Rendered disabled with the visible reason `Not available in this exercise` (`LD-05`).
- **`Save as draft`** -> won't fix (PRD §3). Same disabled treatment as above (`LD-05`).
- **PDF content parsing or rendering; deriving page count from file bytes** -> won't fix (PRD §4, §6). Page count comes from the fixture table keyed on the sanitized filename.
- **Affixing signatures or duty stamps; e-meterai / PKI provider integration** -> won't fix (PRD §4).
- **Payments, email or notifications, SSO** -> won't fix (PRD §4).
- **Deployment, CI, containers, infrastructure** -> won't fix (PRD §4). Verification is local only (`LD-31`).
- **Mobile apps** -> won't fix (PRD §4).
- **Authentication, login, sessions, multi-tenancy, authorization** -> won't fix (PRD §5: a single demo account with no login). No `authn`/`authz` middleware appears in the route table.
- **A database, ORM, migration runner, or any persistence beyond the process lifetime** -> won't fix (PRD §4, `LD-03`, `ADR-002`). Revisit only if Case 2 demands it.
- **Idempotency keys on upload** -> deferred; recorded as a known gap in `docs/decisions.md` (`LD-21`).
- **Metrics, OTEL spans, dashboards, alerting** -> won't fix (`LD-30`). Structured `console` logging only.
- **Feature flags and rollout percentages** -> won't fix (`LD-14`, and `prd-verify-report.md` checklist row 5 deviation). No deploy surface exists to flag.
- **Quota consumption or mutation** -> won't fix (PRD §8.9, `LD-18`). `quota_remaining` is computed, never stored; Case 1 changes no quota.
- **Pixel-perfect visual fidelity, animation, exact fonts or icons, responsive layout** -> won't fix (PRD §3, §8.12: explicitly not assessed). Desktop only.
- **i18n framework, translation files, locale switching** -> won't fix (`LD-11`). Single-locale English strings inline, `id-ID` money formatting only.
- **DOM interaction tests, Playwright, Maestro, visual regression** -> deferred to the NICE-TO-HAVE list (`LD-19`, `LD-32`). A thin `@testing-library/react` smoke test per step is the first item to add if budget allows.
- **Drag-and-drop on the dropzone** -> deferred and **must be named in the gap list if dropped** (PRD §7.1 makes it optional on exactly that condition). The `input[type=file]` path ships regardless.
- **`SCENARIO.md` / `INTEGRATION_SCENARIO.md`** -> skipped at upstream Step 5; `scenario-cataloguer` can be run standalone later (see Next Action).
- **Case 2's requirement change** -> out of scope by construction (PRD §1, §13.6). It is handed over only after the minute-24 checkpoint; nothing is pre-built for it.
- **`test_2_en.md`** (present in the repo) -> deliberately not read for this plan. Reading it would be pre-building for Case 2.
- **The parent directory `/Users/kuro/project/react/react-playground/` and its sibling projects** -> out of scope, never scanned, never modified. All work stays inside `signed-doc/`.

---

## Next Action

1. **Review and sign off this plan.** On sign-off, flip `Status` to `Accepted` and every ADR from `Proposed` to `Accepted`. No Breaking-Change row is `Yes` and no external squad exists, so the engineer's own sign-off is the only gate. Pay particular attention to the frozen kernel API in §Architecture Slice > Port interfaces — `ST-2` and `ST-3` compile against it from minute zero (`ADR-007`).
2. **Branch cut: already done, and no worktree is used.** Per `LD-07` the work happens in place inside `/Users/kuro/project/react/react-playground/signed-doc` on the existing branch `feat/case-1-upload-and-recipients`, already cut from `main`. Do **not** create a worktree and do **not** cut a second branch; `upstream/references/branch-cut.md`'s one-branch-per-repo rule is satisfied by the existing branch. Commits follow `LD-06`: one per subtask, Conventional Commits, with a final commit tagged `case-1` at the checkpoint.
3. **`TASK.md` is generated separately** at `docs/features/case-1-upload-and-recipients/TASK.md`, derived from §Service Change Map (one subtask per row), §Story-Point Calibration (the per-subtask SP table) and §Execution Waves (the three stories, their SP totals and their file-ownership lists, reproduced verbatim at the bottom of TASK.md). `figma` fields on the frontend story are `N/A — no Figma file exists (LD-10)`.
4. **Scenario catalogs were skipped at upstream Step 5.** Run `scenario-cataloguer` standalone at any time before `downstream` Stage 4 if catalog-grounded tests are wanted. Do not link `SCENARIO.md` or `INTEGRATION_SCENARIO.md` from `TASK.md` — they do not exist.
5. **ADR publication: deferred.** No Outline / Engineering Hub connector is available in this session, so the seven ADRs stay local-only inside this PLAN.md. They can be promoted to `Conventions/ADRs/` later via `eng-hub` Mode 2, reusing these IDs without renumbering. The plan is self-contained either way.
6. **Start Wave 2 via `downstream` in parallel mode**, dispatching `ST-1`, `ST-2` and `ST-3` concurrently against the file-ownership lists above. Then run the Wave 3 integration gate and produce the `case-1` checkpoint artifacts: a runnable app from `README.md` commands alone, real test output in `docs/verification.md`, and a gap list naming each unfinished feature and why (PRD §14).
