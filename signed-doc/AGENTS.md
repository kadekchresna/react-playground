# AGENTS.md — signed-doc (upload → recipients → place fields). pnpm workspace, TypeScript end to end.

**Map.** `packages/shared/src` = the one validation/money/pricing/geometry kernel (barrel `index.ts`), imported by both apps:
`money` `file` `recipient` `pricing` `page-count` `quota` `steps` `fields`.
`apps/server/src` = Express: entry `index.ts` (listens), composition root `app.ts` (`createApp()` — no port, supertest-drivable).
Business rules live in `services/envelope-service.ts` + `services/charge-preview-service.ts`; `routes/*` only parse, delegate, map.
`apps/web/src` = React/Vite, entry `main.tsx`; features under `features/{upload,recipients,fields}`. Server-only config: `apps/server/src/config/{account,limits}.ts`.

**Validate.** `pnpm -r typecheck` · `pnpm -r test` (812) · `pnpm --filter @signed-doc/server test` · `pnpm dev` then `curl localhost:5173/api/health`.

**Invariants.**
- Money is `bigint` minor units; on the wire always a 2-decimal string (`"10000.10"`), never a JSON number.
- Price and both quotas live ONLY in `config/account.ts`. Putting either in `packages/shared` or `apps/web` ships them to the browser (ADR-003); the gate is `grep -c "5000\|10000.10" apps/web/dist/assets/*.js` → 0.
- Signature and eMeterai are separate allowances, failing independently with distinguishable messages. `meterai_count <= signature_count` per recipient; a meterai carrier may only sit in step 1.
- **The UI clamps, the API rejects** (geometry §B2). `clampFieldPosition` is frontend-only and must never be imported by `apps/server`; the server answers `422 FIELD_OUT_OF_BOUNDS` and never repairs a coordinate.
- **Pricing comes from the counts, never from the number of placed fields.** Mismatched fields invalidate the document; they do not change the bill.
- Validation order is owned by the kernel's 11-stage pipeline (`chargePreviewStages(quota, orderMode, fields)`) — do not restate it in a service. **Omitting an argument typechecks cleanly and silently disables a whole feature**; that trap has bitten three times, so negative controls live in `docs/evidence/server-tests.txt`.
- Absent `fields` = a Step-2 preview (field rules vacuous). `fields: []` = a real Step 3 with nothing placed, and FAILS reconciliation. Same for `order_mode`: absent means `parallel`.
- Every rule rejection is `422` or `404` shaped `{ error: { code, message, details? } }`; `500` carries no internals.

**Input trust boundaries.**
- The server re-validates everything; frontend validation is UX only. Client-sent price/total/quota are rejected (`422 UNKNOWN_FIELD`), never used. The allow-list is **strings**, so a missing entry is not a type error — it rejects valid payloads instead.
- The filename is hostile input: sanitize with the kernel, judge the extension from the SANITIZED name, never from `Content-Type`; render as text only.
- Uploaded bytes are discarded after validation — metadata only, in memory. No SQL exists yet, so injection is not live; input validation still is.
