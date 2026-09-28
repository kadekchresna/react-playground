# PLAN Case-2 Delta — re-evaluation of PLAN.md against `test_2_en.md`

> Companion to `PLAN.md`. Same workspace, same branch. This file records what
> survives Case 2 unchanged, what breaks, and what to change **now** while the
> plan is still paper. It does not restate PLAN.md.

## 0. Situation

No implementation exists yet. `PLAN.md` (7 ADRs, 32 locked decisions, frozen
kernel API) is drafted; `TASK.md` and `SCENARIO.md` are still being generated.
That timing is the whole advantage here: Case 2's structural pressure can be
absorbed as **seam shaping** in the Case-1 design instead of a tear-open at
minute 24.

**Hard boundary:** seam shaping only. No meterai, no steps, no fields, no
`Send` ships in Case-1 code. Case 1's acceptance table (`docs/prompt.md` §7)
stays the only thing implemented before minute 24. What changes is the *shape*
of a handful of signatures and one state type, so the Case-2 extension is
additive rather than a rewrite.

Case 2's B8 requires tests locking in old behaviour **before** any structural
refactor. Seam shaping reduces how much refactor is left, it does not excuse
skipping that rule for whatever refactor remains.

## 1. Verdict — extend, don't tear open

Six of seven ADRs survive. One is explicitly reversed by product.

| ADR | Fate under Case 2 |
|---|---|
| ADR-001 one TS workspace, one shared kernel | **Survives, vindicated.** A2/A3/A4 all need the same rule in both layers. Polyglot would now mean maintaining step-contiguity, meterai and reconciliation logic twice. |
| ADR-002 in-memory envelopes, bytes discarded | **Survives P1–P3.** Mutates under P4 (§7). |
| ADR-003 price/quota server-only | **Survives, load-bearing.** Meterai price and quota join it; B4 keeps sending both back, and the client still may not supply them. |
| ADR-004 25 MB server-side limit | **Untouched.** |
| ADR-005 Step 3 is a locked display-only pill, no route, no scaffolding | **REVERSED by A0.3 / A4.** Step 3 becomes a real screen. Reversal cost is low *if* the step seam is widened now (§4.1). |
| ADR-006 money as `bigint` minor units, decimal string on the wire | **Survives, and is the single highest-value decision in the plan.** Meterai price `"10000.10"` is exactly the value that breaks a float implementation. `1000010n`; `2×5000.00 + 1×10000.10 = "25000.10"`; `3×5000.00 + 3×10000.10 = "45000.30"` (B7 rows 1–2) come out exact with zero rounding policy. |
| ADR-007 file-disjoint stories, frozen kernel API | **Survives as a mechanism, fails as a Case-2 story cut.** See §6. |

Locked decisions superseded: **LD-18** ("Case 1 never consumes quota") is
overturned by A5.4 if P4 is attempted. **LD-02** (3-step stepper with pill 3
locked) becomes the transitional state, not the end state — the pill unlocks in
Case 2. **LD-13** (Step 2 `Continue` is terminal, no navigation) is superseded:
`Continue` now routes to Step 3.

## 2. What breaks in the frozen kernel API

The five signatures below are the whole cost of Case 2 in `packages/shared`.
Everything else in the barrel is additive.

| Frozen signature | Breaks because | Replacement |
|---|---|---|
| `computeCharges(rs, unitPriceMinor: Minor)` | A3.7 needs two priced lines, not one | `computeCharges(rs, prices: { signature: Minor; meterai: Minor })` returning `{ rows, totalSignatures, totalMeterai, chargeSignatureMinor, chargeMeteraiMinor, totalChargeMinor }` |
| `quotaRemaining(totalSignatures, quota)` | A3.5 requires two quotas failing independently, with messages that distinguish them | `quotaRemaining(used: { signature: number; meterai: number }, quota: { signature: number; meterai: number })` returning per-resource `{ remaining, overBy }` |
| `RecipientInput { name, email, signature_count }` | A3.1, A2.1 | `+ meterai_count: number` (0–3, default 0), `+ step?: number` (present only in `sequential`) |
| `ChargeBreakdown.rows[].chargeMinor` | A3.6 per-row combined cost | row gains `meterai: number` and keeps a single combined `chargeMinor` |
| `validateRecipientList(rs)` — hardcodes `count → per-recipient → duplicates` | B5 fixes a **12-stage** order across recipients, steps, meterai and fields | becomes an ordered stage pipeline (§5) |

`ErrorCode` grows by 11 (`ORDER_MODE_INVALID`, `STEP_SEQUENCE_INVALID`,
`METERAI_COUNT_INVALID`, `METERAI_EXCEEDS_SIGNATURE`,
`INSUFFICIENT_METERAI_QUOTA`, `METERAI_NOT_IN_FIRST_STEP`,
`FIELD_UNKNOWN_RECIPIENT`, `FIELD_COUNT_MISMATCH`, `FIELD_OUT_OF_BOUNDS`,
`FIELD_PAGE_INVALID`, `FIELD_ID_DUPLICATE`) plus 2 under P4
(`PREVIEW_STALE`, `ENVELOPE_LOCKED`, both `409` — the first non-422 failure
status in the system, so `ServiceError` must already carry status, which it
does).

`ValidationFailure.details` gains `recipient_email?: string` and
`field_id?: string`. B7 rows 4, 6 and 12 all demand the UI mark **one row or
one field**, not the whole form.

## 3. New kernel modules

| Module | Contents | Case 2 ref |
|---|---|---|
| `steps.ts` | `validateStepSequence` (contiguous from 1, shared steps legal), `renormalizeSteps` (`[1,2,2,3]` minus step 1's sole member → `[1,1,2]`), `groupByStep` | A2.3, A2.4, B7 rows 5, 7, 8 |
| `fields.ts` | `FIELD_GEOMETRY` table, `clampFieldPosition` (**FE only**), `isFieldInBounds` (**BE only — never clamps**), `validateFieldShape` (page must be `1`, integer x/y, unique id), `validateFieldOwnership`, `reconcileFields` | A4.8–A4.12, B2, B3, B7 rows 10–12, 15–18 |
| `meterai.ts` *(or folded into `recipient.ts`)* | `isValidMeteraiCount` (int 0–3), `meteraiWithinSignatures` (`meterai_count ≤ signature_count`), `meteraiStepPlacement` (carriers must be step 1; vacuous in `parallel`) | A3.2, A3.3, A3.4, B7 rows 4, 6 |

**Geometry is a two-function split, not one.** B2 is explicit: *"The UI clamps.
The API rejects."* A single shared `clampFieldPosition` used on both sides would
silently accept `x = 500` server-side and fail B7 rows 15–16. Same constants,
two behaviours, two call sites — worth an ADR of its own in Case 2.

Derived constants, to be asserted in a test rather than hand-copied:
`signature` `212×88` → `x ∈ [0,420]`, `y ∈ [0,500]`; `meterai` `112×112` →
`x ∈ [0,520]`, `y ∈ [0,476]`; content area `632×588`.

## 4. Seams to widen NOW, during Case 1

Each is cheap, ships no Case-2 behaviour, and is defensible on Case-1 grounds
alone. This is the entire "absorb instead of tear open" play.

### 4.1 Step state is `1 | 2 | 3`, not a boolean
PLAN.md §Frontend Slice specifies "a two-value step state in `App.tsx`". Make
it a `type Step = 1 | 2 | 3` union now, with `3` unreachable and the pill
rendered locked per ADR-005/LD-02. Unlocking in Case 2 is then a guard
deletion, not a state-model change. Cost: zero.

### 4.2 Prices and quotas are records from the start
`config/account.ts` exports `PRICES = { signature: parseDecimalString("5000.00") }`
and `QUOTA = { signature: 8 }` — one-key records, not scalars. `computeCharges`
and `quotaRemaining` take the record shape described in §2 immediately. In
Case 1 the meterai key simply does not exist yet. This removes the single most
invasive Case-2 signature change from the critical path. Cost: near zero, and
it is arguably the better Case-1 design anyway.

### 4.3 Validation is a stage list, not a monolith
Write `validateRecipientList` as an ordered array of named stage functions that
short-circuits on the first failure (LD-24 unchanged). Case 1 registers three
stages; Case 2 registers twelve, in B5's order, by inserting into the array.
The alternative — a hardcoded `if` chain — is exactly the "tear open" B5's
fixed order would force. Cost: ~10 lines.

### 4.4 The charge-preview request type is versioned by mode from day one
Keep the strict key allow-list (it already produces `UNKNOWN_FIELD`), but make
the allow-list a **function of the request**, not a constant. Case 2 needs
`step` rejected in `parallel` and accepted in `sequential` (B4, B7 row 9) —
a constant allow-list cannot express that. Cost: one parameter.

### 4.5 The staleness guard keys on a payload hash, not a request counter
LD-28/LD-29 drive staleness through `AbortController`. Case 2's A5.2 needs the
UI to *know* a preview is stale for recipients, order, mode **and** fields
before the server is asked. A hash (or structural key) of the preview input,
stored beside the last result, satisfies both Case 1 §8.10 and Case 2 A5.2, and
is the natural place a `preview_token` later attaches. Cost: small, and it
makes B7 row 20 easier to test than a counter does.

### 4.6 `RecipientInput` carries `meterai_count` in the type, absent at runtime
Optional in Case 1 (`meterai_count?: number`), unused, never rendered, never
sent. It makes the Case-2 change a required-ness flip. **Judgment call:** this
is the one seam that edges toward speculative generality. If it reads as
scope creep during Case 1 review, drop it — the cost of adding the field later
is one type edit. Keep 4.1–4.5 regardless.

## 5. Validation order — full replacement

B5 replaces the Case-1 order outright. Case 1's is a prefix of it, which is why
§4.3 works:

```
payload shape → envelope exists → order_mode → per recipient → duplicate emails
→ step structure → meterai vs signature → meterai step placement
→ field shape & bounds → field-vs-count reconciliation
→ signature quota → meterai quota
```

Two ordering consequences worth locking as decisions:

1. **Quotas are last, and independent.** A recipient list that is both invalid
   *and* over quota reports the recipient error. B7 row 3 and A3.5 require the
   two quota failures to be separately identifiable, so they are two stages, not
   one branch.
2. **Reconciliation precedes quota.** B7 rows 10–11 expect
   `FIELD_COUNT_MISMATCH` even when quota would also fail.

## 6. Story re-cut — priority beats parallelism

ADR-007 cuts stories by **package** (kernel / server / web) so files are
disjoint. Case 2's P1–P4 cut by **feature**, and every one of them is a vertical
slice through all three packages. The two cuts are orthogonal, and under a
46-minute clock the priority cut has to win: P1 must be *finished and verified*
before P2 starts, because A1 explicitly rewards a smaller number of complete
parts over four half-finished ones.

Proposed Case-2 stories, run in priority order:

| Story | Scope | Packages touched |
|---|---|---|
| `C2-1` (P1) | meterai: counts, dual pricing, dual quota, per-row + summary UI | shared, server, web |
| `C2-2` (P2) | order mode, step contiguity, renormalization, keyboard reorder | shared, server, web |
| `C2-3` (P3) | Step 3 screen, field placement, reconciliation, geometry | shared, server, web |
| `C2-4` (P4, optional) | `preview_token`, atomic `reserve`, envelope lock | server (+ thin web) |

Parallelism inside a story (kernel-first, then server and web concurrently
against the frozen signature) still works and should be kept. Parallelism
*across* P1/P2/P3 should not be attempted: they collide in `pricing.ts`,
`charge-preview-service.ts` and the recipients reducer, and P3's reconciliation
depends on P1's counts existing.

**On the SP baseline:** LD-08's `1 SP = 30 min` against a 65-SP Case-1 plan
describes effort without AI acceleration, not the 24-minute clock. It should not
be read as a schedule. LD-19's must-have ordering is the real Case-1 plan, and
A1's P1–P4 is the real Case-2 plan.

## 7. P4 — the only genuine architecture change

P1–P3 leave `ADR-002` and `LD-20` (stateless w.r.t. recipients) intact:
`charge-preview` stays a pure function of `(body, server price, server quota)`.
P4 breaks both.

- **Quota becomes mutable server state.** `config/account.ts` currently exports
  constants. A reservation decrements them, so quota moves behind the store (or
  a small account-state module) with the constants as its seed.
- **`EnvelopeRecord` gains `locked: boolean`** plus the reservation record. Any
  `charge-preview` or `reserve` after a successful reservation → `409
  ENVELOPE_LOCKED` (A5.5).
- **`preview_token` binds a computation to its inputs** — recipients, order,
  mode and fields (A5.1). The §4.5 payload hash is exactly the binding
  material; the token is that hash plus a server secret or a store lookup. The
  client must never be able to construct it, so an opaque store key is the safer
  of the two.
- **Atomicity (A5.4)** is trivially satisfiable in-process — decrement both
  quotas inside one synchronous function with no `await` between them, and
  validate both *before* writing either. The B8 test ("a failure midway leaves
  no quota partially debited") then means injecting a fault between the two
  writes and asserting neither moved. Worth stating explicitly in
  `docs/decisions.md` that single-process JS gives this for free and a real
  deployment would need a transaction.
- **Double-submit (A5.7)** is an in-flight guard on the `Send` control, same
  mechanism as the existing one-request-per-intent rule (LD-29).

## 8. Test plan delta

B8 adds three categories on top of Case 1's two, plus a regression gate.

| Category | Content | Ref |
|---|---|---|
| Step normalization | contiguity, shared steps, deleting a step's last member | B8.1, B7 rows 5, 7, 8 |
| Meterai + reconciliation | `meterai_count ≤ signature_count`, step-1 placement, fields matching / short / excess / orphaned, clamping **at the exact boundaries** `420/500` and `520/476` | B8.2, B7 rows 4, 6, 10–12, 15–16 |
| Combined cost | `"25000.10"`, `"45000.30"`, both remaining quotas | B8.3, B7 rows 1–2 |
| Case-1 regression gate | upload, duplicate email, signature quota, filename sanitization still green | B7 row 21 |
| P4 only | reservation fault injection leaves neither quota debited | B8 |

The boundary values are the part most likely to be fudged: test `420` and `421`,
`500` and `501`, not just "out of range". B7 rows 15–16 test exactly that edge.

## 9. Open decisions Case 2 forces (not in PLAN.md)

1. **A4.13 — counts lowered below placed fields: auto-drop excess, or flag and
   let the user remove?** Product allows either, requires consistency,
   visibility, documentation and a test. *Recommendation:* **flag, don't
   auto-drop.** Silently deleting a user's placed boxes is the more destructive
   default, and the flagged path reuses the same reconciliation UI that A4.6
   already requires (`Signature 1/2`). Auto-drop needs its own undo story to be
   defensible.
2. **B7 row 13 — a recipient is deleted while owning fields.** Same question,
   same answer, same UI: orphan their fields and flag them, rather than
   cascading a silent delete. Must be documented and tested either way.
3. **Renormalization timing (A2.4).** Renormalize eagerly on delete, so the UI
   never displays a non-contiguous state the server would reject.
4. **P4 attempt or not.** Decide explicitly, before P3 starts, and record it.
   A1 is unambiguous that a stated sacrifice beats a half-built `Send`. Default:
   **do not attempt P4**; render `Send` disabled with an explanation per A4.7.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Seam shaping drifts into building Case-2 features early | Case-1 scope violation; the assessed refactor gets skipped rather than done well | §4 list is closed. Anything not on it waits for minute 24. |
| `TASK.md` / `SCENARIO.md` land Case-1-only and then go stale | The status board stops matching reality mid-run | Let them finish for Case 1; add a Case-2 section rather than regenerating. |
| P1–P3 attempted concurrently to save clock | Merge collisions in `pricing.ts` and the recipients reducer; likely four half-finished parts | Priority order is serial. Parallelize inside a story only. |
| Server-side clamping sneaks in via a shared helper | B7 rows 15–16 fail silently — the API would accept out-of-range coordinates | Two separately-named functions, and a test asserting the BE path **rejects** rather than clamps. |
| Float creeps in for `"10000.10"` | Wrong totals on B7 rows 1–2 | ADR-006 already forbids it; add `10000.10` to the money suite now, during Case 1. |
