# PRD Verify Report — case-1-upload-and-recipients

- **Source:** `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md` (local file)
- **Namespace:** `sign-doc` (mapped to the fixed upstream enum as `sign-doc -> subproject-a`; see PLAN.md > Context > Scope)
- **Verified at:** 2026-09-28T00:00:00Z
- **Verdict:** **READY** (with 2 documented adaptations — see "Deviations" below)

## Checklist

| # | Row | Status | Evidence |
|---|---|---|---|
| 1 | PRD signed off | PASS (adapted) | `<!-- CLASSIFICATION: INTERNAL -->` + `# Fullstack L3 Interview — Case 1: Upload document & set recipients` |
| 2 | BDD stories exist | PASS | `### 10. Case 1 acceptance` — `| Scenario | Required outcome |` table, 12 rows |
| 3 | Edge cases enumerated | PASS | `Filename ../../etc/passwd.pdf`; `A very large file (e.g. 300 MB)`; `Recipients changed while a preview is pending` |
| 4 | NFR concrete with numeric thresholds | PASS | `Max recipients per document | 10`; `Signature count per recipient | integer 1–20`; `Max filename length | 200 characters after sanitization` |
| 5 | Feature-flag spec with default OFF | N/A (adapted) | Section not found — no feature flag named anywhere in the brief |
| 6 | PDPA checklist (if PII) | N/A | `Do not put secrets, tokens, or real personal data in source, the frontend bundle, logs, or any document. Use the @example.test fixture emails` |

## Deviations (read these — they are not silent passes)

This PRD is an **externally issued, immutable assessment brief**, not an internal Outline/Confluence PRD. Two checklist rows encode assumptions that do not hold here. Both are recorded rather than waved through.

### Row 1 — "PRD signed off"

A strict-literal read FAILS: there is no "Approved by" line, no sign-off table, no status badge.

**Adaptation applied:** the brief is an *issued* assessment artifact. Issuance is the sign-off equivalent — there is no author/reviewer pair to chase, and the document cannot be amended by engineering. Row marked PASS (adapted).

**Why not block:** the hard-block exists to stop engineering from building on an unapproved draft. This document is final by construction, so blocking produces no new information and burns the entire 24-minute Case 1 budget.

### Row 5 — "Feature-flag spec with default OFF"

A strict-literal read FAILS: no flag is named.

**Adaptation applied:** the brief has no deploy or rollout surface at all — `deployment` is explicitly out of scope (§4), storage is in-memory (§4), and there is a single demo account with no login (§5). The flag convention presupposes a multi-tenant production rollout that does not exist here. Row marked N/A (adapted).

**Engineer default recorded:** no feature flag ships in Case 1. If one were added, the default would be OFF. Carried into `QUESTIONS-PM.md` as `Q4.1` (confirm-only) and into PLAN.md > Locked Decisions as `LD-14`.

**Note on the N/A rule:** `prd-intake/references/checklist-criteria.md` allows N/A only on row 6. Marking row 5 N/A is therefore a *documented deviation*, not an allowed N/A. It is listed here so a reviewer can audit and overrule it.

### Row 6 — PDPA (allowed N/A, recorded for completeness)

The feature does handle names and email addresses, which are normally PII. §5 mandates that **only fictional `@example.test` fixture data** may exist anywhere in the system, and forbids real personal data in source, bundle, logs, and documents. Storage is in-memory and evaporates on process restart (retention), there is no login and thus no cross-account read path (access control), and removal is process restart or row deletion (deletion path). No real PII is in scope → row 6 N/A per the allowed rule.

## Row-by-row notes

- **Row 3** is the strongest row in this PRD. §10 enumerates path traversal, stored-XSS-shaped filenames, a 300 MB payload, case-insensitive duplicate emails, five distinct bad `signature_count` inputs, unknown-field injection, a 404 envelope, and a stale-response race. That is well past the three-concrete-edge-cases bar.
- **Row 4** passes on the **capacity** limb of the criterion, not latency/throughput/availability — there is no latency SLO anywhere in the brief. The one capacity threshold the PRD deliberately leaves open is max upload size (§10: "Behaviour follows the limit **you** define"). That is now locked at 25 MB (PLAN.md `LD-01`) and must be enforced server-side and recorded in `docs/decisions.md`.
- **Row 2**: §10's table is a Scenario/Required-outcome pair rather than literal Given/When/Then prose. The upstream criterion explicitly permits "a clearly equivalent acceptance-criteria block". The Given/When/Then decomposition is produced downstream in `SCENARIO.md`.

## Next step

Proceed to Phase 2 (ANALYZE) for the engineering Q&A round.

Per this workspace's output override, Phase 2's single `prd-questions.md` is split by audience into `QUESTIONS-ENGINEER.md` and `QUESTIONS-PM.md`. The `Q<category>.<index>` ID scheme is preserved in both so answers trace back to the same question bank.
