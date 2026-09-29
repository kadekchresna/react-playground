# AGENTS.md — signed-doc (Case 1: upload document → set recipients). pnpm workspace, TypeScript end to end.

**Map.** `packages/shared/src` = the one validation/money/pricing kernel (barrel `index.ts`), imported by both apps.
`apps/server/src` = Express: entry `index.ts` (listens), composition root `app.ts` (`createApp()` — no port, supertest-drivable).
Business rules live in `services/envelope-service.ts` + `services/charge-preview-service.ts`; `routes/*` only parse, delegate, map.
`apps/web/src` = React/Vite, entry `main.tsx`. Server-only config: `apps/server/src/config/{account,limits}.ts`.

**Validate.** `pnpm -r typecheck` · `pnpm -r test` · `pnpm --filter @signed-doc/server test` · `pnpm dev` then `curl localhost:3001/api/health`.

**Invariants.**
- Money is `bigint` minor units; on the wire always a 2-decimal string (`"5000.00"`), never a JSON number.
- Price and signature quota live ONLY in `config/account.ts`. Putting either in `packages/shared` or `apps/web` ships them to the browser (ADR-003).
- Upload cap 25 MB, enforced by multer server-side, reported as `422 FILE_TOO_LARGE` (not 413). Case 1 never consumes quota.
- charge-preview order is fixed: payload shape → envelope exists → per-recipient (signature_count → name → email) → duplicates → quota.
- Every rule rejection is `422` or `404` shaped `{ error: { code, message, details? } }`; `500` carries no internals.

**Input trust boundaries.**
- The server re-validates everything; frontend validation is UX only. Client-sent price/total/quota are rejected (`422 UNKNOWN_FIELD`), never used.
- The filename is hostile input: sanitize with the kernel, judge the extension from the SANITIZED name, never from `Content-Type`; render as text only.
- Uploaded bytes are discarded after validation — metadata only, in memory. No SQL exists yet, so injection is not live; input validation still is.
