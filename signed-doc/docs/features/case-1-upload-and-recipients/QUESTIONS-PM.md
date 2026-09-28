# Product / Scope Questions — case-1-upload-and-recipients

**Audience:** PM / product owner (for this exercise: the interviewer). Product, business-rule and scope clarifications only.
**Companion file:** [`QUESTIONS-ENGINEER.md`](./QUESTIONS-ENGINEER.md) — architecture and implementation clarifications.
**PRD source:** `signed-doc/test_1_en.md`
**Verified READY by:** Phase 1 (VERIFY) on 2026-09-28 — see [`prd-verify-report.md`](./prd-verify-report.md)

> **ID scheme.** IDs follow `Q<category>.<index>` from `prd-intake/references/question-bank.md`, shared with `QUESTIONS-ENGINEER.md` — no ID appears in both files. Questions with no bank entry use the next free index in the correct category and are marked `(extends bank)`.
>
> **Answer discipline.** Every question carries a **recorded default** already applied in `PLAN.md`. A non-answer means the default stands, sourced as `Engineer (PM deferred)`. Nothing is left blank, and nothing below re-asks a rule the brief already states — §13.1 is explicit that re-asking settled rules is a negative signal.

---

## 1. Scope boundary as engineering read it

Confirm this line, because everything downstream sits on it:

| In scope for Case 1 | Out of scope for Case 1 |
|---|---|
| Step 1 — Upload document (§7, all 10 requirements) | Step 3 — "Place fields" board (rendered only as a locked, non-navigable stepper pill) |
| Step 2 — Set recipients (§8, all 12 requirements) | `From cloud` upload source (rendered disabled with a visible explanation) |
| `POST /api/envelopes` + `POST /api/envelopes/:id/charge-preview` (§9) | `Save as draft` (rendered disabled with a visible explanation) |
| One shared validation module used by frontend and backend (§8.5) | PDF content parsing/rendering, affixing signatures or duty stamps, e-meterai/PKI |
| Cost-calculation and validation tests, run with real output saved (§11) | Payments, email/notifications, SSO, deployment, mobile apps |
| The five deliverable documents (§12) | Authentication / login / multi-tenancy — single demo account, no login |
| | Pixel-perfect visuals, animation, exact fonts/icons, responsive layout |
| | Case 2's requirement change |

**Recorded default:** this boundary is taken as final. No work, and no scaffolding, lands on the right-hand column.

---

## 2. Questions for PM

### Q8.1 — Figma availability and completeness *(pre-answered — confirm only)*

**Question:** is there a Figma file for this flow, and does it cover the empty, loading and error states the PRD requires?
**Recorded answer:** **no Figma file exists.** `Upload & Recipients Mockup.html` plus PRD §3 are the design source of truth. The mockup covers the populated state only — the empty dropzone state, the upload loading state, the upload error state, per-row validation error styling, and the over-quota banner have **no design** and are engineer-designed to the PRD's functional text.
**Consequence PM should be aware of:** those five states will look plain. §3 and §8.12 remove colours, spacing, fonts, icons, animation and responsiveness from assessment, so effort goes to behaviour rather than appearance.
**Answer:** use the Upload & Recipients Mockup.html as current sot for the ui design

### Q8.3 — Language and currency formatting

**Question:** the mockup's UI copy is English (`Who signs it?`, `Add signer`, `Total charge`) but §9 shows money displayed as `Rp15.000,00`, which is Indonesian `id-ID` formatting. Is the intended product English UI with IDR-formatted money, or should the UI be Indonesian?
**Why it matters:** it is the one place the brief and the mockup pull in different directions, and it is visible on every screen.
**Recorded default:** **English UI copy taken verbatim from the mockup, with money rendered `Rp15.000,00` via `id-ID` formatting.** Rationale: §3 lists the exact English strings to take from the mockup, and §9's display example is explicitly `Rp15.000,00`. No i18n framework, no translation files — single-locale strings inline.
**Note:** the *display* format is presentation only. The **API contract value stays a plain decimal string** (`"15000.00"`) in every direction. Formatting happens at the last render step and nowhere else.
**Answer:** use the default

### Q4.1 — Feature-flag default state *(mandatory category)*

**Question:** does this feature ship behind a flag, and what is its default?
**Recorded default:** **no feature flag.** There is no deploy surface, no rollout, and no tenant to scope a flag to — deployment is out of scope (§4) and there is a single demo account with no login (§5). If a flag were ever added, the default is OFF.
**Source:** Engineer (PM deferred). This row is the documented resolution of `prd-verify-report.md` checklist row 5.
**Answer:** use the default

### Q4.3 — `From cloud` and `Save as draft`: remove, or show disabled? *(extends bank)*

**Question:** §3 permits either "remove them, or render them disabled with an explanation", and forbids leaving them as dead controls that appear to work. Which does PM want to see?
**Why it matters:** removing them makes the UI diverge visibly from the mockup; disabling them keeps the mockup's shape but adds explanatory copy the mockup does not have.
**Recorded default:** **render them disabled, with visible explanatory text** (`Not available in this exercise`), `disabled` plus `aria-disabled="true"`, and no click handler.
**Rationale:** it preserves the mockup's structure — which §3 asks us to take from the mockup — and it demonstrates that the control was deliberately scoped out rather than forgotten. A removed control is indistinguishable from an overlooked one.
**Answer:** use the default

### Q2.4 — Can the user delete the last recipient row? *(extends bank)*

**Question:** §8.1 says "Minimum 1" recipient. Does the remove button on a single remaining row (a) disappear, (b) stay visible but disabled, or (c) work, leaving an empty list that blocks `Continue` with a visible reason?
**Why it matters:** §8.11 separately requires the "empty list" case to be handled, which reads as though an empty list is reachable — but §8.1's minimum of 1 reads as though it is not. These two lines are in tension.
**Recorded default:** **(b) — the remove button stays visible but is `disabled` with `aria-disabled="true"` and a tooltip/hint reading `At least one recipient is required`.** The empty-list path is still handled defensively in validation (the backend returns `422 RECIPIENT_COUNT_INVALID` for a zero-length array) so §8.11 is satisfied at the layer that matters, but the UI does not let the user walk into it.
**Rationale:** a disabled control with a stated reason teaches the rule; a vanishing control hides it; an empty list is a dead end the user has to reverse out of.
**Answer:** use the default

### Q2.5 — What happens after Step 2 `Continue` succeeds? *(extends bank)*

**Question:** `Continue` calls `charge-preview` and gets the authoritative total (§8.9). Step 3 is out of scope. So what does the user see next — a confirmation panel showing the server's authoritative numbers, a disabled "Step 3 is not part of this exercise" state, or nothing at all?
**Why it matters:** this is the **end of the flow in Case 1 and the brief does not specify it.** Without an answer the feature has no terminal state, and §8.9's "the server's total is the final answer" has nowhere visible to land.
**Recorded default:** **on success, replace the locally-estimated summary with the server's authoritative figures** (`total_signatures`, `price.signature`, `total_charge`, `quota_remaining`), label them clearly as confirmed by the server, and show an inline note that Step 3 is outside this exercise. **No navigation occurs** — the locked Step 3 pill stays locked.
**Rationale:** it makes §8.9's "server total is final, frontend number is only an estimate" *observable*, which is the whole point of the requirement. It adds no Step 3 scaffolding.
**Answer:** use the default

### Q2.6 — Are the seeded recipients pre-filled on first load? *(extends bank)*

**Question:** §6 gives Rina Halim (2) and Budi Santoso (1) and says "if you seed them, use exactly these". Should Step 2 open pre-populated with those two, or with one empty row?
**Why it matters:** pre-seeding makes the §10 acceptance row (`total_signatures` 3, `total_charge` `"15000.00"`, remaining quota 5) reproducible in one click; an empty row makes the first-run experience honest but makes the reviewer type.
**Recorded default:** **seed both recipients exactly as given.** Rationale: §10's headline acceptance row is written against precisely that data, and a reviewer on a time budget should be able to see it without typing. Seeding is frontend-side initial state only — the server never assumes recipients exist.
**Answer:** use the default

### Q2.7 — What happens at the 10-recipient ceiling? *(extends bank)*

**Question:** §8.1 caps recipients at 10. At 10 rows, does `Add signer` (a) disappear, (b) stay visible but disabled with a stated reason, or (c) stay active and produce an error?
**Recorded default:** **(b) — visible but `disabled`, with the reason shown next to it: `Maximum 10 recipients per document`.**
**Rationale:** consistent with `Q2.4`. The rule is stated where the user hits it rather than discovered through an error.
**Answer:** use the default

### Q2.8 — How is remaining quota displayed when the list exceeds it? *(extends bank)*

**Question:** §8.7 requires the summary panel to show remaining signature quota. Quota is 8. If the recipients total 9 signatures, does the panel show `-1`, `0`, or an over-by message?
**Why it matters:** §10 has an explicit acceptance row for two recipients at 3 each (total 9, over quota) requiring `Continue` disabled **with a visible reason**. The panel is where that reason lives.
**Recorded default:** show remaining quota **clamped at `0`**, and alongside it an explicit over-quota message naming the numbers: `9 of 8 signatures — 1 over your quota`. `Continue` is disabled and points at that message.
**Rationale:** a negative "remaining" reads as a bug; the over-by number is the actionable fact and doubles as §8.8's visible reason.
**Answer:** use the default

### Q3.3 — Does Case 1 ever consume quota? *(pre-answered by the PRD — stated so nobody re-opens it)* *(extends bank)*

**Question:** the mockup's summary copy says "Deducted from your signature balance when the document is sent." Does anything in Case 1 decrement the quota?
**Recorded answer:** **no.** §8.9 states "Case 1 changes no quota" outright. `charge-preview` is read-only with respect to quota; `quota_remaining` is computed, never stored. The mockup's "when the document is sent" copy refers to a send action that does not exist in Case 1. Listed here only so it is on the record and nobody re-derives it.

### Q3.4 — Priority order if the 24-minute budget runs out *(extends bank)*

**Question:** §14 requires a **specific** gap list at the minute-24 checkpoint, and §1 says time is not extended. If everything cannot land, what does PM want standing?
**Why it matters:** the answer determines the build order, not just the apology. Getting this wrong costs the whole checkpoint.
**Recorded default — MUST-HAVE, in this order:**
1. The shared validation + cost-calculation module **with its tests written first and real output saved** (§11 is the one section titled "Minimum tests"; §13.3 requires tests before implementation).
2. Both backend endpoints with the exact §9 contract, error codes, and fixed validation order.
3. Step 1 upload UI end-to-end against the real backend.
4. Step 2 recipients UI with derived totals and gated `Continue`.
5. The stale-response guard (§8.10) — the single most-tested behaviour in §10's list.
**NICE-TO-HAVE, dropped first:** drag-and-drop on the dropzone (§7.1 explicitly makes it optional and asks for it in the gap list if skipped), DOM interaction tests on top of the state/controller tests (§11 permits either), and any visual polish (§3 removes it from assessment).
**Rationale:** review weight is FE ±60% / BE ±40% (§4), but §11 and §13.3 make the tested core rules the floor. A polished UI over untested rules inverts the brief's own priorities.
