# Signed Doc — Upload document → Set recipients → Place fields

React/Vite frontend talking over real HTTP to an Express backend; both import one shared TypeScript validation + pricing kernel (`packages/shared`), so there is a single source of truth for every rule. The server decides — frontend validation is UX only.

```bash
corepack enable && pnpm install --frozen-lockfile   # Node >= 20
pnpm dev        # Express on :3001, Vite on :5173 (proxies /api -> :3001) — open http://localhost:5173
pnpm test       # all 812 tests    pnpm -r typecheck
```

- Endpoints, unremapped from the brief: `POST /api/envelopes` (multipart, field `file`), `POST /api/envelopes/:id/charge-preview`, plus `GET /api/health`. `POST /:id/reserve` is **not** implemented — see the sacrificed priority below.
- Money crosses the wire only as a 2-decimal string (`"25000.10"`); internally it is `bigint` minor units, never a float. Signatures `"5000.00"` and eMeterai `"10000.10"` are priced and quota'd separately.
- **Uploaded file content is discarded after validation** — only `{ filename, size_bytes, page_count }` is retained. Page count comes from a fixture table keyed by the sanitized filename, never from file content.
- Storage is an in-memory `Map`, so envelopes vanish when the server restarts. There is no SQL, so SQL injection is not yet a relevant surface; input validation, filename sanitization and the server-enforced 25 MB upload limit are applied regardless.
- **Case 2 P4 (`Send` / quota reservation) was deliberately not attempted**; `Send` renders disabled with that reason on screen. Nothing in this app ever sends a document, affixes a signature or applies a duty stamp.
- Assumptions, trade-offs and known gaps: `docs/decisions.md`. Test output: `docs/verification.md` and `docs/evidence/`.
