# TASK.md — case-1-upload-and-recipients

> Status board. Source of truth for `downstream`. Edit inline per the status cadence in [Status update protocol](#status-update-protocol) — never rewrite from scratch.

- **epic:** `EPIC-1`
- **feature title:** `case-1-upload-and-recipients`
- **namespace:** `sign-doc`, mapped to the fixed upstream enum as `sign-doc -> subproject-a`
- **workspace mode:** `single-service` — one repo root: `/Users/kuro/project/react/react-playground/signed-doc`
- **plan of record:** `./PLAN.md` (this directory). Story split, SP totals and file-ownership lists below are reproduced from PLAN.md `## Story-Point Calibration` and `## Execution Waves` and must not be re-derived.
- **PRD:** `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md`; binding engineering spec `/Users/kuro/project/react/react-playground/signed-doc/docs/prompt.md` (§4 Critical Facts, §5a Requirement Traceability, §7 Success Criteria).
- **git:** branch `feat/case-1-upload-and-recipients`, already cut from `main`, worked **in place** inside `signed-doc/`. No worktree (`LD-07`).

**Story ID aliases.** PLAN.md refers to the three stories as `ST-1`, `ST-2`, `ST-3` and to subtasks as `ST-1.1` … `ST-3.8`. Those are exactly the suffixes of the full codes used here (`EPIC-1-ST-1`, `EPIC-1-ST-1.1`, …). Both forms name the same node.

**`services` slug.** Every node carries `services: [subproject-a]`. This feature is single-repo: `subproject-a` resolves to the one workspace root `/Users/kuro/project/react/react-playground/signed-doc`, which contains all three packages (`packages/shared`, `apps/server`, `apps/web`). No subtask spans two repos, and `downstream` parallel mode must **not** open a worktree for it (`LD-07`).

**Commit convention (`LD-06`).** One commit per subtask, Conventional Commits, scope = owning package. Each subtask's Definition of Done names its commit type. Diffs over 300 LOC split at the config/source boundary. A final commit tagged `case-1` marks the minute-24 checkpoint (PRD §13.6, §14). `test:` is unused in this epic by design: no subtask is test-code-only — validation and cost-calculation tests are written **before** their module and ship in that module's own commit (`LD-32`, PRD §13.3), and the one testing-only subtask (`EPIC-1-ST-3.8`) emits documentation artifacts, so it commits as `docs:`.

## Status legend

- `TODO` — not started
- `IN_PROGRESS` — actively being worked (by a sub-agent or the engineer)
- `IN_REVIEW` — code complete, awaiting review / verification (`code-reviewer`, `unit-test`, `endpoint-tester`)
- `DONE` — merged + verified
- `BLOCKED` — cannot progress until an external dependency clears; name the dependency inline
- `DEFERRED` — explicitly punted to a later epic; link forward to the follow-up ticket
- `PARTIAL` — partially shipped; remaining items listed inline under the node

## Hierarchy

Every node — EPIC, Story, Subtask — carries the same required fields. Front-end stories additionally carry a `figma` field.

Required fields:

| Field | Notes |
|-------|-------|
| `title` | One-line summary |
| `description` | 1–3 lines; cites the PLAN.md `## Service Change Map` row(s) that motivate this node |
| `status` | One of the 7 states above |
| `code` | The node ID — `EPIC-1`, `EPIC-1-ST-<n>`, `EPIC-1-ST-<n>.<sub>` |
| `sp` | Story-point estimate; includes its own unit-test + endpoint-test effort. Sourced from PLAN.md `## Story-Point Calibration` |
| `services` | **LIST** of repo / service slugs touched by this node. Always `[subproject-a]` here — single repo |
| `last-checkpoint` | Fine-grained progress marker written by sub-agents after each step. Empty on `TODO` rows; one of the values in the [Checkpoint legend](#checkpoint-legend) once work starts |

Additional fields carried on every subtask in this epic (required by the parallel dispatcher and by the commit policy `LD-06`):

| Field | Notes |
|-------|-------|
| `files` | The exhaustive list of paths this subtask owns and is the only author of. Repo-root relative. Union of a story's subtask `files` equals that story's ownership block, exactly |
| `dod` | Definition of Done — testable assertions, each checkable by a command or a named acceptance row |
| `commit` | The Conventional Commits type + scope for this subtask's single commit |
| `prd` | The PRD requirement ID(s) this subtask satisfies, per `docs/prompt.md` §5a (`§` = section of `test_1_en.md`) |

Front-end only:

| Field | Notes |
|-------|-------|
| `figma` | Link(s) — one per screen / component covered by the story |

### Checkpoint legend

Written by sub-agents after each completed step. The orchestrator reads it on resume and skips already-completed steps. Valid values, in execution order:

- `pre-flight-passed` — sub-agent's per-subtask pre-flight (branch present, tree clean) succeeded
- `branch-cut-ok` — per-subtask working branch is checked out (N/A here: one shared branch, no worktree — `LD-07`)
- `executor-done` — `executor` returned; code committed
- `unit-test-generate-done` — `unit-test` (mode generate) returned; test files written
- `unit-test-run-passed` — `unit-test` (mode run) returned green
- `endpoint-test-passed` — `endpoint-tester` returned green (API tasks only)
- `e2e-test-generate-done` — `e2e-test` (mode generate-*) returned; E2E scaffolds written (FE tasks only)
- `e2e-test-run-passed` — `e2e-test` (mode run) returned green (integration scenarios only)
- `code-review-passed` — `code-reviewer` returned without Critical findings (or with explicit override)
- `mr-created` — `mr-publisher` opened the MR
- `eng-hub-synced` — `eng-hub` Mode 4 wrote the post-merge doc updates

Empty / blank means the subtask has not started or the sub-agent died before its first checkpoint write — in either case the orchestrator restarts from the first applicable step.

---

## EPIC EPIC-1 — case-1-upload-and-recipients

- **code:** `EPIC-1`
- **status:** `TODO`
- **sp:** 65 (18 + 21 + 26; AI-accelerated tracking target 32.5)
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Build Steps 1 and 2 of a 3-step e-signature simulation — "Upload document" then "Set recipients" — as a runnable fullstack app: React/Vite frontend, Express backend, and one shared TypeScript validation + pricing kernel imported by both (`ADR-001`, `LD-23`). Every business rule is enforced server-side; frontend validation is UX only (PRD §7.3). Storage is in-memory and file bytes are discarded after validation; only metadata is kept (`ADR-002`, `LD-03`). Max upload 25 MB, enforced server-side and reported as `422 FILE_TOO_LARGE` (`LD-01`, `ADR-004`). Step 3 "Place fields" is rendered as a visibly locked, display-only stepper pill and is otherwise unscaffolded (`ADR-005`, `LD-02`).
  Covers all 35 rows of PLAN.md `## Service Change Map`. Done when the 15 success criteria of `docs/prompt.md` §7 hold, real test output is saved under `docs/evidence/`, and a specific gap list exists (PRD §14).
  Expected to close `PARTIAL`: the 24-minute budget (PRD §1) is far smaller than 65 SP. `LD-19`'s MUST-HAVE order is the build order, and everything unreached is named by feature in the gap list.

### Story EPIC-1-ST-1 — Shared kernel + workspace scaffold + root docs

- **code:** `EPIC-1-ST-1`
- **status:** `TODO`
- **sp:** 18 (7 subtasks: 3 + 3 + 3 + 3 + 2 + 2 + 2; AI-accelerated 9)
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 1–10. Owns the `pnpm` workspace scaffold (root manifests, the single `pnpm-lock.yaml`, `tsconfig.base.json`, and **all three** per-package manifests / tsconfigs / test-runner configs — single-owner by `ADR-007` item 1 so the lockfile has exactly one author), the frozen `packages/shared` kernel with its five test suites written before the rules, and the root deliverable docs.
  This is the contract story: `ADR-007` item 2 freezes the kernel's public API, and both other stories compile against those exact signatures from minute zero without waiting for this story to land.

#### Subtask EPIC-1-ST-1.1 — pnpm workspace scaffold: root manifests, lockfile, all three package manifests + tsconfigs + test-runner configs

- **code:** `EPIC-1-ST-1.1`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 1–2. Root `package.json` (with `dev`, `test`, `typecheck`, `build` scripts; `dev` starts both processes), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), the single `pnpm-lock.yaml`, strict `tsconfig.base.json` (ES2022, `moduleResolution: bundler`), `.npmrc`, `.gitignore`, plus the manifest / tsconfig / vitest-or-vite config triplet for each of the three packages. Declares the full dependency set for all three packages up front so no other story ever touches the lockfile (`ADR-007`).
- **files:**
  - `package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml`
  - `tsconfig.base.json`
  - `.npmrc`
  - `.gitignore`
  - `packages/shared/package.json`
  - `packages/shared/tsconfig.json`
  - `packages/shared/vitest.config.ts`
  - `apps/server/package.json`
  - `apps/server/tsconfig.json`
  - `apps/server/vitest.config.ts`
  - `apps/web/package.json`
  - `apps/web/tsconfig.json`
  - `apps/web/vite.config.ts`
- **dod:**
  - `pnpm install --frozen-lockfile` from a clean checkout succeeds at the repo root.
  - `pnpm -r typecheck` runs in all three packages and exits 0 (empty packages are allowed to be trivially green at this point).
  - `pnpm -r test` resolves a test runner in all three packages and exits 0.
  - `apps/web/vite.config.ts` proxies `/api` to `http://localhost:3001`; asserted by inspection plus the Wave 3 `pnpm dev` + `curl` check.
  - `pnpm-lock.yaml` already contains every dependency `apps/server` and `apps/web` will import; neither story needs to add one.
  - Commit contains no source file under any `src/`.
- **commit:** `chore(workspace):`
- **prd:** §12

#### Subtask EPIC-1-ST-1.2 — `money.ts` — bigint minor units, strict parse/format, arithmetic (tests first)

- **code:** `EPIC-1-ST-1.2`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 3, with its suite from row 9. `Minor = bigint` (1 IDR = `100n`), `parseDecimalString` (strict `/^\d+\.\d{2}$/`, `RangeError` otherwise), `formatDecimalString` (always 2 fraction digits), `multiplyMinor`, `sumMinor`. The only decimal-string conversion points in the system (`ADR-006`, `LD-22`). No binary floats anywhere.
- **files:**
  - `packages/shared/src/money.ts`
  - `packages/shared/src/__tests__/money.test.ts`
- **dod:**
  - The test file is authored before the implementation and its expected values are hand-derived from PRD §6 — not copied from implementation output (PRD §13.3, `LD-32`).
  - `formatDecimalString(parseDecimalString("5000.00"))` round-trips to `"5000.00"`; `multiplyMinor(parseDecimalString("5000.00"), 3)` formats to `"15000.00"`.
  - Malformed inputs (`"5000"`, `"5000.0"`, `"5000.000"`, `"-1.00"`, `"abc"`, `""`) each throw `RangeError` — one negative assertion per case.
  - `grep -n "number" packages/shared/src/money.ts` shows no arithmetic on a `number` money value; `multiplyMinor`'s `n` is an integer signature count, not a money value.
  - `pnpm --filter @signed-doc/shared test` green for this suite.
- **commit:** `feat(shared):`
- **prd:** §6, §9, §11.1, §13.3

#### Subtask EPIC-1-ST-1.3 — `file.ts` — sanitizeFilename, extensionOf, isAllowedExtension, validateFileMeta (tests first)

- **code:** `EPIC-1-ST-1.3`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 4, with its suite from row 9. Untrusted-input sanitizer: strip `/`, `\`, `..`, reject anything that is not a bare basename, truncate to exactly 200 characters preserving the extension (`LD-25`), judge the extension from the **sanitized** name only — never the client `Content-Type` (PRD §7.9). Deliberately **preserves** `<` and `>` so the text-only-rendering defence is actually exercised rather than passing trivially.
- **files:**
  - `packages/shared/src/file.ts`
  - `packages/shared/src/__tests__/file.test.ts`
- **dod:**
  - Tests authored before the rules, expected values hand-derived from PRD §6 / §7.8.
  - `../../etc/passwd.pdf` sanitizes to `passwd.pdf` with no path component remaining (PRD §10 path-traversal row).
  - `<img src=x onerror=alert(1)>.pdf` survives sanitization **unchanged** as a basename — an assertion that fails if someone "hardens" the function by stripping angle brackets (PRD §10 XSS row).
  - A 250-character name yields `stem + "." + ext` of exactly 200 characters with the extension intact; an extension alone ≥ 200 characters yields `FILENAME_INVALID` (`LD-25`).
  - `.exe` and `.pdf.exe` both yield `FILE_TYPE_NOT_ALLOWED`; all six allowed extensions pass in upper, lower and mixed case.
  - `pnpm --filter @signed-doc/shared test` green for this suite.
- **commit:** `feat(shared):`
- **prd:** §7.8, §7.9, §10 (path-traversal and XSS rows), §11.2

#### Subtask EPIC-1-ST-1.4 — `recipient.ts` — clamp vs strict count, name/email rules, duplicate groups (tests first)

- **code:** `EPIC-1-ST-1.4`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 5, with its suite from row 9. Four rule families: `clampSignatureCount` (frontend, coercing, never `NaN`/`undefined`) and `isValidSignatureCount` (backend, strict integer 1–20, **no coercion**) as two deliberately different functions; `validateRecipient`; `normalizeEmail` (trim + lowercase); `findDuplicateEmailGroups`; `validateRecipientList` ordered count → per-recipient → duplicates (`LD-24`). This is the one shared module PRD §8.5 demands.
- **files:**
  - `packages/shared/src/recipient.ts`
  - `packages/shared/src/__tests__/recipient.test.ts`
- **dod:**
  - Tests authored before the rules; the six negative cases PRD §11.2 names each have their own assertion.
  - `isValidSignatureCount` returns `false` for `0`, `-1`, `2.5`, `"abc"`, `""`, `null`, `undefined`, `21` — and never returns a corrected value.
  - `clampSignatureCount(raw, previous)` returns `previous` for every non-integer input and never returns `NaN` or `undefined`; asserted over the same input set (PRD §8.3).
  - `findDuplicateEmailGroups` groups `"  Rina.Halim@Example.test "` with `"rina.halim@example.test"` and reports both indexes (PRD §8.4, §10 duplicate-email row).
  - Empty name and malformed email each produce the documented `ValidationFailure` code with the additive `details.recipient_index` (`LD-26`).
  - `validateRecipientList` returns `RECIPIENT_COUNT_INVALID` for a zero-length list and for 11 recipients.
  - `pnpm --filter @signed-doc/shared test` green for this suite.
- **commit:** `feat(shared):`
- **prd:** §8.3, §8.4, §8.5, §11.2, §13.3

#### Subtask EPIC-1-ST-1.5 — `pricing.ts` — computeCharges, quotaRemaining (tests first)

- **code:** `EPIC-1-ST-1.5`
- **status:** `TODO`
- **sp:** 2
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 6, with its suite from row 9. `computeCharges(recipients, unitPriceMinor)` returning per-row charges, `totalSignatures` and `totalChargeMinor`; `quotaRemaining(totalSignatures, quota)` returning `remaining` clamped at 0 plus `overBy` (`LD-17`). Pure and component-free, so PRD §8.6's "derived state, never separately synced" is structurally true. Takes price and quota as parameters — it never reads them (`ADR-003`).
- **files:**
  - `packages/shared/src/pricing.ts`
  - `packages/shared/src/__tests__/pricing.test.ts`
- **dod:**
  - Tests authored before the rules, exact-decimal expectations hand-derived from PRD §6.
  - Rina (2) + Budi (1) at `"5000.00"` gives `totalSignatures: 3` and a total formatting to `"15000.00"`, with `quotaRemaining(3, 8) === { remaining: 5, overBy: 0 }` (PRD §10 Rina/Budi row).
  - The quota boundary is asserted explicitly: `quotaRemaining(8, 8) === { remaining: 0, overBy: 0 }` and `quotaRemaining(9, 8) === { remaining: 0, overBy: 1 }` (PRD §11.1).
  - `packages/shared/src/pricing.ts` imports nothing from React, Express or any config module — verified by inspection of its import list.
  - `pnpm --filter @signed-doc/shared test` green for this suite.
- **commit:** `feat(shared):`
- **prd:** §8.6, §8.7, §11.1

#### Subtask EPIC-1-ST-1.6 — `types.ts` + `errors.ts` + `page-count.ts` + `index.ts` barrel (tests first)

- **code:** `EPIC-1-ST-1.6`
- **status:** `TODO`
- **sp:** 2
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 7–8, with the `page-count` suite from row 9. Wire and domain types (`Recipient`, `RecipientInput`, `EnvelopeMeta`, `ChargePreviewRequest`, `ChargePreviewResponse`, `ApiError`), the 11-member `ErrorCode` union plus `ValidationFailure` with additive optional `details` (`LD-26`), the fixture page-count lookup, and the `index.ts` barrel that **is** the frozen public API — a symbol not exported here is not importable by either app (`ADR-007`).
- **files:**
  - `packages/shared/src/types.ts`
  - `packages/shared/src/errors.ts`
  - `packages/shared/src/page-count.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/__tests__/page-count.test.ts`
- **dod:**
  - `pageCountFor` returns 8 for `agreement-vendor-2026.pdf`, 3 for `nda-partner.pdf`, 1 for `berita-acara.docx`, and 1 for any unlisted name — case-insensitively, asserted with mixed-case inputs (PRD §6).
  - `page-count.ts` reads no file content and takes no buffer argument (PRD §4 fact 3) — verified by its signature.
  - `ErrorCode` contains exactly the 11 codes listed in PLAN.md `## Architecture Slice`; no code is emitted anywhere in the repo that is absent from this union.
  - `index.ts` re-exports exactly the frozen API from PLAN.md `## Architecture Slice > Port interfaces`, and exports **no** price, quota or size constant (`ADR-003`).
  - `pnpm --filter @signed-doc/shared typecheck` and `test` both green.
- **commit:** `feat(shared):`
- **prd:** §6, §9, §11.2

#### Subtask EPIC-1-ST-1.7 — Root deliverable docs: `README.md`, `docs/decisions.md`, `docs/ai-log.md`, `docs/evidence/shared-tests.txt`

- **code:** `EPIC-1-ST-1.7`
- **status:** `TODO`
- **sp:** 2
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 10. `README.md` at ≤15 lines covering install/run/test commands, the port, the endpoint mapping, the file-content-discard decision (PRD §7.10) and the in-memory / SQL-injection note (PRD §9). `docs/decisions.md` records the clarifying questions, the plan, trade-offs and every engineer assumption — at minimum the 25 MB limit (`LD-01`), the 10 s / 60 s client timeouts (`LD-28`), no idempotency key (`LD-21`) and no metrics (`LD-30`). `docs/ai-log.md` carries agent transcript excerpts. `docs/evidence/shared-tests.txt` holds the raw, unedited `packages/shared` test output.
- **files:**
  - `README.md`
  - `docs/decisions.md`
  - `docs/ai-log.md`
  - `docs/evidence/shared-tests.txt`
- **dod:**
  - `wc -l README.md` ≤ 15 (PRD §12).
  - A reviewer can run the app from `README.md` commands alone, with no step taken from anywhere else (PRD §14) — checked by following the README verbatim in a clean shell.
  - `README.md` states that file content is discarded after validation and only metadata is kept (PRD §7.10), and carries the in-memory / input-validation note PRD §9 requires.
  - `docs/decisions.md` names all four assumptions above, each with its value and rationale.
  - `docs/evidence/shared-tests.txt` is real captured output of `pnpm --filter @signed-doc/shared test` — it contains the runner's own summary line and is not hand-written.
- **commit:** `docs(shared):`
- **prd:** §7.10, §12

### Story EPIC-1-ST-2 — Backend HTTP service: routes, services, store, server-only config

- **code:** `EPIC-1-ST-2`
- **status:** `TODO`
- **sp:** 21 (7 subtasks: 3 + 2 + 4 + 4 + 4 + 3 + 1; AI-accelerated 10.5)
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 11–23. The whole Express slice: composition root with 5 wiring sites and a strict middleware order, server-only price/quota/limits config (`ADR-003`), the in-memory metadata store behind a two-method port (`ADR-002`), the two use-case services, the HTTP middleware trio, both routers plus `GET /api/health`, and three test suites covering PRD §10 rows 1–11 in-process via `supertest`.
  Owns every business rule that actually counts: the backend re-validates all upload rules and the server's total is final (PRD §7.3, §8.9).

#### Subtask EPIC-1-ST-2.1 — Composition root: `app.ts` + `index.ts` + `request-logger.ts` + `error-mapper.ts`

- **code:** `EPIC-1-ST-2.1`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 17, 18 and 21. `createApp()` as the composition root with the 5 wiring sites and the middleware order logger → per-router `express.json` → routers → `errorMapper` **last**; `index.ts` reads `PORT` (default `3001`) and listens, and is the only file with an import-time side effect. `error-mapper.ts` is the single exit for every failure shape: `ServiceError` → its own status, multer `LIMIT_FILE_SIZE` → `422 FILE_TOO_LARGE` (`LD-27`), malformed JSON → `422`, anything else → `500` with no leaked internals. `request-logger.ts` emits one structured line per request (method, path, status, error code, duration) and nothing more (`LD-30`).
- **files:**
  - `apps/server/src/app.ts`
  - `apps/server/src/index.ts`
  - `apps/server/src/http/request-logger.ts`
  - `apps/server/src/http/error-mapper.ts`
- **dod:**
  - `createApp()` is exported and returns an app `supertest` can drive with no port bound — proven by the route suites in `EPIC-1-ST-2.4` / `EPIC-1-ST-2.6` passing without a listening server.
  - `errorMapper` is registered after every router; an unknown thrown value yields `500` with a body carrying no stack trace and no internal message.
  - Multer's `LIMIT_FILE_SIZE` maps to `422` with `code: "FILE_TOO_LARGE"`, not `413` (`LD-27`).
  - Malformed JSON on the preview route yields `422` in the standard `{ error: { code, message } }` envelope, never a raw Express HTML error page.
  - `express.json` is mounted per-router, so the multipart route is never touched by the JSON body parser — asserted by an oversize-JSON request to the preview route not affecting the upload route.
  - One log line per request is emitted, containing method, path, status, error code and duration.
  - `curl -s localhost:3001/api/health` returns `{"status":"ok"}` once `EPIC-1-ST-2.4` lands the router.
- **commit:** `feat(server):`
- **prd:** §9, §11

#### Subtask EPIC-1-ST-2.2 — Server-only config, in-memory store, service-error channel

- **code:** `EPIC-1-ST-2.2`
- **status:** `TODO`
- **sp:** 2
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 11, 12 and 15. `config/account.ts` (`PRICE_PER_SIGNATURE = parseDecimalString("5000.00")`, `SIGNATURE_QUOTA = 8`) and `config/limits.ts` (`MAX_UPLOAD_BYTES = 25 * 1024 * 1024`, `MAX_JSON_BYTES = 64 * 1024`, `MAX_RECIPIENTS = 10`) — server-only, never importable by the browser bundle (`ADR-003`, `ADR-004`, `LD-01`). `createEnvelopeStore()` gives `{ save, findById }` over a `Map` with sequential `env_NN` ids and metadata only (`ADR-002`). `ServiceError` carries a shared `ValidationFailure` plus an HTTP status and is the only channel from service to handler.
- **files:**
  - `apps/server/src/config/account.ts`
  - `apps/server/src/config/limits.ts`
  - `apps/server/src/store/envelope-store.ts`
  - `apps/server/src/services/service-error.ts`
- **dod:**
  - `grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src` prints nothing outside test fixtures — the `ADR-003` trust boundary holds (PRD §5, Breaking-Change row 11).
  - `MAX_UPLOAD_BYTES` is exactly `25 * 1024 * 1024`, and the same constant is the one handed to multer (`LD-01`).
  - `EnvelopeStore` exposes exactly `save` and `findById`; the stored record is exactly `{ id, filename, size_bytes, page_count, created_at }` with no buffer, no content and no recipient field (`ADR-002`, `LD-20`).
  - `findById` on an unknown id returns `undefined` — the input to the `404` path.
  - `ServiceError` instances carry a `ValidationFailure` whose `code` is a member of the shared `ErrorCode` union; a status other than `422` or `404` is not constructible.
  - `pnpm --filter @signed-doc/server typecheck` green.
- **commit:** `feat(server):`
- **prd:** §4, §5, §6, §7.10, §9, §10 (large-file row)

#### Subtask EPIC-1-ST-2.3 — `envelope-service.ts` — upload use case incl. discard-after-validation, + unit tests

- **code:** `EPIC-1-ST-2.3`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 13, with its suite from row 22. Upload use case in order: require a file → `sanitizeFilename` → `extensionOf` on the sanitized name → `isAllowedExtension` → size check → `pageCountFor` → `store.save`. Returns the `201` body including server-sourced `price` and `quota`. The buffer is never assigned outside this function, so file content is discarded after validation (PRD §7.10, `ADR-002`). All rules re-validated server-side regardless of what the browser already checked (PRD §7.3).
- **files:**
  - `apps/server/src/services/envelope-service.ts`
  - `apps/server/src/__tests__/envelope-service.test.ts`
- **dod:**
  - `createFromUpload(undefined)` raises `ServiceError` `422 FILE_REQUIRED`.
  - Extension judgement happens on the sanitized name, never on `Content-Type`: a `.exe` uploaded with `Content-Type: application/pdf` is rejected `FILE_TYPE_NOT_ALLOWED` (PRD §7.9).
  - Sanitize-then-judge order asserted: `../../etc/passwd.pdf` is stored as `passwd.pdf` and accepted; `../../x.exe` is rejected on extension after sanitization.
  - Page counts come from the fixture table: `agreement-vendor-2026.pdf` → 8, `nda-partner.pdf` → 3, `berita-acara.docx` → 1, unlisted → 1 — with no file bytes read.
  - The saved record contains no `buffer` / content key, and the service holds no reference to the buffer after returning (PRD §7.10) — asserted on the store's captured argument.
  - The `201` body carries server-sourced `price` and `quota`; any client-supplied value for either is ignored (PRD §9).
  - `pnpm --filter @signed-doc/server test` green for this suite.
- **commit:** `feat(server):`
- **prd:** §7.3, §7.8, §7.9, §7.10, §9, §11

#### Subtask EPIC-1-ST-2.4 — `upload-middleware.ts` + `routes/envelopes.ts` + `envelopes.route.test.ts` (PRD §10 rows 1–5)

- **code:** `EPIC-1-ST-2.4`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 16 and 19, with its suite from row 22. `multer({ storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 } }).single('file')` — `files: 1, fields: 0` closes the multi-file and extra-field vectors at the parser. `POST /api/envelopes` (middleware → service → `201`) plus `GET /api/health` so the README's run instructions are checkable in one `curl`. The handler parses, delegates and maps only; no rule lives here (PRD §9).
- **files:**
  - `apps/server/src/http/upload-middleware.ts`
  - `apps/server/src/routes/envelopes.ts`
  - `apps/server/src/__tests__/envelopes.route.test.ts`
- **dod:**
  - `supertest`: `agreement-vendor-2026.pdf` → `201` with `page_count: 8` (PRD §7 criterion 1, §10 row 1).
  - `.exe` and `.pdf.exe` → `422 FILE_TYPE_NOT_ALLOWED` (PRD §7 criterion 2).
  - `../../etc/passwd.pdf` → `201` with the returned filename a sanitized basename carrying no path component (PRD §7 criterion 3).
  - `<img src=x onerror=alert(1)>.pdf` → `201`, filename stored and returned verbatim as a basename (PRD §7 criterion 4; the rendering defence is `EPIC-1-ST-3.4`'s).
  - Missing file → `422 FILE_REQUIRED`; a payload over 25 MB → `422 FILE_TOO_LARGE`, proving the limit is enforced server-side and not only in the browser (PRD §7 criterion 5, `LD-01`).
  - `GET /api/health` → `200 {"status":"ok"}`.
  - `routes/envelopes.ts` contains no validation branch — every rejection originates in the service or the parser.
  - `pnpm --filter @signed-doc/server test` green for this suite.
- **commit:** `feat(server):`
- **prd:** §7.1, §9, §10 rows 1–5

#### Subtask EPIC-1-ST-2.5 — `charge-preview-service.ts` — fixed validation order, key allow-list, duplicates, quota

- **code:** `EPIC-1-ST-2.5`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 14. Five ordered stages, exactly as PRD §9 fixes them: payload shape with a strict key allow-list (`UNKNOWN_FIELD`) → envelope exists (`404`) → per-recipient in index order, `signature_count` → `name` → `email`, first failure wins (`LD-24`) → duplicates → quota. Then `computeCharges` + `quotaRemaining`. Stateless with respect to recipients, so it is idempotent and concurrent-tab safe (`LD-20`), and it consumes no quota (`LD-18`).
  Sized at 4 SP rather than 3 because six PRD §10 acceptance rows depend on this one file (see the note under PLAN.md `## Story-Point Calibration`).
- **files:**
  - `apps/server/src/services/charge-preview-service.ts`
- **dod:**
  - Stage order is asserted by construction, not by inspection: a body that is simultaneously unknown-field-bearing **and** aimed at a missing envelope returns `UNKNOWN_FIELD`; a body aimed at a missing envelope that also holds a duplicate email returns `404` (PRD §9, `LD-24`).
  - `"total_charge":"1.00"` and `"quota":{"signature":99}` each return `422 UNKNOWN_FIELD` with `details.field` naming the offending key, and no client-sent value is ever read (PRD §7 criterion 10, §9).
  - Rina (2) + Budi (1) returns `total_signatures: 3`, `total_charge: "15000.00"`, `quota_remaining: 5` (PRD §7 criterion 6).
  - Two recipients at 3 signatures each (total 9) returns `422 INSUFFICIENT_SIGNATURE_QUOTA` (PRD §7 criterion 7).
  - Trimmed case-variant duplicates return `422 DUPLICATE_RECIPIENT_EMAIL` with `details.recipient_indexes` (PRD §7 criterion 8).
  - `signature_count` of `0`, `-1`, `2.5`, `"abc"` and empty each return `422 SIGNATURE_COUNT_INVALID` — never a clamped value. The service must not import `clampSignatureCount`; `grep -n "clampSignatureCount" apps/server/src` prints nothing (PRD §7 criterion 9).
  - The service neither reads nor writes quota state; `quota_remaining` is computed per call (`LD-18`).
  - Assertions land in `EPIC-1-ST-2.6`'s route suite, which must be green for this subtask to close.
- **commit:** `feat(server):`
- **prd:** §8.4, §8.9, §9, §10 rows 6–11

#### Subtask EPIC-1-ST-2.6 — `routes/charge-preview.ts` + `charge-preview.route.test.ts` (PRD §10 rows 6–11)

- **code:** `EPIC-1-ST-2.6`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 20, with its suite from row 22. `POST /api/envelopes/:id/charge-preview` — parses, calls the service, maps the result to HTTP, nothing else (PRD §9). Its `supertest` suite is the densest acceptance coverage in the repo and is the place `EPIC-1-ST-2.5`'s five-stage order is actually proven.
- **files:**
  - `apps/server/src/routes/charge-preview.ts`
  - `apps/server/src/__tests__/charge-preview.route.test.ts`
- **dod:**
  - Path is exactly `POST /api/envelopes/:id/charge-preview`, so no endpoint remapping table is needed in the README (PRD §9).
  - All of PRD §10 rows 6–11 covered by named cases: Rina+Budi → `3 / "15000.00" / 5`; 9 signatures → `INSUFFICIENT_SIGNATURE_QUOTA`; trimmed case-variant duplicate → `DUPLICATE_RECIPIENT_EMAIL` with `details.recipient_indexes`; `signature_count` of `0`/`-1`/`2.5`/`"abc"`/`null` → `SIGNATURE_COUNT_INVALID`; extra `total_charge` / `quota` → `UNKNOWN_FIELD` with `details.field`; `env_999` → `404 ENVELOPE_NOT_FOUND`; empty array and 11 recipients → `RECIPIENT_COUNT_INVALID`.
  - Every response body matches the `{ error: { code, message, details? } }` envelope (`LD-26`).
  - The handler contains no validation branch and no money arithmetic.
  - `pnpm --filter @signed-doc/server test` green for the whole package.
- **commit:** `feat(server):`
- **prd:** §9, §10 rows 6–11

#### Subtask EPIC-1-ST-2.7 — Backend deliverables: `AGENTS.md`, `docs/evidence/server-tests.txt`

- **code:** `EPIC-1-ST-2.7`
- **status:** `TODO`
- **sp:** 1
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 23. `AGENTS.md` at ≤20 lines: folder map, entry points, validation commands, business invariants and the input trust boundaries (PRD §12). `docs/evidence/server-tests.txt` holds the raw, unedited `apps/server` test output.
- **files:**
  - `AGENTS.md`
  - `docs/evidence/server-tests.txt`
- **dod:**
  - `wc -l AGENTS.md` ≤ 20 (PRD §12).
  - `AGENTS.md` names the composition root (`apps/server/src/app.ts`), the two service files, the trust boundary (`ADR-003`: price and quota are server-only) and the exact commands to typecheck and test each package.
  - `docs/evidence/server-tests.txt` is real captured output of `pnpm --filter @signed-doc/server test`, containing the runner's summary line, not hand-written.
  - No secret, token or real personal datum appears in either file; fixture emails use `@example.test` (PRD §5).
- **commit:** `docs(server):`
- **prd:** §12

### Story EPIC-1-ST-3 — Frontend: Step 1 upload, Step 2 recipients, API layer, controllers, verification

- **code:** `EPIC-1-ST-3`
- **status:** `TODO`
- **sp:** 26 (8 subtasks: 3 + 3 + 3 + 4 + 4 + 4 + 3 + 2; AI-accelerated 13)
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 24–35. The whole `apps/web` slice: app shell and 3-pill stepper with pill 3 locked (`ADR-005`), the disabled-control primitive (`LD-05`), the API layer plus display-only money formatter, the upload state machine, both step views, the recipients reducer with its `countRaw` mechanism, the stale-response guard, and the verification deliverables.
  Carries roughly 60 percent of the review weight (PRD §4). No router and no global store: `App.tsx` switches on a `step` value and each feature owns a `useReducer`, which is what keeps every reducer testable without rendering (`LD-32`).
- **figma:** `N/A — no Figma file exists (LD-10)`. Substituted design source of record, normative for structure, copy and accessibility strings:
  - `/Users/kuro/project/react/react-playground/signed-doc/Upload & Recipients Mockup.html` — board 1 `Step 1 — Upload document`
  - `/Users/kuro/project/react/react-playground/signed-doc/Upload & Recipients Mockup.html` — board 2 `Step 2 — Set recipients`
  - `/Users/kuro/project/react/react-playground/signed-doc/Upload & Recipients Mockup.html` — board 3 `Step 3 — Place fields` (read only for the 3-pill stepper shape; nothing else is used — `ADR-005`)
  - `./PLAN.md` `## Context > Figma` — the decoded markup, copy strings and aria labels, recovered verbatim. Five states have no design at all (empty dropzone, upload loading, upload error/retry, per-row validation error, over-quota banner) and are engineer-designed to the PRD text (`LD-10`).

#### Subtask EPIC-1-ST-3.1 — App shell + stepper + disabled-control primitive

- **code:** `EPIC-1-ST-3.1`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 24, 25 and 26. `index.html`, `main.tsx` (React root + `styles.css`), `App.tsx` (owns `step`, the `EnvelopeMeta` handed from Step 1 to Step 2, and the server-issued `price`/`quota`; props only, no context, no store), `styles.css` (the mockup's colour values as plain CSS custom properties plus the specified `:focus-visible` ring), `Stepper.tsx` (3 pills, pill 3 visibly locked and display-only) and `DisabledControl.tsx` (`From cloud`, `Save as draft`).
- **files:**
  - `apps/web/index.html`
  - `apps/web/src/main.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/components/Stepper.tsx`
  - `apps/web/src/components/DisabledControl.tsx`
- **dod:**
  - `pnpm --filter @signed-doc/web build` succeeds and `pnpm dev` serves the shell with Vite proxying `/api` to `:3001`.
  - The stepper renders 3 pills; pill 3 `Place fields` is `aria-disabled="true"`, not focusable by Tab, and carries no click handler or route (`ADR-005`, `LD-02`).
  - `grep -ril "place.fields" apps/web/src` matches only `Stepper.tsx` and the Step 2 server-confirmed note — no route, no page, no field-placement scaffolding exists (`ADR-005`).
  - The active pill carries `aria-current="step"`.
  - `From cloud` and `Save as draft` render `disabled` **and** `aria-disabled="true"` with the visible reason `Not available in this exercise` adjacent and programmatically associated, and with no click handler (`LD-05`).
  - Keyboard focus is visible on every interactive element: `outline: 2px solid #4B4EDE; outline-offset: 2px` on `:focus-visible` (PRD §8.12).
  - `apps/web/src` imports nothing from `apps/server` (`ADR-003`).
- **commit:** `feat(web):`
- **prd:** §3, §8.12

#### Subtask EPIC-1-ST-3.2 — API layer + display-only money formatter

- **code:** `EPIC-1-ST-3.2`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map rows 27 and 28. `client.ts` — one `fetch` wrapper owning `AbortController` composition and the timeouts, normalizing `422`/`404` bodies into a typed `ApiError`; the single cancellation path shared with the staleness guard (`LD-28`). `upload.ts` — `FormData` field `file`, 60 s. `charge-preview.ts` — sends **only** `{ recipients: [{ name, email, signature_count }] }`, never price, total or quota (`ADR-003`), 10 s. `money-display.ts` — `"15000.00"` → `Rp15.000,00` via `Intl.NumberFormat('id-ID')`, display-only (`LD-11`).
- **files:**
  - `apps/web/src/api/client.ts`
  - `apps/web/src/api/upload.ts`
  - `apps/web/src/api/charge-preview.ts`
  - `apps/web/src/format/money-display.ts`
- **dod:**
  - `client.ts` exposes exactly one `AbortController` composition point and accepts an external `signal`, so the staleness guard and the timeout share one cancellation path (`LD-28`).
  - Timeouts are 10 s for `charge-preview` and 60 s for upload; on timeout the request aborts and a retryable `ApiError` surfaces with the message `Could not reach the server — try again` (`LD-28`).
  - Zero automatic retries anywhere in the API layer — `grep -n "retry" apps/web/src/api` shows no retry loop (`LD-29`).
  - `fetchChargePreview`'s serialized body contains exactly the keys `recipients` → `name`, `email`, `signature_count`; a snapshot assertion fails if price, total or quota is ever added (`ADR-003`, PRD §9).
  - `formatIdr("15000.00")` returns `Rp15.000,00`; `formatIdr` output is never passed back into a calculation — `money-display.ts` has no importer other than render code (`ADR-006`, `LD-11`).
  - Wire values stay plain decimal strings in both directions; no money value is sent or parsed as a JSON number (PRD §4 fact 1).
- **commit:** `feat(web):`
- **prd:** §8.9, §8.11, §9

#### Subtask EPIC-1-ST-3.3 — `upload-machine.ts` + `upload-machine.test.ts`

- **code:** `EPIC-1-ST-3.3`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 29, with its suite from row 34. Five states `idle → validating → uploading → success → error` and actions `SELECT_FILE`, `FE_REJECT`, `UPLOAD_OK`, `UPLOAD_FAIL`, `RETRY`, `REMOVE`. A second `SELECT_FILE` **replaces** the first, so the state holds at most one document and files cannot accumulate (PRD §7.5, §7.6). Unit-tested without rendering (`LD-32`).
- **files:**
  - `apps/web/src/features/upload/upload-machine.ts`
  - `apps/web/src/__tests__/upload-machine.test.ts`
- **dod:**
  - Every one of the five states is reachable and asserted, and every action has at least one transition test.
  - `SELECT_FILE` from `success` replaces the held document; the state after it contains exactly one document, never two (PRD §7.5).
  - `REMOVE` from `success` returns to `idle` with the empty state restored (PRD §7.5).
  - `RETRY` from `error` re-enters `uploading` while preserving the selected file and every previously typed value — nothing is lost (PRD §7.7, `LD-28`).
  - `FE_REJECT` carries the per-cause reason so Step 1 can render a cause-specific message (PRD §7.2), and never bypasses the server: a frontend-accepted file is still re-validated server-side (PRD §7.3).
  - The machine is a pure function of `(state, action)`; the test file imports no React and renders nothing (`LD-32`).
  - `pnpm --filter @signed-doc/web test` green for this suite.
- **commit:** `feat(web):`
- **prd:** §7.5, §7.6, §7.7, §11

#### Subtask EPIC-1-ST-3.4 — Step 1 view: `UploadStep.tsx`, `Dropzone.tsx`, `DocumentCard.tsx`

- **code:** `EPIC-1-ST-3.4`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 30. `UploadStep.tsx` — `What needs to be signed?`, the gated `Continue`, the loading / error / retry states. `Dropzone.tsx` — `Drop your file here or Browse` plus the helper text, a visually hidden `input[type=file]` bound to a `<label>` so the `Browse` path is keyboard-reachable, and frontend pre-validation for UX only. `DocumentCard.tsx` — `Uploaded · {n} pages · {size}` with the filename as a **text node only** and `aria-label="Remove {filename}"`. Copy strings are taken verbatim from the mockup.
- **files:**
  - `apps/web/src/features/upload/UploadStep.tsx`
  - `apps/web/src/features/upload/Dropzone.tsx`
  - `apps/web/src/features/upload/DocumentCard.tsx`
- **dod:**
  - Manual browser pass, recorded in `docs/verification.md`: uploading `agreement-vendor-2026.pdf` against the real backend shows `8 pages` on the card and enables `Continue` (PRD §7 criterion 1).
  - `Continue` is `disabled` until the upload machine reaches `success`, with the reason rendered on screen and referenced by `aria-describedby` (PRD §7.6).
  - Uploading a second file replaces the first in the UI — never two cards (PRD §7.5).
  - Rejections show a per-cause message (wrong type, too large, missing file), each distinct (PRD §7.2).
  - Upload failure shows a `Try again` control that retries without losing the selection; no automatic retry fires (PRD §7.7, `LD-29`).
  - `<img src=x onerror=alert(1)>.pdf` renders as visible text with no script execution — no `dangerouslySetInnerHTML` and no attribute-interpolated `innerHTML` anywhere in these three files (PRD §7 criterion 4, §10 XSS row).
  - The remove button carries `aria-label="Remove {filename}"`; `Browse` is reachable and activatable by keyboard alone (PRD §7.4, §8.12).
  - Drag-and-drop is optional (PRD §7.1); if dropped, it is named explicitly in `docs/verification.md`'s gap list. The `input[type=file]` path ships regardless.
- **commit:** `feat(web):`
- **prd:** §7.1, §7.2, §7.4, §7.6, §10 (XSS row)

#### Subtask EPIC-1-ST-3.5 — `recipients-reducer.ts` + `seed.ts` + `recipients-reducer.test.ts`

- **code:** `EPIC-1-ST-3.5`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 31, with its suite from row 34. `rows: { id, name, email, signature_count, countRaw }[]` with actions `SET_NAME`, `SET_EMAIL`, `SET_COUNT_RAW`, `COMMIT_COUNT`, `INC`, `DEC`, `ADD_ROW`, `REMOVE_ROW`. `countRaw` is a separate string field, so a mid-typing empty box never forces the numeric value to `NaN`; the number changes only on a valid parse or on blur. `ADD_ROW` is a no-op at 10 rows, `REMOVE_ROW` a no-op at 1 row (`LD-12`, `LD-16`). `seed.ts` seeds Rina Halim / 2 and Budi Santoso / 1 exactly as PRD §6 gives them (`LD-15`), frontend initial state only.
- **files:**
  - `apps/web/src/features/recipients/recipients-reducer.ts`
  - `apps/web/src/features/recipients/seed.ts`
  - `apps/web/src/__tests__/recipients-reducer.test.ts`
- **dod:**
  - After `SET_COUNT_RAW` with `""`, `"abc"`, `"2.5"`, `"-1"` or `"0"`, `signature_count` is a valid integer 1–20 in every case — `Number.isInteger` holds and the value is never `NaN` or `undefined` (PRD §7 criterion 9, §8.3).
  - `INC` stops at 20 and `DEC` stops at 1; both are asserted at the boundary.
  - `ADD_ROW` at 10 rows leaves the list at 10; `REMOVE_ROW` at 1 row leaves the list at 1 (`LD-12`, `LD-16`, PRD §8.1, §8.2).
  - The reducer uses the shared `clampSignatureCount` from `packages/shared` rather than a local copy — one validation module, no drift (PRD §8.5).
  - `seed.ts` matches PRD §6 exactly: Rina Halim / `rina.halim@example.test` / 2 and Budi Santoso / `budi.santoso@example.test` / 1. Only `@example.test` fixture emails appear (PRD §5).
  - No derived total is stored in reducer state — no `total_charge`, `total_signatures` or `quota_remaining` key exists (PRD §8.6).
  - The test file renders nothing and imports no React (`LD-32`); `pnpm --filter @signed-doc/web test` green for this suite.
- **commit:** `feat(web):`
- **prd:** §8.1, §8.2, §8.3, §10 (signature_count row), §11

#### Subtask EPIC-1-ST-3.6 — Step 2 view: `RecipientsStep.tsx`, `RecipientRow.tsx`, `SummaryPanel.tsx`

- **code:** `EPIC-1-ST-3.6`
- **status:** `TODO`
- **sp:** 4
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 32. `RecipientsStep.tsx` — `Who signs it?`, the rows, `Add signer`, the summary panel, `Back` / `Save as draft` (disabled) / `Continue`. `RecipientRow.tsx` — `<label for>` on all three inputs (`signer-name-{i}`, `signer-email-{i}`, `signer-count-{i}`), `aria-label` on the −, + and remove buttons reusing the mockup's own strings including its `signer {i+1}` blank-name fallback, and `aria-invalid` + `aria-describedby` on invalid fields. `SummaryPanel.tsx` — derived totals only, remaining quota clamped at 0 plus the explicit over-quota message (`LD-17`), and the server-confirmed swap on `Continue` success (`LD-13`).
- **files:**
  - `apps/web/src/features/recipients/RecipientsStep.tsx`
  - `apps/web/src/features/recipients/RecipientRow.tsx`
  - `apps/web/src/features/recipients/SummaryPanel.tsx`
- **dod:**
  - Manual browser pass, recorded in `docs/verification.md`: Rina (2) + Budi (1) shows 3 signatures and `Total charge` `Rp15.000,00`, and `Continue` returns the server's `total_signatures: 3`, `total_charge: "15000.00"`, `quota_remaining: 5` (PRD §7 criterion 6).
  - Two recipients at 3 signatures each disables `Continue` with the visible reason `9 of 8 signatures — 1 over your quota`, which is the `aria-describedby` target; remaining quota displays `0`, never negative (PRD §7 criterion 7, `LD-17`).
  - Duplicate emails differing only by case and surrounding whitespace mark both colliding rows, driven by the shared module running locally; the server's `details.recipient_indexes` is used for reconciliation and message text only (PRD §7 criterion 8, `LD-26`).
  - All totals are computed in render from `computeCharges` / `quotaRemaining` — no total is held in state and no synchronizing effect exists (PRD §8.6).
  - On `Continue` success the summary swaps to the server's figures labelled server-confirmed, with an inline note that Step 3 is outside this exercise, and **no navigation occurs**; the Step 3 pill stays locked (`LD-13`).
  - `Add signer` at 10 rows is visible but `disabled` with the reason `Maximum 10 recipients per document`; remove at 1 row is visible but `disabled` with `At least one recipient is required` (`LD-12`, `LD-16`).
  - Accessibility: every input has a `<label for>`; every icon button has an `aria-label`; invalid fields carry `aria-invalid` plus `aria-describedby`; the whole flow is operable by keyboard with a visible focus ring (PRD §8.12).
- **commit:** `feat(web):`
- **prd:** §8.4, §8.7, §8.8, §8.12

#### Subtask EPIC-1-ST-3.7 — `preview-controller.ts` + `preview-controller.test.ts` (stale-response guard)

- **code:** `EPIC-1-ST-3.7`
- **status:** `TODO`
- **sp:** 3
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 33, with its suite from row 34. A monotonically increasing `requestSeq` plus the live `AbortController`: any recipient change increments the sequence and aborts the in-flight request, and a response is accepted **only** if its sequence equals the current one. The same `AbortController` carries the 10 s timeout (`LD-28`) and there are zero automatic retries (`LD-29`), because auto-retry is precisely the bug PRD §8.10 tests for. This is the single most-tested behaviour in PRD §10.
- **files:**
  - `apps/web/src/features/recipients/preview-controller.ts`
  - `apps/web/src/__tests__/preview-controller.test.ts`
- **dod:**
  - Two in-flight requests resolved out of order: the older response is dropped and never becomes the active result (PRD §7 criterion 12, §8.10, §10 last row).
  - Any recipient change invalidates the previous server result — the displayed server figures clear rather than going stale (PRD §8.10).
  - The controller takes its transport as a parameter, so the test resolves two promises in a controlled order with **no** `setTimeout`, no real `fetch` and no wall-clock wait — the suite is deterministic and non-flaky.
  - Exactly one request is in flight per user intent; a superseded request is aborted, and no automatic retry is issued (`LD-29`).
  - A 10 s timeout aborts and surfaces a retryable inline error while every typed value stays intact (`LD-28`).
  - `pnpm --filter @signed-doc/web test` green for this suite, run three times consecutively with no flake.
- **commit:** `feat(web):`
- **prd:** §8.10, §8.11, §10 (last row), §11

#### Subtask EPIC-1-ST-3.8 — Verification aggregation: `docs/verification.md`, `docs/evidence/web-tests.txt`, manual browser pass, gap list

- **code:** `EPIC-1-ST-3.8`
- **status:** `TODO`
- **sp:** 2 (`testing-only`)
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Service Change Map row 35. Run every suite, save real output, walk the acceptance rows manually in the browser — that manual pass is the wiring evidence, since the committed tests are state/controller only (`LD-32`) — and write the gap list naming each unfinished feature and why (PRD §14 forbids "some things are missing"). Last subtask of the story; it reads `docs/evidence/shared-tests.txt` and `docs/evidence/server-tests.txt` by path and never edits them.
- **files:**
  - `docs/verification.md`
  - `docs/evidence/web-tests.txt`
- **dod:**
  - `docs/evidence/web-tests.txt` is real captured output of `pnpm --filter @signed-doc/web test`, containing the runner's summary line, not hand-written.
  - `docs/verification.md` records each command with its **actual** output: `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm -r test`, the three per-package test commands, `pnpm --filter @signed-doc/web build`, and `curl -s localhost:3001/api/health` (PRD §12, §14).
  - The two grep gates are run and their output pasted: `grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src` prints nothing, and `grep -ril "place.fields" apps/web/src` matches only `Stepper.tsx` and the Step 2 server-confirmed note (`ADR-003`, `ADR-005`).
  - All 15 rows of `docs/prompt.md` §7 are walked and each has a pass / fail / unverified verdict, plus the two UI-only rows (`Continue` gating with a visible reason; changing recipients while a preview is in flight).
  - The gap list names every unfinished item by feature and reason — drag-and-drop and DOM interaction tests explicitly if they were dropped (PRD §7.1, §14, `LD-19`, `LD-32`).
  - Anything that remains unverified is stated as unverified rather than omitted.
  - The `case-1` commit / tag exists and marks this checkpoint (PRD §13.6, §14).
- **commit:** `docs(web):`
- **prd:** §11, §12, §13.6, §14

---

## Per-story file ownership (normative — disjointness is the contract)

Reproduced from PLAN.md `## Execution Waves > Wave 2 — file ownership`. Every path is repo-root relative to `/Users/kuro/project/react/react-playground/signed-doc`. These three blocks are the normative ownership lists: the union of a story's subtask `files` entries equals its block exactly, and no path appears in two blocks. **Read the lists literally** — directory ownership deliberately does not coincide with file ownership: `EPIC-1-ST-1` owns `apps/server/package.json` and `apps/web/package.json` (and their tsconfig / vite / vitest configs) so the single `pnpm-lock.yaml` has exactly one author (`ADR-007` item 1).

**`EPIC-1-ST-1` (`ST-1`) — Shared kernel + workspace scaffold + root docs. 18 SP. 32 files.**

<!-- files:EPIC-1-ST-1 begin -->
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
<!-- files:EPIC-1-ST-1 end -->

**`EPIC-1-ST-2` (`ST-2`) — Backend HTTP service: routes, services, store, server-only config. 21 SP. 18 files.**

<!-- files:EPIC-1-ST-2 begin -->
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
<!-- files:EPIC-1-ST-2 end -->

**`EPIC-1-ST-3` (`ST-3`) — Frontend: Step 1 upload, Step 2 recipients, API layer, controllers, verification. 26 SP. 25 files.**

<!-- files:EPIC-1-ST-3 begin -->
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
<!-- files:EPIC-1-ST-3 end -->

**Disjointness:** 32 + 18 + 25 = 75 paths, all distinct. No path appears in two lists, so all three stories are dispatchable concurrently in `downstream` parallel mode. All three are also ≥ 10 SP, which is the parallel-mode floor.

**Cross-story dependencies (all read-only — none is a file conflict):**

- `EPIC-1-ST-2` and `EPIC-1-ST-3` both import `packages/shared` and compile against the frozen signatures in PLAN.md `## Architecture Slice > Port interfaces`. They do not wait for `EPIC-1-ST-1`.
- Both also depend on manifests authored by `EPIC-1-ST-1`. Until `EPIC-1-ST-1.1` lands, they write source against the declared dependency set and defer `pnpm install` to the Wave 3 gate.
- `EPIC-1-ST-3.8` (`docs/verification.md`) references `docs/evidence/shared-tests.txt` and `docs/evidence/server-tests.txt` by path. It is the last subtask of its story and reads those files rather than editing them.

---

## Execution-order wave table

> Copied from PLAN.md `## Execution Waves`. Engineers reading TASK.md alone should still see the parallelism story. Tracks separated by `∥` are parallel, and the parallelism is **file-level**: the three Wave 2 tracks own the disjoint file sets listed above.

| Wave | Tracks (`∥` = runs in parallel) | Blocks downstream |
|------|----------------------------------|-------------------|
| 1 | Contract freeze — shared-kernel public API + OpenAPI contract + file-ownership map **(no code; completed inside PLAN.md at Stage 2a)** | All of Wave 2. Nothing may be dispatched until the kernel signatures in PLAN.md `## Architecture Slice` are signed off. |
| 2 | `EPIC-1-ST-1` shared kernel + workspace scaffold + root docs ∥ `EPIC-1-ST-2` backend HTTP service ∥ `EPIC-1-ST-3` frontend Step 1 + Step 2 | Wave 3. All three must be `DONE` before integration. |
| 3 | Integration gate — root `pnpm install --frozen-lockfile`, workspace-wide typecheck, all suites green, `curl` acceptance script, manual browser pass, `docs/verification.md` finalized, gap list written, `case-1` commit + tag | Nothing — ship. This is the minute-24 checkpoint (PRD §13.6, §14). |
| 4 | — *(skipped — no work. Step 3 "Place fields" is out of scope and deliberately unscaffolded per `ADR-005`.)* | — |
| 5 | — *(skipped — no work. No async/heavy endpoints, no AI integration, no Playwright: `LD-31` fixes verification at local Vitest + supertest + manual pass, and `LD-32` chooses state/controller tests over DOM interaction tests.)* | — |
| 6 | — *(skipped — no work. No reporting/export surface. Deferred NICE-TO-HAVE items from `LD-19` are recorded in the gap list instead of padded into a wave.)* | — |

**Wave 3 rule:** any cross-story type error found at the integration gate is fixed **by the owning story's agent in the owning story's files**. No agent edits a file it does not own, even to unblock itself. `TASK.md` is the sole shared file, governed by the race-safe protocol below.

---

## Status update protocol

**Per subtask commit:** flip `TODO`→`DONE` inline with `(SHA)` suffix + 1-line summary. Race-safety: only edit lines under your own subtask + your own story header. Use the `Edit` tool with unique-context `old_string`. **Never** `replace_all`.

**Per story merge:** flip the story status to `DONE`. If any subtask is `PARTIAL` or `DEFERRED`, the story status is `PARTIAL` (not `DONE`) and the remaining items are listed under the story.

**Per epic milestone:** count SP done vs total (65), MUST-HAVE vs NICE-TO-HAVE breakdown per `LD-19`, list deferred items. Update the EPIC node's status only at the end (after all stories close out). The epic is expected to close `PARTIAL` at minute 24 — record the gap list, do not pad the status.

**`BLOCKED`:** requires a one-liner naming the dependency + the date you'll re-check. Stale `BLOCKED` (no recheck date or recheck date passed) gets flagged by `/task-board`.

**`PARTIAL`:** requires the inline list of what's left. Used at story or epic level when shipping a usable subset and deferring the rest.

**`DEFERRED`:** requires the link forward — the follow-up epic / ticket where the deferred work lives.

**`last-checkpoint`:** sub-agents write it after each completed step, using only the values in the [Checkpoint legend](#checkpoint-legend). The orchestrator reads it on resume and skips already-completed steps.

---

## Scenario pointers

The engineer opted in to E2E scenario catalogs after PLAN.md was written, so this block supersedes PLAN.md `## Out-of-Scope` and `## Next Action` item 4 on that one point. `SCENARIO.md` is generated into this same directory.

- `SCENARIO.md` → `./docs/features/case-1-upload-and-recipients/SCENARIO.md`
  E2E scenario IDs follow `SCEN-<STORY>-<P|N><n>`. Browser-level assertions live there; downstream `e2e-test` (mode generate-playwright) reads that file to generate Playwright tests. Story IDs in scenario codes use the short form (`ST-1`, `ST-2`, `ST-3`) — the same nodes as `EPIC-1-ST-1` … `EPIC-1-ST-3` here.

- `INTEGRATION_SCENARIO.md` — **not generated.** Only the E2E catalog was opted into, and this file does not exist, so nothing links to it. Downstream `endpoint-tester` sources its cases from PLAN.md `## API Spec — OpenAPI YAML` plus the PRD §10 acceptance rows already enumerated in the `dod` blocks of `EPIC-1-ST-2.4` and `EPIC-1-ST-2.6`. Run `scenario-cataloguer` standalone later if a service-level catalog is wanted.

---

## Case-2 seam shaping — constraints on EPIC-1 subtasks

> Source: `PLAN-case-2-delta.md` §4. Product issued Case 2 (`test_2_en.md`) while this plan
> was still paper. These five items change the **shape** of EPIC-1 code so the Case-2
> extension is additive. They ship **no Case-2 behaviour** and do not widen EPIC-1 scope.
> Anything not on this list waits for the minute-24 checkpoint.

| # | Applies to | Constraint | Delta ref |
|---|---|---|---|
| S1 | `EPIC-1-ST-3` `src/App.tsx` | Step state is `type Step = 1 \| 2 \| 3`, not a boolean. `3` stays unreachable and pill 3 stays locked (`ADR-005`, `LD-02`). Case 2 unlocks it by deleting a guard. | §4.1 |
| S2 | `EPIC-1-ST-1` `pricing.ts`, `EPIC-1-ST-2` `config/account.ts` | Prices and quotas are **records**, not scalars: `PRICES = { signature }`, `QUOTA = { signature }`. `computeCharges` and `quotaRemaining` take the record shape from day one. In Case 1 the `meterai` key simply does not exist. | §4.2 |
| S3 | `EPIC-1-ST-1` `recipient.ts` | `validateRecipientList` is an **ordered array of named stage functions** short-circuiting on first failure (`LD-24` unchanged), not a hardcoded `if` chain. Case 1 registers 3 stages; Case 2's B5 order inserts 9 more. | §4.3 |
| S4 | `EPIC-1-ST-2` `charge-preview-service.ts` | The strict key allow-list is a **function of the request**, not a module constant. Case 2 needs `step` rejected in `parallel` and accepted in `sequential`. | §4.4 |
| S5 | `EPIC-1-ST-3` `features/recipients/preview-controller` | The staleness guard keys on a **payload hash** of the preview input, stored beside the last result — not a monotonic request counter. Satisfies PRD §8.10 now and Case 2's A5.2 later; it is where `preview_token` attaches under P4. | §4.5 |

Rejected as speculative: carrying an unused optional `meterai_count` on `RecipientInput`
during Case 1 (delta §4.6). Cost of adding it at minute 24 is one type edit.

One addition to an existing `dod`: `EPIC-1-ST-1.2`'s money suite must include
`"10000.10"` round-trip and `"25000.10"` / `"45000.30"` sum assertions. Those are Case-2
figures, but they are the values that would expose a float regression, and the suite is
cheapest to write once. No other Case-1 `dod` changes.

---

## EPIC EPIC-2 — case-2-order-meterai-fields

- **code:** `EPIC-2`
- **status:** `TODO`
- **sp:** not estimated — see note
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Case 2 (`test_2_en.md`), handed over at the minute-24 checkpoint, continuing on the same
  codebase. Three product changes plus one optional: e-meterai as a separately priced and
  separately quota'd per-recipient count; a signing-order mode with contiguous steps; the
  Step 3 "Place fields" screen with the count-vs-field reconciliation invariant; and an
  atomic quota reservation behind `Send`. Full re-evaluation of this plan against it —
  what survives, what breaks, the five broken kernel signatures, the new modules, the
  replacement validation order — is in `PLAN-case-2-delta.md`. Read that before starting.
  Verdict recorded there: **extend, don't tear open.** Six of seven ADRs survive; `ADR-005`
  is reversed by product. `LD-18` and `LD-13` are superseded; `LD-02` becomes transitional.
  **SP deliberately not estimated.** 46 minutes remain (`test_2_en.md` §A0) against a scope
  product states is larger than the time. A1's P1→P4 priority order is the plan, and a
  named sacrifice is worth more than four half-finished parts.

### Story EPIC-2-ST-1 — P1: e-meterai — dual pricing, dual quota, per-recipient count

- **code:** `EPIC-2-ST-1`
- **status:** `TODO`
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Highest priority (`test_2_en.md` A1). `meterai_count` per recipient (integer 0–3, default
  0), never exceeding that recipient's `signature_count` (A3.2). Meterai price `"10000.10"`,
  quota `3`, both server-sourced and both independent of the signature quota (A3.5, B1).
  Breaks `computeCharges` and `quotaRemaining` per delta §2 — mitigated by seam S2 if it
  shipped. Summary gains separate lines per A3.7 and dual usage display per A3.8. All
  figures stay derived state (A3.9).
- **dod:**
  - B7 row 1: `parallel`, Rina 2 sig/1 met + Budi 1 sig/0 met → charges `"15000.00"` + `"10000.10"`, total `"25000.10"`, remaining `5`/`2`.
  - B7 row 2: meterai exactly at quota (3) → total `"45000.30"`, remaining meterai `0`, **allowed**.
  - B7 row 3: 4 meterai → `422 INSUFFICIENT_METERAI_QUOTA`, message distinguishable from the signature-quota message.
  - B7 row 4: Rina 2 sig / 3 met → `422 METERAI_EXCEEDS_SIGNATURE`; the FE marks **that row**, not the whole form.
  - B8.3 cost suite run with saved output; Case-1 money suite still green.
- **commit:** `feat(meterai):`

### Story EPIC-2-ST-2 — P2: signing order mode — steps, contiguity, keyboard reorder

- **code:** `EPIC-2-ST-2`
- **status:** `TODO`
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  `order_mode` selector above the recipient list: `parallel` (default, the Case-1
  behaviour) or `sequential` (A2). New kernel module `steps.ts` — contiguity from 1 with
  shared steps legal, plus eager renormalization on delete (A2.3, A2.4). `sequential`
  groups recipients under visible step headers with parallel members marked (A2.5).
  Reordering is **keyboard-mandatory**, drag-and-drop optional (A2.6); `aria-label` names
  the recipient moved and focus survives the move (A2.7); no entered data is lost (A2.8).
  Meterai carriers are confined to step 1 (A3.3), vacuous in `parallel` (A3.4).
- **dod:**
  - B7 row 5: Rina step 1, Budi + Citra step 2 → valid, `steps` has 2 entries, step 2 holds two emails.
  - B7 row 6: Citra in step 2 given 1 meterai → `422 METERAI_NOT_IN_FIRST_STEP`.
  - B7 row 7: `[1,3]`, `[2,3]`, `[0,1]` → `422 STEP_SEQUENCE_INVALID`.
  - B7 row 8: `[1,2,2,3]`, sole member of step 1 deleted → renormalized `[1,1,2]`, other recipient data intact.
  - B7 row 9: `parallel` payload carrying `step` → `422 UNKNOWN_FIELD` (seam S4).
  - B8.1 step-normalization suite run with saved output.
- **commit:** `feat(order):`

### Story EPIC-2-ST-3 — P3: Step 3 Place fields + reconciliation invariant

- **code:** `EPIC-2-ST-3`
- **status:** `TODO`
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  Unlocks Step 3, reversing `ADR-005`. Left panel with signer selector + Signature/eMeterai
  palette; **click-to-place is the mandatory path and must be fully keyboard-operable**,
  drag-and-drop optional (A4.2). Placed fields show kind **and owner identity as text**, not
  colour alone (A4.3). Per-recipient reconciliation progress with shortfall **and** excess
  markers (A4.6). New kernel module `fields.ts`, including the **two-function geometry
  split** — `clampFieldPosition` for the FE, `isFieldInBounds` for the BE, which rejects and
  never clamps (B2). Pricing stays computed from counts, never from field count (A4.12).
  Page 1 only; `Preview` and `Save as draft` stay disabled with an explanation (A4.7).
- **dod:**
  - B7 rows 10–11: count/field mismatch both directions → `422 FIELD_COUNT_MISMATCH`, UI shows `Signature 1/2` and the excess before submitting.
  - B7 row 12: field owned by a non-recipient → `422 FIELD_UNKNOWN_RECIPIENT`.
  - B7 rows 15–16: boundaries tested at `420`/`421` and `500`/`501`, `520`/`521` and `476`/`477` — UI clamps, API returns `422 FIELD_OUT_OF_BOUNDS`.
  - B7 row 17: `page: 2` or `page: 0` → `422 FIELD_PAGE_INVALID`. B7 row 18: duplicate `id` → `422 FIELD_ID_DUPLICATE`.
  - B7 row 19: a field placed entirely by keyboard; focus not lost afterwards.
  - B7 rows 13–14 follow the decisions in delta §9 (flag, don't auto-drop) — visible, documented in `docs/decisions.md`, and tested.
  - B8.2 suite run with saved output.
- **commit:** `feat(fields):`

### Story EPIC-2-ST-4 — P4 (OPTIONAL): `Send` — preview token + atomic reservation

- **code:** `EPIC-2-ST-4`
- **status:** `TODO`
- **services:** `[subproject-a]`
- **last-checkpoint:**
- **description:**
  **Attempt only if EPIC-2-ST-1…3 are all DONE and verified** (A1, A5). Default recommendation
  recorded in delta §9 item 4: **do not attempt**; render `Send` disabled with an explanation
  per A4.7 and state the sacrifice. This is the only genuine architecture change in Case 2 —
  quota becomes mutable server state, `EnvelopeRecord` gains a lock, and `LD-18`
  ("Case 1 never consumes quota") and `LD-20` (stateless w.r.t. recipients) both fall. See
  delta §7 before starting.
- **dod:**
  - B7 row 22: `Send` with a valid token → `200`, **both** quotas decremented, envelope locked.
  - B7 row 23: token predating a field change → `409 PREVIEW_STALE`; the UI offers recompute with **no loss** of entered data or placed fields.
  - Post-reservation `charge-preview` or `reserve` → `409 ENVELOPE_LOCKED` (A5.5).
  - `reserve` accepts **only** `{ preview_token }` — counts, prices, recipients or fields in the payload are rejected (A5.3).
  - A5.7: double-click fires exactly one request.
  - B8: a fault injected between the two quota writes leaves **neither** debited, proven by test output.
- **commit:** `feat(reserve):`

### Cross-cutting — EPIC-2 exit criteria

- **B7 row 20** (preview A and B in flight, B resolves first, A ignored) is satisfied by seam S5 if it shipped; re-verify it after each of ST-1…ST-3, since each one changes the payload the hash is taken over.
- **B7 row 21 — Case-1 regressions.** Upload, duplicate email, signature quota and filename sanitization must still be green. Run the full Case-1 suite at the close of every Case-2 story, not only at the end.
- **B8 refactor rule.** Before any structural refactor (flat recipient array → step-based structure, or adding the field collection), **write and run the tests that lock in the old behaviour first**, then change it. This is explicitly assessed. Seam shaping reduces how much refactor is left; it does not excuse skipping this.
- **A6 wrap-up.** Update `README.md`, `AGENTS.md`, `docs/decisions.md`, `docs/verification.md` and the transcript, then commit/tag `case-2`. `docs/decisions.md` must answer: what changed in the Case-1 data structures and why; every self-made assumption; and **which priority was sacrificed and what the risk is**. `docs/verification.md` must separate what was run with output, what is unverified, and what is believed weak.
