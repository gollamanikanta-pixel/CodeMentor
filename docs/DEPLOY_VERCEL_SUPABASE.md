# Deploying CodeMentor on Vercel + Supabase

| Piece | Where it runs |
| --- | --- |
| React app (`client/`) | Vercel static hosting |
| Express API (`server/`) | One Vercel serverless function, mounted at `/api` |
| Database | Supabase Postgres (schema in `server/src/db/schema.sql`) |
| Interactive console (E2B runner + `/api/terminal` WebSocket) | **Not on Vercel** - see "Limits" |

`npm run vercel-build` (see `scripts/vercel-build.mjs`) builds the client, bundles the
API into a single function, and writes the Vercel Build Output (`.vercel/output`).
`vercel.json` points the build at it.

## 1. Supabase

The schema is already applied as the `codementor_initial_schema` migration (8 tables, row-level
security enabled with no policies, so the public Supabase API reads nothing). To re-apply it:
`DATABASE_URL=... npm run db:migrate` (idempotent).

Use the **Transaction pooler** connection string (Project -> Connect), which is the one that suits
serverless:

    postgresql://postgres.<project-ref>:<DB-PASSWORD>@aws-<n>-<region>.pooler.supabase.com:6543/postgres

URL-encode special characters in the password. The server enables TLS automatically for
non-localhost hosts.

## 2. Vercel

Import the GitHub repo. Leave the framework preset as **Other** (`vercel.json` already sets
install/build commands). Add these environment variables (Production + Preview):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Supabase transaction-pooler string |
| `SESSION_SECRET` | a long random string (`openssl rand -hex 32`) |
| `CLIENT_ORIGIN` | your public URL, e.g. `https://codementor.vercel.app` (no trailing slash) |
| `EXECUTION_PROVIDER` | `judge0` |
| `EXECUTION_API_BASE_URL` | `https://ce.judge0.com` |
| `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | optional - only for AI Deep Help |

`NODE_ENV=production` is set by Vercel. Never put real secrets in a `VITE_*` variable.

## 3. Verify

1. `https://<your-app>/api/health` returns `{"ok":true,...}`.
2. Register an account, create a project, reload - it persists (rows appear in Supabase).
3. Multi-file workspace -> run a C/C++/Java project (uses Judge0).

## Limits on Vercel

* **Interactive Run Code console**: Vercel functions cannot hold WebSockets, so `/api/terminal`
  does not work there and the console shows "could not be reached". Everything else works
  (editor, local analysis, visuals, quizzes, accounts, projects, multi-file runs via Judge0).
  To enable it, run `server/src/index.ts` and `runner/` on a host with long-lived processes
  (Railway, Fly.io, a VPS) and point the browser's `/api` at that origin.
* **In-memory limits**: AI/execution daily quotas, cooldowns and the AI cache live in each
  function instance's memory, so they are best-effort on serverless (they reset on cold start and
  are per instance). Move them into Postgres before relying on them for cost control.
* `npm run db:seed` creates a public demo account and refuses to run when `NODE_ENV=production`.
