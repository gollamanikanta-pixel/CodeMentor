# CodeMentor manual test checklist

Run `npm install`, then `npm run dev`, and open <http://localhost:5173>.
Check each item at 360px, 480px, 768px, 1024px, 1280px and 1440px widths unless a
row says otherwise.

## 1. Landing and navigation

- [ ] `/` renders hero, six feature areas, the three language-status cards, the local-first section, how-it-works and the footer.
- [ ] Nav links (Home, Features, How it works) scroll to the right sections.
- [ ] Theme toggle switches dark ↔ light and persists after reload.
- [ ] “Start Learning” and “Open Playground” navigate to `/playground`.
- [ ] Footer links (Playground, Help, Privacy, Terms, Feedback) navigate without errors.

## 2. Routes

- [ ] `/playground`, `/projects`, `/quiz-history`, `/settings`, `/help` each render inside the workspace shell.
- [ ] Signed-out visits to authenticated routes redirect to `/login?next=…` and return to the intended page after signing in.
- [ ] An unknown URL (e.g. `/nope`) renders the styled Not Found page inside the shell, with a working home link.

## 2b. Login → logout → re-login regression

- [ ] Log in, browse several pages (each load calls the session helpers), log out, then log in again with the same email and password — it always succeeds; it is never rejected with “Too many account requests.”
- [ ] `GET /api/auth/csrf` and `GET /api/auth/me` never count toward the credential-stuffing budget; only register/login/forgot-password/reset-password do.
- [ ] With two tabs open, a state-changing request in one tab still succeeds after the other tab loaded a page (the who-am-i endpoint no longer rotates the CSRF cookie).

## 3. Responsive layout

- [ ] Desktop: sidebar + editor + analysis panel + console are all readable.
- [ ] Tablet: panels reflow; editor stays usable.
- [ ] Mobile: panels stack, no horizontal scrolling, the sidebar starts collapsed, buttons stay tappable (44px+).
- [ ] No horizontal overflow at 760–900px: the account name and breadcrumbs drop out of the top bar before the single-column mobile layout takes over.
- [ ] At ≤560px the project bar and editor toolbar wrap instead of clipping their controls.
- [ ] The editor card and analysis panel each hug their own content (no large empty bordered panel when one column is taller).
- [ ] Both themes stay consistent: cards keep a faint top sheen, the console reads as a darker terminal well with a cyan prompt, and the diagram frame shows a soft cyan aura on hover.

## 3b. Secure runner capability statement

- [ ] The Help centre and README §8 both show the exact statement: “CodeMentor runs most supported console and multi-file learning projects in isolated environments. Some projects may be limited by compiler versions, security, runtime, memory, package, network, or platform requirements.”
- [ ] With the runner unconfigured, a compiled language shows “Secure runner unavailable” plus the exact “Secure execution is not configured…” message — never fake output.
- [ ] While capabilities load, the badge reads “Checking secure runner”, then resolves to ready/unavailable.

## 4. Python runner

- [ ] Load the Python starter and click **Run Code** → output shows `Class average: 84.25` and status `success`.
- [ ] First run shows “Preparing Python runtime…” in the console.
- [ ] Paste a program using `input()` and put values in **Program Input (stdin)** one per line → values are read in order.
- [ ] Introduce a `NameError` → console **Errors** tab shows it and the analyzer adds a learning error.
- [ ] Introduce a syntax error (e.g. a missing parenthesis) → `syntax_error` with a possible line.
- [ ] Write an infinite loop → times out after ~3s and the worker is terminated (page stays responsive).
- [ ] Enter code larger than 50 KB → blocked with a safe message.

## 5. JavaScript runner

- [ ] Load the JavaScript starter and run → output shows `Class average: 84.25`.
- [ ] `console.warn`/`console.error` appear under Errors; `log`/`info` under Output.
- [ ] `input()` reads stdin lines.
- [ ] Throwing an error reports `runtime_error` in well under a second.
- [ ] Infinite loop times out after ~3s.

## 6. Errors & Learning Hints

- [ ] The section label is exactly **“Errors & Learning Hints”**.
- [ ] Each issue shows category, likely line + confidence, technical message, what happened, why, a hint, a concept reminder, a self-check question and debugging steps.
- [ ] Changing **Hint level** in Settings switches between gentle / guided / learning hints.
- [ ] The retry button is labelled exactly **“I Fixed It — Run Code Again”** and runs only the current editor code.
- [ ] Fixing the issue and re-running shows: *“Great work—this error is no longer detected. You fixed it yourself.”*
- [ ] No corrected code, exact fix, patch, diff, Apply Fix, or Copy Fixed Code control appears anywhere.

## 7. Local analyzer

- [ ] Python: unmatched brackets, incomplete block, mixed tabs/spaces, literal `/0`, `len()` denominator, `arr[len(arr)]`, assignment inside `if`.
- [ ] JavaScript: unmatched brackets, `==`, `/0`, `.length` denominator, `<= arr.length`, assignment in condition.
- [ ] TypeScript: `any` annotation and non-null assertion hints; JSON tasks aimed at storage stay serializable.
- [ ] SQL: `SELECT` without `FROM`, aggregate without `GROUP BY`, `JOIN` without `ON`, `DELETE`/`UPDATE` without `WHERE`.
- [ ] Uncertainty labels (Possible issue / Suggestion / Likely logic issue) are visible.

## 8. Visuals

- [ ] **Visuals** tab shows an SVG diagram for the detected structure.
- [ ] A Mermaid flowchart renders for function/loop/decision code; invalid input falls back to honest text.
- [ ] Caption reads “Generated locally from detected code structure.”
- [ ] Expand/fullscreen toggles without breaking layout.

## 9. Quiz and history

- [ ] **Quiz** tab offers difficulty and 5/10/15 questions.
- [ ] **Generate Local Quiz** produces questions with exactly one correct answer and an explanation.
- [ ] Answering shows correct/incorrect feedback, progress, and a final score with concepts to review.
- [ ] If too few questions exist, the insufficient-questions note appears.
- [ ] `/quiz-history` shows completed quizzes, average score and concepts to review; empty state appears when there is no history.

## 10. Upload and projects

- [ ] Upload `.py`, `.js`, `.c`, `.cpp`, `.java` and `.html` files → the matching available language loads and feedback confirms the file stayed local.
- [ ] Upload `.ts`, `.sql`, `.cs`, `.go`, `.php`, `.rb`, `.rs` or `.kt` in the single-file Playground → it is rejected with a Coming soon message.
- [ ] Empty file and oversized file are rejected safely; unsupported types are rejected.
- [ ] **Save project** → the project appears on `/projects`.
- [ ] Search, language filter and grid/list toggle work.
- [ ] Rename, Duplicate, Export (downloads a `.txt`) and Delete (with confirmation) work.
- [ ] Empty state reads “Your saved projects will appear here.”

## 11. Coming soon languages

- [ ] The Playground and default-language menus keep TypeScript, SQL, C#, Go, PHP, Ruby, Rust and Kotlin visible with a Coming soon label and disabled selection.
- [ ] Legacy saved drafts in one of these languages show Coming soon and cannot be run; choosing an available language restores the normal starter/runtime flow.
- [ ] Multi-file projects may retain coming-soon source files, but attempting to run one reports Coming soon and does not call the execution API.
- [ ] No fake output or runtime errors are shown for coming-soon languages.

## 12. Available runners

- [ ] With the terminal runner unconfigured, the five available console languages do not show fabricated output; the Playground explains that the hosted interactive runner is unavailable.
- [ ] With the E2B runner configured, Python, JavaScript, C, C++ and Java starters run and stream actual output.
- [ ] Live stdin prompts accept input and continue output for each available language that requests it.
- [ ] A deliberately broken C program (a missing `;`) returns `compilation_error` with the compiler output and the reported line — a learning signal, never a fix or a patch.
- [ ] HTML Run Preview works in the sandboxed browser preview; the console Run Code action remains disabled for HTML.
- [ ] In the authenticated multi-file workspace, C/C++/Java use the secure remote runner; Python/JavaScript remain single-file Playground languages.
- [ ] Running twice within the cooldown shows the honest “cooling down” message rather than the runner's raw rate-limit error.

## 13. AI Deep Help

- [ ] “Ask AI for Deeper Help” opens a dialog showing provider readiness or the honest unconfigured state.
- [ ] With no AI keys: the dialog explains everything local remains available; confirming returns the safe message.
- [ ] With keys configured: requests are available on demand without an app-imposed daily cap or cooldown; Gemini's own quotas and billing still apply.
- [ ] Repeating the identical request returns `cached: true` and reuses the saved explanation.
- [ ] AI is never called on load, typing, tab switch, theme change, save, local analysis, visual/quiz generation, or upload (verify in the Network panel).

## 14. Security and privacy

- [ ] No `VITE_AI_API_KEY`, `VITE_API_KEY` or `VITE_AI_MODEL` appears in the client bundle or `.env.example`.
- [ ] `server/.env` is git-ignored; only `.env.example` placeholders exist.
- [ ] No secret appears in logs, URLs, `localStorage`, screenshots or user-facing errors.
- [ ] Provider routes reject invalid payloads with Zod and return safe messages (no stack traces).
- [ ] Rate limiters trigger a friendly message.
- [ ] Corrupted `localStorage` values are discarded rather than breaking the app.
- [ ] “Clear local data” asks for confirmation and removes only CodeMentor keys.

## 15. Accessibility

- [ ] Every icon-only button has an accessible name and tooltip.
- [ ] Tabs, dialogs and switches expose correct ARIA roles; Escape closes dialogs.
- [ ] Live regions announce run completion, detected errors, analysis completion and quiz submission.
- [ ] Status is conveyed with icon + label/badge, not colour alone.
- [ ] Keyboard-only navigation reaches every control with a visible focus ring.
- [ ] With “Reduced motion” enabled, animations and smooth scrolling are suppressed.

## 16. Accounts, project sync and the multi-file workspace (v2)

- [ ] Signed out, every existing route (Playground, Projects, Quiz History, Settings, Help) still works and `/workspace` redirects to `/login?next=/workspace`.
- [ ] Registering an account signs the learner in and lands on the workspace.
- [ ] Logging out clears the session cookie; reloading stays signed out.
- [ ] Password recovery never reveals whether an email exists.
- [ ] The workspace file explorer supports add/delete, and deleting the last file is refused.
- [ ] A ZIP import with an unsafe path or unsupported file type is rejected safely.
- [ ] Save persists the project and files; reloading the workspace restores them.
- [ ] The Preview tab renders the HTML entry file in a sandboxed iframe with a visible “external resources are blocked” notice.
- [ ] Preview `console.log` output appears in the workspace Console tab.
- [ ] A compiled-language project without a configured runner shows the honest “Secure execution is not configured…” state, never fake output.
- [ ] Requests without a matching CSRF header are rejected with a security-check message.
- [ ] Neither the session cookie value nor any API key appears in `localStorage` or in network responses.
