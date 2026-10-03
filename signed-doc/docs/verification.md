# docs/verification.md

What was run, what it printed, what passed, and what is **not** verified.

- Scope of this document: written by `EPIC-1-ST-3` (the `apps/web` frontend). It records
  the workspace-wide gates as they actually ran, and it is honest about which rows it can
  and cannot discharge.
- Environment: node `v24.19.0`, pnpm `12.6.0`, macOS (darwin 25.6.0). Branch
  `feat/case-1-upload-and-recipients`.
- Sibling evidence, referenced by path and **not** inlined:
  - `docs/evidence/shared-tests.txt` — `packages/shared`, 113 tests (owner `EPIC-1-ST-1`).
  - `docs/evidence/server-tests.txt` — `apps/server`, 62 tests (owner `EPIC-1-ST-2`).
  - `docs/evidence/web-tests.txt` — `apps/web`, 144 tests (owner `EPIC-1-ST-3`), captured by
    this story with `--reporter=verbose`.

---

## 1. Commands run, with their actual output

### 1.1 Clean install

```
$ pnpm install --frozen-lockfile
Scope: all 4 workspace projects
✓ Lockfile passes supply-chain policies (verified 31m ago)
Lockfile is up to date, resolution step is skipped
Done in 27ms using pnpm v12.6.0
```

### 1.2 Workspace typecheck — **exit 0**

```
$ pnpm -r typecheck
packages/shared typecheck$ tsc --noEmit
packages/shared typecheck: Done
apps/server typecheck$ tsc --noEmit
apps/web typecheck$ tsc --noEmit
apps/server typecheck: Done
apps/web typecheck: Done
exit=0
```

### 1.3 Workspace tests — 319 passing across three packages

```
$ pnpm -r test
packages/shared test:  Test Files  5 passed (5)
packages/shared test:       Tests  113 passed (113)
apps/server test:  Test Files  4 passed (4)
apps/server test:       Tests  62 passed (62)
apps/web test:  Test Files  5 passed (5)
apps/web test:       Tests  144 passed (144)
```

Per-package raw output: `docs/evidence/shared-tests.txt`, `docs/evidence/server-tests.txt`,
`docs/evidence/web-tests.txt`.

### 1.4 Frontend suite, the story's own evidence

```
$ pnpm --filter @signed-doc/web test
 ✓ src/__tests__/upload-machine.test.ts (31 tests)
 ✓ src/__tests__/recipients-reducer.test.ts (41 tests)
 ✓ src/__tests__/preview-controller.test.ts (24 tests)
 ✓ src/__tests__/api-contract.test.ts (24 tests)
 ✓ src/__tests__/app-smoke.test.tsx (24 tests)

 Test Files  5 passed (5)
      Tests  144 passed (144)
```

Run three times consecutively for the `EPIC-1-ST-3.7` flake check; identical each time:

```
$ for i in 1 2 3; do pnpm --filter @signed-doc/web test 2>&1 | grep -E "^ +(Tests|Test Files)"; done
 Test Files  5 passed (5)
      Tests  144 passed (144)
 Test Files  5 passed (5)
      Tests  144 passed (144)
 Test Files  5 passed (5)
      Tests  144 passed (144)
```

The stale-response suite is deterministic by construction — an injected transport, no
`fetch`, no `setTimeout`, no wall-clock wait — so there is nothing in it for a scheduler to
reorder. The three runs confirm that rather than discovering it.

### 1.5 Production build

```
$ pnpm --filter @signed-doc/web build
$ tsc --noEmit && vite build
vite v6.4.3 building for production...
✓ 43 modules transformed.
dist/index.html                   0.60 kB │ gzip:  0.37 kB
dist/assets/index-CJtC_cnl.css    6.33 kB │ gzip:  1.93 kB
dist/assets/index-DWCCXGJ6.js   170.59 kB │ gzip: 55.19 kB
✓ built in 317ms
```

### 1.6 The app actually runs, and the frontend crosses a real process boundary

```
$ pnpm --filter @signed-doc/server start
{"msg":"listening","port":3001,"health":"http://localhost:3001/api/health"}

$ pnpm --filter @signed-doc/web dev
  VITE v6.4.3  ready in 168 ms
  ➜  Local:   http://localhost:5173/

$ curl -s -o /dev/null -w "index HTTP %{http_code}\n" http://localhost:5173/
index HTTP 200

$ curl -s http://localhost:5173/api/health      # through the Vite dev proxy
{"status":"ok"}
```

The `/api/health` body came back **through the Vite dev server**, so the browser origin and
the Express origin are genuinely separate processes (PRD §4).

---

## 2. Gates

### 2.1 ADR-003 — price and quota never reach the browser bundle

The plan's gate is `grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src`, and
its own `dod` allows "formatting fixtures in tests". Run verbatim it returns 69 matches, all
of which are test fixtures, JSDoc examples, or the error-code *name*. Rather than assert
that by eye, here is the same gate with tests and comments excluded:

```
$ grep -rn "5000\|SIGNATURE_QUOTA" packages/shared/src apps/web/src --include='*.ts' --include='*.tsx' \
    | grep -v "__tests__" | grep -vE ":[0-9]+:\s*(//|\*|/\*)"
packages/shared/src/errors.ts:21:  | 'INSUFFICIENT_SIGNATURE_QUOTA'
packages/shared/src/errors.ts:36:  'INSUFFICIENT_SIGNATURE_QUOTA',
```

Both remaining hits are the error-code identifier — a member of the shared vocabulary, not a
quota value. And the decisive check, on the artifact that actually ships:

```
$ grep -c "5000" apps/web/dist/assets/*.js
0
```

**Zero occurrences of the price in the built browser bundle.** The frontend learns price and
quota only from the `201` upload body.

### 2.2 ADR-005 — Step 3 is not scaffolded

```
$ grep -ril "place.fields" apps/web/src
apps/web/src/features/recipients/SummaryPanel.tsx
apps/web/src/components/Stepper.tsx
apps/web/src/__tests__/app-smoke.test.tsx
```

The `dod` names the first two: the locked pill and the Step 2 server-confirmed note. The
third is the test that asserts the pill is locked — a test, not a scaffold. There is no
`features/place-fields/` directory, no route, no reducer and no `TODO`.

### 2.3 LD-29 — zero automatic retries in the API layer

```
$ grep -rn "retry" apps/web/src/api | grep -vi "retryable\|no retry\|Zero retries\|automatic retry"
(no output)
```

Every `retry` token in `apps/web/src/api` is either the `retryable` flag or a comment saying
there is no retry loop. Retries are asserted absent behaviourally too: three tests count
`fetch` calls after a timeout, a network failure and a `500`, and each is exactly one.

### 2.4 XSS — the filename is never HTML

```
$ grep -rn "dangerouslySetInnerHTML\|innerHTML" apps/web/src
apps/web/src/features/upload/DocumentCard.tsx:10: * There is no `dangerouslySetInnerHTML` in this file, and none anywhere in
```

The only hit is the comment saying so. Asserted at render time in `app-smoke.test.tsx`: after
uploading `<img src=x onerror=alert(1)>.pdf`, the container's HTML contains `&lt;img` and
`container.querySelector('img')` is `null`.

---

## 3. Live acceptance pass against the real backend

`EPIC-1-ST-2` landed during this story, so these rows were driven against the **real Express
process**, not a stub.

### 3.1 Reproducible `curl` transcript (fresh server, empty store)

```
$ curl -s -F 'file=@agreement-vendor-2026.pdf' http://localhost:3001/api/envelopes
{"envelope_id":"env_01","document":{"filename":"agreement-vendor-2026.pdf","size_bytes":1400000,"page_count":8},"price":{"signature":"5000.00"},"quota":{"signature":8}}

$ curl -s -X POST -H 'content-type: application/json' \
    -d '{"recipients":[Rina 2, Budi 1]}' http://localhost:3001/api/envelopes/env_01/charge-preview
{"recipient_count":2,"total_signatures":3,"price":{"signature":"5000.00"},"charges":{"signature":"15000.00"},"total_charge":"15000.00","quota":{"signature":8},"quota_remaining":{"signature":5}}

$ ... same, but 9 signatures (over the quota of 8)
{"error":{"code":"INSUFFICIENT_SIGNATURE_QUOTA","message":"9 of 8 signatures - 1 over your quota"}}

$ ... same, but both rows resolve to one email (padded, mixed case)
{"error":{"code":"DUPLICATE_RECIPIENT_EMAIL","message":"Duplicate recipient email","details":{"recipient_indexes":[0,1]}}}

$ ... same, plus a client-proposed "total_charge"
{"error":{"code":"UNKNOWN_FIELD","message":"Unknown field is not accepted","details":{"field":"total_charge"}}}

$ curl -s -X POST ... http://localhost:3001/api/envelopes/env_999/charge-preview
{"error":{"code":"ENVELOPE_NOT_FOUND","message":"Envelope not found"}}
```

### 3.2 The frontend's OWN API layer against that server

Driven with `tsx`, importing `apps/web/src/api/upload.ts`, `apps/web/src/api/charge-preview.ts`
and `apps/web/src/format/money-display.ts` directly, so the numbers below were produced by
the shipped frontend code rather than transcribed.

```
[1] upload agreement-vendor-2026.pdf
  OK   {"envelope_id":"env_02","document":{"filename":"agreement-vendor-2026.pdf","size_bytes":1400000,"page_count":8},"price":{"signature":"5000.00"},"quota":{"signature":8}}
[2] upload ../../etc/passwd.pdf (path traversal)
  OK   {"filename":"passwd.pdf","size_bytes":1024,"page_count":1}
[3] upload <img src=x onerror=alert(1)>.pdf (XSS-shaped name)
  OK   {"filename":"<img src=x onerror=alert(1)>.pdf","size_bytes":1024,"page_count":1}
[4] upload invoice.pdf.exe
  FAIL status=422 code=FILE_TYPE_NOT_ALLOWED message="File type is not supported"
[5] charge-preview Rina(2) + Budi(1)
  OK   {...,"total_signatures":3,"total_charge":"15000.00","quota_remaining":{"signature":5},"rendered_total":"Rp15.000,00","rendered_price":"Rp5.000,00"}
[6] charge-preview quota boundary (8 signatures)
  OK   {"total_charge":"40000.00","rendered":"Rp40.000,00","quota_remaining":{"signature":0}}
[7] charge-preview over quota (9 signatures)
  FAIL status=422 code=INSUFFICIENT_SIGNATURE_QUOTA message="9 of 8 signatures - 1 over your quota"
[8] charge-preview duplicate email (padded, mixed case)
  FAIL status=422 code=DUPLICATE_RECIPIENT_EMAIL details={"recipient_indexes":[0,1]}
[9] charge-preview against env_999
  FAIL status=404 code=ENVELOPE_NOT_FOUND message="Envelope not found"
[10] charge-preview with signature_count "abc" (forced past the FE)
  FAIL status=422 code=SIGNATURE_COUNT_INVALID details={"recipient_index":0}
[11] raw body adding "total_charge" (bypassing the FE API layer)
  OK   {"status":422,"body":{"error":{"code":"UNKNOWN_FIELD","details":{"field":"total_charge"}}}}
[12] raw body adding "quota" (bypassing the FE API layer)
  OK   {"status":422,"body":{"error":{"code":"UNKNOWN_FIELD","details":{"field":"quota"}}}}
```

`FAIL` here means "the server rejected it, which is the expected outcome for that row" — it
is the label the script prints when the API layer raises an `ApiRequestError`.

**Caveat, stated rather than buried.** That driver script lives in a scratchpad directory
outside the repository and is not committed, so a reviewer cannot re-run it from a clean
checkout. The `curl` transcript in §3.1 covers the same wire rows and **is** reproducible.
Committing the driver as a test was rejected because it needs a live server on `:3001` and
would fail in any environment that does not have one.

---

## 4. `docs/prompt.md` §7 Success Criteria — row by row

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `agreement-vendor-2026.pdf` → `201`, card shows `8 pages`, `Continue` enabled | **PASS** | §3.1 (`page_count: 8` from the real server); `app-smoke.test.tsx` "renders the XSS-shaped filename as inert text and enables Continue" asserts `Uploaded · 8 pages · 1.4 MB` and `Continue.disabled === false` |
| 2 | `.exe` / `.pdf.exe` rejected by FE **and** BE with `FILE_TYPE_NOT_ALLOWED` | **PASS** | FE: `app-smoke.test.tsx` "rejects a bad extension in the browser…" — message shown, **zero** network calls. BE: §3.2 row [4] |
| 3 | `../../etc/passwd.pdf` → sanitized basename | **PASS** (server-side; FE just renders it) | §3.2 row [2] — `"filename":"passwd.pdf"` |
| 4 | `<img src=x onerror=alert(1)>.pdf` renders as text, no script | **PASS** | §2.4 — server returns the name intact (§3.2 row [3]) and the render test proves `&lt;img` with no `img` element |
| 5 | 300 MB handled per a defined, server-enforced limit | **PASS server-side / PARTIAL here** | The server's own suite covers it (`docs/evidence/server-tests.txt`). The FE pre-check is asserted only indirectly; **I did not send a 300 MB body from the frontend** |
| 6 | Rina 2 + Budi 1 → `3` / `"15000.00"` / remaining `5` | **PASS** | §3.1 and §3.2 row [5], including `formatIdr` → `Rp15.000,00`; `app-smoke.test.tsx` asserts the same figures on screen before and after `Continue` |
| 7 | Total 9 over quota disables `Continue` with a visible reason; forced → `422` | **PASS** | UI: `app-smoke.test.tsx` "disables Continue over quota…" — `9 of 8 signatures — 1 over your quota` is the `aria-describedby` text and remaining reads `0 of 8`. Forced: §3.2 row [7] |
| 8 | Padded case-variant duplicate → `422`, FE marks the colliding rows | **PASS** | FE: `app-smoke.test.tsx` "marks BOTH colliding rows…" — both email inputs get `aria-invalid="true"` from the LOCAL shared module, before any request. BE: §3.2 row [8] |
| 9 | `signature_count` `0` / `-1` / `2.5` / `"abc"` / empty — never `NaN`, BE `422` | **PASS** | FE: `recipients-reducer.test.ts` asserts a valid 1–20 integer over 13 hostile inputs and pins each settle value; `app-smoke.test.tsx` repeats it through the real input. BE: §3.2 row [10] |
| 10 | Unknown field → `422 UNKNOWN_FIELD`; client values never used | **PASS** | BE: §3.2 rows [11] and [12]. FE: `api-contract.test.ts` and `app-smoke.test.tsx` both assert the outgoing body's keys are exactly `recipients → name, email, signature_count` |
| 11 | `charge-preview` against `env_999` → `404` | **PASS** | §3.1, §3.2 row [9]; `preview-controller.test.ts` asserts the FE surfaces `ENVELOPE_NOT_FOUND` rather than leaving a stale total |
| 12 | Changing recipients while a preview is pending — older response never becomes the result | **PASS** | `preview-controller.test.ts`, 8 tests, deterministic (see §5) |
| 13 | Cost-calculation tests (exact decimals incl. the quota boundary) run, output saved | **PASS** (owner `EPIC-1-ST-1`) | `docs/evidence/shared-tests.txt`; the boundary is re-confirmed live in §3.2 row [6] (`"40000.00"`, remaining `0`) |
| 14 | Validation-module tests run, output saved | **PASS** (owner `EPIC-1-ST-1`) | `docs/evidence/shared-tests.txt` |
| 15 | `case-1` commit/snapshot, README-runnable app, real output here, specific gap list | **PARTIAL** | App runs from README commands (§1.6); this file carries real output; the gap list is §6. **The `case-1` tag was NOT created** — see G-1 |

### 4.1 The two UI-only rows called out separately

| Row | Verdict | Evidence |
|---|---|---|
| `Continue` gating with a visible reason (Step 1 and Step 2) | **PASS** | Both gates are asserted by resolving `aria-describedby` to the text actually in the DOM, not by checking the attribute exists. Step 1: `Upload a valid document to continue…`. Step 2: the full blocker list. A dedicated test puts a blank name and an over-quota total on screen at once and asserts **both** reasons are present — they are not collapsed into one generic message |
| Changing recipients while a preview is in flight | **PASS at controller level; PARTIAL in the UI** | The controller suite proves it exhaustively. `app-smoke.test.tsx` proves the UI half that is observable without timing control: after a `200` the panel is labelled `Server-confirmed`, and one click on `+` drops that label and falls back to the local estimate. **The out-of-order arrival itself was not driven through the mounted UI** |

---

## 5. How the staleness guard works, and how it was proved

Seam S5. `previewKey(envelopeId, recipients)` reduces the preview input — the envelope id
plus the `{name, email, signature_count}` triples, in order — to one canonical string. That
string is stored beside the result, and the result is reachable **only** through
`resultFor(key)`, which compares. The guard is therefore two-sided:

- **Write side.** Each request holds its own `AbortController`; issuing a new request or
  calling `syncKey` with a different payload aborts the previous one and clears the
  `#inFlight` slot. A response is accepted only if its own run object is still `#inFlight`,
  so a late arrival is dropped regardless of what the transport did with the abort signal.
- **Read side.** `RecipientsStep` computes the key each render and asks for that key's
  result. A result computed for any other payload is structurally unreachable from the
  render — not merely cleared by an effect that has to remember to run.

Key is the canonical form itself, not a fixed-width digest: a truncated digest can collide,
and a collision here would mean showing one payload's total against a different payload.

Proved by `preview-controller.test.ts` with an injected transport, no `fetch`, no
`setTimeout` and no wall-clock wait — the race is *constructed*, not raced for:

- two requests in flight, the **second** resolves first, then the first arrives late → the
  panel keeps `20000.00` and the stale `15000.00` is unreadable for either key;
- the stale one resolves **first** → it is dropped and the state stays `loading` for the new
  key;
- a stale **failure** cannot raise a banner over newer data;
- the superseded request's `AbortSignal` is asserted `aborted === true`, and exactly one
  un-aborted request exists at any time;
- a response arriving after a plain data change (no new request) is dropped;
- editing **back** to an already-answered payload restores that answer with no second
  request — the assertion that distinguishes a payload hash from a request counter.

`LD-28`'s single cancellation path is asserted in `api-contract.test.ts`: the signal `fetch`
receives is *not* the caller's signal (it is composed), and aborting the caller's signal
aborts it.

---

## 6. Gaps — named by feature and reason

- **G-1 — no `case-1` tag.** `EPIC-1-ST-3.8`'s `dod` asks for a `case-1` commit/tag. This
  story's brief explicitly says "Do not tag. Do not push." I followed the brief. Eight
  Conventional-Commits commits exist on `feat/case-1-upload-and-recipients`, one per
  subtask; whoever owns the checkpoint can tag the head.
- **G-2 — CLOSED at the integration gate.** Originally filed as "no real-browser pass",
  because no browser-automation tool was available to the story agent. It has since been
  run in Chrome against both live processes (`apps/server` on `:3001`, Vite on `:5173`,
  requests crossing the real dev-proxy boundary). See §9 below for the transcript. The
  jsdom `app-smoke.test.tsx` remains as the regression instrument; the browser pass is what
  proves the wiring. Still unverified even so: the `Browse` label opening a native OS file
  picker on Enter (the automation attaches to the `input[type=file]` directly, bypassing the
  picker), and drag-and-drop with a real `DataTransfer` — see G-6.
- **G-3 — the 300 MB / oversize path was not exercised from the frontend.** The server-side
  limit is covered by `docs/evidence/server-tests.txt`. The browser's UX-only pre-check
  (`UX_ONLY_MAX_UPLOAD_BYTES` in `App.tsx`) is exercised through `validateFileMeta`'s own
  tests, but **no oversize file was actually selected in the UI** and no 300 MB body was
  sent from `apps/web`.
- **G-4 — real timeouts were never waited out.** `LD-28`'s 10 s and 60 s deadlines are
  asserted with a 5 ms timeout in `api-contract.test.ts` and by injecting a timeout-shaped
  rejection into the controller. The constants `CHARGE_PREVIEW_TIMEOUT_MS = 10_000` and
  `UPLOAD_TIMEOUT_MS = 60_000` themselves are **read but never observed firing at their real
  values**.
- **G-5 — the out-of-order preview race was not driven through the mounted UI.** It is
  proved at the controller, which is where it lives (`LD-32` makes that the primary
  evidence), and the UI is proved to read through the guarded accessor. The end-to-end
  interleaving in a browser is not.
- **G-6 — drag-and-drop ships but is untested.** PRD §7.1 makes it optional provided it is
  named here. It is implemented in `Dropzone.tsx` (`onDragOver` / `onDrop`, first file only)
  and is **not covered by any test**. The `input[type=file]` path is the one that is proved.
- **G-7 — the §3.2 driver script is not in the repo.** See the caveat in §3.
- **G-8 — no `EnvelopeMeta` persistence across a page reload.** Reloading the browser loses
  the uploaded envelope and the user must re-upload. The server's store is in-memory too
  (`ADR-002`), so a server restart has the same effect; the UI surfaces the resulting `404`
  as `ENVELOPE_NOT_FOUND` rather than showing a stale total.

---

## 7. What I believe is weak

- **The jsdom smoke suite is the weakest load-bearing evidence in this story.** It carries
  every "does the UI actually do this" row, and jsdom is not a browser (G-2). If one thing
  here deserves a second look before this is graded, it is a five-minute manual pass through
  `pnpm dev` in a real browser.
- **Which field is invalid is inferred, not returned.** `validateRecipient` returns the first
  failure for a whole recipient, so `RecipientRow` isolates the field by re-running the
  shared rule against a probe holding the other fields known-good. That is sound and avoids
  duplicating a rule, but it is indirect: a future rule that couples name and email would
  break the isolation silently. A per-field entry point in the shared module would be
  sturdier.
- **`SET_COUNT_RAW` deliberately does not clamp while typing.** An out-of-range but parseable
  value holds the previous number until blur, so typing `25` on the way to `2` does not snap
  the cursor. The number is never invalid and blur always settles it, but for a moment the
  text on screen and the number in the totals disagree. That is a considered trade-off, not
  an oversight; it is asserted in two tests so it cannot drift accidentally.
- **`safeParse` in `RecipientsStep` swallows a malformed server price into `0n`.** It exists
  so a server contract violation cannot white-screen the render. The consequence is that such
  a violation shows as `Rp0,00` rather than as an error. Visibly wrong beats invisibly wrong,
  but a dedicated "the server sent something impossible" state would be better.
- **`aria-describedby` on Step 2's `Continue` points at a `<ul>`.** The reasons are all read,
  but list semantics inside a description are not what every screen reader handles best. Not
  checked with an actual screen reader.
- **The error-message copy for the five undesigned states (`LD-10`) is mine.** It is
  functional, consistent and states the cause, but no designer or PM has seen it.

---

## 9. Real-browser pass (integration gate, orchestrator-run)

Run after all three stories landed, by the orchestrator rather than a story agent, which is
why it appears here rather than in §3. Closes **G-2**.

**Setup:** `apps/server` on `:3001` and Vite on `:5173`, both live. Every request below
crossed the real dev-proxy boundary (`curl localhost:5173/api/health` → `{"status":"ok"}`),
so this is the PRD §4 process boundary, not a stub.

| # | Action in Chrome | Observed | PRD §7 row |
|---|---|---|---|
| 1 | Load `/` | Stepper renders 3 pills; pill 3 `Place fields (locked in this exercise)`; `From cloud` disabled with `Not available in this exercise`; `Continue` disabled with the visible reason `Upload a valid document to continue. The server decides whether it is valid.` | 1, LD-02, LD-05 |
| 2 | Upload `agreement-vendor-2026.pdf` | Card shows `Uploaded · 8 pages · 69 B`; `Continue` enables; footer reason becomes `Ready to set recipients.` | 1 |
| 3 | Inspect the card's remove control | `aria-label` = `Remove agreement-vendor-2026.pdf` — names the file | §7.4 |
| 4 | `Continue` → Step 2 | Seeded Rina 2 / Budi 1; per-row `Rp10.000,00` / `Rp5.000,00`; `3 signatures × Rp5.000,00 per signature`; `Remaining signature quota 5 of 8`; `Total charge Rp15.000,00`; badged `Estimate` | 6, LD-11, LD-15 |
| 5 | Set Budi to `7` (total 9) | `9 of 8 signatures — 1 over your quota` in both the summary and the footer; remaining clamps to `0 of 8`; `Continue` disabled | 7, LD-17 |
| 6 | Keyboard focus during step 5 | `:focus-visible` outline **actually rendered** on the `+` button — the specific thing jsdom could not prove | G-2 |
| 7 | Revert to `1`, press `Continue` | Panel turns green, badge flips `Estimate` → `Server-confirmed`, figures replaced by the server's, explanatory note added; no navigation, pill 3 stays locked | 6, LD-13 |
| 8 | Remove, then upload `<img src=x onerror=alert(1)>.pdf` | Filename renders as **inert text**; **no dialog fired, no `img` element created**; card reads `Uploaded · 1 pages · 69 B` (correctly absent from the fixture table) | 4 |

Row 8 is the one worth calling out: it was run deliberately as a live payload, so a failure
would have fired `alert(1)` in the real browser. It did not.

**Not covered by this pass:** the native file picker (automation attaches to the
`input[type=file]` directly), real drag-and-drop (G-6), real timeout deadlines (G-4), and
the oversize-from-UI path (G-3). Those gaps stand as written above.

---

# Case 2 — what was run, what was not

Appended at the close of Case 2 by the orchestrating session. Section 9 above
covers the Case-1 browser pass; this covers P1, P2 and P3.

## 10. Commands run, with their actual results

```
$ pnpm -r typecheck
packages/shared Done · apps/server Done · apps/web Done          exit 0

$ pnpm -r test
packages/shared test:  Tests  332 passed (332)
apps/server    test:  Tests  165 passed (165)
apps/web       test:  Tests  315 passed (315)
                             812 total

$ pnpm --filter @signed-doc/web build
dist/assets/index-CGo0J-mA.js   200.82 kB │ gzip: 63.67 kB      ✓ built in 400ms

$ grep -c "5000\|10000.10" apps/web/dist/assets/*.js
0
```

Growth by slice: shared 113 → 183 (P1) → 247 (P2) → 332 (P3); server 62 → 81 →
109 → 165; web 144 → 193 → 254 → 315. **No test was ever deleted or weakened.**
Where a signature change forced a rewrite, the expected values were preserved;
where the brief genuinely superseded an assertion (the stage-order lists, the
stepper-pill-3-locked assertions), a complementary assertion was added that
keeps the original's intent, and each is named in the relevant commit message.

Per-slice raw output is in `docs/evidence/{shared,server,web}-tests.txt`, each
append-only with the Case-1 capture intact at the top.

## 11. Negative controls — proof the tests fail for the right reason

Passing tests prove little when the failure mode is "compiles cleanly, does
nothing". Each edit below was applied, the suite run, then reverted. **All six
typecheck cleanly.** Recorded in `docs/evidence/server-tests.txt`.

| Control | Failures |
|---|---|
| Drop the fields argument to `chargePreviewStages` | 36 |
| Remove `'fields'` from the root allow-list | 55 |
| Remove the per-field shape loop | 5 |
| Hard-wire `field_count: 0` | 7 |
| Hand-roll a clamp in the service (the §B2 violation) | 9 |
| Collapse absent `fields` into empty | 20 |

The P2 server slice ran three of its own in the same spirit (18, 17 and 28
failures). The web slice disabled its focus-restoration effect and confirmed
exactly the three §A2.7/§B7.19 focus tests went red — including one that failed
with `activeElement === document.body`, i.e. focus genuinely lost.

## 12. Real-browser passes (orchestrator-run, against both live processes)

Each ran with `apps/server` on `:3001` and Vite on `:5173`, every request
crossing the real dev-proxy boundary.

**P1 (e-meterai).** §B7 row 1 exact: `Rp25.000,10`, remaining `5 of 8` and
`2 of 3`, Rina's combined row charge `Rp20.000,10`, chips `Signature 3/8` and
`eMeterai 1/3`. §B7 row 4: pushing Rina to 3 eMeterai against 2 signatures
marked **that row** — `3 eMeterai for 2 signatures — one duty stamp per
signature` — left Budi's row clean, and disabled `Continue` with
`Recipient 1: …` as the footer reason.

**P2 (signing order).** The mode selector renders above the list; parallel shows
no step UI. Sequential grouped rows under `Step 1` / `Step 2` headers with a
four-button order toolbar correctly disabled at the ends. Merging Budi into step
1 produced `Step 1 — 2 recipients — they sign in parallel within this step` with
every entered value intact. The sequential payload round-tripped to a
`Server-confirmed` total, so the server accepted `step` over the wire.

**P3 (place fields).** Stepper pill 3 unlocked; the `(locked in this exercise)`
string is gone from the DOM. The palette reports the kernel's own sizes
(`212 × 88`, `112 × 112`). Placing a signature produced a box labelled
`Signature` / `RH Rina Halim` — kind **and** owner as text, not colour — with a
visible focus ring on the new box. The reconciliation panel read
`DOES NOT MATCH YET`, `Rina Halim — Signature 1/2 · eMeterai 0/0`,
`1 Signature field still to place`. `Preview`, `Save as draft` and `Send` all
render disabled with their reasons stated; `Send`'s names P4 explicitly.

## 13. NOT verified — the honest list

- **P4 is entirely unbuilt** and therefore entirely unverified: no
  `preview_token`, no `/reserve`, no atomic dual decrement, no envelope lock, no
  `409 PREVIEW_STALE` / `409 ENVELOPE_LOCKED`. This is the declared sacrifice,
  not an oversight — see `docs/decisions.md`.
- **No browser pass covered §B7 rows 15–18 end to end.** The boundary and
  malformed-field rejections are proven at the API with both the out-of-range
  value and the clamped value (`422` and `200` respectively), and the UI clamp is
  unit-tested, but no one dragged a box to `x = 500` in Chrome and watched it
  stop.
- **The native file picker and real drag-and-drop remain untested** (carried over
  from Case 1, G-2/G-6). The automation attaches to the `input[type=file]`
  directly. Drag-and-drop from the palette was deliberately not built.
- **The real 10 s / 60 s timeouts have never been observed firing** (G-4).
  They are asserted with a 5 ms stand-in.
- **The oversize-upload path has never been exercised from the UI** (G-3); the
  server-side limit is covered.
- **§B7 row 20** (out-of-order previews) is exhaustively covered at the
  controller with an injected transport, but was never driven through the
  mounted UI or a real network.
- No screenshot or visual review of the Step 3 canvas beyond the single
  orchestrator pass above; layout at other widths is unexamined, and responsive
  layout is explicitly not assessed.

## 14. Believed weak

- **jsdom carries every rendered assertion.** It gives DOM semantics but no
  layout, no real hit-testing and no true focus ring. The focus tests assert
  `document.activeElement`, which is the right property, but a box that is
  visually off-canvas would still pass.
- **One unreproducible red run.** The P2 server slice saw a single non-zero exit
  it could not reproduce; seven consecutive runs by that agent and five more by
  the orchestrator were all green. Most likely contention with a concurrent
  agent, but it is unproven and recorded rather than dismissed.
- **`FIELD_COUNT_MISMATCH` is unreachable from the UI** because `Check charges`
  is gated on the invariant holding locally. Deliberate (see decisions §9), and
  the 422 path is covered by a stubbed rejection — but it means the server's own
  message for that code has never been read by a user.
- **The error copy for states no designer ever saw is the implementers' own** —
  carried over from Case 1 and now considerably larger in surface.
- **Accessibility is asserted, not audited.** Labels, `aria-label`s,
  `aria-describedby` and focus are all tested, but no screen reader has been run
  against any of it.
