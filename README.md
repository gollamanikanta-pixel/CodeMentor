# CodeMentor

**Understand Code. Visualize Logic. Learn Better.**

CodeMentor is a local-first programming-learning platform for students and self-learners. Learners write, paste, upload and run their own code, see real output and errors, understand what happened and why, review line-by-line explanations, visualize program structure, practice with quizzes generated from their own code, save projects, and — only when they explicitly ask — request deeper guidance from a backend-only AI route.

CodeMentor **guides, it never auto-fixes**. It explains errors, highlights likely lines, gives progressive hints, asks self-check questions and suggests debugging steps. It never returns corrected code, exact corrected lines, patches, diffs, replacements, or copy-paste solutions, and it has no "Apply Fix" control.

---

## 1. Features

- **Playground workspace** — collapsible sidebar, Monaco editor, analysis panel, bottom console, and a sticky action toolbar.
- **Interactive console runner** — Python, JavaScript, C, C++ and Java run in E2B cloud sandboxes with outbound internet disabled. HTML uses a sandboxed browser preview. Click **Run Code** to jump to the live console, type input when prompted and press Enter; output streams back while it runs. When a diagnostic identifies a source line, CodeMentor highlights it and provides a jump-to-line action. TypeScript, SQL, C#, Go, PHP, Ruby, Rust and Kotlin are marked **Coming soon** and are not selectable or runnable in the learner interface.
- **Local analysis** — rule-based guidance runs locally without AI, network access or code rewriting. Analyzer code for coming-soon languages remains internal and is not exposed as a supported language choice.
- **Errors & Learning Hints** — category badge, likely line with confidence, technical message, what happened, why, progressive hints, concept reminder, self-check question and debugging steps.
- **Local visuals** — accessible SVG data-structure diagrams plus safe Mermaid flowcharts generated from detected structure.
- **Local quizzes** — concept, true/false, find-issue and debugging-strategy questions with 5/10/15 counts and three difficulty levels, stored in quiz history.
- **Projects** — save, search, filter, rename, duplicate, export and delete; grid or list view.
- **Settings** — theme, font size, word wrap, minimap, reduced motion, explanation level, hint level, default language, autosave and AI toggle. All persisted locally.
- **AI Deep Help (optional)** — one combined backend request per unique code version, stable-hash caching, daily quota and cooldown, honest unavailable state.
- **Optional accounts (v2)** — register, log in, log out and recover a password. Sessions are opaque httpOnly cookies; every state-changing request is CSRF-checked. Nothing local depends on an account.
- **Server-side project sync (v2)** — a signed-in learner can save multi-file projects and get durable execution history back from the protected API.
- **Multi-file workspace (v2)** — a file explorer, themed Monaco editor, entry-file selection, ZIP import/export and a sandboxed browser preview for web projects.
- **Sandboxed web preview (v2)** — HTML/CSS/JS previews run in an `allow-scripts` iframe with external resources blocked and console output streamed back to the learner.
- **Accessibility** — semantic landmarks, ARIA tabs/dialogs/live regions, visible focus states, 44px+ touch targets, reduced-motion support, and status shown with icons and labels, never colour alone.

## 1b. Registration and login come first

Learners create an account before entering the learning workspace.

| Public | Authenticated |
| --- | --- |
| `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/404` | `/dashboard`, `/playground`, `/workspace`, `/projects`, `/quiz-history`, `/settings`, `/help` |

- Opening an authenticated page while signed out redirects to `/login?next=<path>`; `next` is validated (same-origin, in-app routes only) and used after a successful sign-in.
- “Start Learning” goes to `/register` when signed out and `/dashboard` when signed in; “Open Playground” goes to `/login` when signed out and `/playground` when signed in.
- After registration or login you land on the requested route, otherwise `/dashboard`.
- Logout invalidates the server session, clears client auth state, and returns to `/login`.
- Every learner only ever reaches their own projects, files, executions, settings and quiz history — enforced in the SQL queries, not just the UI.

## 2. The most important learning rule

CodeMentor may identify errors, explain messages, describe what and why, give progressive hints, ask self-check questions, show diagrams, and generate quizzes. It must **never** generate the fix. The retry control is labelled exactly **“I Fixed It — Run Code Again”** and runs only the source currently in the editor — it never edits, applies or replaces the learner's code. When an error disappears, the UI shows: *“Great work—this error is no longer detected. You fixed it yourself.”*

## 3. Architecture

```text
codementor/
├─ client/                         # React + Vite + TypeScript SPA
│  ├─ index.html
│  ├─ vite.config.ts               # dev proxy: /api -> localhost:5000
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ tests/                       # node:test unit tests (run via tsx)
│  │  ├─ localAnalyzer.test.ts
│  │  └─ localQuiz.test.ts
│  └─ src/
│     ├─ App.tsx                   # route table
│     ├─ main.tsx                  # providers: ErrorBoundary, Settings, Toast, Auth, Router
│     ├─ index.css                 # design system
│     ├─ routeManifest.ts
│     ├─ auth/AuthContext.tsx      # v2: optional account state
│     ├─ web/sandboxPreview.ts     # v2: sandboxed HTML preview builder
│     ├─ api/client.ts             # frontend -> backend only
│     ├─ analyzers/
│     │  ├─ localAnalyzer.ts       # dispatcher + summary/visual/quiz readiness
│     │  ├─ ruleHelpers.ts         # error factories, known-error dictionaries
│     │  ├─ pythonRules.ts
│     │  ├─ javascriptRules.ts
│     │  ├─ typescriptRules.ts
│     │  └─ sqlRules.ts
│     ├─ components/               # Logo, ErrorBoundary, ui kit, AiHelpDialog
│     ├─ data/languages.ts         # single centralized language configuration
│     ├─ diagrams/                 # visualContract, svgVisuals, MermaidDiagram
│     ├─ editor/CodeEditor.tsx     # Monaco wrapper + error markers
│     ├─ features/
│     │  ├─ analysis/AnalysisPanel.tsx
│     │  ├─ visuals/VisualsTab.tsx
│     │  ├─ quiz/QuizPanel.tsx
│     │  ├─ console/ConsolePanel.tsx
│     │  └─ workspace/MultiFileWorkspace.tsx   # v2: multi-file workspace
│     ├─ hooks/                    # usePlayground, useToast, useAiUsage, useMediaQuery
│     ├─ layout/                   # AppLayout, Sidebar, Topbar
│     ├─ pages/                    # Landing, Dashboard, Playground, Workspace, Projects, QuizHistory, Settings, Help, Auth, Policy, NotFound
│     ├─ projects/projectStore.ts
│     ├─ quizzes/localQuiz.ts
│     ├─ runners/browserRunner.ts
│     ├─ settings/                 # defaults + SettingsContext
│     ├─ storage/localStorage.ts   # versioned keys + safe clearing
│     ├─ types/index.ts
│     └─ workers/                  # pythonRunner.worker.ts, javascriptRunner.worker.ts
├─ server/                         # Node + Express + TypeScript API
│  ├─ tsconfig.json
│  ├─ package.json
│  └─ src/
│     ├─ index.ts                  # helmet, cors, cookie-parser, schema boot, routers
│     ├─ config/env.ts             # the only place secrets are read
│     ├─ auth/auth.ts              # v2: sessions, CSRF, bcrypt, guards
│     ├─ cache/ttlCache.ts
│     ├─ controllers/apiControllers.ts
│     ├─ db/                       # v2: schema.sql, database.ts, migrate.ts
│     ├─ middleware/               # errorHandler, rateLimit
│     ├─ providers/                # secureExecutionProvider + provider selection
│     ├─ routes/                   # apiRouter, authRoutes, projectRoutes, aiRoutes, executionRoutes
│     ├─ services/aiService.ts     # hash cache, quota, cooldown, output limits
│     ├─ tests/auth.test.ts        # v2: schema/auth safety tests
│     ├─ types/index.ts
│     ├─ utils/hash.ts             # stableStringify / stableHash / truncate
│     └─ validators/requestSchemas.ts
├─ docs/
│  ├─ PROJECT_SPEC.md              # spec + honest implementation status
│  ├─ SECURITY_NOTES.md
│  ├─ TESTING.md
│  └─ MANUAL_TEST_CHECKLIST.md
├─ ARCHITECTURE.md                 # v2: full architecture map
├─ .env.example
├─ .gitignore
├─ package.json                    # npm workspaces
└─ README.md
```

### Data flow

1. The learner edits code in the browser. Autosave writes a local draft only — no run, no AI.
2. **Run Code** opens an authenticated WebSocket to the interactive runner. Source is sent only after the learner starts a run; the runner launches a fresh E2B sandbox with outbound internet disabled, streams output, and accepts live stdin until completion or cancellation.
3. The local analyzer runs **in the browser** and produces the `LocalAnalysis` object (summary, concepts, line explanations, errors, hints, tips, diagram, quiz readiness).
4. The UI renders Analysis, Visuals and Quiz from that object.
5. **Ask AI for Deeper Help** is the only automatic-free path to the backend. The browser POSTs one combined context; the backend hashes it, serves a cache hit for free, or calls the provider once.
6. Other backend calls are explicit and account-scoped: signing in, saving a multi-file project, and (for multi-file project execution) using the configured execution provider.

## 4. Technology stack

**Frontend:** React, Vite, TypeScript, React Router, Monaco Editor (`@monaco-editor/react`), Mermaid, Lucide React, Web Workers, `localStorage`, a React context store, a reusable UI kit, a toast system, an error boundary, and a custom 8px-rhythm design system in `index.css`.

**Backend:** Node.js, Express, TypeScript, Zod, dotenv, Helmet, CORS, express-rate-limit, and an in-memory TTL cache.

> Note: Tailwind is intentionally **not** used. The design system is a hand-written, token-based stylesheet (`index.css`) so the app ships no unused utility classes. This is a deliberate deviation from the original brief and is called out here for honesty.

## 5. Windows + VS Code setup

Open the `codementor` folder in VS Code, then run in **PowerShell**:

```powershell
# 1. Install the workspace tooling (concurrently, etc.)
npm install

# 2. Create environment files for the API and hosted runner
Copy-Item server\.env.example server\.env
Copy-Item runner\.env.example runner\.env

# 3. Create / validate the SQLite schema and seed the demo learner
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Set the same private random value as TERMINAL_RUNNER_SECRET in
#    server/.env and RUNNER_SHARED_SECRET in runner/.env.
#    Add E2B_API_KEY to runner/.env, then build the hosted toolchain template.
npm run runner:template

# 5. Start all services
npm run dev
```

Dependencies are hoisted to the workspace-root `node_modules`, so one
`npm install` covers the client, the server and the root tooling; `npm run
install:all` performs the same install explicitly.

Open <http://localhost:5173>. Interactive runs require an E2B account/API key, the built E2B language template, and matching private runner secrets. Local analysis does not require a runner or E2B key.

Prefer separate terminals?

```powershell
npm run dev:server   # Express API on http://localhost:5000
npm run dev:client   # Vite app on http://localhost:5173
npm run dev:runner   # Interactive runner on ws://127.0.0.1:5101
```

Verification commands:

```powershell
npm run check    # TypeScript typecheck for client and server
npm test         # node:test unit tests (analyzers, quiz engine, server hashing)
npm run build    # production build of the client
```

If PowerShell blocks npm scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

If a port is busy:

```powershell
npm run dev --prefix client -- --port 5174
```

## 6. Language support and status

One file, `client/src/data/languages.ts`, is the single source of truth. Each entry carries an internal key, display name, file extensions, Monaco language id, execution mode, status label and description, an `executionEnabled` flag, an `analysisSupported` flag, an optional provider language id, and a starter example.

| Group | Languages | Execution | Local analysis |
| --- | --- | --- | --- |
| Available console languages | Python, JavaScript, C, C++, Java | Yes — authenticated live WebSocket to an isolated sandbox with outbound internet disabled | Yes where applicable |
| Sandboxed preview | HTML | Yes — isolated iframe (Run Preview) | Yes |
| Coming soon | TypeScript, SQL, C#, Go, PHP, Ruby, Rust, Kotlin | Not selectable or runnable in the learner interface | Not advertised |

The provider adapters retain additional language mappings for backend and future use, but those languages are not presented as currently available to learners. Existing saved drafts in a coming-soon language remain non-runnable until the learner switches to an available language.

Coming-soon source files are not accepted by the single-file Playground upload. Multi-file projects may retain source files, but their coming-soon languages cannot be run.

## 7. Previous browser runner implementation

The older Python/Pyodide and JavaScript Web Worker adapters remain in the source tree for non-interactive use and their existing unit coverage. The Playground Run Code action uses the live E2B PTY runner for all executable console languages so it can pause for input. JavaScript programs can call `input('Enter a number: ')`; other languages use their usual standard-input APIs.

## 8. Secure remote execution for multi-file projects

> CodeMentor runs most supported console and multi-file learning projects in isolated environments. Some projects may be limited by compiler versions, security, runtime, memory, package, network, or platform requirements.

The Playground interactive runner is a separate Node service and executes source only inside E2B's isolated cloud sandboxes. It creates each sandbox with outbound internet disabled, uses a PTY to stream output and input, and kills the sandbox after each run. The Express API authenticates the learner session and proxies terminal messages; it does not compile or run learner programs itself. Learner code and interactive input are sent to E2B. The existing Judge0/Piston adapters below are used by multi-file project execution, not the Playground's live console.

### Judge0 CE (keyless) adapter — default

`EXECUTION_PROVIDER=judge0` selects a built-in adapter for [Judge0 CE](https://ce.judge0.com), a keyless, open-source remote runner. The backend retains mappings for nine compiled languages for future/provider compatibility; the current learner interface exposes only C, C++ and Java through multi-file execution. The adapter:

- calls `POST /submissions?base64_encoded=false&wait=true` with `{ source_code, language_id, stdin }`;
- maps all nine languages to verified Judge0 CE ids — `c → 103`, `cpp → 105`, `java → 91`, `csharp → 51`, `go → 107`, `php → 98`, `ruby → 72`, `rust → 108`, `kotlin → 111`;
- maps Judge0's integer status ids onto CodeMentor's honest model (Accepted → `success`, Compilation Error → `compilation_error` with the reported line, Time Limit Exceeded → `time_limit_exceeded`, SIGSEGV/abort/… → `runtime_error`, Internal / Exec Format Error → `internal_error`);
- reports peak memory (KB → bytes) and wall time (seconds → ms), and never invents a line when the diagnostic has none;
- sends the learner's source **exactly as written** — CodeMentor never edits, wraps or corrects it;
- shares one daily-limit + cooldown guard with every other provider, so the public runner's rate limit (roughly one request per second) never surfaces as the learner's error; a rate-limited response degrades to an honest `unavailable` with local guidance.

> **Historical provider verification:** C, C++, Java, C#, Go, PHP, Ruby, Rust and Kotlin returned `status: "success"` with exact program output in earlier provider checks; a deliberately broken C program returned `status: "compilation_error"` with `errorLine: 2`. These backend checks do not mean every mapped language is currently exposed in the learner interface.

When configured, `GET /api/execution-capabilities` can report provider readiness for the backend's mapped languages after a real submission probe. This API status does not expand the learner-facing language menu.

### Piston (keyless) adapter — alternative, with automatic fallback

`EXECUTION_PROVIDER=piston` instead selects a built-in adapter for the [Piston](https://github.com/engineer-man/piston) API. The adapter:

- calls `GET /runtimes` and caches the runtime list server-side for 10 minutes;
- calls `POST /execute` with `{ language, version, files[], stdin, compile_timeout, run_timeout, run_memory_limit }`;
- maps every advertised secure-runner language — `c → c`, `cpp → c++`, `java → java`, plus `csharp`, `go`, `php`, `ruby`, `rust`, `kotlin` — and picks the newest published version;
- sends the learner's own filenames so Java class names and C/C++ `#include`s stay valid, with a per-language fallback filename when no project files exist.

> **Verified finding (important):** the **public** Piston endpoint at `https://emkc.org/api/v2/piston` is **whitelist-only as of 2026-02-15** and returns **HTTP 401** for anonymous use:
>
> `Public Piston API is now whitelist only as of 2/15/2026. Please host your own instance...`
>
> So the public endpoint **cannot execute learner code**. `/api/execution-capabilities` reports this honestly because it *probes a real execution* rather than only listing runtimes.
>
> Rather than dead-ending the learner, the Piston path is wrapped in a **transparent Judge0 fallback**: when Piston refuses to execute (401/403), is unreachable, or rate-limits, the *same unmodified source* is retried on Judge0 CE and the real result is returned. A real compile or runtime result is never replaced — only a refusal is. Set `EXECUTION_JUDGE0_FALLBACK=false` to disable the retry.

**To run through your own Piston instance instead**, point the base URL at it:

```bash
# Docker must be installed and running
docker run -d --name piston -p 2000:2000 --privileged ghcr.io/engineer-man/piston
```

```dotenv
EXECUTION_PROVIDER=piston
EXECUTION_API_BASE_URL=http://localhost:2000/api/v2
EXECUTION_API_KEY=
```

Then restart the API. `/api/execution-capabilities` reports provider readiness with detected runtime versions; the current learner interface only exposes C/C++/Java through multi-file execution.

The exact capability statement above is also shown in the in-app Help centre.

Compiled languages are delegated to a vetted external runner through a provider interface:

- `SecureExecutionProvider` — the interface.
- `Judge0ExecutionProvider` — the default keyless Judge0 CE adapter (nine backend language mappings; only C/C++/Java currently run from the multi-file UI).
- `PistonExecutionProvider` — the keyless Piston adapter.
- `ResilientExecutionProvider` — wraps Piston with the transparent Judge0 retry described above.
- `LiveSecureExecutionProvider` — used only when `EXECUTION_API_BASE_URL` and `EXECUTION_API_KEY` are set; enforces a daily limit, a cooldown, a request timeout, and provider-side time/memory/output limits.
- `UnavailableExecutionProvider` — the honest fallback that returns `status: "unavailable"` and the message above.

A single shared guard (`executionGuard` / `recordExecution`) enforces the daily limit and cooldown for **every** remote provider, and a single shared `errorLineFromOutput` helper extracts the reported line for both normalizers, so the status and line rules are defined once and unit-tested.

Endpoints: `POST /api/run` (account-gated: requires a signed-in session and a CSRF token), `GET /api/execution-usage` and `GET /api/execution-capabilities` (open, so fair-use and readiness status show signed out). Responses never include corrected code, correction lines, patches or diffs.

## 8b. Accounts, project sync and the multi-file workspace (v2)

The whole local-first experience works signed-out. These additions are optional and never gate learning:

- **Optional accounts** — register, log in, log out, and password recovery. Passwords are bcrypt-hashed, sessions are opaque httpOnly cookies stored as hashes, and every state-changing request carries a double-submit CSRF token. Password reset is non-enumerable.
- **Server-side project sync** — signed-in learners save multi-file projects through the owner-scoped project API. Every file path is validated, files are capped per project, and a learner can only read or write their own rows.
- **Multi-file workspace** — `/workspace` (account-only) pairs a file explorer, the shared themed Monaco editor, entry-file selection, ZIP import/export and a sandboxed preview. Only this route is guarded; the Playground, analysis, visuals and quizzes stay open.
- **Sandboxed web preview** — HTML/CSS/JS projects render in an `sandbox="allow-scripts"` iframe. External resources and remote `<script src>` / `<link href>` tags are blocked with an explicit notice, and the preview's `console` output is streamed back to the workspace console.
- **Project execution history** — `POST /api/executions` snapshots the entry file, records a durable `ExecutionJob`, and delegates to the same secure provider. The backend still never compiles or runs learner code.

Endpoints: `GET /api/auth/csrf`, `POST /api/auth/register|login|logout|forgot-password|reset-password`, `GET /api/auth/me`, `GET|POST|PUT|DELETE /api/projects...` and `POST /api/executions`. The provider-backed `POST /api/deep-analyze` and `POST /api/run` require a signed-in session and a CSRF token; all read-only usage endpoints stay open.

SQLite is created automatically at boot (`ensureSchema()`); `npm run db:migrate` applies the same idempotent schema on demand. The database file lives at `DATABASE_URL` (default `file:./data/codementor.db`) and is git-ignored.

## 9. Local analysis, visuals and quizzes

The project retains local analyzer rules for Python, JavaScript, TypeScript and SQL. Only currently available language flows are exposed as supported choices; TypeScript and SQL remain marked Coming soon in the learner interface. Analyzer examples include syntax/traceback mapping (SyntaxError, IndentationError, NameError/ReferenceError, TypeError, ZeroDivisionError, IndexError, KeyError, ValueError, ImportError, RangeError), unmatched brackets, incomplete blocks, mixed indentation, literal division by zero, empty-collection denominators, off-by-one indexing, assignment-inside-condition, loose equality, SQL missing `FROM`, aggregate without `GROUP BY`, join without `ON`, unfiltered `DELETE`/`UPDATE`, and TypeScript `any` / non-null assertions.

Uncertainty labels — **Possible issue**, **Suggestion**, **Likely logic issue** — are shown next to the hints. Hints come in three progressive levels (gentle / guided / learning) and the selected level is chosen in Settings.

Visuals are chosen from detected structure via a specificity ladder: recursion → call stack, queue/stack usage → queue/stack, loop → iteration flow, condition → decision flow, function → input/process/output, dictionary/object → key/value, list/array → indexed boxes, otherwise → program flow. All nine kinds carry captions that state the rule the diagram teaches (e.g. a queue is described as *“adds at the back, removes from the front”*), and a function is only reported as **Recursion** when the call is actually inside its own body — a function merely called from elsewhere is never misclassified. SVG components render data structures inside editor-style diagram frames with a legend, and Mermaid renders a flowchart with `securityLevel: 'strict'` and `htmlLabels: false`; invalid diagrams fall back to honest text. Everything is labelled *“Generated locally from detected code structure.”* Runtime values are never invented — the dictionary diagram is deliberately schematic (`key → value` rows) rather than showing plausible-looking sample data.

The design system is hand-written CSS (`client/src/index.css`): Space Grotesk display type over DM Sans body text with JetBrains Mono for code, a slate token palette with a fixed accent grammar (indigo for actions/learning, violet reserved for AI, cyan for structure/visuals, green/amber/red for status), and a custom Monaco theme (`codementor-dark`/`codementor-light`) so the editor, diagrams and UI share one palette. Both themes and all motion preferences are honored.

A final **visual polish layer** (§24 of `index.css`) sits on top of the base system without changing any token name or component contract. It adds an ambient aurora wash behind the app, a subtle glass sheen to cards and stat tiles, a gradient rule under page headings, sticky translucent top bars, a terminal-style console well with a cyan prompt, a cyan aura on the generated-diagram frame, a soft pulse ring on empty states, and refined focus rings and scrollbars. It also defines the previously-missing `--card` token that the fullscreen preview referenced, and closes two responsive gaps that caused horizontal overflow at 768 px and 360 px. Every added animation is neutralised by the existing `prefers-reduced-motion` / `data-reduced-motion` guards.

Quizzes are generated locally from the learner's own code, concepts, errors and execution result. If too few safe questions exist, the app says: *“CodeMentor generated the available safe questions from this program. Add more concepts or analyze another program for more practice.”*

## 10. AI Deep Help and cost control

AI is **optional, backend-only, and never automatic**. The backend reads `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_API_TIMEOUT_MS`, `AI_DAILY_LIMIT`, `AI_COOLDOWN_SECONDS`, `AI_CACHE_TTL_SECONDS`, `AI_MAX_SOURCE_CHARS` and `AI_MAX_CONTEXT_LINES`. There is no `VITE_AI_API_KEY`, `VITE_API_KEY` or `VITE_AI_MODEL` anywhere. Google AI Studio credentials are sent only to Google's native Gemini endpoint from the server; for this integration use a currently available model such as `gemini-3.5-flash`. Google model availability/load can vary over time.

- The browser only ever calls `POST /api/deep-analyze` and `GET /api/ai-usage`. Deep Help is account-gated (signed-in session + CSRF token) so fair use stays fair; the usage endpoint stays open so the header can show status signed out. Signed out, the AI dialog offers a sign-in link instead of consuming a request.
- The learner clicks **Ask AI for Deeper Help** and confirms a dialog that shows **“AI Deep Help remaining today: X”**.
- The backend builds a stable hash from the source excerpt, language, execution result, local error fingerprints, explanation level, hint level, requested sections and model.
- Cache hit → returns `cached: true`, no provider call, **no quota consumed**. The UI says a saved explanation is available and that using it will not consume another request.
- Only failures, timeouts and malformed responses are exempt from quota too — they never count against the learner.
- Output is capped: summary ≤ 4 sentences, ≤ 5 concepts, ≤ 5 issue/hint items, ≤ 5 tips, ≤ 5 extra quiz questions. Large source is sent as a focused excerpt plus nearby lines and the local summary.
- At most **one** structured JSON repair retry, never a retry loop.
- If AI is missing, rate-limited or fails, the local analysis stays fully available.

AI is never called while typing, on page load, on tab switching, on theme/setting changes, on save, on local analysis, on visual/quiz generation, or on upload. Near the AI controls the UI shows **“Use Local Guidance First.”**

## 11. Security and privacy

- Helmet, a credential-aware CORS allowlist from `CLIENT_ORIGIN`, `cookie-parser`, an auth endpoint limiter, global and provider rate limiters, a 512 KB JSON limit, and Zod validation on every provider and account route.
- Sessions are opaque random tokens stored only as SHA-256 hashes in httpOnly cookies. State-changing requests require a double-submit CSRF token (`x-csrf-token` matching the `codementor_csrf` cookie).
- Project file paths are validated (`safePath`) and per-project file and byte caps are enforced before any row is written.
- The multi-file web preview runs in an `allow-scripts` iframe with external resources blocked, so preview code never shares the app's origin.
- Safe error responses — no stack traces, no secret logging. Errors are logged by short label only.
- Secrets live only in ignored environment files; `.env.example` files ship placeholders.
- Interactive runs require a signed-in session, same-origin WebSocket and CSRF validation. The API proxies to the runner using a private shared secret; the runner launches isolated E2B sandboxes without outbound internet and enforces output and time limits.
- Browser worker timeouts; code and input size limits; safe Mermaid; defensive `localStorage` handling.
- A React error boundary wraps the whole app.
- Do not enter passwords, personal information, tokens, database credentials or API keys into learning code.

Local storage uses versioned keys and discards corrupted values:

```
codementor:v1:settings
codementor:v1:draft
codementor:v1:projects
codementor:v1:quiz-history
codementor:v1:latest-local-analysis
codementor:v1:latest-deep-analysis
codementor:v1:latest-execution
```

No secrets are ever written to storage.

## 12. Environment file

Copy `server/.env.example` to `server/.env` and `runner/.env.example` to `runner/.env`. Create an E2B account/key and store it as `E2B_API_KEY` only in `runner/.env`. Set one private random secret as `TERMINAL_RUNNER_SECRET` in `server/.env` and `RUNNER_SHARED_SECRET` in `runner/.env`. Build the cloud toolchain template with `npm run runner:template`; this uses E2B's cloud builder and does not require local Docker. Then start all three development services with `npm run dev`. The runner listens only on localhost by default. Learner source and interactive input are sent to E2B through this service.

Interactive runner defaults: `TERMINAL_RUNNER_URL=ws://127.0.0.1:5101/session`, `RUNNER_HOST=127.0.0.1`, `RUNNER_PORT=5101`, and `E2B_TEMPLATE=codementor-interactive`. The E2B template contains additional toolchains, but only Python, JavaScript, C, C++ and Java are currently exposed in the Playground. Do not expose the runner service publicly without TLS and network access controls. Review E2B's current account limits and pricing before enabling user traffic.

The v2 account columns are optional but recommended when you enable accounts: `DATABASE_URL`, `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, plus `EXECUTION_MAX_FILES`, `EXECUTION_MAX_PROJECT_BYTES` and `EXECUTION_MAX_FILE_BYTES` for multi-file project limits.

> **Vercel + Supabase:** the server now stores data in Postgres (Supabase) instead of SQLite. See [`docs/DEPLOY_VERCEL_SUPABASE.md`](docs/DEPLOY_VERCEL_SUPABASE.md) for the deployment steps; the SQLite-specific notes below predate that change.

### Production deployment requirements

### Railway deployment

The root `railway.toml` deploys the React SPA and Express API together as one public service. The API serves the built client (including SPA history routes), and its HTTP server also accepts the `/api/terminal` WebSocket. Interactive execution is a separate, private runner service configured by `runner/railway.toml`.

1. Create a Railway project from this GitHub repository and add a PostgreSQL database. Keep a single backend instance: sessions, quotas and caches currently live in process memory.
2. Create the public **CodeMentor** service from the repository root. Railway uses the root `railway.toml`; the build compiles both the client and server, and the start command runs the compiled API. Add a public Railway domain to this service.
3. Add a second service from the same repository for the interactive runner. Set its **Root Directory** to `/runner` so it uses `runner/railway.toml`. Do not generate a public domain for this service; the API reaches it over Railway's private network.
4. Set the CodeMentor service variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}` (use the actual Railway PostgreSQL service name in the reference)
   - `CLIENT_ORIGIN=https://<your-codementor-domain>`
   - `SESSION_SECRET=<a unique random secret of at least 32 bytes>`
   - `TERMINAL_RUNNER_URL=ws://${{Runner.RAILWAY_PRIVATE_DOMAIN}}:8080/session` (use the actual runner service name and the runner's listening port; this project currently listens on Railway port `8080`)
   - `TERMINAL_RUNNER_SECRET=<the same random secret set on the runner>`
5. Set the runner service variables:
   - `RUNNER_SHARED_SECRET=<the exact same value as TERMINAL_RUNNER_SECRET>`
   - `E2B_API_KEY=<your E2B API key>`
   - `E2B_TEMPLATE=codementor-interactive`
   Railway's `PORT` variable is used automatically. Generate the E2B template with `npm run runner:template` from a trusted local environment configured with the E2B key if it does not already exist in that E2B account.
6. Add any optional `AI_API_*` values to the CodeMentor service only if AI Deep Help is desired. Judge0-based remote execution is configured by default; its availability and rate limits depend on the external Judge0 service.
7. Deploy both services, wait for their health checks, and verify `https://<your-codementor-domain>/api/health`, account sign-up/login, and an interactive program that reads input. The runner `/health` response reports whether its key is present, but a real E2B run is needed to verify the key and template.

Do not expose the runner service publicly or put `E2B_API_KEY`, database credentials, or either shared secret in client/build variables. Railway service-variable references are case-sensitive and must use the actual names of your database and runner services. Keep a single API instance unless session and quota state are moved to shared storage.

## 13. Testing

```powershell
npm test            # server, client and runner test suites
npm run check       # typecheck client and server
npm run build       # production client build
npm run db:generate # validate the schema
```

See [`docs/TESTING.md`](docs/TESTING.md) and [`docs/MANUAL_TEST_CHECKLIST.md`](docs/MANUAL_TEST_CHECKLIST.md) for the full manual matrix (landing, responsive layouts, each runner, error markers, hint levels, diagrams, quizzes, uploads, AI cache/quota/cooldown, missing configuration, no-auto-correction and no-secret-exposure checks).

## 14. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Hosted runner says `E2B_API_KEY` is missing | Add your E2B key to `runner/.env` only, then restart the runner service. |
| E2B reports that the language template is missing | Run `npm run runner:template` after setting `E2B_API_KEY` in `runner/.env`. |
| Interactive runner cannot be reached | Check that `server/.env` has `TERMINAL_RUNNER_URL` and the matching shared secret is configured in both server and runner environments. |
| Program runs but no input control appears | The input control appears after the console says the program is running; confirm your code reads from stdin. |
| “AI Deep Help is not configured” | Expected without AI keys. All local features still work. |
| “Secure execution is not configured…” in multi-file workspace | Configure the optional `EXECUTION_*` provider settings; Playground live runs use the separate E2B runner. |
| Port already in use | `npm run dev --prefix client -- --port 5174` |
| PowerShell blocks npm | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

## 15. Known limitations and roadmap

**Known limitations**

- The legacy Python/Pyodide adapter loads from a CDN; a production deployment should pin or self-host the asset.
- Interactive E2B runs are for small learning programs, not long-running work; E2B plan limits and charges may apply.
- Monaco loads from a CDN in development; production builds should bundle or self-host it.
- The default Judge0 CE runner is a **public** service with a fair-use rate limit (roughly one request per second). CodeMentor's shared cooldown keeps normal learning under it; heavy or classroom use should host a private Judge0/Piston instance. Judge0 CE compiles a single source file per run, so multi-file projects execute their entry file.
- Remote execution providers and AI providers are interfaces plus honest fallbacks until configured.
- The TTL cache and quota counters are per-process in memory; a multi-instance deployment needs shared storage.

**Roadmap**

- Verified safe TypeScript transpilation and execution.
- A sandboxed, credential-free SQL practice engine.
- Full live E2B validation after configuring the owner's API key and building the hosted template.
- Vitest + Playwright suites for component and browser-level coverage.
- Instructor views and shareable, read-only project links.
- Shared session/cache storage for multi-instance deployments (the SQLite file and in-memory caches are per-process today).

## 16. Validation notes (honest status)

This section states what was **actually run** and what remains, so nothing is
misrepresented.

**Verified commands**

| Command | Result |
| --- | --- |
| `npm run check` | Passed — client and server TypeScript checks. |
| `npm test` | Passed — 119 tests: 41 server, 62 client, and 16 runner tests. |
| `npm run build` | Passed — production client bundle built; Vite reports existing large-chunk size warnings. |
| `npm run db:generate` | Validates the schema and lists all 8 tables with their columns. |
| `npm run db:migrate` | Applies the SQLite schema successfully. |
| `npm run db:seed` | Creates the demo learner, a starter project and quiz history. |
| `GET /api/execution-capabilities` and `POST /api/run` | Historical provider checks cover backend adapters, including nine compiled-language mappings. These adapters are not equivalent to current learner-facing language availability; see §6. |

**Verified manually (live backend + browser)**

- Auth: register → session → `/me`, logout → `/login`, CSRF required (missing header → 403), path traversal rejected, unauth `/api/projects` → 401.
- Access model: signed-out `/dashboard` and `/workspace` redirect to `/login?next=…`; landing CTAs are auth-aware; all 7 authenticated routes render.
- Multi-file workspace: load, edit, save, hard-reload restore, sandboxed preview build with external resources blocked.
- HTML preview: language selector includes HTML, `Run Preview` renders in an `allow-scripts` iframe with the blocked-resource notice and a working console bridge (`Preview ready`), and `Run Code` stays disabled for HTML.
- Quiz API: `GET /api/quizzes` returns seeded + created records joined to project names; `POST /api/quizzes` creates one; unauth → 401.
- Settings API: `GET`/`PUT /api/settings` round-trip, and signing in adopts the account's saved theme (verified: server `light` applied on login).
- Cancel endpoint answers honestly (`Execution job not found.` for an unknown id).
- **Spec-parity audit (before the interactive-runner change):** historical browser checks covered the prior execution flow. The current interactive flow authenticates the signed-in session, Origin and CSRF token; the API proxies to a separately authenticated runner.
- **Previous browser-worker audit (before replacing the Playground Run Code flow):** learner-written Python/JavaScript success, stdin, errors and timeouts, plus the sandboxed HTML preview, were verified in a real browser. This does not validate the current E2B interactive path.

**Previous remote-provider verification (multi-file execution)**

- `provider: judge0`, `reachable: true`, nine languages `ready: true`, message “Secure runner ready for C, C++, Java, C#, Go, PHP, Ruby, Rust, Kotlin.”
- API runs: `c` → `Hello from C!`, `cpp` → `C++ runs`, `java` → `Java runs`, `csharp` → `C# runs`, `go` → `Go runs`, `php` → `PHP runs`, `ruby` → `Ruby runs`, `rust` → `Rust runs`, `kotlin` → `Kotlin runs` — every one `status: "success"`.
- Learning signal: a missing semicolon in C returned `status: "compilation_error"` with the compiler output and `errorLine: 2` — a real hint, never a fix.
- HTML: the sandboxed preview renders the starter in an iframe with the blocked-external-resources notice.

**Interactive E2B-runner verification**

- Runner startup/health, rejection of an invalid shared secret, the WebSocket protocol error response, and honest missing-E2B-credential behavior are covered by automated smoke tests.
- In this validation, the local API and runner `/health` endpoints both returned HTTP 200; the runner reported `configured: true`. The E2B key and matching server/runner shared-secret settings are present locally; their values were not printed.
- The health response confirms non-empty configuration only. This validation did not create an E2B sandbox or verify that the remote key and configured template can execute. Confirm the live E2B prompt → input → output flow before production traffic; prior browser/provider checks are historical and are not a substitute for a deployment smoke test.

**Still not implemented (tracked in `docs/PROJECT_SPEC.md`)**

- Live status streaming for multi-file execution jobs; those records remain separate from the Playground WebSocket terminal.
- Real cancellation against a provider that supports it (the adapter reports “not supported” honestly).
- Standalone **CSS** as its own Playground language (CSS is handled inside HTML projects and the multi-file workspace).
- Tailwind and Prisma/Drizzle were intentionally replaced by a hand-written design system and `node:sqlite`.

---

Built for learners, not shortcuts.
