# CodeMentor

**Understand Code. Visualize Logic. Learn Better.**

CodeMentor is a local-first programming-learning platform for students and self-learners. Learners write, paste, upload and run their own code, see real output and errors, understand what happened and why, review line-by-line explanations, visualize program structure, practice with quizzes generated from their own code, save projects, and — only when they explicitly ask — request deeper guidance from a backend-only AI route.

CodeMentor **guides, it never auto-fixes**. It explains errors, highlights likely lines, gives progressive hints, asks self-check questions and suggests debugging steps. It never returns corrected code, exact corrected lines, patches, diffs, replacements, or copy-paste solutions, and it has no "Apply Fix" control.

---

## 1. Features

- **Playground workspace** — collapsible sidebar, Monaco editor, analysis panel, bottom console, and a sticky action toolbar.
- **Console runners** — Python and JavaScript run in browser workers; CodeMentor does not send their source to a remote execution service. C, C++ and Java run through the configured isolated execution service when each language is reported ready. Their source and stdin are sent only after the learner chooses **Run Code**. Python downloads Pyodide from jsDelivr, and learner programs may make their own network requests. HTML uses a sandboxed browser preview.
- **Local analysis** — rule-based guidance runs locally without AI, network access or code rewriting. Analyzer code for coming-soon languages remains internal and is not exposed as a supported language choice.
- **Errors & Learning Hints** — category badge, likely line with confidence, technical message, what happened, why, progressive hints, concept reminder, self-check question and debugging steps.
- **Local visuals** — accessible SVG data-structure diagrams plus safe Mermaid flowcharts generated from detected structure.
- **Local quiz generation** — concept, true/false, find-issue and debugging-strategy questions with 5/10/15 counts and three difficulty levels. Signed-in quiz results and history are stored in the account API; browser-only history is used only without an account.
- **Projects** — save, search, filter, rename, duplicate, export and delete; signed-in Playground source and project operations use the protected account API. Existing browser-only projects are not presented as account data.
- **Settings** — appearance, editor and learning preferences persist locally and sync to the signed-in account. Playground drafts remain browser-local; saving a project uploads source only on explicit action.
- **AI Deep Help and Chat (optional)** — on-demand, authenticated provider requests; Deep Help uses stable-hash caching, chat supports follow-up questions, and local guidance remains available when AI is unavailable.
- **Accounts** — register, log in, log out and recover a password before entering the authenticated workspace. Sessions are opaque httpOnly cookies; every state-changing request is CSRF-checked.
- **Account-backed projects and quiz history** — source files, projects, settings, quiz history and execution history use owner-scoped protected APIs. Signed-in learners can explicitly import legacy browser projects, the current draft (including standard input), and quiz summaries/history dates; the originals remain in browser storage.
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
│     ├─ auth/AuthContext.tsx      # authenticated account state
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
│     ├─ services/aiService.ts     # hash cache, provider requests, output limits
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

1. The learner edits code in the browser. Autosave writes a local draft only — no run, no AI, and no account project is changed until explicit save.
2. **Run Code** sends Python or JavaScript to a dedicated browser worker. Program execution stays in the browser; Python downloads its Pyodide runtime from jsDelivr. Stdin is supplied in **Program Input**. The local runner enforces a 50 KB source limit, a 10 KB input limit, a 45-second runtime bootstrap limit and a 3-second execution limit.
3. The local analyzer runs **in the browser** and produces the `LocalAnalysis` object (summary, concepts, line explanations, errors, hints, tips, diagram, quiz readiness).
4. The UI renders Analysis, Visuals and Quiz from that object.
5. **Ask AI for Deeper Help** is the only automatic-free path to the backend. The browser POSTs one combined context; the backend hashes it, serves a cache hit for free, or calls the provider once.
6. Other backend calls are explicit and account-scoped: signing in, saving Playground or multi-file project source, recording quiz results, and (for multi-file project execution) using the configured execution provider.

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

# 3. Validate the Postgres schema and seed the optional demo learner
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Optional legacy hosted terminal only: set matching private runner
#    secrets and E2B_API_KEY, then build its toolchain template.
#    Browser-local Python/JavaScript runs do not need this service.
npm run runner:template

# 5. Start all services
npm run dev
```

Dependencies are hoisted to the workspace-root `node_modules`, so one
`npm install` covers the client, the server and the root tooling; `npm run
install:all` performs the same install explicitly.

Open <http://localhost:5173>. Python and JavaScript Playground runs work in the browser and do not require the E2B runner or its API key. Account-backed features still need the API and database; E2B is only for the optional legacy terminal service.

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
| Available local console languages | Python, JavaScript | Yes — local browser workers; stdin is supplied before the run | Yes |
| Available secure remote console languages | C, C++, Java | Yes when the configured isolated runner reports the language ready; source and stdin are sent only after Run Code | Structural guidance |
| Sandboxed preview | HTML | Yes — isolated iframe (Run Preview) | Yes |
| Coming soon | TypeScript, SQL, C#, Go, PHP, Ruby, Rust, Kotlin | Not selectable or runnable in the learner interface | Not advertised |

The provider adapters retain additional language mappings for backend and future use, but those languages are not presented as currently available to learners. Existing saved drafts in a coming-soon language remain non-runnable until the learner switches to an available language.

Coming-soon source files are not accepted by the single-file Playground upload. Multi-file projects may retain source files, but their coming-soon languages cannot be run.

## 7. Local browser runners

Python and JavaScript run in dedicated Web Workers and do not use the hosted terminal service. Supply input in the Playground's **Program Input** panel before running. Python loads a pinned Pyodide runtime from jsDelivr on first use; later runs reuse it for that page session. Source and input are not uploaded by the runner, but learner programs can access browser network APIs, so do not put secrets in code.

## 8. Secure remote execution

> CodeMentor runs most supported console and multi-file learning projects in isolated environments. Some projects may be limited by compiler versions, security, runtime, memory, package, network, or platform requirements.

The legacy interactive terminal is a separate Node service and uses E2B cloud sandboxes. The Playground does not call that WebSocket service: Python and JavaScript run locally, while C/C++/Java use the authenticated secure-run API when the readiness check passes. Source for secure runs is sent to the selected remote provider only after the learner chooses **Run Code**.

### Judge0 CE (keyless) adapter — default

`EXECUTION_PROVIDER=judge0` selects a built-in adapter for [Judge0 CE](https://ce.judge0.com), a keyless, open-source remote runner. The backend retains mappings for nine compiled languages for future/provider compatibility; the current learner interface exposes C, C++ and Java through the single-file Playground and multi-file execution. The adapter:

- calls `POST /submissions?base64_encoded=false&wait=true` with `{ source_code, language_id, stdin }`;
- maps all nine languages to verified Judge0 CE ids — `c → 103`, `cpp → 105`, `java → 91`, `csharp → 51`, `go → 107`, `php → 98`, `ruby → 72`, `rust → 108`, `kotlin → 111`;
- maps Judge0's integer status ids onto CodeMentor's honest model (Accepted → `success`, Compilation Error → `compilation_error` with the reported line, Time Limit Exceeded → `time_limit_exceeded`, SIGSEGV/abort/… → `runtime_error`, Internal / Exec Format Error → `internal_error`);
- reports peak memory (KB → bytes) and wall time (seconds → ms), and never invents a line when the diagnostic has none;
- sends the learner's source **exactly as written** — CodeMentor never edits, wraps or corrects it;
- shares one daily-limit + cooldown guard with every other provider, so the public runner's rate limit (roughly one request per second) never surfaces as the learner's error; a rate-limited response degrades to an honest `unavailable` with local guidance.

> **Historical provider verification:** C, C++, Java, C#, Go, PHP, Ruby, Rust and Kotlin returned `status: "success"` with exact program output in earlier provider checks; a deliberately broken C program returned `status: "compilation_error"` with `errorLine: 2`. These backend checks do not mean every mapped language is currently exposed in the learner interface.

When configured, `GET /api/execution-capabilities` reports provider readiness for the backend's mapped languages after a real submission probe. The single-file Run button for C, C++ and Java is enabled only when the service reports that language ready; this status does not expand the learner-facing language menu.

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

Then restart the API. `/api/execution-capabilities` reports provider readiness with detected runtime versions; the learner interface exposes C/C++/Java through the single-file Playground and multi-file execution when ready.

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

## 8b. Accounts, project sync and the multi-file workspace

Account storage backs authenticated learner data. Local analysis and unsaved drafts stay in the browser, but account projects and quiz history are never silently substituted from local storage:

- **Accounts** — passwords are bcrypt-hashed, sessions are opaque httpOnly cookies stored as hashes, and every state-changing request carries a double-submit CSRF token. Password reset is non-enumerable.
- **Playground project/source sync** — explicit saves create or update account-owned project source; Projects opens saved source back in the Playground. The autosaved working draft remains local.
- **Account-backed quiz history** — generated quizzes stay local, while completed signed-in quiz scores are written to the authenticated API. A failed save is reported and is not written to local history as a misleading fallback.
- **Multi-file workspace** — `/workspace` pairs a file explorer, the shared themed Monaco editor, entry-file selection, ZIP import/export and a sandboxed preview. Files are edited locally until explicitly saved to the protected project API; when account storage is unavailable, the workspace shows an error instead of presenting a local project as synced.
- **Sandboxed web preview** — HTML/CSS/JS projects render in an `sandbox="allow-scripts"` iframe. External resources and remote `<script src>` / `<link href>` tags are blocked with an explicit notice, and the preview's `console` output is streamed back to the workspace console.
- **Project execution history** — `POST /api/executions` snapshots the entry file, records a durable `ExecutionJob`, and delegates to the same secure provider. The backend still never compiles or runs learner code.

Endpoints: `GET /api/auth/csrf`, `POST /api/auth/register|login|logout|forgot-password|reset-password`, `GET /api/auth/me`, `GET|POST|PUT|DELETE /api/projects...` and `POST /api/executions`. The provider-backed `POST /api/deep-analyze`, `POST /api/ai-chat` and `POST /api/run` require a signed-in session and a CSRF token; all read-only usage endpoints stay open.

Account data uses the existing Postgres schema (`server/src/db/schema.sql`). `DATABASE_URL` must be a PostgreSQL connection string; `npm run db:migrate` applies the schema to that configured database. The production Railway Postgres design is unchanged.

## 9. Local analysis, visuals and quizzes

The project retains local analyzer rules for Python, JavaScript, TypeScript and SQL. Only currently available language flows are exposed as supported choices; TypeScript and SQL remain marked Coming soon in the learner interface. Analyzer examples include syntax/traceback mapping (SyntaxError, IndentationError, NameError/ReferenceError, TypeError, ZeroDivisionError, IndexError, KeyError, ValueError, ImportError, RangeError), unmatched brackets, incomplete blocks, mixed indentation, literal division by zero, empty-collection denominators, off-by-one indexing, assignment-inside-condition, loose equality, SQL missing `FROM`, aggregate without `GROUP BY`, join without `ON`, unfiltered `DELETE`/`UPDATE`, and TypeScript `any` / non-null assertions.

Uncertainty labels — **Possible issue**, **Suggestion**, **Likely logic issue** — are shown next to the hints. Hints come in three progressive levels (gentle / guided / learning) and the selected level is chosen in Settings.

Visuals are chosen from detected structure via a specificity ladder: recursion → call stack, queue/stack usage → queue/stack, loop → iteration flow, condition → decision flow, function → input/process/output, dictionary/object → key/value, list/array → indexed boxes, otherwise → program flow. All nine kinds carry captions that state the rule the diagram teaches (e.g. a queue is described as *“adds at the back, removes from the front”*), and a function is only reported as **Recursion** when the call is actually inside its own body — a function merely called from elsewhere is never misclassified. SVG components render data structures inside editor-style diagram frames with a legend, and Mermaid renders a flowchart with `securityLevel: 'strict'` and `htmlLabels: false`; invalid diagrams fall back to honest text. Everything is labelled *“Generated locally from detected code structure.”* Runtime values are never invented — the dictionary diagram is deliberately schematic (`key → value` rows) rather than showing plausible-looking sample data.

The design system is hand-written CSS (`client/src/index.css`): Space Grotesk display type over DM Sans body text with JetBrains Mono for code, a slate token palette with a fixed accent grammar (indigo for actions/learning, violet reserved for AI, cyan for structure/visuals, green/amber/red for status), and a custom Monaco theme (`codementor-dark`/`codementor-light`) so the editor, diagrams and UI share one palette. Both themes and all motion preferences are honored.

A final **visual polish layer** (§24 of `index.css`) sits on top of the base system without changing any token name or component contract. It adds an ambient aurora wash behind the app, a subtle glass sheen to cards and stat tiles, a gradient rule under page headings, sticky translucent top bars, a terminal-style console well with a cyan prompt, a cyan aura on the generated-diagram frame, a soft pulse ring on empty states, and refined focus rings and scrollbars. It also defines the previously-missing `--card` token that the fullscreen preview referenced, and closes two responsive gaps that caused horizontal overflow at 768 px and 360 px. Every added animation is neutralised by the existing `prefers-reduced-motion` / `data-reduced-motion` guards.

Quizzes are generated locally from the learner's own code, concepts, errors and execution result. If too few safe questions exist, the app says: *“CodeMentor generated the available safe questions from this program. Add more concepts or analyze another program for more practice.”*

## 10. AI Deep Help, Chat and cost control

AI is **optional, backend-only, and never automatic**. The backend reads `AI_API_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_API_TIMEOUT_MS`, `AI_CACHE_TTL_SECONDS`, `AI_MAX_SOURCE_CHARS` and `AI_MAX_CONTEXT_LINES`. There is no client-side provider key or app-imposed daily request cap/cooldown. Gemini account quotas and billing still apply. The service supports OpenAI-compatible chat-completions endpoints and Google's native Gemini API adapter.

To enable Deep Help and Chat, configure all three provider values on the **server only** (never in Vite or browser settings):

```text
AI_API_BASE_URL=<provider chat-completions URL, or https://generativelanguage.googleapis.com for Gemini>
AI_API_KEY=<provider credential>
AI_MODEL=<model name available to your provider account>
```

For OpenAI-compatible providers, `AI_API_BASE_URL` should be the provider's complete chat-completions endpoint. For Gemini, use the API origin shown above and the provider's currently available model name. Settings exposes only whether the backend reports a complete configuration; it never displays or stores the key. A signed-in learner must also have **Enable AI Deep Help** on in account settings; the backend enforces that preference as well as authentication and CSRF. The provider credential, billing/access and model selection must be supplied by the deployment owner.

- The browser calls `POST /api/deep-analyze`, `POST /api/ai-chat` and `GET /api/ai-usage`. Both AI features are account-gated (signed-in session + CSRF token) and check the learner's saved account setting; the usage endpoint returns only safe provider readiness.
- AI Chat sends the code context and recent conversation only when the learner sends a message; the chat endpoint is rate-limited to 10 requests per minute. Gemini account quotas and billing apply.
- The backend builds a stable hash from the source excerpt, language, execution result, local error fingerprints, explanation level, hint level, requested sections and model.
- Cache hit → returns `cached: true` without a provider call.
- AI Chat carries up to 10 recent conversation messages for follow-up questions and is not cached.
- Output is capped: summary ≤ 4 sentences, ≤ 5 concepts, ≤ 5 issue/hint items, ≤ 5 tips, ≤ 5 extra quiz questions. Large source is sent as a focused excerpt plus nearby lines and the local summary.
- At most **one** structured JSON repair retry, never a retry loop.
- If AI is missing, the provider rejects or rate-limits the request, or a call fails, the local analysis stays fully available.

AI is never called while typing, on page load, on tab switching, on theme/setting changes, on save, on local analysis, on visual/quiz generation, or on upload. Near the AI controls the UI shows **“Use Local Guidance First.”**

## 11. Security and privacy

- Helmet, a credential-aware CORS allowlist from `CLIENT_ORIGIN`, `cookie-parser`, an auth endpoint limiter, global and provider rate limiters, a 512 KB JSON limit, and Zod validation on every provider and account route.
- Sessions are opaque random tokens stored only as SHA-256 hashes in httpOnly cookies. State-changing requests require a double-submit CSRF token (`x-csrf-token` matching the `codementor_csrf` cookie).
- Project file paths are validated (`safePath`) and per-project file and byte caps are enforced before any row is written.
- The multi-file web preview runs in an `allow-scripts` iframe with external resources blocked, so preview code never shares the app's origin.
- Safe error responses — no stack traces, no secret logging. Errors are logged by short label only.
- Secrets live only in ignored environment files; `.env.example` files ship placeholders.
- Browser-local Python/JavaScript runs use worker termination, code and input size limits and runtime timeouts; Python fetches its runtime from jsDelivr. Learner code can make its own network requests.
- The optional legacy hosted terminal requires a signed-in session, same-origin WebSocket and CSRF validation; the API proxies to its E2B runner using a private shared secret.
- Safe Mermaid; defensive `localStorage` handling.
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

Signed-in project source and quiz history use the protected account API rather
than mirroring into the `projects` and `quiz-history` browser keys. Account API
failures stay visible instead of falling back to those local/legacy values.
Playground drafts and transient learning state remain local by design.

No secrets are ever written to storage.

## 12. Environment file

Copy `server/.env.example` to `server/.env` for the API. The separate E2B runner configuration below is optional legacy setup; browser-local Python and JavaScript Playground runs do not need an E2B account, API key or runner service. If you explicitly exercise the legacy hosted terminal, configure its E2B key and shared secrets in the server and runner environments, build its template with `npm run runner:template`, then start all three services with `npm run dev`. The runner listens only on localhost by default, and source/input sent to that service are sent to E2B.

Legacy interactive runner defaults: `TERMINAL_RUNNER_URL=ws://127.0.0.1:5101/session`, `RUNNER_HOST=127.0.0.1`, `RUNNER_PORT=5101`, and `E2B_TEMPLATE=codementor-interactive`. The single-file Playground does not use this service. Do not expose the runner publicly without TLS and network access controls. Review E2B's current account limits and pricing before enabling user traffic.

Account features require `DATABASE_URL` (Postgres) and a strong `SESSION_SECRET`; configure `SESSION_COOKIE_NAME` and `SESSION_TTL_DAYS` as needed. `EXECUTION_MAX_FILES`, `EXECUTION_MAX_PROJECT_BYTES` and `EXECUTION_MAX_FILE_BYTES` control multi-file project limits.

> **Production deployment:** use Vercel for the app and API and Supabase Postgres for account, project, quiz and execution data. Follow [`docs/DEPLOY_VERCEL_SUPABASE.md`](docs/DEPLOY_VERCEL_SUPABASE.md).

### Production deployment: Vercel + Supabase

This repository's production target is Vercel for the frontend and API and
Supabase Postgres for account-backed data. Follow the full setup and
verification steps in [`docs/DEPLOY_VERCEL_SUPABASE.md`](docs/DEPLOY_VERCEL_SUPABASE.md).
Vercel serverless functions do not support the long-lived WebSocket connection
used by the legacy interactive terminal. Python and JavaScript now run in
browser workers without that service; single-request secure-run endpoints for
multi-file projects remain separate.

## 13. Testing

```powershell
npm test            # server, client and runner test suites
npm run check       # typecheck client and server
npm run build       # production client build
npm run db:generate # validate the schema
```

See [`docs/TESTING.md`](docs/TESTING.md) and [`docs/MANUAL_TEST_CHECKLIST.md`](docs/MANUAL_TEST_CHECKLIST.md) for the full manual matrix (landing, responsive layouts, each runner, error markers, hint levels, diagrams, quizzes, uploads, AI cache and availability, missing configuration, no-auto-correction and no-secret-exposure checks).

## 14. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Python is still preparing the local runtime | Check the connection to jsDelivr; Pyodide is downloaded from its CDN on first use. |
| Program input is not received | Add one input value per line under **Program Input** before starting the run. |
| “AI Deep Help is not configured” | Expected without AI keys. All local features still work. |
| “Secure execution is not configured…” in multi-file workspace | Configure the optional `EXECUTION_*` provider settings; single-file Python/JavaScript runs do not use that provider. |
| Port already in use | `npm run dev --prefix client -- --port 5174` |
| PowerShell blocks npm | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

## 15. Known limitations and roadmap

**Known limitations**

- Python loads its pinned Pyodide runtime from jsDelivr on first use; the learner's program can access browser network APIs.
- The optional legacy E2B terminal is not used by the single-file Playground; E2B plan limits and charges may apply if that service is explicitly enabled elsewhere.
- Monaco loads from a CDN in development; production builds should bundle or self-host it.
- The default Judge0 CE runner is a **public** service with a fair-use rate limit (roughly one request per second). CodeMentor's shared cooldown keeps normal learning under it; heavy or classroom use should host a private Judge0/Piston instance. Judge0 CE compiles a single source file per run, so multi-file projects execute their entry file.
- Remote execution providers and AI providers are interfaces plus honest fallbacks until configured.
- The TTL cache and quota counters are per-process in memory; a multi-instance deployment needs shared storage.

**Roadmap**

- Verified safe TypeScript transpilation and execution.
- A sandboxed, credential-free SQL practice engine.
- Optional legacy E2B terminal validation after configuring an API key and building its hosted template.
- Vitest + Playwright suites for component and browser-level coverage.
- Instructor views and shareable, read-only project links.
- Shared session/cache storage for multi-instance deployments (session, AI response cache and runner cooldown state are currently per-process).

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
| `npm run db:migrate` | Applies the Postgres schema when a valid `DATABASE_URL` is available. |
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
- **Current single-file runner validation:** Python and JavaScript use browser workers; automated client tests and the production build pass. Confirm first-use Pyodide loading from jsDelivr in the target browser.

**Previous remote-provider verification (multi-file execution)**

- `provider: judge0`, `reachable: true`, nine languages `ready: true`, message “Secure runner ready for C, C++, Java, C#, Go, PHP, Ruby, Rust, Kotlin.”
- API runs: `c` → `Hello from C!`, `cpp` → `C++ runs`, `java` → `Java runs`, `csharp` → `C# runs`, `go` → `Go runs`, `php` → `PHP runs`, `ruby` → `Ruby runs`, `rust` → `Rust runs`, `kotlin` → `Kotlin runs` — every one `status: "success"`.
- Learning signal: a missing semicolon in C returned `status: "compilation_error"` with the compiler output and `errorLine: 2` — a real hint, never a fix.
- HTML: the sandboxed preview renders the starter in an iframe with the blocked-external-resources notice.

**Legacy E2B-runner verification (historical; not used by the single-file Playground)**

- Runner startup/health, rejection of an invalid shared secret, the WebSocket protocol error response, and honest missing-E2B-credential behavior are covered by automated smoke tests.
- In this validation, the local API and runner `/health` endpoints both returned HTTP 200; the runner reported `configured: true`. The E2B key and matching server/runner shared-secret settings are present locally; their values were not printed.
- The health response confirms non-empty configuration only. This validation did not create an E2B sandbox or verify that the remote key and configured template can execute.

**Still not implemented (tracked in `docs/PROJECT_SPEC.md`)**

- Live status streaming for multi-file execution jobs; those records remain separate from the Playground WebSocket terminal.
- Real cancellation against a provider that supports it (the adapter reports “not supported” honestly).
- Standalone **CSS** as its own Playground language (CSS is handled inside HTML projects and the multi-file workspace).
- Tailwind and Prisma/Drizzle were intentionally replaced by a hand-written design system and direct parameterized Postgres queries.

---

Built for learners, not shortcuts.
