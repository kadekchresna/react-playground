<!-- CLASSIFICATION: INTERNAL -->

# Fullstack L3 Interview — Case 2: Signing order, e-meterai, field placement

---

## PART A — THE CHANGES (read now)

### A0. Context

Product changed its mind after case 1 went out internally:

1. "Everyone is invited at the same time" does not fit documents that need staged approval — a manager must sign after their staff, not alongside them.
2. E-meterai (the Indonesian electronic duty stamp) was never counted at all, even though its quota and price are separate from signatures.
3. The signature count typed on Step 2 means nothing until the boxes actually exist on the document. The **Place fields** screen (board 3 of the mockup) enters the flow, and the number of boxes placed **must match** the numbers on Step 2.

You have **46 minutes left** (minutes 24–70), including clarification, planning, refactoring, tests, debugging, and the closing demo. Case 2 carries **70%** of the weight.

Continue on **the same codebase**. What is assessed: whether your case-1 structure can simply be extended or has to be torn open — and if it has to be torn open, whether you do it safely (tests first, then change). Case 1 regressions are still assessed.

The stepper is now **3 steps**: `Upload document → Set recipients → Place fields`.

### A1. Priorities — read this before anything else

Case 2 is bigger than the time left. That is deliberate. Work **in this order** and report honestly how far you got:

| Priority | Part |
| ---: | --- |
| **P1** | Change B — e-meterai per recipient, separate quota, correct charge figures |
| **P2** | Change A — signing order mode + steps |
| **P3** | Change C — Place fields + count reconciliation |
| **P4** | Change D — `Send`: atomic quota reservation. **Only attempt this if P1–P3 are done and verified.** |

**P4 is not required.** Sacrificing a lower priority and saying so specifically is worth more than four half-finished parts. What is not accepted: claiming something is done when it is not, or leaving a part broken without mentioning it.

### A2. Change A — Signing order mode (P2)

A mode selector above the recipient list:

| Mode | Behaviour |
| --- | --- |
| `parallel` (default, the case-1 behaviour) | All recipients are invited at the same time |
| `sequential` | Recipients are grouped into **steps**; the next step is only invited once every recipient in the previous step is done |

`sequential` rules:

1. Every recipient has a `step`, an integer ≥ 1.
2. **Several recipients may share the same step** — meaning they sign in parallel within that step. This must be supported.
3. Step numbers must be **contiguous starting at 1**. `[1,1,2,3]` is valid. `[1,3]`, `[2,3]`, `[0,1]` are not.
4. If recipients are deleted until a step becomes empty, the remaining step numbers **must be renormalized** back to contiguous. Example: `[1,2,2,3]`, then the sole member of step 1 is deleted → `[1,1,2]`.

UI:

5. `sequential` mode displays recipients **grouped by step** with a visible step header, and members of the same step are clearly marked as parallel signers.
6. Provide a way to change the order **without requiring drag-and-drop**: at minimum up/down buttons, plus a way to merge a recipient into a neighbouring step. Drag-and-drop is optional; **a keyboard path is mandatory**.
7. Reordering controls must have an `aria-label` naming the recipient being moved, and keyboard focus must not be lost after a row moves.
8. Reordering **must not lose any entered data** — neither recipient fields nor already-placed document fields.

### A3. Change B — E-meterai (P1)

A new **eMeterai** column with a `−`/`+` stepper and a number input, alongside the Signatures column.

1. Meterai price `"10000.10"`. Meterai quota = `3`. `meterai_count` per recipient is an integer `0`–`3`, default `0`.
2. **`meterai_count` must not exceed that recipient's `signature_count`.** One duty stamp is affixed next to one signature.
3. **In `sequential` mode, a recipient carrying meterai may only be in step 1.** Affixing a duty stamp produces a single stamped version of the document, and that must happen before the signing chain starts. Moving a meterai-carrying recipient to step 2 or later makes the document invalid, and the reason must appear on screen pointing at that recipient.
4. `parallel` mode counts as a single step, so rule 3 does not bind there.
5. The signature quota and the meterai quota are **separate**; a shortfall in either is blocked on its own, with a message that distinguishes the two.

UI:

6. The per-row `Charge` column shows that recipient's combined cost.
7. The summary shows **separate lines** and then the total: `{n} signatures × Rp5.000,00`, `{m} eMeterai × Rp10.000,10`, `Total charge`.
8. Show usage against **both** quotas, e.g. `Signature 3/8` and `eMeterai 1/3`.
9. All of these figures remain **derived state**.

### A4. Change C — Step 3: Place fields (P3)

Following board 3 of the mockup: a left panel (signer selector + field palette), the document canvas in the centre, and the footer `Back` / `Save as draft` / `Send`.

1. The left panel holds a **signer selector** that decides who the next field belongs to, and a palette with **Signature** and **eMeterai** buttons.
2. **Clicking a palette button places a field on the canvas — this is the mandatory path**, and it must be fully operable by keyboard. Drag-and-drop from the palette is optional; if you build it, click-to-place must still exist.
3. A placed field displays its kind **and the identity of its owner**. Colour alone is not enough — include text/initials.
4. Every field has a remove button whose `aria-label` names the kind and the owner.
5. Moving an already-placed field is **optional**. If you build it, clamping still applies.
6. Show **per-recipient reconciliation progress**, e.g. `Rina Halim — Signature 1/2 · eMeterai 0/1`, with a clear marker for both shortfalls and excess.
7. The mockup's `Preview` and `Save as draft` buttons are **out of scope** — do not build them; remove them or render them disabled with an explanation. Page 1 only; multi-page documents are out of scope.
   - `Send` **does not send the document**: no email/invitation to recipients, no affixing of signatures or duty stamps. The only thing `Send` does is the P4 quota reservation (A5). If you do not attempt P4, render `Send` disabled with an explanation. Do not leave `Save as draft` or `Send` as dead controls that appear to work.
8. Field coordinates and sizes are in **Appendix B2**. Clamping applies on the frontend **and** the backend.

**The reconciliation invariant — the heart of this case.** `signature_count` / `meterai_count` are *statements of intent*; the fields are *their materialization*. A document is valid only when the two match exactly:

9. Per recipient: the number of `signature` fields they own **==** `signature_count`, and the number of `meterai` fields they own **==** `meterai_count`.
10. No field may belong to someone who is not in the recipient list.
11. A `meterai` field may only belong to a recipient who satisfies rule A3.3.
12. **Pricing is still computed from the counts, not from the number of fields.** Mismatched fields make the document invalid; they do not change the bill.
13. When `signature_count` / `meterai_count` is lowered below the number of placed fields: choose **one** behaviour — excess fields are dropped automatically, **or** they are flagged as excess and the user removes them. Be consistent, make it visible to the user, document it, and test it. What is not accepted: state left inconsistent with no notification at all.

### A5. Change D — `Send` (P4, only if P1–P3 are done)

`Send` **does not send email, does not affix signatures, and does not affix duty stamps.** What it does: asks the server to recompute, then reserves quota and locks the envelope.

1. `charge-preview` returns a `preview_token` — an opaque token binding that computation to the data it was computed from (recipients, order, **and** fields). The client must not guess or construct it.
2. Any change to recipients, order, mode, **or fields** invalidates the token. `Send` is disabled until a fresh preview is fetched. The UI must already know this rather than waiting for the server to refuse.
3. `POST /api/envelopes/:id/reserve` accepts **only** `{ "preview_token": "..." }`. No counts, prices, recipients, or fields in that payload.
4. The reservation **decrements both quotas in a single atomic operation.** There must be no state in which one quota is debited and the other is not, whatever fails midway.
5. A token whose data no longer matches the current state → `409 PREVIEW_STALE`. After a successful reservation the envelope is locked; any later `charge-preview` or `reserve` → `409 ENVELOPE_LOCKED`.
6. Handle both `409`s with a clear recovery path: what happened, what the user should do, and **no loss of entered data or placed fields**.
7. `Send` must not fire two requests on a double-click.

### A6. Wrap-up

Update `README.md`, `AGENTS.md`, `docs/decisions.md`, `docs/verification.md`, and the agent transcript. Create a commit/snapshot named `case-2`.

`docs/decisions.md` must answer: what changed in your case-1 data structures and why; **every assumption you made yourself** because the brief did not say; and which priority you sacrificed and what the risk is.

`docs/verification.md` must separate: what you **did** run + its output · what you have **not** verified · what you **believe is weak** but had no time to fix. A claim of "it should pass" without run output counts as unverified.

---

## PART B — CONTRACT APPENDIX (open while coding, nothing to memorize)

### B1. Constants

| Constant | Value |
| --- | --- |
| Price per meterai | `"10000.10"` |
| Meterai quota | `3` |
| `meterai_count` per recipient | integer `0`–`3` |

Case 1 constants are unchanged: signature price `"5000.00"`, signature quota `8`, max 10 recipients, `signature_count` `1`–`20`.

### B2. Field geometry (exact numbers, taken from the mockup)

| Dimension | Value |
| --- | ---: |
| Page size | `760 × 700` |
| Page padding | `56` top/bottom, `64` left/right |
| **Content area** | `632 × 588` |
| `signature` field size | `212 × 88` |
| `meterai` field size | `112 × 112` |

`x`, `y` are the field's top-left coordinates **relative to the content area**, not the viewport. Clamping:

```
0 ≤ x ≤ 632 − field_width        0 ≤ y ≤ 588 − field_height
```

→ `signature`: `x ∈ [0,420]`, `y ∈ [0,500]`. `meterai`: `x ∈ [0,520]`, `y ∈ [0,476]`.

**The UI clamps. The API rejects** out-of-range coordinates with `422` — the server never clamps silently.

### B3. Field model

```json
{ "id": "f1", "kind": "signature", "recipient_email": "rina.halim@example.test", "page": 1, "x": 64, "y": 224 }
```

`kind`: `"signature"` | `"meterai"`. `recipient_email` is compared after trimming, case-insensitively. `page` is required and must be `1`. `x`/`y` are integers. `id` must be unique.

### B4. `POST /api/envelopes/:id/charge-preview` (extended)

Input:

```json
{
  "order_mode": "sequential",
  "recipients": [
    { "name": "Rina Halim",   "email": "rina.halim@example.test",  "signature_count": 2, "meterai_count": 1, "step": 1 },
    { "name": "Budi Santoso", "email": "budi.santoso@example.test", "signature_count": 1, "meterai_count": 0, "step": 2 }
  ],
  "fields": [
    { "id": "f1", "kind": "signature", "recipient_email": "rina.halim@example.test",  "page": 1, "x": 64,  "y": 224 },
    { "id": "f2", "kind": "signature", "recipient_email": "rina.halim@example.test",  "page": 1, "x": 64,  "y": 340 },
    { "id": "f3", "kind": "meterai",   "recipient_email": "rina.halim@example.test",  "page": 1, "x": 360, "y": 224 },
    { "id": "f4", "kind": "signature", "recipient_email": "budi.santoso@example.test", "page": 1, "x": 64,  "y": 440 }
  ]
}
```

In `order_mode: "parallel"`, `step` **must not be sent** → `422 UNKNOWN_FIELD`.

Success `200`:

```json
{
  "preview_token": "pv_7c1f...",
  "order_mode": "sequential",
  "steps": [
    { "step": 1, "recipient_emails": ["rina.halim@example.test"] },
    { "step": 2, "recipient_emails": ["budi.santoso@example.test"] }
  ],
  "recipient_count": 2,
  "total_signatures": 3,
  "total_meterai": 1,
  "field_count": 4,
  "price":   { "signature": "5000.00",  "meterai": "10000.10" },
  "charges": { "signature": "15000.00", "meterai": "10000.10" },
  "total_charge": "25000.10",
  "quota":           { "signature": 8, "meterai": 3 },
  "quota_remaining": { "signature": 5, "meterai": 2 }
}
```

`preview_token` is only required if you attempt P4. Without P4 you may omit the field.

### B5. New error codes

`ORDER_MODE_INVALID`, `STEP_SEQUENCE_INVALID`, `METERAI_COUNT_INVALID`, `METERAI_EXCEEDS_SIGNATURE`, `INSUFFICIENT_METERAI_QUOTA`, `METERAI_NOT_IN_FIRST_STEP`, `FIELD_UNKNOWN_RECIPIENT`, `FIELD_COUNT_MISMATCH`, `FIELD_OUT_OF_BOUNDS`, `FIELD_PAGE_INVALID`, `FIELD_ID_DUPLICATE`. P4 adds `PREVIEW_STALE` and `ENVELOPE_LOCKED` (both `409`).

Validation order: payload shape → envelope exists → `order_mode` → per recipient → duplicate emails → step structure → meterai-vs-signature → meterai step placement → field shape & bounds → field-vs-count reconciliation → signature quota → meterai quota.

### B6. `POST /api/envelopes/:id/reserve` (P4)

Input: `{ "preview_token": "pv_7c1f..." }`

Success `200`:

```json
{
  "envelope_id": "env_01",
  "reserved": { "signature": 3, "meterai": 1 },
  "quota_remaining": { "signature": 5, "meterai": 2 },
  "total_charge": "25000.10"
}
```

### B7. Case 2 acceptance

The P4 rows only apply if you attempt P4.

| # | Scenario | Required outcome |
| ---: | --- | --- |
| 1 | `parallel`; Rina 2 sig/1 met, Budi 1 sig/0 met, fields complete | sig 3, met 1, charges `"15000.00"` + `"10000.10"`, total `"25000.10"`, remaining quota `5`/`2` |
| 2 | `parallel`; Rina 2 sig/2 met, Budi 1 sig/1 met, fields complete | met 3 (exactly the quota), total `"45000.30"`, remaining meterai `0`, **allowed** |
| 3 | Add one more meterai (total 4) | `422 INSUFFICIENT_METERAI_QUOTA`; the message distinguishes it from the signature quota |
| 4 | Rina 2 sig / 3 met | `422 METERAI_EXCEEDS_SIGNATURE`; the FE marks that row, not the whole form |
| 5 | `sequential`; Rina step 1, Budi step 2, Citra step 2 (1 sig/0 met) | Valid; `steps` contains 2 steps, step 2 holds two emails |
| 6 | Scenario #5 with Citra given 1 meterai | `422 METERAI_NOT_IN_FIRST_STEP` |
| 7 | Steps sent as `[1,3]`, `[2,3]`, or `[0,1]` | `422 STEP_SEQUENCE_INVALID` |
| 8 | `sequential` steps `[1,2,2,3]`, sole member of step 1 deleted | Renormalized to `[1,1,2]`; other recipient data intact |
| 9 | `parallel` but the payload includes `step` | `422 UNKNOWN_FIELD` |
| 10 | Rina `signature_count` 2, only 1 signature field placed | `422 FIELD_COUNT_MISMATCH`; the UI shows `Signature 1/2` before submitting |
| 11 | Rina `signature_count` 2, 3 signature fields placed | `422 FIELD_COUNT_MISMATCH`; the UI shows the excess |
| 12 | A field whose `recipient_email` is not in the list | `422 FIELD_UNKNOWN_RECIPIENT` |
| 13 | A recipient is deleted while owning fields | Follows your documented decision; visible to the user, documented, and tested |
| 14 | `signature_count` lowered below the number of placed fields | Per A4.13; consistent, documented, and tested |
| 15 | Place a `signature` at `x = 500` | Clamped to `420` in the UI; `x = 500` sent directly to the API → `422 FIELD_OUT_OF_BOUNDS` |
| 16 | Place a `meterai` at `y = 600` | Clamped to `476`; sending `600` directly → `422 FIELD_OUT_OF_BOUNDS` |
| 17 | A field with `page: 2` or `page: 0` | `422 FIELD_PAGE_INVALID` |
| 18 | Two fields with the same `id` | `422 FIELD_ID_DUPLICATE` |
| 19 | Place a field entirely by keyboard | Possible; focus is not lost after the field is placed |
| 20 | Previews A and B in flight, B resolves first, A arrives after | The UI keeps B's result; A is ignored |
| 21 | Case 1 regressions: upload, duplicate email, signature quota, filename sanitization | Still working |
| 22 *(P4)* | `Send` with a valid token | `200`, **both** quotas decremented, envelope locked |
| 23 *(P4)* | `Send` with a token from a preview taken before fields changed | `409 PREVIEW_STALE`; the UI offers a recompute without losing entered data or placed fields |

### B8. Minimum tests for case 2

Three categories, **run, with the output saved**:

1. **Step normalization** — contiguity, shared steps, deleting the last member of a step.
2. **Meterai rules + field reconciliation** — `meterai_count ≤ signature_count`, step-1 placement, fields matching/short/excess/orphaned, coordinate clamping at the exact boundaries (`420/500`, `520/476`).
3. **Exact combined cost calculation** (`"25000.10"`, `"45000.30"`) and both remaining quotas.

Plus: **case 1 regressions still green**. If you attempt P4, add a test showing that a failure midway through the reservation leaves no quota partially debited.

Before any structural refactor (flat recipient array → step-based structure, or adding a field collection), **write/run the tests that lock in the old behaviour first**, then change it. This is assessed.

### B9. Still out of scope

Parsing/rendering PDF content, the `Preview` button, the `Save as draft` button, actually sending the document via `Send` (beyond the P4 quota reservation), multi-page documents, affixing signatures or duty stamps to a file, e-meterai/PKI provider integration, payments, email/notifications, SSO, deployment, mobile.

This case stops at **counts, order, box placement, pricing, and quotas**.
