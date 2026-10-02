# CodeMentor architecture

CodeMentor is a local-first learning workspace. **Nothing about learning requires
an account or the backend**: Python and JavaScript run in browser workers, and
all analysis, visuals and quizzes are generated locally. The backend is optional
and adds exactly three things — optional accounts, server-side project sync, and
a delegated secure runner for compiled languages.

```
Browser (React + Vite)                         Backend (Express + TS)
────────────────────────                       ──────────────────────
pages/        route screens                    routes/    api composition
layout/       workspace shell                  controllers/  HTTP normalization
editor/       Monaco adapter (themed)          validators/   Zod schemas
analyzers/    local Python/JS/TS/SQL rules     services/     AI cache + quota
diagrams/     SVG + Mermaid visuals            providers/    secure-runner adapters
quizzes/      local question generation        db/           SQLite schema + client
features/     analysis, visuals, quiz,         auth/         sessions + CSRF
              workspace (multi-file)           middleware/   rate limit + errors
runners/      browser execution contract       config/       the only env reader
workers/      Pyodide + JS Web Workers
storage/      versioned localStorage
web/          sandboxed HTML preview builder
auth/         optional account context
api/          the only place that calls the backend
```

## The one invariant

The learning rule is architectural, not cosmetic: **the app never generates
corrected code**. `analyzers/` produces explanations and hints, never a diff or a
replacement; the `Errors & Learning Hints` panel has no "apply fix" control; the
retry button (*"I Fixed It — Run Code Again"*) re-runs the editor buffer unchanged.
A test in `client/tests/localAnalyzer.test.ts` asserts no analysis object ever
carries `correctedCode`, `fixedCode`, `correctedLine`, `applyFix`, `patch` or
`replacement`.

## Local-first data flow

1. The learner types in Monaco. Autosave writes a local draft — no run, no AI.
2. **Run** posts to a dedicated Web Worker (Pyodide for Python, a `Function`
   sandbox for JavaScript). The worker is always terminated after the run.
3. The local analyzer runs in the browser and produces a `LocalAnalysis`.
4. Analysis / Visuals / Quiz render entirely from that object.
5. **Ask AI for Deeper Help** is the only path to the backend, and only when the
   learner explicitly asks.

## v2: accounts, project sync and the multi-file workspace

These extend the app without changing the local-first path.

- **`server/src/db/`** — SQLite via Node's built-in `node:sqlite`. `schema.sql`
  declares `User`, `Session`, `PasswordResetToken`, `UserSettings`, `Project`,
  `ProjectFile`, `ExecutionJob` and `QuizHistory`. `ensureSchema()` runs at boot
  (idempotent `IF NOT EXISTS`) and `npm run db:migrate` runs it on demand.
- **`server/src/auth/`** — bcrypt password hashing, opaque session tokens stored
  as SHA-256 hashes, an httpOnly session cookie, and a double-submit CSRF cookie
  (`codementor_csrf`) that every state-changing request must echo in an
  `x-csrf-token` header. `optionalAuth` attaches a user when present;
  `requireAuth` guards account-only routes.
- **`server/src/routes/projectRoutes.ts`** — owner-scoped project and file CRUD.
  Paths are validated (`safePath`), files are capped per project, and a learner
  can only ever read or write their own rows.
- **`server/src/routes/authRoutes.ts`** — register / login / logout / me / forgot /
  reset, each Zod-validated. Password reset is deliberately non-enumerable.
- **`POST /api/executions`** — authenticated, project-aware execution. It snapshots
  the project's entry file, records a durable `ExecutionJob`, and delegates to the
  same `SecureExecutionProvider` used by `/api/run`. The backend still never
  compiles or runs student code.
- **`server/src/providers/`** — the secure-runner adapter layer. `Judge0ExecutionProvider`
  (default: the keyless Judge0 CE service, all nine compiled languages),
  `PistonExecutionProvider` (keyless Piston alternative), `ResilientExecutionProvider`
  (retries the same unmodified source on Judge0 when Piston refuses to execute),
  `LiveSecureExecutionProvider` (generic URL + key), and
  `UnavailableExecutionProvider` (honest fallback). Each response normalizer is a pure,
  unit-tested function, and one shared guard enforces the daily limit and cooldown for
  every remote provider so public rate limits never surface as the learner's error.
- **`client/src/web/sandboxPreview.ts`** — builds one self-contained HTML document
  from `.html` / `.css` / `.js` files. It blocks external resources and remote
  `<script src>` / `<link href>` tags, and the preview runs in an
  `sandbox="allow-scripts"` iframe so it never shares the app's origin.
- **`client/src/features/workspace/MultiFileWorkspace.tsx`** — a file explorer,
  themed Monaco editor, sandboxed preview with a `postMessage` console bridge,
  ZIP import/export, and save-to-account. It reuses the shared `codementor-dark` /
  `codementor-light` Monaco themes so the workspace matches the Playground.
- **`client/src/auth/AuthContext.tsx`** + **`ProtectedRoute`** — optional account
  state. Only `/workspace` is guarded; every other route works signed-out.

## Security posture

There is no `child_process`, `exec`, `spawn`, shell, local compiler or Docker path
anywhere on the server. The single intentional exception in the whole project is
the **JavaScript browser worker**, which compiles learner code with the `Function`
constructor — the only way to run JavaScript locally — inside an isolated worker
with no DOM or network access. Secrets live only in `server/.env`; the browser
never receives an API key.
