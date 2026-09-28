# SCENARIO.md — case-1-upload-and-recipients

End-to-end / browser-level scenarios for this feature. Each row is one assertion or one sad-path. Downstream `e2e-test` (mode generate-playwright) consumes this catalog.

- Source PLAN.md: [./PLAN.md](./PLAN.md)
- Source TASK.md: [./TASK.md](./TASK.md)
- Source PRD: `/Users/kuro/project/react/react-playground/signed-doc/test_1_en.md` (§10 acceptance table is the coverage floor)
- Binding spec: `/Users/kuro/project/react/react-playground/signed-doc/docs/prompt.md` (§4 Critical Facts, §5a requirement IDs, §7 Success Criteria)
- Scope of this run: **e2e-only**. `INTEGRATION_SCENARIO.md` is deliberately NOT produced (engineer opted in for E2E scenarios only at upstream Step 5).
- Total: **106 scenarios across 3 stories (42 positive / 64 negative)**

---

## ID convention

```
SCEN-<STORY>-<P|N><n>
```

- `<STORY>` — story code from TASK.md: `ST-1` (shared kernel, observed through both layers), `ST-2` (backend HTTP contract), `ST-3` (frontend Step 1 + Step 2). Story codes come from PLAN.md §Execution Waves / §Story-Point Calibration, which is the same source TASK.md is generated from.
- `<P|N>` — `P` = positive / happy path, `N` = negative / sad path.
- `<n>` — 1-based counter within the same story + polarity. Counters for `P` and `N` are independent.

IDs are immutable once written. To remove a scenario, strike the row (`~~SCEN-...~~`) and keep it in place with a one-line reason. No row in this file is struck.

---

## Scope, conventions, and deviations from the template

**Row columns.** The template specifies `ID | Given | When | Then | Notes`. This catalog adds two columns because the calling workflow requires them on every scenario: **Title** (short stable name) and **Traceability** (PRD requirement IDs from `docs/prompt.md` §5a plus the `LD-*` / `ADR-*` the scenario depends on). `When` cells carry explicitly numbered steps (`1.` `2.` …) for the same reason. Everything else follows the template verbatim: one assertion per row, concrete `Given`, observable `Then`, at least one `N` row per story.

**Story grouping rationale.** PLAN.md decomposes the epic by package ownership (`ST-1` kernel, `ST-2` backend, `ST-3` frontend), not by end-user story, because `ADR-007` draws file-disjoint boundaries. Browser-level scenarios are therefore grouped as:

- `ST-1` — rules owned by `packages/shared` asserted **through both layers at once** (the FE pre-check and the server verdict must agree). This is where PRD §8.5's "one source of truth" becomes observable.
- `ST-2` — the real HTTP contract asserted with the **browser deliberately bypassed** (`curl` / `supertest` against `POST /api/envelopes` and `POST /api/envelopes/:id/charge-preview`). PRD §7.3 makes the server the decision-maker, so these rows are not optional UI duplicates — they are the only proof that a hostile client cannot win.
- `ST-3` — the browser flow: Step 1 upload, Step 2 recipients, the 3-pill stepper, gating, a11y, error and stale-response UX.

**BDD source.** PLAN.md contains no literal per-story `Given / When / Then` prose blocks. `prd-verify-report.md` row 2 records why and where the decomposition belongs: *"§10's table is a Scenario/Required-outcome pair rather than literal Given/When/Then prose … The Given/When/Then decomposition is produced downstream in `SCENARIO.md`."* This file is that decomposition. Every row is derived from PRD §10, PRD §7/§8/§9, `docs/prompt.md` §7, or a PLAN.md Locked Decision — none is invented.

**Out-of-scope items get no scenarios.** Nothing is catalogued for Step 3 "Place fields" behaviour, `From cloud` / `Save as draft` functionality, PDF parsing, page count from file bytes, auth, persistence, deployment, i18n, responsive layout, quota mutation, or Case 2 (PLAN.md §Out-of-Scope). The only Step 3 / disabled-control rows here assert that those surfaces are **inert** — which is in scope (`ADR-005`, `LD-05`).

**Environment facts every row assumes.** Single demo account, no login (PRD §5). Storage is an in-memory `Map`; file bytes are discarded after validation and only metadata is kept (`LD-03`, `ADR-002`) — no row may assume file retrieval or survival across a restart. Price `"5000.00"` and quota `8` are server-only (`ADR-003`) and reach the browser only inside the `201` upload body. Max upload size is **25 MB enforced server-side** (`LD-01`, `ADR-004`, `422 FILE_TOO_LARGE`). Client timeouts: upload 60 s, charge-preview 10 s (`LD-28`); zero automatic retries (`LD-29`). Error envelope is always `{ "error": { "code", "message", "details?" } }` (`LD-26`).

---

## Story ST-1 — Shared validation & pricing kernel, asserted through both layers

PLAN.md sections: [Locked Decisions](./PLAN.md#locked-decisions) · [Architecture Slice > packages/shared](./PLAN.md#architecture-slice-per-repo) · [Service Change Map](./PLAN.md#service-change-map)

Story intent: prove the FE pre-check and the server verdict come from **one** module (PRD §8.5, `LD-23`) and that the money / filename / page-count rules behave identically wherever they are observed.

| ID | Title | Given | When | Then | Traceability | Notes |
|----|-------|-------|------|------|--------------|-------|
| SCEN-ST-1-P1 | Uppercase extension accepted | App is on Step 1 with an empty dropzone; server running on `:3001` | 1. Select a 100 KB file named `Agreement.PDF` | Upload succeeds; the document card appears with `Agreement.PDF`; no extension error is shown | §7.9, §6 (case-insensitive extensions) | Extension comparison is lowercased in `isAllowedExtension` |
| SCEN-ST-1-P2 | Unlisted filename yields page_count 1 | App is on Step 1, empty state | 1. Select a 20 KB file named `contract-2026.pdf` | Card reads `Uploaded · 1 pages · 20 KB`; page count is the fixture default, not parsed from bytes | §6 (fixture table), `LD-03` | Fixture default is `1` for any unlisted name |
| SCEN-ST-1-P3 | Fixture page count — nda-partner.pdf | App is on Step 1, empty state | 1. Select a valid file named `nda-partner.pdf` | Card reads `3 pages` | §6 (fixture table) | Value is table-driven, never derived from content |
| SCEN-ST-1-P4 | Fixture page count — berita-acara.docx | App is on Step 1, empty state | 1. Select a valid file named `berita-acara.docx` | Card reads `1 pages`; `.docx` is accepted | §6, §7.9 | Confirms `docx` is in the allow-list |
| SCEN-ST-1-P5 | Exact money for 7 signatures | Step 2 with an uploaded envelope; rows totalling 7 signatures | 1. Read the summary panel | `Total charge` renders `Rp35.000,00`; the server's `total_charge` for the same list is the string `"35000.00"` | §6, §9, `LD-22`, `ADR-006`, `LD-11` | Exact string equality — no epsilon, no float |
| SCEN-ST-1-P6 | 200-character filename passes unchanged | App is on Step 1, empty state | 1. Select a valid `.pdf` whose sanitized name is exactly 200 characters | Upload succeeds; the card shows the full 200-character name unchanged | §7.8, `LD-25` | Boundary: at the cap, not over it |
| SCEN-ST-1-P7 | Over-length filename truncated preserving extension | App is on Step 1, empty state | 1. Select a valid file whose name is 220 characters ending `.pdf` | Upload succeeds; the returned/displayed filename is exactly 200 characters and still ends `.pdf` | §7.8, `LD-25` | `stem + "." + ext === 200` chars |
| SCEN-ST-1-P8 | Padded, mixed-case unique emails are accepted | Step 2 with two rows whose emails differ after normalization | 1. Enter `  Rina.Halim@Example.test ` in row 1 and `budi.santoso@example.test` in row 2<br>2. Click `Continue` | Server returns `200`; no `DUPLICATE_RECIPIENT_EMAIL`; both rows stay unmarked | §8.4, `LD-24` | Normalization trims and lowercases; it does not reject |
| SCEN-ST-1-P9 | Quota boundary — exactly 8 signatures | Step 2 with an uploaded envelope; rows totalling exactly 8 signatures | 1. Click `Continue` | Server returns `200` with `total_signatures: 8`, `total_charge: "40000.00"`, `quota_remaining.signature: 0`; `Continue` was enabled | §8.7, §8.9, §11.1, `LD-17` | The quota boundary row PRD §11.1 demands |
| SCEN-ST-1-N1 | `.exe` rejected by the frontend pre-check | App is on Step 1, empty state, DevTools Network panel open | 1. Select a file named `payload.exe` | A cause-specific error names the file type (not a generic message); **no** request to `/api/envelopes` is made; `Continue` stays disabled | §7.2, §10 row 2 (FE half) | Pair with `SCEN-ST-2-N2` for the server half |
| SCEN-ST-1-N2 | `.pdf.exe` rejected by the frontend pre-check | App is on Step 1, empty state | 1. Select a file named `invoice.pdf.exe` | Same cause-specific file-type error; no request is sent; `Continue` stays disabled | §7.2, §7.9, §10 row 2 (FE half) | Extension is the last segment only |
| SCEN-ST-1-N3 | Extension alone at/over the 200-char cap is rejected | App is on Step 1, empty state | 1. Select a file whose extension alone is 200+ characters | Upload is rejected with `FILENAME_INVALID`; no document card appears | §7.8, `LD-25` | Truncation is impossible, so reject |
| SCEN-ST-1-N4 | `signature_count` "abc" — both layers agree | Step 2 with row 1 at `signature_count` 2 | 1. Type `abc` into row 1's number input<br>2. Force a `charge-preview` request carrying `"signature_count": "abc"` via `curl` | FE keeps the previous value `2` and never renders `NaN`/blank state; the server returns `422 SIGNATURE_COUNT_INVALID` (it does **not** clamp) | §8.3, §10 row 9, `LD-24` | `clampSignatureCount` (FE) vs `isValidSignatureCount` (BE) are deliberately different |
| SCEN-ST-1-N5 | Duplicate rows are marked locally before any round trip | Step 2, DevTools Network panel open | 1. Type `rina.halim@example.test` into row 2 (row 1 already has the same address) | Both colliding rows are marked invalid immediately from the local shared module; the marking does not wait for a server response | §8.4, §8.5, §10 row 8, `LD-26` | Server `details.recipient_indexes` is reconciliation only |
| SCEN-ST-1-N6 | Frontend estimate never diverges from the server total | Step 2 with rows totalling 3 signatures | 1. Note the on-screen `Total charge`<br>2. Click `Continue` and read the server-confirmed figure | Both are the same exact value (`Rp15.000,00` ← `"15000.00"`); no rounding, trailing-cent or float artifact appears | §6, §8.6, §8.9, `ADR-006` | Divergence here means a float leaked in |

---

## Story ST-2 — Backend HTTP contract, browser deliberately bypassed

PLAN.md sections: [New Endpoints — Route Table](./PLAN.md#new-endpoints--route-table) · [API Spec — OpenAPI YAML](./PLAN.md#api-spec--openapi-yaml) · [Verification Plan per Repo](./PLAN.md#verification-plan-per-repo)

Story intent: every rule is enforced server-side even when the client is hostile or absent (PRD §7.3, §9). All rows drive the real HTTP surface directly (`curl`, or `supertest` against `createApp()`), never the UI. Status codes, error codes and bodies below are taken from PLAN.md's route table and OpenAPI block verbatim.

| ID | Title | Given | When | Then | Traceability | Notes |
|----|-------|-------|------|------|--------------|-------|
| SCEN-ST-2-P1 | Health probe answers | Server is running on `:3001` | 1. `GET /api/health` | `200` with body `{"status":"ok"}` | §9 (additive route), §12 | Makes the README run instructions checkable |
| SCEN-ST-2-P2 | Upload the fixture PDF | Server running; store empty | 1. `POST /api/envelopes` multipart, field `file` = `agreement-vendor-2026.pdf` | `201` with `envelope_id: "env_01"`, `document.filename: "agreement-vendor-2026.pdf"`, `document.page_count: 8`, `document.size_bytes` = real byte length, `price.signature: "5000.00"`, `quota.signature: 8` | §9, §10 row 1, `docs/prompt.md` §7.1 | Exact contract from the OpenAPI `EnvelopeCreated` schema |
| SCEN-ST-2-P3 | Path-traversal filename is stored as a bare basename | Server running | 1. `POST /api/envelopes` with `file` named `../../etc/passwd.pdf` | `201` with `document.filename: "passwd.pdf"` — no `/`, no `\`, no `..` anywhere in the response | §7.8, §10 row 3, `docs/prompt.md` §7.3 | Sanitize happens **before** the extension check |
| SCEN-ST-2-P4 | XSS-shaped filename survives sanitization verbatim | Server running | 1. `POST /api/envelopes` with `file` named `<img src=x onerror=alert(1)>.pdf` | `201`; `document.filename` still contains `<` and `>` exactly as sent, as a bare basename | §7.8, §10 row 4, PLAN.md §Critical Files | `sanitizeFilename` deliberately preserves `<`/`>` so the real defence (text-only render) is exercised — see `SCEN-ST-3-P19` |
| SCEN-ST-2-P5 | Rina + Budi authoritative preview | `env_01` exists | 1. `POST /api/envelopes/env_01/charge-preview` with Rina (2) + Budi (1) | `200` with `recipient_count: 2`, `total_signatures: 3`, `price.signature: "5000.00"`, `charges.signature: "15000.00"`, `total_charge: "15000.00"`, `quota.signature: 8`, `quota_remaining.signature: 5` | §8.9, §9, §10 row 6, `docs/prompt.md` §7.6 | The single most-cited acceptance row |
| SCEN-ST-2-P6 | Preview is idempotent and consumes no quota | `env_01` exists | 1. Send the Rina + Budi preview twice in a row | Both responses are byte-identical; `quota_remaining.signature` is `5` both times — nothing was decremented or stored | §8.9, `LD-18`, `LD-20` | Concurrent-tab safe by construction |
| SCEN-ST-2-P7 | Quota boundary returns remaining 0, not negative | `env_01` exists | 1. Preview a list totalling exactly 8 signatures | `200` with `total_signatures: 8`, `total_charge: "40000.00"`, `quota_remaining.signature: 0` | §8.7, §11.1, `LD-17` | `quota_remaining` has `minimum: 0` in the contract |
| SCEN-ST-2-P8 | Price and quota always come from the server | Server running | 1. Upload any valid file<br>2. Preview any valid recipient list | Both responses carry `price.signature: "5000.00"` and `quota.signature: 8` sourced server-side; neither value appears in the request | §5, §9, `ADR-003` | The browser's only source of price/quota is the `201` body |
| SCEN-ST-2-P9 | Envelope ids are sequential and independently resolvable | Store empty | 1. Upload a valid file (→ `env_01`)<br>2. Upload a second valid file | Second response is `201` with `envelope_id: "env_02"`; a preview against either id succeeds | §9, `ADR-002` | Opaque sequential ids, PRD's own `env_01` example |
| SCEN-ST-2-P10 | Money is a JSON string on the wire, never a number | `env_01` exists | 1. Preview Rina + Budi and inspect the raw response text | `"total_charge":"15000.00"` appears quoted; no unquoted numeric money value exists anywhere in the body | §6, §9, `docs/prompt.md` §4 fact 1, `ADR-006` | Matches the `Money` schema pattern `^[0-9]+\.[0-9]{2}$` |
| SCEN-ST-2-N1 | Missing file field | Server running | 1. `POST /api/envelopes` with no `file` part | `422` with `error.code: "FILE_REQUIRED"` | §9, §7.1 | First check in the upload order |
| SCEN-ST-2-N2 | `.exe` rejected server-side | Server running; the browser is not involved | 1. `POST /api/envelopes` with `file` named `payload.exe` | `422` with `error.code: "FILE_TYPE_NOT_ALLOWED"` | §7.3, §7.9, §10 row 2 (BE half), `docs/prompt.md` §7.2 | Proves the FE check is UX only |
| SCEN-ST-2-N3 | `.pdf.exe` rejected server-side | Server running | 1. `POST /api/envelopes` with `file` named `invoice.pdf.exe` | `422` with `error.code: "FILE_TYPE_NOT_ALLOWED"` | §7.9, §10 row 2 (BE half) | Double extension must not fool the check |
| SCEN-ST-2-N4 | 300 MB upload refused by the server | Server running; no browser pre-check in the path | 1. `POST /api/envelopes` streaming a 300 MB file | `422` with `error.code: "FILE_TOO_LARGE"` and message naming the 25 MB limit; the connection is aborted by the parser rather than buffering 300 MB | §10 row 5, `docs/prompt.md` §7.5, `LD-01`, `LD-27`, `ADR-004` | **Server-side enforcement is the assertion** — the client check is irrelevant here |
| SCEN-ST-2-N5 | 25 MB + 1 byte is over the limit | Server running | 1. `POST /api/envelopes` with a file of exactly `25 * 1024 * 1024 + 1` bytes | `422 FILE_TOO_LARGE` | §10 row 5, `LD-01`, `ADR-004` | Upper boundary. A file of exactly 25 MB is accepted |
| SCEN-ST-2-N6 | Content-Type spoof does not bypass the extension rule | Server running | 1. `POST /api/envelopes` with `file` named `payload.exe` and part `Content-Type: application/pdf` | `422 FILE_TYPE_NOT_ALLOWED` — the verdict comes from the sanitized filename, not the declared type | §7.9, `docs/prompt.md` §4 fact 5 | Client-declared MIME is never trusted |
| SCEN-ST-2-N7 | Two file parts are refused at the parser | Server running | 1. `POST /api/envelopes` with two `file` parts | Request fails with the standard `{error:{code,message}}` envelope; no envelope is created | §7.1, `ADR-004` (`files: 1`) | Closes the multi-file vector before handler code |
| SCEN-ST-2-N8 | Extra multipart text field is refused at the parser | Server running | 1. `POST /api/envelopes` with `file` plus an extra text field `total_charge=1.00` | Request fails with the standard error envelope; no client-supplied money value is read | §9, `ADR-003`, `ADR-004` (`fields: 0`) | Why `UNKNOWN_FIELD` needs no multipart variant |
| SCEN-ST-2-N9 | Unknown envelope | Server running; `env_999` was never created | 1. `POST /api/envelopes/env_999/charge-preview` with a valid recipient list | `404` with `error.code: "ENVELOPE_NOT_FOUND"` | §9, §10 row 11, `docs/prompt.md` §7.11 | The only non-422 failure status in the feature |
| SCEN-ST-2-N10 | Empty recipients array | `env_01` exists | 1. Preview with `{"recipients": []}` | `422` with `error.code: "RECIPIENT_COUNT_INVALID"` | §8.11, §9, `LD-12` | The empty-list path the UI prevents but the server still defends |
| SCEN-ST-2-N11 | Eleven recipients | `env_01` exists | 1. Preview with 11 valid recipient objects | `422 RECIPIENT_COUNT_INVALID` | §8.1, §9 | Max is 10 |
| SCEN-ST-2-N12 | `recipients` is not an array | `env_01` exists | 1. Preview with `{"recipients": {"name":"Rina"}}` | `422 RECIPIENT_COUNT_INVALID` | §9 | Shape check precedes content checks |
| SCEN-ST-2-N13 | `signature_count` 0 | `env_01` exists | 1. Preview with row 0 `signature_count: 0` | `422 SIGNATURE_COUNT_INVALID` with `details.recipient_index: 0` | §8.3, §9, §10 row 9, `LD-26` | Lower boundary |
| SCEN-ST-2-N14 | `signature_count` -1 | `env_01` exists | 1. Preview with row 0 `signature_count: -1` | `422 SIGNATURE_COUNT_INVALID`, `details.recipient_index: 0` | §10 row 9 | Negative |
| SCEN-ST-2-N15 | `signature_count` 2.5 | `env_01` exists | 1. Preview with row 0 `signature_count: 2.5` | `422 SIGNATURE_COUNT_INVALID`, `details.recipient_index: 0` | §10 row 9 | Non-integer |
| SCEN-ST-2-N16 | `signature_count` "abc" — no coercion | `env_01` exists | 1. Preview with row 0 `signature_count: "abc"` | `422 SIGNATURE_COUNT_INVALID` — the server does **not** clamp or coerce to a valid number | §10 row 9, PLAN.md §Critical Files | Guards the "backend accidentally clamps" risk |
| SCEN-ST-2-N17 | `signature_count` null / absent | `env_01` exists | 1. Preview with row 0 `signature_count: null` | `422 SIGNATURE_COUNT_INVALID`, `details.recipient_index: 0` | §10 row 9 | The "empty" case from PRD §10 |
| SCEN-ST-2-N18 | `signature_count` 21 | `env_01` exists | 1. Preview with row 0 `signature_count: 21` | `422 SIGNATURE_COUNT_INVALID` | §6, §8.3 | Upper boundary; 20 is accepted |
| SCEN-ST-2-N19 | Name empty after trimming | `env_01` exists | 1. Preview with row 1 `name: "   "` | `422` with `error.code: "RECIPIENT_INVALID"` and `details.recipient_index: 1` | §8.4, §9, `LD-24`, `LD-26` | Name is checked after `signature_count` |
| SCEN-ST-2-N20 | Email domain has no dot | `env_01` exists | 1. Preview with row 0 `email: "rina.halim@example"` | `422 RECIPIENT_INVALID`, `details.recipient_index: 0` | §8.4, §9 | Minimum email rule from PRD §8.4 |
| SCEN-ST-2-N21 | Email has two at-signs | `env_01` exists | 1. Preview with row 0 `email: "rina@@example.test"` | `422 RECIPIENT_INVALID`, `details.recipient_index: 0` | §8.4 | Exactly one `@` is required |
| SCEN-ST-2-N22 | Duplicate email after trim + case-fold | `env_01` exists | 1. Preview with row 0 `"  Rina.Halim@Example.test "` and row 1 `"rina.halim@example.test"` | `422` with `error.code: "DUPLICATE_RECIPIENT_EMAIL"` and `details.recipient_indexes: [0, 1]` | §8.4, §10 row 8, `docs/prompt.md` §7.8, `LD-26` | Comparison is trimmed and case-insensitive |
| SCEN-ST-2-N23 | Forced request over quota | `env_01` exists | 1. Preview a list totalling 9 signatures (seeded 3 + two recipients at 3 each) | `422` with `error.code: "INSUFFICIENT_SIGNATURE_QUOTA"` and a message naming the numbers (`9 of 8 signatures - 1 over your quota`) | §8.8, §9, §10 row 7, `docs/prompt.md` §7.7, `LD-17` | The "if forced through" half of PRD §10 row 7 |
| SCEN-ST-2-N24 | Ten recipients fail on quota, not on count | `env_01` exists | 1. Preview 10 valid recipients at 1 signature each (total 10) | `422 INSUFFICIENT_SIGNATURE_QUOTA` — **not** `RECIPIENT_COUNT_INVALID`, because 10 is a legal count | §9 (validation order), `LD-24` | Proves quota is the last stage |
| SCEN-ST-2-N25 | Unknown top-level field `total_charge` | `env_01` exists | 1. Preview with a valid `recipients` plus `"total_charge":"1.00"` | `422` with `error.code: "UNKNOWN_FIELD"` and `details.field: "total_charge"`; the client value is never used | §9, §10 row 10, `docs/prompt.md` §7.10, `ADR-003` | `additionalProperties: false` from day one |
| SCEN-ST-2-N26 | Unknown top-level field `quota` | `env_01` exists | 1. Preview with a valid `recipients` plus `"quota":{"signature":99}` | `422 UNKNOWN_FIELD` with `details.field: "quota"`; quota stays the server's `8` | §9, §10 row 10, `ADR-003` | Client cannot raise its own quota |
| SCEN-ST-2-N27 | Unknown field nested inside a recipient | `env_01` exists | 1. Preview with row 0 carrying an extra `"charge":"5000.00"` | `422 UNKNOWN_FIELD` with `details.field` naming the offending key | §9, `LD-26` | The allow-list is strict at every level |
| SCEN-ST-2-N28 | Order — payload shape beats envelope lookup | `env_999` does not exist | 1. `POST /api/envelopes/env_999/charge-preview` with an unknown field in the body | `422 UNKNOWN_FIELD` (not `404`) — payload shape is validated first | §9 (validation order), `docs/prompt.md` §4 fact 14 | Ordering is a scored property |
| SCEN-ST-2-N29 | Order — per-recipient beats duplicates | `env_01` exists | 1. Preview with row 0 `signature_count: 0` **and** rows 0/1 sharing one email | `422 SIGNATURE_COUNT_INVALID` (not `DUPLICATE_RECIPIENT_EMAIL`) | §9 (validation order), `LD-24` | Per-recipient stage runs before the duplicate stage |
| SCEN-ST-2-N30 | First failure wins across recipients | `env_01` exists | 1. Preview where row 0 has an empty name and row 1 has an invalid email | Exactly one error object is returned, with `details.recipient_index: 0`; row 1's problem is not reported | §9, `LD-24`, `LD-26` | Index order, first failure, immediate return |
| SCEN-ST-2-N31 | Malformed JSON body | `env_01` exists | 1. `POST .../charge-preview` with body `{"recipients":` and `content-type: application/json` | `422` with the standard error envelope; no stack trace, framework text or internal path appears in the body | §9, PLAN.md `error-mapper.ts` | Single exit for every failure shape |
| SCEN-ST-2-N32 | JSON body over the 64 kB cap | `env_01` exists | 1. `POST .../charge-preview` with a >64 kB JSON body | Request is rejected with the standard error envelope; the service layer is never reached | §9, PLAN.md `config/limits.ts` | `express.json({ limit })` is mounted per-router |
| SCEN-ST-2-N33 | Envelopes do not survive a restart | `env_01` was created, then the server process is restarted | 1. `POST /api/envelopes/env_01/charge-preview` with a valid list | `404 ENVELOPE_NOT_FOUND` | §4, §7.10, `LD-03`, `LD-21`, `ADR-002` | In-memory store; **no** scenario may assume persistence |
| SCEN-ST-2-N34 | Unexpected internal failure leaks nothing | Server running with a fault injected below the handler | 1. `POST /api/envelopes/env_01/charge-preview` with a valid list | `500` with a generic body; no stack trace, no file path, no dependency name, no uploaded-file content | §9, PLAN.md `error-mapper.ts` | Fault-injected row; `error-mapper` is the only exit |

---

## Story ST-3 — Frontend: Step 1 upload, Step 2 recipients, stepper, gating, a11y

PLAN.md sections: [Frontend Slice](./PLAN.md#frontend-slice) · [Context > Figma](./PLAN.md#figma) (normative copy strings) · [ADR-005](./PLAN.md#adr-005-step-3-is-a-locked-display-only-stepper-pill--no-route-no-scaffold)

Story intent: the browser flow behaves per PRD §7 and §8 with the copy and `aria-*` strings recovered from the mockup, all gating reasons visible on screen, and every failure mode retryable without losing typed input.

| ID | Title | Given | When | Then | Traceability | Notes |
|----|-------|-------|------|------|--------------|-------|
| SCEN-ST-3-P1 | Step 1 empty state renders the mockup copy | App freshly loaded at the Step 1 view; no document uploaded | 1. Read the page | Heading `What needs to be signed?`, dropzone text `Drop your file here or Browse`, helper text `One document per request. PDF, JPG, JPEG, PNG, DOC or DOCX.` are all present | §7.1, PLAN.md §Context > Figma, `LD-10` | Empty state — one of the five states with no design |
| SCEN-ST-3-P2 | `Continue` is disabled with a visible reason in the empty state | Step 1, no document uploaded | 1. Inspect the `Continue` control | It is `disabled`; a visible reason text explains why and is referenced by the control's `aria-describedby` | §7.6, `docs/prompt.md` §4 fact 6 | Reason is on screen, never a tooltip-only hint |
| SCEN-ST-3-P3 | Stepper renders three pills with Step 3 locked | App loaded at Step 1 | 1. Inspect the stepper | Exactly three pills render: `1 Upload document`, `2 Set recipients`, `3 Place fields`; pill 3 carries `aria-disabled="true"`, is rendered in the locked treatment, and is absent from the tab order | §3, `LD-02`, `ADR-005` | Display-only; no route exists behind it |
| SCEN-ST-3-P4 | `aria-current="step"` marks the active pill | App loaded at Step 1 | 1. Inspect the stepper | Pill 1 carries `aria-current="step"`; pills 2 and 3 do not | §8.12, PLAN.md §Design System Gap | Screen-reader position cue |
| SCEN-ST-3-P5 | `From cloud` is disabled with an explanation | Step 1, empty state | 1. Inspect the `From cloud` control | It is `disabled` with `aria-disabled="true"`, shows the visible text `Not available in this exercise`, and has no click handler | §3, `LD-05` | Not removed, not a dead control that appears to work |
| SCEN-ST-3-P6 | `Browse` is keyboard reachable | Step 1, empty state | 1. Tab to the `Browse` control and press Enter | The OS file picker opens; the control is a real focusable element bound by `<label>` to a visually hidden `input[type=file]` | §7.1, §8.12 | Drag-and-drop is optional (PRD §7.1); this path always ships |
| SCEN-ST-3-P7 | Loading state during upload | Step 1, empty state; the upload request is held open | 1. Select a valid 1.4 MB `agreement-vendor-2026.pdf` | A loading state is visible while the request is in flight; `Continue` remains disabled during it | §7.7, `LD-10` | Loading state — no design exists, behaviour is the requirement |
| SCEN-ST-3-P8 | Document card content after a successful upload | Step 1, empty state | 1. Select `agreement-vendor-2026.pdf` and let the request complete | Card shows the filename plus `Uploaded · 8 pages · 1.4 MB` | §7.4, §10 row 1, PLAN.md §Context > Figma | Page count comes from the `201` body |
| SCEN-ST-3-P9 | Remove button names the file | Upload of `agreement-vendor-2026.pdf` succeeded | 1. Inspect the card's remove button | It carries `aria-label="Remove agreement-vendor-2026.pdf"` | §7.4, §8.12 | Mockup string reused verbatim |
| SCEN-ST-3-P10 | `Continue` becomes enabled after a valid upload | Upload of `agreement-vendor-2026.pdf` succeeded | 1. Inspect `Continue` | It is enabled and the disabled-reason text is gone | §7.6, §10 row 1, `docs/prompt.md` §7.1 | Gate opens only on machine state `success` |
| SCEN-ST-3-P11 | Remove returns the page to the empty state | A document card is shown | 1. Click the card's remove button | The card disappears, the empty dropzone returns, and `Continue` is disabled again with its reason visible | §7.5, §7.6 | `REMOVE` transition on the upload machine |
| SCEN-ST-3-P12 | A second upload replaces the first | A card for `nda-partner.pdf` is shown | 1. Select `agreement-vendor-2026.pdf` | Exactly one card is present and it shows `agreement-vendor-2026.pdf` with `8 pages`; files do not accumulate | §7.5, `docs/prompt.md` §4 fact 6 | `SELECT_FILE` replaces, never appends |
| SCEN-ST-3-P13 | Advancing to Step 2 updates the stepper | A valid document is uploaded; `Continue` enabled | 1. Click `Continue` | The Step 2 view renders; pill 1 shows complete, pill 2 is active with `aria-current="step"`, pill 3 is still locked and `aria-disabled="true"` | §3, `LD-02`, `ADR-005` | No router; `App.tsx` switches a `step` value |
| SCEN-ST-3-P14 | Step 2 heading and sub-copy | Step 2 is shown | 1. Read the page | Heading `Who signs it?` and sub-copy `Everyone below is invited at the same time. Fields are placed manually in the next step.` are present | §8.1, PLAN.md §Context > Figma | Copy is the design contract |
| SCEN-ST-3-P15 | Seeded recipients | Step 2 freshly entered | 1. Read the recipient rows | Two rows: `Rina Halim` / `rina.halim@example.test` / 2, and `Budi Santoso` / `budi.santoso@example.test` / 1 | §6, `LD-15` | Frontend initial state only — the server never assumes recipients |
| SCEN-ST-3-P16 | Summary panel estimate for the seeded list | Step 2 with the seeded rows | 1. Read the summary panel | It shows `3 signatures × Rp5.000,00 per signature` and `Total charge` `Rp15.000,00`, plus remaining quota `5` | §8.7, §10 row 6, `LD-11`, `LD-17` | Price/quota came from the `201` body, not a bundled constant |
| SCEN-ST-3-P17 | Totals are derived, updating live | Step 2 with the seeded rows (3 signatures) | 1. Click `+` on Rina's row once | Total signatures becomes 4 and `Total charge` becomes `Rp20.000,00` immediately, with no separate stored total to desynchronize | §8.6, `docs/prompt.md` §4 fact 9 | Computed in render from `computeCharges` |
| SCEN-ST-3-P18 | Per-row charge column updates | Step 2 with Rina at 2 signatures | 1. Click `+` on Rina's row once | Rina's `Charge` cell becomes `Rp15.000,00` | §8.6, §8.7 | One assertion per row: this is the per-row cell only |
| SCEN-ST-3-P19 | `Add signer` appends an empty row defaulting to 1 | Step 2 with 2 rows | 1. Click `Add signer` | A third row appears with empty name, empty email and `signature_count` `1` | §8.2 | Default is 1, never 0 |
| SCEN-ST-3-P20 | Stepper button `aria-label`s name the signer | Step 2 with Rina's row present | 1. Inspect the `−` and `+` buttons on Rina's row | They carry `aria-label="Fewer signatures for Rina Halim"` and `aria-label="More signatures for Rina Halim"` | §8.12, PLAN.md §Context > Figma | Mockup strings reused verbatim |
| SCEN-ST-3-P21 | Blank-name rows fall back to `signer {i+1}` in labels | Step 2 with a newly added row 3 whose name is empty | 1. Inspect that row's remove button | Its `aria-label` is `Remove signer 3` | §8.12, PLAN.md §Context > Figma | The mockup's own `a11yName` fallback |
| SCEN-ST-3-P22 | Every recipient input has an associated label | Step 2 with two rows | 1. Inspect the name, email and signature inputs of row 1 | Each has a `<label for>` pointing at `signer-name-0`, `signer-email-0`, `signer-count-0` respectively | §8.12 | Ids follow the mockup's scheme |
| SCEN-ST-3-P23 | Keyboard focus is visible | Step 2 is shown | 1. Tab through the row controls | Each focused control shows a visible focus ring (`outline: 2px solid #4B4EDE; outline-offset: 2px`) | §8.12 | Already specified by the mockup CSS |
| SCEN-ST-3-P24 | Remove on the single remaining row is disabled with a reason | Step 2 reduced to exactly one row | 1. Inspect that row's remove button | It is visible but `disabled` with `aria-disabled="true"` and the hint `At least one recipient is required` | §8.1, `LD-12` | UI never walks the user into the empty list |
| SCEN-ST-3-P25 | `Add signer` is disabled at ten rows | Step 2 with 10 recipient rows | 1. Inspect `Add signer` | It is visible but `disabled`, with the reason `Maximum 10 recipients per document` shown next to it | §8.1, `LD-16` | Ceiling is taught, not hidden |
| SCEN-ST-3-P26 | Request body carries only `recipients` | Step 2 with a valid list; DevTools Network panel open | 1. Click `Continue` and inspect the outgoing request | The JSON body contains exactly `{ "recipients": [{ name, email, signature_count }] }` — no price, total, quota or charge key | §9, `ADR-003`, §10 row 10 | Client never proposes commercial values |
| SCEN-ST-3-P27 | Server-confirmed summary replaces the estimate | Step 2 with the seeded rows, all valid | 1. Click `Continue` and let the `200` arrive | The panel shows the server's `total_signatures` 3, `Rp5.000,00`, `Rp15.000,00` and remaining `5`, labelled as server-confirmed | §8.9, §10 row 6, `LD-13` | Server value is final; the estimate is only responsive |
| SCEN-ST-3-P28 | Success state notes Step 3 is out of scope and does not navigate | The Step 2 `Continue` request just returned `200` | 1. Observe the view | An inline note states Step 3 is outside this exercise; the view does **not** navigate and pill 3 stays locked | §3, `LD-13`, `ADR-005` | Deliberate terminal state |
| SCEN-ST-3-P29 | XSS-shaped filename renders as inert text | An upload of `<img src=x onerror=alert(1)>.pdf` returned `201` | 1. Observe the document card | The filename shows literally as text; no `img` element exists in the card and no dialog/script executes | §7.8, §10 row 4, `docs/prompt.md` §7.4 | Text node only — never `dangerouslySetInnerHTML` |
| SCEN-ST-3-P30 | `Back` preserves the uploaded document | Step 2 is shown with a document uploaded in Step 1 | 1. Click `Back` | Step 1 renders with the same document card still present and `Continue` enabled | §7.5 (no accumulation), PLAN.md §Frontend Slice | `App.tsx` owns the envelope metadata across steps |
| SCEN-ST-3-N1 | Wrong file type is rejected client-side with a specific message | Step 1, empty state | 1. Select `payload.exe` | A cause-specific message names the unsupported type (not a generic "invalid file"); `Continue` stays disabled | §7.2, §10 row 2, `LD-10` | Per-cause messages are required by PRD §7.2 |
| SCEN-ST-3-N2 | Oversize file is pre-checked client-side (UX only) | Step 1, empty state | 1. Select a 30 MB `.pdf` | An error names the 25 MB limit; no upload request is sent; `Continue` stays disabled | §7.2, §10 row 5, `LD-01`, `ADR-003` | The browser copy of the limit is a pre-check comment-marked as UX only |
| SCEN-ST-3-N3 | Server `FILE_TOO_LARGE` is rendered when the client check is bypassed | Step 1; the client-side size pre-check is bypassed so a 30 MB file is actually sent | 1. Submit the file and wait for the `422` | The UI renders the error from `error.code` (`FILE_TOO_LARGE`) with the 25 MB message, plus a `Try again` control; no document card appears | §7.3, §10 row 5, `LD-27`, `ADR-004` | One frontend branch: `status === 422 → render error.code` |
| SCEN-ST-3-N4 | Server `FILE_TYPE_NOT_ALLOWED` is rendered | Step 1; a `.pdf.exe` is forced past the client check | 1. Submit and wait for the `422` | The UI renders the `FILE_TYPE_NOT_ALLOWED` message; `Continue` stays disabled | §7.3, §10 row 2 | FE and BE both reject — the PRD requires both halves |
| SCEN-ST-3-N5 | Upload `500` shows a retryable error state | Step 1; the upload endpoint is stubbed to `500` | 1. Select a valid file and wait | An error state appears with a `Try again` control; the page keeps its context (step, prior view state) | §7.7, `LD-29`, `LD-10` | Error/retry state — engineer-designed |
| SCEN-ST-3-N6 | Retry after an upload failure works without re-selecting | An upload just failed with `500`; the endpoint now returns `201` | 1. Click `Try again` | The upload succeeds, the card appears, and the error state clears | §7.7, `LD-29` | Retry is user-driven; zero automatic retries |
| SCEN-ST-3-N7 | Upload timeout at 60 s | Step 1; the upload endpoint never responds | 1. Select a valid file and wait past 60 s | The request aborts and an inline retryable error reads `Could not reach the server — try again`; no document card appears | §7.7, `LD-28`, `LD-29` | Same `AbortController` as the staleness guard |
| SCEN-ST-3-N8 | Network drop during upload | Step 1; the network is disconnected mid-request | 1. Select a valid file and wait | The same retryable inline error appears; no automatic retry is attempted (exactly one request per user intent) | §7.7, `LD-28`, `LD-29` | Auto-retry is the bug PRD §8.10 tests for |
| SCEN-ST-3-N9 | Empty name marks the row and blocks `Continue` | Step 2 with the seeded rows | 1. Clear Rina's `Full name` field | That row's name input gets `aria-invalid="true"` with an `aria-describedby` error, and `Continue` becomes disabled with the reason visible | §8.4, §8.8, §10 (validation), `LD-10` | Per-row validation error — engineer-designed state |
| SCEN-ST-3-N10 | Whitespace-only name is treated as empty | Step 2 with the seeded rows | 1. Replace Rina's name with three spaces | The row is marked invalid and `Continue` is disabled | §8.4 | Trimmed before checking |
| SCEN-ST-3-N11 | Malformed email marks the row | Step 2 with the seeded rows | 1. Set Budi's email to `budi.santoso@example` | That email input gets `aria-invalid="true"` with an associated message; `Continue` is disabled | §8.4, §8.8 | Domain must contain a dot with non-empty parts |
| SCEN-ST-3-N12 | Duplicate emails mark both colliding rows | Step 2 with the seeded rows | 1. Set Budi's email to `  Rina.Halim@Example.test ` | Both row 1 and row 2 are marked as colliding, and `Continue` is disabled with the reason visible | §8.4, §10 row 8, `docs/prompt.md` §7.8, `LD-26` | Marking is local; server `details.recipient_indexes` only reconciles |
| SCEN-ST-3-N13 | Non-numeric count keeps the previous value | Step 2 with Rina at 2 | 1. Type `abc` into Rina's signature input | The committed numeric value stays `2`; nothing renders as `NaN`, `undefined` or blank in the totals | §8.3, §10 row 9, `docs/prompt.md` §4 fact 7 | The mockup's `parseCount(raw, previous)` mechanism |
| SCEN-ST-3-N14 | Decimal count keeps the previous value | Step 2 with Rina at 2 | 1. Type `2.5` into Rina's signature input | The committed numeric value stays `2`; totals never show a fractional signature count | §8.3, §10 row 9 | Integer-only |
| SCEN-ST-3-N15 | Zero is clamped up to the minimum | Step 2 with Rina at 2 | 1. Type `0` into Rina's signature input and blur | The value becomes `1` | §8.3, §10 row 9 | `clampSignatureCount` is the FE-only coercing function |
| SCEN-ST-3-N16 | Negative input is clamped up to the minimum | Step 2 with Rina at 2 | 1. Type `-1` into Rina's signature input and blur | The value becomes `1` | §8.3, §10 row 9 | Never negative, never `NaN` |
| SCEN-ST-3-N17 | Above-maximum input is clamped down to 20 | Step 2 with Rina at 2 | 1. Type `25` into Rina's signature input and blur | The value becomes `20` | §8.3, §6 | Range is 1-20 |
| SCEN-ST-3-N18 | Clearing the box mid-typing never produces `NaN` | Step 2 with Rina at 2 | 1. Select all in Rina's signature input and delete | The raw box may be visually empty, but the committed numeric value stays `2` and the totals remain numeric | §8.3, `docs/prompt.md` §4 fact 7 | The `countRaw` field is why this holds |
| SCEN-ST-3-N19 | `−` at the minimum does not go below 1 | Step 2 with a row at `signature_count` 1 | 1. Click that row's `−` button | The value stays `1` | §8.3 | At-min state of the signature stepper |
| SCEN-ST-3-N20 | Over-quota panel clamps remaining at 0 | Step 2 with the seeded 3 signatures | 1. Add two recipients at 3 signatures each (total 9) | Remaining quota reads `0` (never `-1`) and the message `9 of 8 signatures — 1 over your quota` is visible | §8.7, §10 row 7, `LD-17` | Over-quota banner — engineer-designed state |
| SCEN-ST-3-N21 | Over-quota disables `Continue` with an associated reason | Step 2 totalling 9 signatures against quota 8 | 1. Inspect `Continue` | It is `disabled` and its `aria-describedby` points at the over-quota message | §8.8, §10 row 7, `docs/prompt.md` §7.7, `LD-17` | Reason is on screen, not hidden |
| SCEN-ST-3-N22 | Forced over-quota request surfaces the server code | Step 2 totalling 9 signatures; the disabled `Continue` is bypassed so the request is actually sent | 1. Submit and wait for the `422` | The UI renders `INSUFFICIENT_SIGNATURE_QUOTA` with its message; the summary is **not** relabelled server-confirmed | §8.9, §10 row 7, `LD-13` | Matches `SCEN-ST-2-N23` at the HTTP layer |
| SCEN-ST-3-N23 | Two simultaneous blockers both stay visible | Step 2 with a duplicate email **and** a total of 9 signatures | 1. Inspect the page | Both the duplicate-row marking and the over-quota message are visible at once, and `Continue` is disabled | §8.8, §8.11, `LD-17` | Reasons are not collapsed into one generic message |
| SCEN-ST-3-N24 | A stale preview response never becomes the active result | Step 2 with a preview request in flight for the seeded list | 1. Change Rina's signature count while that request is still pending<br>2. Let the first (now stale) response arrive | The stale response is discarded: the panel never shows figures computed for the old list | §8.10, §10 row 12, `docs/prompt.md` §7.12, `LD-28` | Monotonic `requestSeq` + `AbortController` |
| SCEN-ST-3-N25 | Out-of-order responses resolve to the newest | Step 2; preview request A (seq 1) and request B (seq 2) are both in flight | 1. Let B resolve first, then let A resolve | The panel shows B's figures and keeps them; A's late response is dropped | §8.10, §10 row 12, `LD-29` | Interleaved deterministically via an injected transport |
| SCEN-ST-3-N26 | Editing a recipient invalidates the prior server result | Step 2 where a `200` preview has already been applied and labelled server-confirmed | 1. Change Budi's email | The server-confirmed labelling is dropped and the panel falls back to the local estimate | §8.9, §8.10, `docs/prompt.md` §4 fact 12 | Any change invalidates the previous server answer |
| SCEN-ST-3-N27 | Preview timeout at 10 s keeps typed values | Step 2 with a valid list; the preview endpoint never responds | 1. Click `Continue` and wait past 10 s | The request aborts, an inline retryable error `Could not reach the server — try again` appears, and every typed name/email/count is unchanged | §8.11, `LD-28`, `LD-29` | 10 s for preview vs 60 s for upload |
| SCEN-ST-3-N28 | Preview `500` offers user-driven retry only | Step 2 with a valid list; the preview endpoint returns `500` | 1. Click `Continue` and wait | An error banner with a `Try again` control appears; no request is retried automatically | §8.11, `LD-29` | `role="alert"` so the reason is announced |
| SCEN-ST-3-N29 | Retry after a preview failure keeps the list | A preview just failed; the endpoint now returns `200` | 1. Click `Try again` | The preview succeeds and the server-confirmed figures appear; no typed value was lost | §8.11, `LD-29` | Retry without losing what was typed |
| SCEN-ST-3-N30 | `404` after the envelope evaporates | Step 2 with a valid list; the server was restarted so the envelope no longer exists | 1. Click `Continue` | The UI surfaces the `ENVELOPE_NOT_FOUND` failure and directs the user to re-upload; it does not silently show a stale total | §9, §10 row 11, `LD-03`, `LD-21`, `ADR-002` | In-memory store; restart is a full erasure |
| SCEN-ST-3-N31 | `Save as draft` is inert | Step 2 is shown | 1. Inspect and then activate `Save as draft` | It is `disabled` with `aria-disabled="true"` and the visible text `Not available in this exercise`; activating it changes nothing | §3, `LD-05` | Not a dead control that appears to work |
| SCEN-ST-3-N32 | The locked Step 3 pill is not navigable | Any step is shown | 1. Click pill `3 Place fields`<br>2. Try to reach it with Tab and press Enter | Nothing happens: no view change, no URL change, no new panel; the pill is never focused | §3, §4, `LD-02`, `ADR-005` | No route, no reducer, no scaffold behind it |
| SCEN-ST-3-N33 | No Step 3 surface exists anywhere else in the UI | The app is running | 1. Walk Step 1 and Step 2 in full | The only mentions of Step 3 are the locked pill and the Step 2 success note; no field-placement control, palette or canvas is reachable | §3, §4, `ADR-005` | Matches the `grep -ril "place.fields"` gate in §Verification Plan |
| SCEN-ST-3-N34 | Price and quota are absent from the bundle | A production build of `apps/web` is served | 1. Load the app **without** uploading anything and inspect the served JS for `5000` / quota constants | No price or quota constant is present; the summary panel cannot render figures before the `201` body arrives | §5, `ADR-003` | Browser-observable half of the trust-boundary invariant |

---

## Traceability — PRD §10 acceptance rows (the coverage floor)

PRD `test_1_en.md` §10 contains **12** acceptance rows. **12 of 12 are covered.** No row is uncovered.

| # | PRD §10 scenario | Required outcome | Covering scenario IDs |
|---|---|---|---|
| 1 | Upload `agreement-vendor-2026.pdf` | `201`, card shows `8 pages`, `Continue` enabled | SCEN-ST-2-P2, SCEN-ST-3-P8, SCEN-ST-3-P10 |
| 2 | Upload `.exe` or `.pdf.exe` | Rejected by FE **and** BE with `FILE_TYPE_NOT_ALLOWED` | SCEN-ST-1-N1, SCEN-ST-1-N2, SCEN-ST-2-N2, SCEN-ST-2-N3, SCEN-ST-3-N1, SCEN-ST-3-N4 |
| 3 | Filename `../../etc/passwd.pdf` | Sanitized basename, no path components | SCEN-ST-2-P3 |
| 4 | Filename `<img src=x onerror=alert(1)>.pdf` | Rendered as text, no script execution | SCEN-ST-2-P4, SCEN-ST-3-P29 |
| 5 | A very large file (e.g. 300 MB) | Server-enforced defined limit, recorded as an assumption | SCEN-ST-2-N4, SCEN-ST-2-N5, SCEN-ST-3-N2, SCEN-ST-3-N3 |
| 6 | Rina 2 + Budi 1 | `total_signatures` 3, `total_charge` `"15000.00"`, remaining 5 | SCEN-ST-2-P5, SCEN-ST-3-P16, SCEN-ST-3-P27, SCEN-ST-1-N6 |
| 7 | Add 2 recipients @3 each (total 9) | `Continue` disabled with visible reason; forced → `422 INSUFFICIENT_SIGNATURE_QUOTA` | SCEN-ST-3-N20, SCEN-ST-3-N21, SCEN-ST-3-N22, SCEN-ST-2-N23 |
| 8 | `  Rina.Halim@Example.test ` + `rina.halim@example.test` | `422 DUPLICATE_RECIPIENT_EMAIL`; FE marks colliding rows | SCEN-ST-2-N22, SCEN-ST-3-N12, SCEN-ST-1-N5 |
| 9 | `signature_count` `0`, `-1`, `2.5`, `abc`, empty | Clamped/rejected, never `NaN`, BE `422 SIGNATURE_COUNT_INVALID` | SCEN-ST-2-N13, SCEN-ST-2-N14, SCEN-ST-2-N15, SCEN-ST-2-N16, SCEN-ST-2-N17, SCEN-ST-3-N13, SCEN-ST-3-N14, SCEN-ST-3-N15, SCEN-ST-3-N16, SCEN-ST-3-N18, SCEN-ST-1-N4 |
| 10 | Payload adds `"total_charge":"1.00"` or `"quota":{"signature":99}` | `422 UNKNOWN_FIELD`; client values never used | SCEN-ST-2-N25, SCEN-ST-2-N26, SCEN-ST-2-N27, SCEN-ST-3-P26 |
| 11 | `charge-preview` against `env_999` | `404` | SCEN-ST-2-N9, SCEN-ST-3-N30 |
| 12 | Recipients changed while a preview is pending | Older response must not become the active result | SCEN-ST-3-N24, SCEN-ST-3-N25, SCEN-ST-3-N26 |

---

## Traceability — `docs/prompt.md` §7 Success Criteria (binding, 15 rows)

**12 of 15 rows are covered by E2E scenarios. 3 rows are flagged as NOT coverable by a browser-level scenario** — they are test-evidence and checkpoint obligations, not runtime behaviour. They are named explicitly rather than silently dropped.

| §7 row | Criterion | Covering scenario IDs | Status |
|---|---|---|---|
| 1 | `agreement-vendor-2026.pdf` → `201`, `8 pages`, `Continue` enabled | SCEN-ST-2-P2, SCEN-ST-3-P8, SCEN-ST-3-P10 | Covered |
| 2 | `.exe` / `.pdf.exe` rejected by FE and BE | SCEN-ST-1-N1, SCEN-ST-1-N2, SCEN-ST-2-N2, SCEN-ST-2-N3, SCEN-ST-3-N1, SCEN-ST-3-N4 | Covered |
| 3 | `../../etc/passwd.pdf` → sanitized basename | SCEN-ST-2-P3 | Covered |
| 4 | `<img src=x onerror=alert(1)>.pdf` renders as text | SCEN-ST-2-P4, SCEN-ST-3-P29 | Covered |
| 5 | 300 MB handled per a server-enforced limit | SCEN-ST-2-N4, SCEN-ST-2-N5, SCEN-ST-3-N3 | Covered (the "recorded in `docs/decisions.md`" clause is a doc obligation, not an E2E assertion — see gap G-2) |
| 6 | Rina 2 + Budi 1 → 3 / `"15000.00"` / 5 | SCEN-ST-2-P5, SCEN-ST-3-P16, SCEN-ST-3-P27 | Covered |
| 7 | Total 9 over quota disables `Continue`; forced → `422` | SCEN-ST-3-N20, SCEN-ST-3-N21, SCEN-ST-3-N22, SCEN-ST-2-N23 | Covered |
| 8 | Padded case-variant duplicate → `422 DUPLICATE_RECIPIENT_EMAIL`, FE marks rows | SCEN-ST-2-N22, SCEN-ST-3-N12 | Covered |
| 9 | `signature_count` `0` / `-1` / `2.5` / `"abc"` / empty | SCEN-ST-2-N13…N17, SCEN-ST-3-N13…N18, SCEN-ST-1-N4 | Covered |
| 10 | Unknown field → `422 UNKNOWN_FIELD`, client values unused | SCEN-ST-2-N25, SCEN-ST-2-N26, SCEN-ST-3-P26 | Covered |
| 11 | `env_999` → `404` | SCEN-ST-2-N9, SCEN-ST-3-N30 | Covered |
| 12 | Stale preview never becomes the active result | SCEN-ST-3-N24, SCEN-ST-3-N25, SCEN-ST-3-N26 | Covered |
| 13 | Cost-calculation tests (exact decimals incl. quota boundary) run with real output saved | Behaviour edge covered by SCEN-ST-1-P5, SCEN-ST-1-P9, SCEN-ST-2-P7, SCEN-ST-2-P10 | **Not fully coverable at E2E level** — see gap G-1 |
| 14 | Validation-module tests run with real output saved | Behaviour edge covered by the ST-1 / ST-2 negative rows | **Not fully coverable at E2E level** — see gap G-1 |
| 15 | `case-1` commit, README-runnable app, real output in `docs/verification.md`, specific gap list | SCEN-ST-2-P1 covers the README's `curl` health check only | **Not coverable at E2E level** — see gap G-3 |

---

## Rules for row content — conformance notes

Checked against `references/scenario-md-template.md` before this file was written:

- **One assertion per row.** Multi-observable actions are split: card content (`SCEN-ST-3-P8`), remove-button label (`SCEN-ST-3-P9`) and `Continue` enablement (`SCEN-ST-3-P10`) are three rows for the same upload, not one. Totals are split into the per-row `Charge` cell (`SCEN-ST-3-P18`) and the aggregate (`SCEN-ST-3-P17`).
- **`Given` is concrete.** Every `Given` names the view (Step 1 / Step 2 / HTTP-only), the data state (seeded rows, `env_01` present, store empty, server restarted) and any stubbed transport.
- **`When` is one action**, expressed as numbered steps; a second step appears only where the assertion is inherently about ordering (stale-response interleaving, replace-on-reupload, retry).
- **`Then` is observable.** UI rows assert what a user sees or can interact with. HTTP rows assert status code, `error.code`, `details` and exact body values from PLAN.md's OpenAPI block — never internal state.
- **Every story has N rows.** ST-1: 6, ST-2: 34, ST-3: 34. Negatives cover invalid input, wrong file type, oversize, missing field, malformed email, duplicates, zero recipients, unknown field, `404`, malformed JSON, oversize JSON, restart-erasure, timeouts, network drop, `500`, out-of-order/stale responses, over-quota, and inert out-of-scope controls.
- **No permission/auth negatives exist** — there is no authentication anywhere in this feature (PRD §5, PLAN.md §Out-of-Scope). Stating that explicitly is required by the skill's sad-path discipline; inventing `401`/`403` rows would be fiction.
- **No NFR-latency negatives beyond the two client timeouts** — the brief states no latency, throughput or availability SLO (`prd-verify-report.md` row 4 note). The only numeric time thresholds that exist are `LD-28`'s 10 s preview and 60 s upload timeouts, both catalogued (`SCEN-ST-3-N7`, `SCEN-ST-3-N27`).
- **No code in this catalog.** Test generation is downstream (`e2e-test`, mode generate-playwright).

---

## Coverage summary and open gaps

| Metric | Value |
|---|---|
| Stories | 3 (`ST-1`, `ST-2`, `ST-3`) |
| Scenarios total | 106 |
| Positive (`P`) | 42 — ST-1: 9, ST-2: 10, ST-3: 23 |
| Negative / edge (`N`) | 64 — ST-1: 6, ST-2: 34, ST-3: 34 |
| PRD §10 acceptance rows | 12 of 12 covered |
| `docs/prompt.md` §7 success criteria | 12 of 15 covered by E2E rows; 3 flagged below |
| `{TBD}` placeholders | none |

**Gaps, stated rather than hidden:**

- **G-1 — `docs/prompt.md` §7 rows 13 and 14 (minimum-tests obligations, PRD §11).** These require that unit suites for cost calculation and the validation module are *run with real output saved*. That is a repo/test-evidence obligation, not a browser-observable behaviour, so no E2E row can discharge it. The underlying *behaviours* are catalogued (exact decimals: `SCEN-ST-1-P5`, `SCEN-ST-2-P10`; quota boundary: `SCEN-ST-1-P9`, `SCEN-ST-2-P7`; validation matrix: the ST-1/ST-2 negative rows). The evidence itself is produced by `ST-1.2`-`ST-1.6` and `ST-3.8` into `docs/evidence/*.txt` and `docs/verification.md` per PLAN.md §Verification Plan.
- **G-2 — the "recorded as an assumption in `docs/decisions.md`" clause of PRD §10 row 5.** The 25 MB limit's *enforcement* is covered (`SCEN-ST-2-N4`, `SCEN-ST-2-N5`); the *documentation* of it is a deliverable check owned by `ST-1.7` (`LD-01`, `LD-09`), not an E2E assertion.
- **G-3 — `docs/prompt.md` §7 row 15 (checkpoint row).** `case-1` commit/tag existence, clean-checkout runnability, saved test output and the specific gap list are process and deliverable checks (PRD §12, §14; `LD-06`, `LD-09`). Only the README's health-check command is E2E-observable (`SCEN-ST-2-P1`).
- **G-4 — drag-and-drop on the dropzone is not catalogued.** PRD §7.1 makes it optional provided it is named in the gap list, and `LD-19` classifies it NICE-TO-HAVE and first to be dropped. Only the `input[type=file]` path is catalogued (`SCEN-ST-3-P6`). If drag-and-drop ships, add `SCEN-ST-3-P31`+ rather than renumbering.
- **G-5 — no DOM-interaction test harness is committed** (`LD-32`: state/controller tests are the primary evidence, plus a manual browser pass). Every `ST-3` row in this catalog is therefore discharged **either** by a future Playwright run **or** by the manual browser pass recorded in `docs/verification.md`. Which of the two discharged a row must be stated there.
- **G-6 — `INTEGRATION_SCENARIO.md` is intentionally absent.** Scope for this run is e2e-only. Service-level rows (in-memory store behaviour, composition-root wiring, request-logger output) have no catalog of their own; the `ST-2` rows above cover the same surface through real HTTP instead. Run `scenario-cataloguer` with scope `integration-only` if a service-level catalog is later wanted.
- **G-7 — PLAN.md §Out-of-Scope line records that `SCENARIO.md` was skipped at upstream Step 5.** That line is now stale (this file exists, produced by a standalone run). PLAN.md was deliberately **not** modified to fix it — correcting it is the plan owner's edit to make.
