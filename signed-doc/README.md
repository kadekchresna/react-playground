# Signed Doc — Case 1: Upload document + Set recipients

React/Vite frontend talking over real HTTP to an Express backend; both import one shared TypeScript validation + pricing kernel (`packages/shared`), so there is a single source of truth for every rule. The server decides — frontend validation is UX only.

```bash
corepack enable && pnpm install --frozen-lockfile   # Node >= 20
pnpm dev        # Express on :3001, Vite on :5173 (proxies /api -> :3001) — open http://localhost:5173
pnpm test       # every suite      pnpm -r typecheck
```

- Endpoints, unremapped from PRD §9: `POST /api/envelopes` (multipart, field `file`), `POST /api/envelopes/:id/charge-preview`, plus `GET /api/health`.
- Money crosses the wire only as a 2-decimal string (`"15000.00"`); internally it is `bigint` minor units, never a float.
- **Uploaded file content is discarded after validation** — only `{ filename, size_bytes, page_count }` is retained (PRD §7.10). Page count comes from a fixture table keyed by the sanitized filename, never from file content.
- Storage is an in-memory `Map`, so envelopes vanish when the server restarts. There is no SQL, so SQL injection is not yet a relevant surface; input validation, filename sanitization and the server-enforced 25 MB upload limit are applied regardless.
- Assumptions, trade-offs and known gaps: `docs/decisions.md`. Test output: `docs/verification.md` and `docs/evidence/`.
