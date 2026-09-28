## 1. Role

You are a senior fullstack engineer tasked with building Case 1 of the "Upload document → Set recipients" flow (Steps 1–2 of a 3-step document e-signature simulation app inspired by, but not connected to, the Mekari Sign domain), with a real HTTP backend enforcing every business rule.

## 2. Context (final — do not re-analyze)

- Business: Self-contained simulation, no real Mekari service or data involved. Single demo account, **no login/auth, no multi-tenancy** (§5). Price and quota belong to that one demo account and are known only to the server (§5, §9). Currency is IDR.
- Technical: Any frontend/backend stack allowed — no bonus for matching Mekari's stack (§4). **Frontend must talk to a real HTTP backend**; a single-process fullstack framework is fine but business rules must never live only in the browser (§4). Storage may be in-memory; a database is not required (§4). Review weight: frontend ±60%, backend ±40% (§4).
- Decisions already made:
  - Step 3 ("Place fields") is explicitly out of scope for Case 1 — do not start it, doing it early earns nothing (§3, table row Step 3).
  - `From cloud` and `Save as draft` controls are out of scope: remove them, or render disabled with an explanation. Never leave them as dead controls that appear to work (§3).
  - Out of scope for **both** cases: PDF content parsing/rendering, affixing signatures/duty stamps, e-meterai/PKI integration, payments, email/notifications, SSO, deployment, mobile apps (§4).
  - File content does not need to be stored permanently; may discard after validation and keep only metadata — this decision must be recorded in the README (§7.10).
  - Mockup (`Upload & Recipients Mockup.html`) is a reference for structure/content only, not pixel-perfect. Not assessed: exact colours/spacing, animation, fonts, identical icons; any UI kit is fine (§3). Responsive layout is not assessed — desktop only is fine (§8.12).

## 3. Scope

IN SCOPE:

- Step 1 — Upload document: dropzone + file input for exactly one document, frontend validation with per-cause messages, backend re-validation of every rule, "Your document" card (filename, `Uploaded · {page_count} pages · {size}`, remove button with named `aria-label`), replace-on-reupload, gated `Continue`, loading/error/retry states, server-side filename sanitization, extension check on sanitized filename (§7.1–§7.10).
- Step 2 — Set recipients: recipient rows (Full name | Email address | Signatures stepper | Charge | remove), `Add signer` (min 1, max 10), signature-count clamp 1–20 with no `NaN`/`undefined` states, per-recipient validation, case-insensitive duplicate-email rejection, one reusable validation module shared by FE+BE, pure/testable derived totals, summary panel, gated `Continue`, authoritative server total via charge-preview, stale-response guarding, error/retry handling, accessibility (labels, aria-labels, visible focus) (§8.1–§8.12).
- Backend: `POST /api/envelopes` (multipart upload) and `POST /api/envelopes/:id/charge-preview`, or equivalents mapped in the README, with the exact success/error shapes and validation order in §9.
- Shared validation module used by both frontend and backend (one source of truth for name/email/signature-count/duplicate rules) (§8.5).
- Minimum tests: cost-calculation functions (exact decimals incl. quota boundary) and the input-validation module (empty name, invalid email, case-insensitive duplicates, out-of-range signature_count, filename sanitization, rejected extensions), run with output saved (§11).
- Deliverables: `README.md`, `AGENTS.md`, `docs/decisions.md`, `docs/verification.md`, agent transcript or `docs/ai-log.md`, source + lockfile + seed + tests runnable from a clean checkout (§12).
- Minute-24 checkpoint: `case-1` commit/snapshot, README-runnable app, real test output saved, specific gap list (§13.6, §14).

OUT OF SCOPE:

- Step 3 "Place fields" board — do not implement, do not scaffold (§3, §4).
- PDF content parsing/rendering, affixing signatures/duty stamps, e-meterai/PKI provider integration, payments, email/notifications, SSO, deployment, mobile apps (§4).
- `From cloud` upload source and `Save as draft` — must be removed or disabled with explanation, not built out (§3, §8 heading note).
- Authentication/login/multi-tenancy — single demo account only (§5).
- Pixel-perfect visual matching to the mockup, animation, exact fonts/icons, responsive layout (§3, §8.12).
- Any change to quota logic in Case 1 (`Continue` calls backend for total; "Case 1 changes no quota") (§8.9).
- Case 2's requirement change — handed to the engineer only after the minute-24 checkpoint; do not pre-build for it (§1, §13.6).

## 4. Critical Facts (do not violate)

1. Every monetary value in the API contract is a decimal string with 2 fraction digits (e.g. `"5000.00"`), never a JSON number; money must use a decimal type or integers scaled by 100 with string conversion — never binary floats, on both FE and BE (§6, §9).
2. Fixtures: price per signature `"5000.00"`, signature quota `8`, max recipients per document `10`, signature_count integer `1`–`20`, allowed extensions `pdf/jpg/jpeg/png/doc/docx` (case-insensitive), max filename length `200` chars after sanitization (§6).
3. Page count is **not** derived from file content — it comes from a fixture table keyed by the sanitized filename (case-insensitive); any unlisted name yields `1` (§6).
4. The backend must re-validate every upload rule; frontend validation is UX only, the decision belongs to the server (§7.3).
5. The filename is untrusted input: the server strips path components (`/`, `\`, `..`), rejects/normalizes anything that isn't a bare basename, and caps length; extension is judged from the **sanitized** filename, never the client's `Content-Type`; the frontend renders the filename as text only, never as HTML (§7.8, §7.9, §10 XSS row).
6. Continue (Step 1) stays disabled until a valid document exists, with the reason visible; uploading a second file replaces the first — files never accumulate (§7.5, §7.6).
7. `signature_count` is clamped 1–20 by both the stepper and the number input; non-numeric/empty/decimal/negative input must never leave state as `NaN`/`undefined` (§8.3).
8. Duplicate emails within one document are rejected, compared after trimming and case-insensitively (§8.4).
9. All totals (per-row `Charge`, total signatures, `Total charge`) are derived state computed by pure, component-free-testable functions — never stored as separately-synced state (§8.6).
10. `Continue` (Step 2) is disabled on any validation error **or** when total signatures exceed quota, with the reason visible on screen (§8.8).
11. The Step 2 `Continue` action calls the backend for the authoritative total; the server's total is final, the frontend number is only a responsive estimate (§8.9).
12. Any change to recipient data invalidates the previous server result; a late response from an older request must never surface as the result for newer data (§8.10, §10 last acceptance row).
13. The server sources price and quota itself; price/total/quota sent by the client are never used, and unknown input fields produce `422 UNKNOWN_FIELD` (§9).
14. Charge-preview validation order is fixed: payload shape → envelope exists → per-recipient validation → duplicates → quota (§9).
15. All calculation and business rules live in a service/use-case layer separate from the HTTP handler; the handler only parses, calls the service, and maps the result to HTTP (§9).
16. If a database is used, queries must be parameterized/ORM-based; if in-memory, the README must note that SQL injection isn't yet relevant but input validation is still enforced (§9).
17. No secrets, tokens, or real personal data in source, frontend bundle, logs, or any document; use `@example.test` fixture emails (§5).
18. Any server-side upload size limit is the engineer's own choice, but it must be enforced **on the server**, not only in the browser, and recorded as an assumption in `docs/decisions.md` (§10).

## 5. Task

Produce: a runnable fullstack implementation of Case 1 (Step 1 Upload document + Step 2 Set recipients) — frontend, backend, shared validation module, tests, and the required documentation deliverables.
Format: source code (frontend + backend, any stack) + markdown docs.
Location: repository root of this project (`signed-doc/`), with docs under `docs/`; API endpoints as specified in §9 unless remapped, in which case the mapping must appear in the README.
Audience: a technical reviewer assessing a Fullstack L3 candidate submission, weighting frontend ±60% / backend ±40% (§4).

The output must include:

- Step 1 Upload document UI + validation (frontend and backend) per §7.
- Step 2 Set recipients UI + validation (frontend and backend) per §8.
- One shared/reusable validation module (name, email, signature-count, duplicate-email rules) used by both layers (§8.5).
- `POST /api/envelopes` and `POST /api/envelopes/:id/charge-preview` (or documented equivalents) implementing the exact success/error shapes, error codes, and validation order in §9.
- Cost-calculation functions as pure, unit-testable code (§8.6, §11.1).
- Tests for cost calculation and the validation module, run with real output saved (§11).
- `README.md` (≤15 lines), `AGENTS.md` (≤20 lines), `docs/decisions.md`, `docs/verification.md`, agent transcript or `docs/ai-log.md` (§12).
- A `case-1` commit/snapshot plus a specific gap list at the minute-24 checkpoint (§13.6, §14).

## 5a. Requirement Traceability

| Output item | Source requirement(s) |
| --- | --- |
| Dropzone + file input, single document | §7.1 |
| Frontend per-cause validation messages | §7.2 |
| Backend re-validation of all upload rules | §7.3 |
| "Your document" card (filename, pages, size, remove w/ aria-label) | §7.4 |
| Remove-to-empty-state; replace on re-upload | §7.5 |
| Gated `Continue` with visible reason | §7.6, §8.8 |
| Loading/error/retry state on upload | §7.7 |
| Server-side filename sanitization | §7.8, §10 (path traversal, XSS rows) |
| Extension judged from sanitized filename | §7.9 |
| File content discard decision recorded in README | §7.10 |
| Recipient rows, min 1 / max 10, `Add signer` | §8.1, §8.2 |
| Signature-count clamp 1–20, no NaN/undefined | §8.3, §10 (signature_count row) |
| Per-recipient + duplicate-email validation | §8.4, §10 (duplicate email row) |
| Shared validation module (FE+BE) | §8.5 |
| Derived, pure-function totals | §8.6 |
| Summary panel (signatures, price, total, remaining quota) | §8.7 |
| Authoritative server total via charge-preview | §8.9, §10 (Rina/Budi row) |
| Stale-response guarding | §8.10, §10 (last row) |
| Accessibility (labels, aria-labels, focus) | §8.12 |
| `POST /api/envelopes` contract + error codes | §9, §10 (upload rows) |
| `POST /api/envelopes/:id/charge-preview` contract + error codes | §9, §10 (quota/duplicate/unknown-field/404 rows) |
| Service layer separate from HTTP handler | §9 |
| Money as decimal/scaled-int, never float | §6, §9 |
| Cost-calc + validation-module tests, output saved | §11 |
| README / AGENTS.md / docs/decisions.md / docs/verification.md / transcript | §12 |
| `case-1` checkpoint + gap list | §13.6, §14 |

## 6. How to Work

- DO NOT make assumptions on business rules covered in Sections 2–4 above — treat them as final.
- DO NOT implement Step 3 ("Place fields") or Case 2's requirement change; Case 2 arrives only after the minute-24 checkpoint (§1, §3).
- DO NOT take destructive actions (deleting seed data, dropping stores) without explicit confirmation.
- Use `[NEEDS CONFIRMATION]` tags for uncertain items — see inline tags below and the numbered questions at the end of this response.
- Write validation-module and cost-calculation tests **before** implementing the rules they check, then run them and save real output — no copying implementation output into expected values, and do not test only the happy path (§11, §13.3).
- Ask the agent (if using an AI coding agent, which is mandatory per §2) to review its own output for correctness, security, and edge cases; verify its findings before accepting them (§2, §13.4).
- Narrate trade-offs as they're made, not only at the end (§13.5).
- Stop at the minute-24 checkpoint even if incomplete — state gaps by feature name and reason, never as "some things are missing" (§13.6, §14).
- Max upload file size is `[NEEDS CONFIRMATION]` — §10 explicitly delegates this to the implementer ("Behaviour follows the limit you define"); pick a number, enforce it server-side, and record it as an assumption in `docs/decisions.md` rather than asking further.
- Whether the Step 1↔Step 2 stepper visually shows a locked/disabled third step or only 2 steps is `[NEEDS CONFIRMATION]` — §3's bullet list says "a 2-step stepper" but the mockup itself has 3 boards.

## 7. Success Criteria

The output is "done" when:

1. Uploading `agreement-vendor-2026.pdf` returns `201`, the card shows `8 pages`, and `Continue` becomes enabled (§10).
2. Uploading `.exe` or `.pdf.exe` is rejected by both FE and BE with `FILE_TYPE_NOT_ALLOWED` (§10).
3. Filename `../../etc/passwd.pdf` is stored/returned as a sanitized basename with no path components (§10).
4. Filename `<img src=x onerror=alert(1)>.pdf` renders as text with no script execution (§10).
5. A very large file (e.g. 300 MB) is handled per a defined, server-enforced limit, with the assumption recorded in `docs/decisions.md` (§10).
6. Rina (2 signatures) + Budi (1 signature) yields `total_signatures: 3`, `total_charge: "15000.00"`, remaining quota `5` (§10).
7. Two recipients at 3 signatures each (total 9, over quota) disables `Continue` with a visible reason; a forced request returns `422 INSUFFICIENT_SIGNATURE_QUOTA` (§10).
8. Emails `"  Rina.Halim@Example.test "` and `"rina.halim@example.test"` together return `422 DUPLICATE_RECIPIENT_EMAIL`, and the FE marks the colliding rows (§10).
9. `signature_count` of `0`, `-1`, `2.5`, `"abc"`, or empty is clamped/rejected client-side without ever becoming `NaN`, and the BE returns `422 SIGNATURE_COUNT_INVALID` (§10).
10. A payload adding `"total_charge":"1.00"` or `"quota":{"signature":99}` returns `422 UNKNOWN_FIELD`; client-sent values are never used (§10).
11. `charge-preview` against a non-existent envelope (e.g. `env_999`) returns `404` (§10).
12. Changing recipients while a preview request is pending never lets the older response become the active result (§10).
13. Cost-calculation function tests (exact decimals, including the quota boundary) are run and their real output saved (§11.1).
14. Validation-module tests (empty name, invalid email, case-insensitive duplicates, out-of-range signature_count, filename sanitization, rejected extensions) are run and their real output saved (§11.2).
15. A `case-1` commit/snapshot exists, a reviewer can run the app from README commands alone, `docs/verification.md` has actual test output, and a specific (not vague) gap list is recorded (§14).

## 8. References

- `test_1_en.md` — source PRD (Fullstack L3 Interview, Case 1 brief), this project's directory.
- `Upload & Recipients Mockup.html` — visual reference with 3 boards (Step 1 Upload, Step 2 Set recipients, Step 3 Place fields); Step 3 is out of scope for Case 1 (§3).

## 9. Constraints

- Budget: `[NOT SPECIFIED IN PRD]`.
- Timeline: 70-minute total coding session; Case 1 occupies minutes 0–24 (clarification, planning, implementation, tests, checkpoint); time is not extended if unfinished (§1).
- Team: solo engineer using a mandatory AI coding agent capable of reading/writing files and running commands (Claude Code, Codex, Cursor/Windsurf agent mode, or equivalent) — a paste-only chatbot does not meet the format (§2). Seniority/size beyond "L3 candidate" is `[NOT SPECIFIED IN PRD]`.
- Tools available: any frontend/backend stack and any UI kit (§4); an agentic AI coding tool (§2); in-memory storage is sufficient, no database required (§4).
- Tools NOT available: no access to any Mekari repository or service (§1); chatbot-only AI assistance does not satisfy the format requirement (§2).

---

## Orchestrator Contract — read first, applies for the whole session

You are the ORCHESTRATOR for this feature. You do not write code, you do not
edit files, you do not draft documents yourself. Every substantive step —
reading the PRD, drafting PLAN.md/TASK.md/SCENARIO.md, implementing code,
writing tests — is delegated to an `Agent` tool subagent. Your job is:
dispatch subagents, relay their reports, keep the user informed, and answer
the user's questions at any point without breaking the workflow.

- Use exactly 2–3 subagents for downstream implementation
  (parallel mode) — the exact count decided by downstream's own eligibility
  gate in `downstream/references/parallel-mode.md`, clamped to the range 2–3 —
  never fewer than 2 unless downstream's own eligibility
  gate forces bundle/direct fallback — and even then, dispatch a single-task
  bundle subagent rather than implementing inline yourself. You never call
  `executor`, `unit-test`, or any code-writing skill directly in this
  (parent) session.
- Reasoning effort: xhigh. Apply maximum reasoning depth to every planning
  and implementation decision, and instruct every subagent you dispatch to
  do the same (state it explicitly in each subagent's brief — there is no
  standalone CLI effort flag, so this is enforced by instruction).
- Stay interactive. After dispatching subagents and while they run, remain
  available to answer the user's questions about status, scope, or
  decisions. Do not go silent until the phase is done.
- Zero tolerance for unverified completion ("YOU CANNOT MAKE MISTAKE"): a
  subagent may not report a story/task DONE without its own build/lint/test
  evidence. You do not mark anything DONE on a subagent's say-so alone —
  check the evidence it returns before updating TASK.md.

## Two-Phase Workflow

### Phase 1 — upstream
Invoke the `upstream` skill. It produces, per its own spec:
- `PLAN.md` (implementation plan, architecture, ADRs)
- `TASK.md` (EPIC → Story → Subtask)
- `SCENARIO.md` (E2E scenarios) — opt in at upstream Step 5, do not skip it
  for this run

**Override upstream's question output:** wherever `prd-intake` (Phase 2
ANALYZE) would write a single `prd-questions.md`, split it by audience
instead into two files in the same workspace:
- `QUESTIONS-ENGINEER.md` — architecture/implementation clarifications
  (data model, auth, async boundary, migration path, etc.)
- `QUESTIONS-PM.md` — product/business/scope clarifications (acceptance
  criteria ambiguity, out-of-scope calls, priority, business rules)

Keep the `Q<category>.<index>` ID scheme in both files so answers still
trace back correctly. A question that is genuinely both goes in
`QUESTIONS-ENGINEER.md` with a note pointing to the related PM question.

**Stop after Phase 1.** Do not start Phase 2 until the user explicitly says
to proceed — upstream produces a plan for the user to review, not a
green light to implement.

### Phase 2 — downstream (only after explicit user go-ahead)
Invoke the `downstream` skill. Prefer `parallel` mode with 2–3
subagents; fall back to `bundle` only when downstream's own eligibility gate
(story-size ≥10 SP, disjoint files, ≥2 stories) fails — never `direct`, since
direct mode makes the parent session implement, which this contract forbids.

## Figma Contract — hard requirement, no exceptions

**Applicability for this run:** this feature has a frontend slice, but its
design source is the local file `Upload & Recipients Mockup.html`, not a
Figma file. No Figma URL exists for this feature. Therefore: skip the Figma
MCP pass and treat `Upload & Recipients Mockup.html` plus PRD §3 as the
design source of truth (structure and content only — colours, spacing,
fonts, icons and responsiveness are explicitly not assessed per §3/§8.12).
The rules below apply in full **only if** the user supplies a Figma file URL
for this feature at any point in the session.

When `context-bundler` (Step 6, FE in scope) runs its Figma MCP pass:

1. Call `get_metadata` on the Figma file first and enumerate **every page
   and frame in the file**, not just the page/frame the linked URL points
   at. List them all in the Context section before filtering to what's
   actually in scope for this feature.
2. For every in-scope frame, call BOTH `get_design_context` AND
   `get_variable_defs`. `get_variable_defs` is not optional here — it is
   the only source of the actual design tokens (color, spacing, typography
   variables) that keep the implementation visually consistent with the
   design system. A frame processed without `get_variable_defs` is
   incomplete; re-run it.
3. Cross-check every pulled token against the Design System Gap analysis
   (context-bundler Section 7) before `adr-planner` builds the Frontend
   Slice. A component built against a guessed color/spacing value instead
   of the real variable is a defect — treat it as one.
4. If the Figma MCP is unavailable, do not silently fall back to
   screenshots for this run — stop and tell the user, since token-level
   accuracy is required here.

## Git & Worktree Contract

**Base branch detection — run before cutting any branch:**
- Backend repo (has `go.mod`, `internal/`, or similar): try `development`
  first, fall back to `develop` if `development` doesn't exist
  (`git rev-parse --verify <candidate>`).
- Frontend repo (has `package.json` + a frontend framework): try `develop`
  first, fall back to `main` if `develop` doesn't exist.
- For each repo in scope: `git fetch origin <base>`, `git checkout <base>`,
  `git pull` — always pull latest before branching, every time, even on
  resume.

**Worktree — create before any implementation, every time:**
- Path: sibling of the repo, at `<repo-parent>/worktrees/<feature-name>/<repo-name>`
  — NOT `<repo>/worktrees/...` inside the repo itself. Placing a worktree
  inside the tracked repo triggers gitlink mode 160000 and breaks the
  parent index (see `downstream/references/parallel-mode.md`). This
  reconciles "worktrees/<feature-name>" naming with that hard invariant —
  use the sibling form, never the nested form.
- One worktree per repo per story being worked in parallel mode.
- Every code change for this feature happens inside its worktree. Nothing
  is edited directly in the engineer's primary checkout.

**Branching:**
- One branch per story: `feat/<task-name>` (kebab-case, derived from the
  story title), cut from the epic branch per the existing `executor` skill
  convention.
- One branch per PRD/epic before it merges to the target base branch.
- One commit per task/subtask, Conventional Commits format, per
  `mr-publisher`'s convention.

## Test-Fix Loop Contract — overrides the stop-and-ask default in
## unit-test / e2e-test / endpoint-tester for this run only

The skill files (`unit-test`, `e2e-test`, `endpoint-tester`) normally stop
on a test failure and ask the engineer whether to fix, skip, or continue.
For this run, override that: the goal is the test passing, not a single
attempt. Do not ask the engineer on a first failure — try to reach the goal
yourself first.

**Goal:** every test the failing command targets (unit / endpoint / e2e)
reaches PASS. That command's result is the sole success signal — not "looks
fixed," not a partial pass.

**On any test failure:**
1. Invoke `superpowers:systematic-debugging` to diagnose — never patch
   blindly against the error text alone.
2. Apply the fix.
3. Re-run the exact same failing command. Read its actual result.
4. PASS → continue the pipeline normally.
5. Still FAIL → repeat from step 1.

**Dead-end conditions — stop the loop and surface to the user, do not
keep trying past these:**
- 5 attempts reached on the same test without a PASS.
- The same error signature repeats twice in a row unchanged (no
  diagnostic progress between attempts).
- The fix requires something the subagent cannot obtain itself — a
  credential, an external service, a product/business decision, a
  missing fixture only the engineer has. This is a blocker, not a bug;
  don't spend attempts on it.

**Excluded from this loop:** SAST/Semgrep/Gitleaks Critical findings.
Those still stop immediately and require the engineer's explicit override
per `mr-publisher`'s rules — never auto-retried, security findings are not
"try again" material.

**Audit trail:** write every attempt to
`./docs/features/<feature-title>/evidence/<SUB-ID>-fix-attempts.md` —
attempt number, diagnosis, fix applied, re-run command, re-run result.
Append-only. On dead-end, this file is what you hand the engineer — the
loop's failure must be explainable from it, not just "gave up."

## Pre-Flight Answers — already decided, do not re-ask

A prior Pre-Flight pass surfaced three questions. They are answered here.
Treat these as final input and proceed straight to Step 1.

1. **Namespace:** `sign-doc`. If the skill's enum validation hard-rejects
   any value outside `subproject-a | subproject-b | subproject-c`, fall back
   to `subproject-a` and record the mapping `sign-doc -> subproject-a` in
   the workspace's plan docs. Do not stop to ask.
2. **Git mode: direct branch, NO worktree.** This overrides the Git &
   Worktree Contract's worktree requirement for this run only. Reason: the
   git root is `/Users/kuro/project/react/react-playground`, which holds
   ~12 unrelated untracked projects; a worktree of that root drags all of
   them along. Work in place, in `signed-doc/`, on branch
   `feat/case-1-upload-and-recipients` cut from `main` (no `develop` or
   `development` branch exists in this repo — skip base-branch detection).
   Every other clause of the Git & Worktree Contract (one branch per story,
   one commit per task, Conventional Commits) still applies.
3. **Stepper:** render **3 steps with Step 3 ("Place fields") visibly
   locked/disabled**. Step 3 is display-only — no routing to it, no fields
   UI, no scaffolding behind it. This resolves the `[NEEDS CONFIRMATION]`
   in Section 6.

Also already decided, do not re-ask:

- **Max upload size: 25 MB**, enforced server-side (not only in the
  browser), recorded as an assumption in `docs/decisions.md` per PRD §10.
- **Workspace root:** `signed-doc/`; planning docs at
  `signed-doc/docs/features/case-1-upload-and-recipients/`. Deliverable
  docs stay where prompt §5 puts them (`README.md`, `AGENTS.md`,
  `docs/decisions.md`, `docs/verification.md`).
- **SCENARIO.md opt-in: yes** (upstream Step 5).

## Known environment blockers — use these workarounds, do not re-diagnose

- **Skill discovery:** `upstream`, `downstream`, `prd-intake`,
  `context-bundler`, `adr-planner`, `scenario-cataloguer` live at
  `~/.claude/skills/workflows/<name>/SKILL.md`. Claude Code only discovers
  `~/.claude/skills/<name>/SKILL.md`, so `Skill(upstream)` returns
  `Unknown skill: upstream`. Workaround: every subagent reads its
  `SKILL.md` by absolute path and follows it verbatim. Do not attempt a
  symlink/flatten fix in this session — it needs a restart to take effect.
- **`AskUserQuestion` may be absent** from the session toolset. If so, use
  plain chat prompts. But note that the answers above already cover every
  Pre-Flight question, so no prompt should be needed before Phase 1 ends.
