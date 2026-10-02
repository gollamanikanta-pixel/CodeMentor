# CodeMentor project specification & status

> **Understand Code. Visualize Logic. Learn Better.**

This document records what the platform is specified to do and the **honest**
implementation status of each area. Where something deviates or is not yet
built, it is marked and explained rather than claimed as complete.

## Non-negotiable learning policy

CodeMentor explains, hints and questions. It **never** generates corrected code,
exact corrected lines, patches, diffs, replacements, or copy-paste solutions, and
it has no "apply fix" control. The retry control is labelled exactly
**“I Fixed It — Run Code Again”** and runs only the current editor buffer. When a
detected error disappears the UI shows **“Great work—this error is no longer
detected. You fixed it yourself.”** A unit test asserts no analysis object ever
carries `correctedCode`, `fixedCode`, `correctedLine`, `applyFix`, `patch` or
`replacement`.

## Access model

| Public routes | Authenticated routes |
| --- | --- |
| `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/404` | `/dashboard`, `/playground`, `/workspace`, `/projects`, `/quiz-history`, `/settings`, `/help` |

- An unauthenticated visitor opening an authenticated page is redirected to
  `/login?next=<path>`; `next` is validated by `safeReturnPath` (same-origin
  in-app paths only) and used after a successful sign-in.
- “Start Learning” → `/register` (signed out) or `/dashboard` (signed in).
- “Open Playground” → `/login?next=/playground` (signed out) or `/playground`.
- Logout invalidates the server session, clears client auth state and returns to
  `/login`.
- Ownership is enforced in backend queries: a learner can only read or write
  their own projects, files, executions, settings, and quiz history.

## Status map

| Area | Status | Notes |
| --- | --- | --- |
| Register / login / logout / forgot / reset | **Implemented** | bcrypt, httpOnly session cookie, CSRF token, rate limits, non-enumerable recovery. |
| Protected routing + safe return path | **Implemented** | `ProtectedRoute` + `safeReturnPath`. |
| Dashboard | **Implemented** | Welcome, stats, quick language starts, recent projects, concepts to review, encouragement. |
| Landing + policy pages | **Implemented** | Landing CTAs are auth-aware; `/privacy` and `/terms` are real pages. |
| SQLite schema + migrations | **Implemented** | Node's built-in `node:sqlite`; `ensureSchema()` + `npm run db:migrate`. |
| Project / file APIs | **Implemented** | Owner-scoped CRUD, `safePath`, file/byte/count caps, Zod validation. |
| Multi-file workspace | **Implemented** | Explorer, tabs, entry file, rename-free add/delete, themed Monaco, save. |
| Sandboxed HTML/CSS/JS preview | **Implemented (workspace)** | `allow-scripts` iframe, external resources blocked, console bridge. |
| Python browser runner | **Implemented** | Pyodide in a dedicated worker, stdin, timeout, honest error mapping. |
| JavaScript browser runner | **Implemented** | Dedicated worker, `console` capture, `input()`, timeout. |
| Local analysis (Python / JS / TS / SQL) | **Implemented** | Rule-based, with progressive hints and uncertainty labels. |
| Local visuals (9 kinds) | **Implemented** | SVG + safe Mermaid from detected structure. |
| Local quizzes + history | **Implemented (client)** | Generated locally; history stored locally. |
| Settings | **Implemented (client)** | Theme, font size, wrap, minimap, motion, levels, language, autosave, AI toggle. |
| AI Deep Help | **Implemented** | Backend-only, account-gated, cache/quota/cooldown, honest unavailable state. |
| Secure remote runner (C/C++/Java) | **Provider interface + honest fallback** | Real HTTPS adapter; no local compiler, no `child_process`. Needs `EXECUTION_*` config. |
| HTML in the Playground | **Implemented** | `HTML` is a first-class language with the `browser_html_preview` mode. |
| `browser_html_preview` execution mode | **Implemented** | Sandboxed iframe preview with Run Preview / Refresh / Clear Console and a console bridge. |
| HTML analyzer rules | **Implemented** | Missing `alt`, duplicate `id`, unbalanced tags, unlabelled input, blocked external resource, missing `lang`/skeleton. |
| Server-backed quizzes (`/api/quizzes`) | **Implemented** | List, create and read one, owner-scoped, joined to project titles. |
| Server-backed settings (`/api/settings`) | **Implemented** | `GET`/`PUT` with per-key mapping; adopted on sign-in. |
| Execution job recording + read-back | **Implemented** | `POST /api/executions` records a job; `GET /api/executions/:jobId` reads it. |
| Execution job live status (SSE/WebSocket) | **Not yet** | Jobs are recorded and readable; progress is not streamed. |
| Provider-backed cancellation | **Honest fallback** | `POST /api/executions/:jobId/cancel` reports “not supported” rather than pretending. |
| Standalone CSS language | **Not yet** | CSS is handled inside HTML projects and the multi-file workspace. |
| Prisma / Drizzle ORM | **Deliberate deviation** | Uses Node's built-in `node:sqlite` instead; see Deviations. |
| Tailwind CSS | **Deliberate deviation** | Uses a hand-written token design system in `client/src/index.css`. |
| Seed + generate scripts | **Implemented** | `db:seed` creates a demo learner/project/history; `db:generate` validates the schema. |

## Deviations from the original brief

1. **No Tailwind.** The UI is a hand-written, token-based stylesheet so the app
   ships no unused utility classes and the palette lives in one place.
2. **No Prisma/Drizzle.** Persistence uses Node's built-in `node:sqlite`
   (`DatabaseSync`) so a fresh checkout needs no code generation step. The
   schema is plain SQL in `server/src/db/schema.sql`.
3. **`sessionStorage`/`localStorage` hold no credentials.** Only draft data and
   preferences are stored client-side.

## Resource limits

CPU/time 3s target · wall clock 10–15s · memory 256 MB target · combined output
200 KB · per-file 50 KB · per-project 500 KB · 30 files · per-user daily and
cooldown quotas for AI and secure execution.
