import type { DeepAnalysis, ExecutionResult, LanguageName, LocalAnalysis, QuizRecord } from '../types';

/**
 * The browser talks to AI and secure execution only through this backend.
 * No AI or execution keys ever reach this module.
 */

async function postJson<T>(path: string, payload: unknown): Promise<{ ok: boolean; data: T & { message?: string } }> {
  // Provider-backed POSTs are account-gated, so they must carry the session
  // cookie and echo the CSRF token like every other state-changing request.
  const token = readCsrfCookie() || (await fetchCsrfToken().catch(() => ''));
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-csrf-token': token } : {}) },
    body: JSON.stringify(payload),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: response.ok, data: data as T & { message?: string } };
}

export type DeepHelpPayload = {
  source: string;
  language: LanguageName;
  execution?: ExecutionResult | null;
  localAnalysis?: LocalAnalysis | null;
  explanationLevel?: string;
  hintLevel?: string;
  sections?: string[];
};

export function requestDeepHelp(payload: DeepHelpPayload) {
  return postJson<DeepAnalysis>('/api/deep-analyze', payload);
}

export function requestSecureRun(payload: { source: string; stdin: string; language: string }) {
  return postJson<ExecutionResult>('/api/run', payload);
}

export async function getAiUsage() {
  const response = await fetch('/api/ai-usage');
  if (!response.ok) throw new Error('usage-unavailable');
  return (await response.json()) as {
    configured: boolean;
  };
}

export type ExecutionCapabilityEntry = { ready: boolean; version: string | null; note: string };
export type ExecutionCapabilities = {
  provider: string;
  reachable: boolean;
  checkedAt: string;
  languages: Record<string, ExecutionCapabilityEntry>;
  message: string;
};

/** Probes the backend for what the secure runner can actually do right now. */
export async function getExecutionCapabilities(): Promise<ExecutionCapabilities | null> {
  try {
    const response = await fetch('/api/execution-capabilities');
    if (!response.ok) return null;
    return (await response.json()) as ExecutionCapabilities;
  } catch {
    return null;
  }
}

export async function getExecutionUsage() {
  const response = await fetch('/api/execution-usage');
  if (!response.ok) throw new Error('usage-unavailable');
  return (await response.json()) as {
    remaining: number;
    limit: number;
    configured: boolean;
    cooldownSeconds: number;
  };
}

/* ------------------------------------------------------------------ v2 ----
 * Accounts, server-side project sync and project-aware execution. Every call
 * uses cookies (`credentials: 'include'`) and echoes the CSRF token for any
 * state-changing request, so nothing here ever weakens the local-first path.
 */

export type AccountUser = { id: string; fullName: string; email: string; createdAt?: string; lastLoginAt?: string | null };

export type ProjectFileRecord = {
  id: string;
  projectId: string;
  relativePath: string;
  filename: string;
  extension: string;
  language: string;
  content: string;
  isEntryFile: number;
};

export type ProjectRecord = {
  id: string;
  title: string;
  primaryLanguage: string;
  entryFile: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = { project: ProjectRecord; files: ProjectFileRecord[] };

export function readCsrfCookie(): string {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('codementor_csrf='))
    ?.split('=')[1] || '';
}

/** Fetches a fresh CSRF token from the backend (and sets the cookie). */
export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!response.ok) throw new Error('Could not prepare the secure terminal connection. Refresh the page and sign in again.');
  const data = (await response.json()) as { csrfToken: string };
  return data.csrfToken;
}

export async function openInteractiveTerminal(): Promise<WebSocket> {
  const token = readCsrfCookie() || (await fetchCsrfToken());
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/api/terminal`, ['codementor.terminal.v1', token]);
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The hosted interactive runner could not be reached. Check that the API and runner services are running.'));
    };
    const onClose = () => {
      cleanup();
      reject(new Error('The terminal connection closed before the program could start.'));
    };
    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
    };
    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
    socket.addEventListener('close', onClose, { once: true });
  });
  return socket;
}

async function sendJson<T>(path: string, method: string, payload?: unknown): Promise<{ ok: boolean; status: number; data: T & { message?: string } }> {
  const token = readCsrfCookie() || (await fetchCsrfToken().catch(() => ''));
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-csrf-token': token } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data: data as T & { message?: string } };
}

export async function getCurrentUser(): Promise<AccountUser | null> {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return null;
    const data = (await response.json()) as { user: AccountUser };
    return data.user;
  } catch {
    return null;
  }
}

export function loginAccount(payload: { email: string; password: string; remember?: boolean }) {
  return sendJson<{ user: AccountUser }>('/api/auth/login', 'POST', payload);
}

export function registerAccount(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}) {
  return sendJson<{ user: AccountUser }>('/api/auth/register', 'POST', payload);
}

export async function logoutAccount() {
  await sendJson('/api/auth/logout', 'POST');
}

export function requestPasswordReset(payload: { email: string }) {
  return sendJson<{ message: string }>('/api/auth/forgot-password', 'POST', payload);
}

export function resetPassword(payload: { token: string; password: string; confirmPassword: string }) {
  return sendJson<{ message: string }>('/api/auth/reset-password', 'POST', payload);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const response = await fetch('/api/projects', { credentials: 'include' });
  if (!response.ok) throw new Error('projects-unavailable');
  const data = (await response.json()) as { projects: ProjectRecord[] };
  return data.projects;
}

export function createProject(payload: { title: string; primaryLanguage: string; entryFile?: string }) {
  return sendJson<{ project: ProjectRecord }>('/api/projects', 'POST', payload);
}

export async function getProject(projectId: string): Promise<ProjectDetail | null> {
  const response = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
  if (!response.ok) return null;
  return (await response.json()) as ProjectDetail;
}

export function updateProject(projectId: string, payload: { title?: string; entryFile?: string; primaryLanguage?: string }) {
  return sendJson<{ project: ProjectRecord }>(`/api/projects/${projectId}`, 'PUT', payload);
}

export function deleteProject(projectId: string) {
  return sendJson(`/api/projects/${projectId}`, 'DELETE');
}

export function createProjectFile(
  projectId: string,
  payload: { relativePath: string; filename: string; language: string; content: string; isEntryFile?: boolean },
) {
  return sendJson<{ file: ProjectFileRecord }>(`/api/projects/${projectId}/files`, 'POST', payload);
}

export function updateProjectFile(projectId: string, fileId: string, payload: { content: string; isEntryFile?: boolean }) {
  return sendJson<{ file: ProjectFileRecord }>(`/api/projects/${projectId}/files/${fileId}`, 'PUT', payload);
}

export function deleteProjectFile(projectId: string, fileId: string) {
  return sendJson(`/api/projects/${projectId}/files/${fileId}`, 'DELETE');
}

export function runProjectExecution(payload: {
  projectId?: string;
  source?: string;
  stdin?: string;
  language: string;
  entryFile?: string;
}) {
  return sendJson<ExecutionResult & { jobId?: string }>('/api/executions', 'POST', payload);
}

export async function getExecutionJob(jobId: string) {
  const response = await fetch(`/api/executions/${jobId}`, { credentials: 'include' });
  if (!response.ok) return null;
  return (await response.json()) as { job: Record<string, unknown> };
}

/** Cancellation depends on the provider; the backend reports honestly if unsupported. */
export function cancelExecution(jobId: string) {
  return sendJson<{ message?: string; cancelled?: boolean }>(`/api/executions/${jobId}/cancel`, 'POST');
}

/* -- Quiz history --------------------------------------------------------- */

export async function listQuizzes(): Promise<QuizRecord[]> {
  const response = await fetch('/api/quizzes', { credentials: 'include' });
  if (!response.ok) throw new Error('quizzes-unavailable');
  const data = (await response.json()) as { quizzes: QuizRecord[] };
  return data.quizzes;
}

export function createQuiz(payload: {
  project: string;
  projectId?: string;
  language: string;
  difficulty: string;
  score: number;
  total: number;
  percentage: string;
  conceptsToReview: string[];
}) {
  return sendJson<{ quiz: QuizRecord }>('/api/quizzes', 'POST', payload);
}

/* -- Settings ------------------------------------------------------------- */

export async function getAccountSettings(): Promise<Record<string, unknown> | null> {
  const response = await fetch('/api/settings', { credentials: 'include' });
  if (!response.ok) return null;
  const data = (await response.json()) as { settings: Record<string, unknown> };
  return data.settings;
}

export function updateAccountSettings(patch: Record<string, unknown>) {
  return sendJson<{ settings: Record<string, unknown> }>('/api/settings', 'PUT', patch);
}
