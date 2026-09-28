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
- `Existing pattern: questions answered with a recorded default, never blank` -> `Where: QUESTIONS-PM.md / QUESTIONS-ENGINEER.md` -> `Why follow: the Locked Decisions table below inherits that discipline; no row is TBD.`

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
