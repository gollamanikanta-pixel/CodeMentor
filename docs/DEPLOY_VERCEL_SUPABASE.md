# Deploying CodeMentor on Vercel + Supabase

This is the production deployment path for this repository:

| Piece | Where it runs |
| --- | --- |
| React app (`client/`) | Vercel static hosting |
| Express API (`server/`) | Vercel serverless function at `/api` |
| Account, project, settings, quiz and execution data | Supabase Postgres |
| AI Deep Help | Optional provider called only by the server |
| Interactive terminal over WebSockets | Not supported by Vercel functions |

No Railway service is required for the Vercel + Supabase deployment. The
interactive terminal needs a long-running WebSocket-capable host and therefore
is not used by the single-file Playground. Python and JavaScript run locally in
browser workers; Python downloads Pyodide from jsDelivr on first use. Learner
programs may make their own network requests. Single-request Judge0 execution
for multi-file projects is a separate feature.

## 1. Connect the GitHub repository to Vercel

1. In the Vercel project at
   [codementor.ai](https://vercel.com/manikanta13/codementor.ai), confirm the
   connected repository is `gollamanikanta-pixel/CodeMentor`.
2. Set the project root to the repository root. Do not set it to `client/`,
   `server/` or `runner/`.
3. Keep the framework preset as **Other**. The root `vercel.json` runs
   `npm run vercel-build`, which creates the static frontend and `/api`
   serverless function.
4. Set the Node.js runtime to 22 if the project setting offers a runtime
   selection.
5. Use `codementor.ai` as the production domain after its DNS verification is
   complete. The Vercel project’s assigned `*.vercel.app` domain can be used
   for the initial smoke test.

The frontend and API share one origin on Vercel. Do not set a `VITE_*` provider
key or a separate API URL: the client calls `/api/...` on the same domain.

## 2. Prepare the Supabase database

The project uses Supabase as PostgreSQL; it does not use Supabase Auth or expose
the Supabase REST API to the browser. CodeMentor's own account/session API
stores password hashes and opaque session-token hashes in Postgres.

1. Open the Supabase project and select **SQL Editor**.
2. Create a new query, paste the contents of
   [`../server/src/db/schema.sql`](../server/src/db/schema.sql), and run it.
   The script is idempotent and creates the tables, indexes and restrictive
   row-level-security settings used by the server.
3. Select **Project Settings → Database → Connect** and copy the **Transaction
   pooler** URI (port `6543`). URL-encode any special characters in its
   password. Do not use a browser/public/anon key as `DATABASE_URL`.
4. Keep that URI private. It is a server-side Vercel environment variable only.

The same schema can be applied from a trusted local checkout instead of SQL
Editor by setting `DATABASE_URL` in `server/.env` and running
`npm run db:migrate --prefix server`. Never put a production database URI into
the frontend environment or commit it to Git.

## 3. Configure Vercel environment variables

Add these under **Project → Settings → Environment Variables** for **Production**.
Use the same settings for Preview only if you intentionally want live account
and AI behavior in preview deployments.

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase Transaction pooler URI (port `6543`) |
| `DATABASE_POOL_MAX` | Recommended | `3` |
| `SESSION_SECRET` | Yes | A unique random secret with at least 32 random bytes |
| `SESSION_COOKIE_NAME` | Recommended | `codementor_session` |
| `SESSION_TTL_DAYS` | Recommended | `7` |
| `CLIENT_ORIGIN` | Recommended | `https://codementor.ai` (include any other exact production domain as a comma-separated origin) |
| `EXECUTION_PROVIDER` | Recommended | `judge0` |
| `EXECUTION_API_BASE_URL` | Recommended | `https://ce.judge0.com` |
| `AI_API_BASE_URL` | Optional | Provider endpoint; Gemini uses `https://generativelanguage.googleapis.com` |
| `AI_API_KEY` | Optional | Provider credential, server-side only |
| `AI_MODEL` | Optional | A model available to that provider account |
| `AI_API_TIMEOUT_MS` | Recommended | `25000` to leave response time within Vercel's function limit |

Set AI values together or leave all three empty. The deployed `/api/ai-usage`
response reports only whether the set is complete. If the provider values are
currently configured only on another host, copy them into Vercel’s server-side
environment settings; they are not inherited automatically.

Never prefix a secret with `VITE_`. Vite variables are compiled into client
assets and are public. Redeploy after changing environment variables.

The frontend and `/api` function use the same origin, so there is no need for a
separate Railway API or `VITE_API_URL`. `CLIENT_ORIGIN` remains an exact-origin
CORS allowlist for any browser request that is cross-origin.

## 4. Deploy and verify

After the Supabase schema and Vercel variables are in place, trigger a Vercel
deployment from the connected GitHub branch. Check:

1. `https://codementor.ai/api/health` returns
   `{"ok":true,"service":"codementor-server"}`.
2. `https://codementor.ai/api/ai-usage` returns `{"configured":true}` only when
   all three AI provider variables are present. `false` means AI variables are
   missing; it does not mean the frontend is broken.
3. Register a test account, sign out/in, create a project and reload it.
4. Confirm the account, project, project-file and related rows exist in
   Supabase. Do not use real learner code for deployment smoke tests.
5. Turn on **Enable AI Deep Help** in the signed-in account settings, then test
   it with a small, non-sensitive code example.

If Deep Help fails, check the Vercel function logs for the safe diagnostic
labels `safe-ai-provider-request-failed` or
`safe-ai-provider-output-unusable`. The first distinguishes provider HTTP
status, timeout, configuration and network failure without logging credentials
or response bodies. Verify the model name and provider quota in the provider
dashboard.

## Vercel platform limits

- Vercel serverless functions cannot accept the long-lived WebSocket upgrade
  needed by `/api/terminal`; interactive terminal runs will not work on this
  deployment. Python and JavaScript single-file runs use browser workers
  instead; single-request Judge0 paths for multi-file projects are independent
  of that terminal.
- In-memory AI result cache and runner quota/cooldown counters are per function
  instance and may reset on cold starts. They are best-effort and not shared
  across instances.
- If the custom domain is not resolving, first verify its domain assignment and
  DNS status in the Vercel project. The assigned Vercel preview domain is
  available for checking the build before custom-domain DNS propagates.
