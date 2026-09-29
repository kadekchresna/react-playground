# AI agent log

PRD §2 makes an agentic AI coding tool mandatory and PRD §12 asks for the
transcript or a log. This file records how the agent was driven and what it
actually did, in order, including the places where its first answer was wrong.

Tool: Claude Code (agentic — reads and writes files, runs commands).
Workspace scaffold + `packages/shared` kernel + root docs (`EPIC-1-ST-1`).

---

## How the work was framed

The agent was not asked to "build the app". It was given a frozen contract to
implement: a public API signed off before any code existed, an explicit file
ownership list, and a hard rule that test files are authored before the rules
they check, with expected values hand-derived from the PRD fixtures. Three work
streams ran against disjoint file sets, so the kernel's signatures had to be
right before anything compiled against them.

Prompt excerpt (constraints given to the agent):

> **Tests before rules.** For `money.ts`, `file.ts`, `recipient.ts`,
> `pricing.ts`, `page-count.ts`: write the test file first, with expected values
> hand-derived from the PRD fixtures. Never copy implementation output into an
> expected value. Include negative cases, not just the happy path.
>
> **Money is `bigint` minor units** (1 IDR = `100n`), with the decimal string
> (`"5000.00"`) as the sole wire format. No binary floats anywhere.
>
> `packages/shared` has ZERO runtime dependencies and imports nothing from
> either app. It never reads price, quota or size limits — every such value
> arrives as a parameter.

## Order of work

1. Read the PRD, the plan and the task contract before writing anything —
   specifically the frozen public API, the locked decisions and the Case-2 seam
   constraints, because those change the *shape* of Case-1 code.
2. Workspace scaffold: three package manifests, tsconfigs, test-runner configs,
   one lockfile, declared once with the complete dependency set for all three
   packages so no other work stream ever touches `pnpm-lock.yaml`.
3. For each kernel module, in this order: **test file, then implementation**,
   then run. `money` → `file` → `recipient` → `pricing` → `page-count` → the
   barrel.
4. Verify by running, not by asserting: install, typecheck, the suite, and a
   resolution probe from each consumer package.
5. Commit one subtask at a time, Conventional Commits, with the reasoning in
   the message body.

## Where the agent's first answer was wrong

**A test written before the rule caught a real ambiguity.** The `file.ts` suite
asserted that `../<script>alert(1)</script>.pdf` sanitizes to
`<script>alert(1)</script>.pdf` — i.e. that the traversal prefix is stripped and
the payload survives. It does not: `</script>` contains a slash, so the
"keep the last path segment" rule yields `script>.pdf`.

The tempting move was to "fix" the sanitizer so the payload reassembles. That
would have been wrong. A slash is not a legal filename character, so the input
genuinely names a file inside a strangely named directory, and reassembling it
would mean interpreting the attacker's intent instead of the bytes. The
hand-written expectation was the thing at fault. The suite now asserts the
last-segment behaviour explicitly, with the reasoning in a comment, and a
separate case covers payload preservation using a payload that contains no
slash. The XSS assertion that matters — `<` and `>` survive sanitization
untouched, so the frontend's text-only rendering is actually exercised — still
holds.

**A toolchain collision that a "looks fine" review would have missed.**
`vitest@2` pins Vite 5 internally while `@vitejs/plugin-react` is built against
Vite 6. Both installed happily; `pnpm -r typecheck` then failed with two
mutually unassignable `Plugin` types in `vite.config.ts`. Fixed by aligning on
Vitest 3 rather than by casting the config, because a cast would have hidden a
genuinely duplicated Vite in the tree.

**pnpm 12 blocks install scripts by default.** The first `pnpm install`
"succeeded" and then exited non-zero on `ERR_PNPM_IGNORED_BUILDS` for esbuild.
Allow-listed `esbuild` explicitly in `pnpm-workspace.yaml` rather than
disabling the protection globally.

## Where the agent's output was verified, not trusted

Every claim below was checked by running the command, not by reading the code:

- `pnpm install --frozen-lockfile` — reproduces from the committed lockfile.
- `pnpm -r typecheck` — exits 0 in all three packages.
- `pnpm --filter @signed-doc/shared test` — 113 tests, 5 files, green. Raw
  output saved verbatim to `docs/evidence/shared-tests.txt`.
- **Resolution probe from `apps/server`** (`tsx`): imported the kernel and
  reproduced the PRD §10 acceptance row end to end —
  `total_signatures 3 / total_charge 15000.00 / quota_remaining 5`, and
  `validateFileMeta({filename: "../../etc/passwd.pdf"})` returning
  `{"filename":"passwd.pdf"}`.
- **Resolution probe from `apps/web`** (Vite's own resolver via
  `ssrLoadModule`): the workspace package and its `.js`-extension internal
  imports resolve in the browser toolchain too, returning `15000.00`.

The two probes exist because "the kernel compiles" and "both apps can actually
import the kernel" are different claims, and only the second one matters to the
two work streams compiling against it.

## Trade-offs narrated as they were made

- `quotaRemaining` was frozen in the plan as `(totalSignatures, quota)` but the
  Case-2 seam constraint requires record-shaped prices and quotas from day one.
  The record form was implemented and the divergence flagged, rather than
  silently following whichever document was read last.
- `computeCharges` keeps the frozen `rows` / `totalSignatures` /
  `totalChargeMinor` field names and *adds* the record-shaped `charges`, so
  code written against the frozen signature still compiles.
- A row whose signature count is mid-edit contributes `0` to the total instead
  of `NaN`. The row is still marked invalid by `validateRecipient` and the
  server still refuses the request; the choice only affects what the running
  estimate shows while typing.
- Blank emails are skipped by duplicate detection. Two empty rows are not
  "duplicates of each other" — they are two per-recipient failures, and
  reporting them as a collision would mark the wrong cause.
