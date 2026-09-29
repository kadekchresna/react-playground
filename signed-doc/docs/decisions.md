# Decisions, assumptions and trade-offs

Scope of this file: the questions that had to be answered before code could be
written, the assumptions taken where the brief delegates the choice, and the
trade-offs made while building. Full reasoning per decision lives in
`docs/features/case-1-upload-and-recipients/PLAN.md` (`## Locked Decisions`,
`## ADR Section`); this file is the reviewer-facing summary.

## Assumptions the brief delegates to the implementer

| # | Assumption | Value | Why |
|---|---|---|---|
| A1 | **Maximum upload size** (PRD §10 says "behaviour follows the limit you define", enforced on the server, recorded here) | **25 MB** (`26214400` bytes) | Comfortably above any realistic agreement PDF and small enough that a single hostile upload cannot exhaust a demo process. Enforced by `multer`'s `limits.fileSize`, so the stream is aborted as the limit is crossed and a 300 MB upload is refused without buffering 300 MB. Surfaced as `422 FILE_TOO_LARGE`, not `413`: PRD §9 makes every upload failure a `422` with a renderable body, and one status plus one envelope means the frontend has one error branch. The browser pre-checks the same number purely to save a round trip — the server's check is the one that decides (PRD §7.3). |
| A2 | **Client-side request timeouts** | **charge-preview 10 s, upload 60 s** | Long enough that a slow local machine is not mistaken for a failure, short enough that a hung request does not strand the UI. Both run on the same `AbortController` that drives the staleness guard, so there is exactly one cancellation path. On timeout the request is aborted, an inline retryable error appears, and every typed value is kept. |
| A3 | **Retries** | **User-driven only. Zero automatic retries.** | An automatic retry is precisely the bug PRD §8.10 tests for: it manufactures a second in-flight request whose late response can overwrite newer data. Exactly one in-flight request per user intent, with a visible `Try again` control. |
| A4 | **Idempotency** | **No idempotency key on upload.** | Envelopes are in-memory, free to create, and the frontend holds at most one. A duplicate upload creates an orphan that is invisible to the user and evaporates on restart. Recorded as a known gap rather than solved, because the machinery would cost more than the risk. |
| A5 | **Observability** | **Structured `console` logging only** — one line per request (method, path, status, error code, duration). | No metrics backend, no Prometheus, no OTEL, no dashboards. There is no deploy surface to attach them to. Recorded as an explicit gap. |
| A6 | **Filename longer than 200 characters** | **Truncate, preserving the extension**, so `stem + "." + ext` is exactly 200. If the extension alone leaves no room for a stem, reject with `FILENAME_INVALID`. | Truncating the stem keeps the type check meaningful; truncating blindly would turn `report.pdf` into `report.pd` and change what the file claims to be. |
| A7 | **Stepper shape** | **Three pills, the third (`Place fields`) locked, display-only**, `aria-disabled`, out of the tab order, no route behind it. | PRD §3's prose says "a 2-step stepper" but the mockup renders three boards. Showing three with the third visibly locked reads as "deliberately scoped out" rather than "unfinished", and it is not a dead control that appears to work (PRD §3). No Step 3 scaffolding of any kind exists. |
| A8 | **`From cloud` / `Save as draft`** | **Rendered disabled** with the visible explanation `Not available in this exercise`, `aria-disabled="true"`, no click handler. | PRD §3 forbids leaving them as dead controls that appear to work; disabling with a reason is the honest option of the two the brief allows. |

## Design decisions with a real trade-off

**Money is `bigint` minor units, with a 2-decimal string as the only wire
format.** `1 IDR === 100n`. A `bigint` cannot hold a fractional value, so "never
a binary float" (PRD §4 fact 1) is enforced by the type system instead of by a
documented convention — and because `BigInt` is not JSON-serializable, the
compiler forces every value through `formatDecimalString` at the boundary. The
cost is ergonomic: `signature_count` has to be widened with `BigInt(n)` at each
multiplication, and display formatting is hand-rolled because
`Intl.NumberFormat`'s currency style operates on `number`. Rejected
alternatives: `decimal.js` (a dependency that still admits a float through
`new Decimal(0.1)`), and `number` with an "always integer minor units"
convention (relies on discipline, and this is the single most-probed
correctness property in the brief).

**One TypeScript workspace rather than a polyglot stack.** PRD §8.5 asks for one
reusable validation module used by both layers; taken strictly, that eliminates
every backend language that cannot import TypeScript. The trade-off is that the
backend is constrained to Node. Given the review weight (frontend ±60%), the
backend is the cheaper side to constrain, and the payoff is that rule drift
between the layers is impossible rather than merely discouraged.

**Price and quota are server-only and never enter `packages/shared`.** The
shared kernel is bundled into the browser, so any constant placed there for
convenience would ship the demo account's commercial terms to the client,
contradicting PRD §5. `computeCharges` and `quotaRemaining` therefore take
price and quota as parameters — one more argument than a version reading a
constant, which is exactly the point: the function cannot accidentally become
authoritative. The frontend learns both values only from the `201` upload
response and treats them as opaque server-issued figures for the on-screen
estimate; the server's `charge-preview` total is final (PRD §8.9).

**`packages/shared` does export rule constants** — `ALLOWED_EXTENSIONS`,
`MAX_FILENAME_LENGTH`, `MIN`/`MAX_SIGNATURE_COUNT`, `MAX_RECIPIENTS`. These are
PRD §6 validation rules that both layers must agree on, not commercial terms,
and shipping them to the browser is what lets frontend validation match the
server's answer. No price, quota or upload-size value is exported.

**Validation is an ordered list of named stages, not an `if` chain.** PRD §9
fixes the order (count → per-recipient → duplicates → quota) and the order is
therefore part of the contract, so it is expressed as data and asserted in the
test suite by name. It also means adding a rule is an insertion rather than
surgery on a long function.

**Two different signature-count functions, on purpose.** The frontend's
`clampSignatureCount` repairs input so state can never hold `NaN` or
`undefined` (PRD §8.3); the backend's `isValidSignatureCount` refuses without
coercing, so `"3"` is invalid. A single "helpful" shared function would let a
hostile client have its value silently corrected instead of rejected.

**The filename sanitizer deliberately does not strip `<` and `>`.** Escaping is
the renderer's job. Laundering the name in the kernel would make the PRD §10
XSS row pass without ever exercising the frontend's text-only rendering, which
is the defence actually being tested. A related case found while writing the
tests: `../<script>alert(1)</script>.pdf` contains a slash inside the payload,
so the last-segment rule yields `script>.pdf`. That is the correct reading — a
slash is not a legal filename character — and it is asserted explicitly rather
than left to chance.

## Tooling choices forced by the environment

- **Vitest 3 / Vite 6.** Vitest 2 pins Vite 5 internally, which collides with
  the Vite 6 that `@vitejs/plugin-react` is built against and fails `tsc` on
  `vite.config.ts` with two incompatible `Plugin` types. Aligning on Vitest 3
  removes the duplicate Vite.
- **`esbuild` is allow-listed in `pnpm-workspace.yaml`.** pnpm 12 blocks
  dependency install scripts by default; `esbuild` needs its postinstall to
  link its prebuilt binary.
- **One lockfile, one author.** Every manifest, tsconfig and test-runner config
  is owned by a single work stream, and the complete dependency set for all
  three packages was declared up front, so `pnpm install --frozen-lockfile`
  reproduces from a clean checkout (PRD §12).

## Known gaps (specific, not vague)

- **No idempotency key on upload** (A4) — a retried upload can create an
  orphaned in-memory envelope.
- **No metrics or tracing** (A5) — request logging is `console` only.
- **Envelopes do not survive a server restart**, by design (in-memory `Map`).
  A reviewer who restarts the backend mid-demo must re-upload.
- **No magic-byte / content sniffing.** The extension is judged from the
  sanitized filename per PRD §7.9, and the bytes are discarded, so a file whose
  content does not match its extension is accepted. Out of scope: PRD §4 rules
  out PDF content parsing.
- **Worst case 25 MB of a hostile upload is buffered in memory** before the
  limit rejects it. Acceptable for a single-user demo with no concurrency
  requirement.
