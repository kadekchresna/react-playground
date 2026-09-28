<!-- CLASSIFICATION: INTERNAL -->

# Fullstack L3 Interview — Case 1: Upload document & set recipients
---
## PART A — CANDIDATE BRIEF

### 1. Goal and time limit

Build a small web application: the **Upload document → Set recipients** flow for sending a document out for digital signature. This is a self-contained simulation inspired by the Mekari Sign domain. **All data, prices, quotas, and rules below are fictional** and do not represent any production API. You need no access to any Mekari repository or service.

Total coding session: **70 minutes**.

- **Minutes 0–24: Case 1** (this file) — clarification, planning, implementation, tests, checkpoint.
- **Minutes 24–70: Case 2** — a requirement change on the same codebase, handed to you exactly at minute 24.

Weighting: **Case 1 = 30%, Case 2 = 70%.** What we assess most is how you absorb change, not how fast you type the initial feature.

Time is **not extended** if case 1 is unfinished. Whatever is incomplete simply has to be stated specifically.

### 2. Using an AI coding agent is mandatory

You **must** use an AI coding agent that can read/write files and run commands (Claude Code, Codex, Cursor/Windsurf agent mode, or another agentic IDE). A chatbot that only produces snippets for you to paste **does not meet the format of this test**.

What is assessed is not the number of prompts or how expensive your model is, but: that you plan before prompting, curate context deliberately, use review-style prompts to make the agent critique its own output, **verify** what it produces, and switch to hand-editing when prompting stops paying off.

You still own the code. "The AI wrote it" is not an accepted explanation for a bug, a security hole, or a claimed test that was never run.

### 3. Visual reference

Open `Upload & Recipients Mockup.html` in a browser. It contains 3 boards:

| Board | Status in case 1 |
| --- | --- |
| Step 1 — Upload document | **In scope** |
| Step 2 — Set recipients | **In scope** |
| Step 3 — Place fields | **Not part of case 1.** Do not start it now; doing it early earns nothing. |

The mockup is a **reference for structure and content**, not a pixel-perfect target. **Not assessed:** exact colours/spacing, animation, fonts, identical icons. Any UI kit is fine.

What you must take from the mockup:

- A 2-step stepper: "Upload document" → "Set recipients".
- Step 1: a dropzone reading `Drop your file here or Browse`, the helper text `One document per request. PDF, JPG, JPEG, PNG, DOC or DOCX.`, a "Your document" card showing the filename + `Uploaded · {n} pages · {size}` + a remove button, and a `Continue` button.
- Step 2: the heading `Who signs it?`, recipient rows with the columns **Full name | Email address | Signatures (− [n] +) | Charge | remove button**, an `Add signer` button, a summary panel showing `{total} signatures × {price} per signature` and `Total charge`, and the footer `Back` / `Save as draft` / `Continue`.
- `From cloud` and `Save as draft` are **out of scope**: remove them, or render them disabled with an explanation. Do not leave them as dead controls that appear to work.

### 4. Environment and scope

- Any frontend/backend stack. There is no bonus for matching Mekari's stack.
- **The frontend must talk to a real HTTP backend.** A single-process fullstack framework is fine, but business rules must not live only in the browser.
- Technical review focus: **frontend ±60%, backend ±40%**.
- Storage may be in-memory. A database is not required.
- **Out of scope (both cases):** parsing/rendering PDF content, affixing signatures or duty stamps to a file, e-meterai/PKI provider integration, payments, email/notifications, SSO, deployment, mobile apps.
- **Out of scope for case 1 only:** the Step 3 board.
- Runtime setup, dependency installation, and agent checks happen **before the timer**. An empty generic skeleton may be prepared in advance. Domain features, seed data, and the tests for this exercise are written after the timer starts.

### 5. Demo account and data

- The app uses **a single demo account with no login**. No authentication is needed, and there is no multi-tenancy in this test.
- Price and quota belong to that demo account and are **known only to the server** (§6, §9).
- **Do not put secrets, tokens, or real personal data** in source, the frontend bundle, logs, or any document. Use the `@example.test` fixture emails; if you need a `.env`, fill it with values that are obviously dummy.

### 6. Fixtures

Currency is IDR. **Every monetary value in the API contract is a decimal string with 2 fraction digits** (`"5000.00"`), never a JSON number. There is no tax, discount, cash balance, or intermediate rounding.

| Constant | Value |
| --- | --- |
| Price per signature | `"5000.00"` |
| Signature quota | `8` |
| Max recipients per document | `10` |
| Signature count per recipient | integer `1`–`20` |
| Allowed file extensions | `pdf`, `jpg`, `jpeg`, `png`, `doc`, `docx` (case-insensitive) |
| Max filename length | `200` characters after sanitization |

**Page count is not derived from file content.** The server uses the following fixture table keyed by the sanitized filename (case-insensitive); any other name yields `1`:

| Filename | page_count |
| --- | ---: |
| `agreement-vendor-2026.pdf` | 8 |
| `nda-partner.pdf` | 3 |
| `berita-acara.docx` | 1 |

Initial recipients (if you seed them, use exactly these):

| Name | Email | Signatures |
| --- | --- | ---: |
| Rina Halim | rina.halim@example.test | 2 |
| Budi Santoso | budi.santoso@example.test | 1 |

### 7. Requirements — Step 1: Upload document

1. Provide a dropzone and an `input[type=file]` to select **exactly one** document. File drag-and-drop is optional; if you skip it, put it in your gap list.
2. Validate on the frontend before sending, with a specific error message per cause — not one generic message.
3. Send the file to the backend. **The backend must re-validate every one of those rules.** Frontend validation is UX only; the decision belongs to the server.
4. On success, show the "Your document" card: filename, `Uploaded · {page_count} pages · {size}`, and a remove button whose `aria-label` names the file.
5. Remove returns the page to its empty state. Uploading a second file **replaces** the first; files do not accumulate.
6. `Continue` is disabled until a valid document exists, with the reason visible to the user.
7. Show a loading state during upload, and an error state that can be retried without losing page context.
8. **The filename is untrusted input.** The server sanitizes it before storing/returning: strip path components (`/`, `\`, `..`), reject or normalize anything that is not a bare basename, and cap the length. The frontend renders the filename **as text**, never as HTML.
9. The extension is judged from the **sanitized filename**, not from the client's `Content-Type`.
10. File content does not need to be stored permanently. You may discard it after validation and keep only metadata. Record this decision in the README.

### 8. Requirements — Step 2: Set recipients

1. Render recipient rows with the columns from the mockup. Minimum 1, maximum 10.
2. `Add signer` appends an empty row (`signature_count` defaults to `1`). The remove button deletes a row.
3. The `−`/`+` stepper and the number input change `signature_count`, clamped to `1`–`20`. Non-numeric, empty, decimal, or negative input must never leave the state as `NaN`/`undefined`.
4. Per-recipient validation:
   - Name required, whitespace trimmed, non-empty after trimming.
   - Email required and valid. Minimum rule: trim, exactly one `@`, non-empty local part, domain containing a dot with non-empty parts on both sides. Full RFC compliance is not needed.
   - **Duplicate emails within one document are rejected**, compared after trimming and **case-insensitively**.
5. Validation is written **once as a reusable module** and used by both frontend and backend (duplicating the rules across languages is fine, as long as there is one clear source of truth and both are tested). Do not scatter validation `if`s inside UI components.
6. **All totals are derived state.** The per-row `Charge`, total signatures, and `Total charge` are computed from the recipient list; do not store them as separate state that has to be kept in sync. The calculation functions must be **pure** and testable without rendering a component.
7. The summary panel shows total signatures, unit price, `Total charge`, and the remaining signature quota.
8. `Continue` is disabled when there is a validation error **or** when total signatures exceed the quota. The reason is visible on screen, not hidden.
9. `Continue` calls the backend for the **authoritative total**. The server's total is the final answer; the frontend number is only a responsive estimate. Case 1 changes no quota.
10. Any change to recipient data invalidates the previous server result. **A late response from an older request must never surface as the result for newer data.**
11. Handle: empty list, empty name/email, duplicate email, insufficient quota, failed request, slow request. Offer retry without losing what was typed.
12. Accessibility: every input has an associated `<label>`, icon buttons have an `aria-label`, keyboard focus is visible. **Responsive layout is not assessed** — desktop only is fine.

### 9. Backend contract

Equivalent endpoints are allowed as long as they are mapped in the README. The objects below show the **required fields**; adding more is fine.

#### `POST /api/envelopes` — multipart, field `file`

Success `201`:

```json
{
  "envelope_id": "env_01",
  "document": { "filename": "agreement-vendor-2026.pdf", "size_bytes": 1468006, "page_count": 8 },
  "price": { "signature": "5000.00" },
  "quota": { "signature": 8 }
}
```

Failure `422`, in a shape the UI can render:

```json
{ "error": { "code": "FILE_TYPE_NOT_ALLOWED", "message": "File type is not supported" } }
```

Required error codes, at minimum: `FILE_REQUIRED`, `FILE_TYPE_NOT_ALLOWED`, `FILENAME_INVALID`. Adding more codes is fine; every code you add must have a rationale you can explain.

#### `POST /api/envelopes/:id/charge-preview`

Business input, **only**:

```json
{
  "recipients": [
    { "name": "Rina Halim",   "email": "rina.halim@example.test",  "signature_count": 2 },
    { "name": "Budi Santoso", "email": "budi.santoso@example.test", "signature_count": 1 }
  ]
}
```

Success `200`:

```json
{
  "recipient_count": 2,
  "total_signatures": 3,
  "price": { "signature": "5000.00" },
  "charges": { "signature": "15000.00" },
  "total_charge": "15000.00",
  "quota": { "signature": 8 },
  "quota_remaining": { "signature": 5 }
}
```

Server rules:

- **The server sources price and quota from its own side.** Price/total/quota sent by the client are never used; unknown input fields produce `422 UNKNOWN_FIELD` rather than being silently accepted.
- `recipients` must be an array of 1–10 objects → otherwise `422 RECIPIENT_COUNT_INVALID`.
- `signature_count` must be an integer 1–20 → otherwise `422 SIGNATURE_COUNT_INVALID`.
- Invalid name/email → `422 RECIPIENT_INVALID`. Duplicate email (case-insensitive, after trimming) → `422 DUPLICATE_RECIPIENT_EMAIL`.
- Total signatures > quota → `422 INSUFFICIENT_SIGNATURE_QUOTA`.
- An unknown envelope → `404`.
- Validation order: payload shape → envelope exists → per-recipient validation → duplicates → quota.
- **All calculation and business rules live in a service/use-case layer separate from the HTTP handler.** The handler only parses, calls the service, and maps the result to HTTP.
- **Money uses a decimal type or integers scaled by 100 with string conversion.** Never use binary floats for money. The frontend follows the same exact rules; display may be `Rp15.000,00`.
- If you use a database, queries must be parameterized/ORM-based. If in-memory, note in the README that SQL injection is not yet relevant but input validation is still performed.

### 10. Case 1 acceptance

| Scenario | Required outcome |
| --- | --- |
| Upload `agreement-vendor-2026.pdf` | `201`, the card shows `8 pages`, `Continue` becomes enabled |
| Upload `.exe` or `.pdf.exe` | Rejected by the FE **and** the BE with `FILE_TYPE_NOT_ALLOWED` |
| Filename `../../etc/passwd.pdf` | The server stores/returns a sanitized basename; no path components |
| Filename `<img src=x onerror=alert(1)>.pdf` | Rendered as text; no script execution |
| A very large file (e.g. 300 MB) | Behaviour follows the limit **you** define. Whatever that limit is, it must be enforced **on the server**, not only in the browser, and recorded as an assumption in `docs/decisions.md` |
| Rina 2 + Budi 1 | `total_signatures` 3, `total_charge` `"15000.00"`, remaining quota 5 |
| Add 2 recipients @3 each (total 9) | `Continue` disabled with a visible reason; if forced through → `422 INSUFFICIENT_SIGNATURE_QUOTA` |
| Emails `  Rina.Halim@Example.test ` + `rina.halim@example.test` | `422 DUPLICATE_RECIPIENT_EMAIL`; the FE marks the colliding rows |
| `signature_count` set to `0`, `-1`, `2.5`, `abc`, empty | Clamped/rejected; state never becomes `NaN`; BE returns `422 SIGNATURE_COUNT_INVALID` |
| Payload adds `"total_charge":"1.00"` or `"quota":{"signature":99}` | `422 UNKNOWN_FIELD`; client values are never used |
| `charge-preview` against an envelope that does not exist (e.g. `env_999`) | `404` |
| Recipients changed while a preview is pending | The older response must not become the active result |

### 11. Minimum tests for case 1

Two categories, **run, with the output saved**:

1. **Cost calculation functions** — exact decimals, including the quota boundary.
2. **Input validation module** — empty name, invalid email, case-insensitive duplicates, `signature_count` out of range, filename sanitization, rejected extensions.

UI tests may be interaction tests **or** state/controller tests accompanied by a manual demo proving the UI is actually wired up. **Do not** test only the happy path, and do not copy your implementation's output into the expected value.

### 12. Deliverables

Short and factual. They may be filled in progressively across both cases. **Long documentation earns nothing** and eats your own time.

| Artifact | Required content | Reasonable size |
| --- | --- | --- |
| `README.md` | Install/run/test commands, port, endpoint mapping if it differs from this brief | ≤ 15 lines |
| `AGENTS.md` (or equivalent) | Folder map, entry points, validation commands, business invariants, input trust boundaries | ≤ 20 lines |
| `docs/decisions.md` | Clarifying questions + the answers, the plan written before coding, decisions & trade-offs, **assumptions you made on your own** | free-form, concise |
| `docs/verification.md` | Commands you ran + **actual output**, tests failed/passed, manual checks, what remains unverified | free-form, concise |
| Agent transcript | Export your agent transcript as-is. If your agent cannot export, create `docs/ai-log.md` with the key prompt excerpts | as-is |
| Source + lockfile + seed + tests | Runnable by a reviewer from a clean checkout; no `node_modules` or build artifacts | — |

### 13. How we expect you to work

1. **Before coding:** state your understanding and ask about product/UX decisions that are unclear. Record the answers or the assumptions you agreed on. This brief is **deliberately incomplete** in a few places — finding those and asking is part of the assessment. Do not re-ask rules that are already explicit.
2. **Write a short plan before your first implementation prompt.** A dedicated plan mode is not required; a written plan is.
3. Give the agent the relevant context, write tests for the core rules **before** implementing them, then run them and save the real output.
4. Ask the agent to review its own output for correctness, security, and edge cases. **Check its findings.** Hand-edit when that is more efficient, and say why.
5. Narrate trade-offs as you make important decisions — do not wait to be asked at the end.
6. **At minute 24:** give a short demo of what works, show the test results, state your gaps specifically, then create a commit or snapshot named `case-1`.

### 14. Minute-24 checkpoint

- [ ] Commit/snapshot `case-1`.
- [ ] A reviewer can run the app using the commands in the README.
- [ ] Actual test output saved in `docs/verification.md`.
- [ ] A specific gap list (feature name + why it is unfinished), not "some things are missing".

After the checkpoint you receive the requirement change and **continue on the same codebase**.
