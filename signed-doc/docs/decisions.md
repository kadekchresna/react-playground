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

---

# Case 2 — order, e-meterai, field placement

Written at the close of Case 2 by the orchestrating session, which is the only
place the whole picture exists: each slice was built by a separate agent that
saw only its own layer.

## What changed in the Case-1 data structures, and why

Case 2 was absorbed at the seams rather than by tearing the Case-1 structure
open. The plan was still unimplemented when product issued `test_2_en.md`, so
five shape changes were made in the Case-1 build itself — typed `Step = 1|2|3`
instead of a boolean, prices/quotas as one-key **records** instead of scalars,
validation as an ordered **stage array** instead of an `if` chain, a
**request-dependent** key allow-list, and a staleness guard keyed on a
**payload hash** instead of a request counter. None of them shipped Case-2
behaviour. All five are why the changes below are additive.

| Structure | Case 1 | Case 2 | Why |
|---|---|---|---|
| `RecipientInput` | `{name, email, signature_count}` | `+ meterai_count`, `+ step?` | §A3.1, §A2.1 |
| `PriceTable` / `QuotaTable` | `{signature}` | `{signature, meterai}` | §A3.5 — two allowances that fail independently |
| `ChargeRow` | `{index, signatures, chargeMinor}` | `+ meterai`, `chargeMinor` now combined | §A3.6 |
| `computeCharges` | `(rs, unitPrice)` | `(rs, prices)` + `totalMeterai`, `charges` | two priced lines |
| `quotaRemaining` | `(n, quota)` | `(used, quota)` → per-resource | shortfalls must be separately reportable |
| Stage pipeline | 3 stages | **11**, order fixed by §B5 | inserted, never reordered |
| `ChargePreviewResponse` | — | `+ order_mode, steps, total_meterai, field_count` | §B4 |
| New kernel modules | — | `quota.ts`, `steps.ts`, `fields.ts` | one rule, one home |

`ADR-005` (Step 3 is a locked, unscaffolded pill) is the only ADR product
reversed. `LD-18` ("Case 1 never consumes quota") and `LD-13` ("Step 2 is
terminal") are superseded. The other six ADRs survived unchanged — `ADR-006`
(money as `bigint` minor units) is the one that paid for itself: eMeterai at
`"10000.10"` is exactly the value that breaks a float, and `"25000.10"` /
`"45000.30"` come out exact with no rounding policy.

## The sacrificed priority, and the risk

**P4 (`Send` — `preview_token` + atomic quota reservation) was not attempted.**
§A1 ranks it last and says explicitly that it is not required, and that a
stated sacrifice is worth more than four half-finished parts. P1, P2 and P3 are
complete and verified instead. `Send` renders disabled with that reason visible
on screen; it is not a dead control.

What that costs, honestly:

- No quota is ever consumed. `charge-preview` stays read-only and the envelope
  is never locked, so the same document can be priced indefinitely.
- There is no `preview_token`, so nothing binds a computation to the data it
  was computed from. The frontend's payload-hash staleness guard covers the
  *UI* case (a stale answer can never be displayed), but a determined client
  could still act on an old quote — there is no server-side defence, because
  there is no server-side state to defend.
- The atomicity requirement (§A5.4) is untested. In-process it would be
  trivial — decrement both allowances in one synchronous function with no
  `await` between them — but "trivial" is not "verified", and a real
  deployment would need a transaction that this design has never had to have.
- `409 PREVIEW_STALE` and `409 ENVELOPE_LOCKED` do not exist, so the two
  recovery paths §A5.6 asks for are unwritten.

## Assumptions made where the brief was silent

Each was a real fork in the road; the alternative is recorded so it can be
re-taken cheaply.

1. **Absent means "not asked", present-but-malformed means "wrong".** A missing
   `meterai_count` is the documented default `0`; a missing `order_mode` is
   `parallel`; a missing `fields` key is a Step-2 preview with the field rules
   vacuous. But `null`, `"2"`, `2.5` and `fields: []` are all judged. This is
   the single assumption that keeps every Case-1 payload valid — without it the
   §B7.21 regressions would 422 *en masse*.
2. **`fields: []` is a real Step 3 with nothing placed**, and fails
   reconciliation. Only `undefined` is vacuous.
3. **The geometry rule is two functions, not one.** §B2 says "the UI clamps,
   the API rejects", so `clampFieldPosition` (frontend) and
   `validateFieldBounds` (backend) are separately named and the server never
   imports the clamp. A single shared helper would have made the server accept
   `x = 500` and silently fail §B7.15–16.
4. **§A4.13 and §B7.13: flag, never auto-drop.** Lowering a count below the
   placed boxes marks the excess for the user to remove; deleting a recipient
   orphans their boxes and flags them. Silently destroying placed work is the
   more destructive default. Structurally enforced: the field reducer is never
   told about recipients, so no recipient change *can* reach it.
5. **No sixth field error code was invented.** §B5 lists five, so each owns a
   domain — a `kind` with no geometry is `FIELD_OUT_OF_BOUNDS`, not a
   `FIELD_KIND_INVALID` the acceptance table cannot branch on.
6. **`steps` is required on the response and present in `parallel` too**, as the
   single group §A3.4 describes. §B4 only shows the sequential body. Reversal is
   `steps?:`.
7. **Contiguity is a property of the step *set*, not of row order** —
   `[3,1,2,1]` passes. §A2.2 makes sharing first-class, and requiring sorted
   rows would break the up/down reorder mid-move.
8. **Step 2's `Continue` is two-phase**: press once to ask the server (the exact
   Case-1 behaviour), press again to advance to Step 3. An immediate advance
   would have contradicted an existing Case-1 assertion that inspects the
   confirmed panel. An edit between presses invalidates the confirmation and
   returns the button to phase one, so a stale quote can never carry a user
   forward.
9. **`Check charges` is a new Step-3 control.** §A4.7 scopes out `Preview` and
   `Send`, which left nothing on Step 3 able to send `fields`. It is gated on
   the reconciliation invariant holding locally — so `FIELD_COUNT_MISMATCH` is
   not reachable *from the UI*, by design: §A4.6's point is that the user sees
   `Signature 1/2` and fixes it rather than pressing a button to be told. The
   invalid state is fully reachable and visible; only the request is gated.
10. **Drag-and-drop from the palette was deliberately not built** (§A4.2 makes it
    optional). A second placement path the keyboard cannot reach is precisely
    how §B7.19 gets failed.
11. **Switching to sequential seeds steps `1..n`**, not all-in-step-1, so the
    mode change is visibly not a no-op. Switching back to parallel **deletes**
    `step` from every row, so "no step on the wire in parallel" is true at the
    state level, not just in the projection.
12. **Excess means the LATER boxes.** The count promised the earlier ones; the
    rest arrived after it was lowered.

## A trap worth recording

Three separate waves hit the same failure mode: **a call site that compiles
cleanly while silently disabling a whole feature.** `chargePreviewStages(quota)`
without the mode argument makes every ordering rule dead; without the fields
argument, every §B7.10–18 rule. The allow-list is plain strings, so a missing
entry is not a type error either — it rejects valid payloads instead. And this
repo's test fixtures are mostly untyped literals, so a contract change flags
nothing and the suite keeps passing while asserting the old shape.

Typecheck is **not** a sufficient gate here. The countermeasure that worked is
negative controls: make the silently-wrong edit, confirm the suite goes red,
revert. Six of them are recorded in `docs/evidence/server-tests.txt`.
