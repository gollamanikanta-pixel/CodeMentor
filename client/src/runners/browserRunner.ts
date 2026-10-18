import type { ExecutionResult, ProgressStatus, RunStatus, RunnableLanguage } from '../types';

export type { ExecutionResult, RunStatus } from '../types';

const MAX_CODE_BYTES = 51200;
const MAX_STDIN_BYTES = 10240;
/** Budget for downloading and booting the runtime (e.g. Pyodide) the first time. */
const BOOTSTRAP_MS = 45000;
/** Budget for the learner's own program once it actually starts executing. */
const TIMEOUT_MS = 3000;

export type ProgressHandler = (status: ProgressStatus, message: string) => void;

type WorkerMessage = Partial<Omit<ExecutionResult, 'status'>> & {
  status: RunStatus | ProgressStatus | 'runtime_ready';
  message?: string;
  requestId?: string;
};

type RunRequest = { requestId: string; sourceCode: string; stdin: string };
type PythonPreloadRequest = { type: 'preload'; requestId: string };

type ExecutionRunner = {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: RunRequest) => void;
  terminate: (discard?: boolean) => void;
};

let pythonWorker: Worker | null = null;
let activePythonRunner: ExecutionRunner | null = null;
let pythonRuntimeReady = false;
let pythonRuntimePreparing = false;
let pythonPreloadRequestId: string | null = null;

const RUNNER_STATUSES = new Set<string>([
  'preparing',
  'running',
  'runtime_ready',
  'success',
  'syntax_error',
  'compilation_error',
  'runtime_error',
  'timeout',
  'time_limit_exceeded',
  'memory_limit_exceeded',
  'cancelled',
  'internal_error',
  'unavailable',
]);

function isWorkerMessage(value: unknown): value is WorkerMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.status === 'string' &&
    RUNNER_STATUSES.has(message.status) &&
    (message.stdout === undefined || typeof message.stdout === 'string') &&
    (message.stderr === undefined || typeof message.stderr === 'string') &&
    (message.message === undefined || typeof message.message === 'string') &&
    (message.time === undefined || message.time === null || typeof message.time === 'number') &&
    (message.errorLine === undefined || message.errorLine === null || typeof message.errorLine === 'number')
  );
}

function getPythonWorker(): Worker {
  if (pythonWorker) return pythonWorker;

  const worker = new Worker(new URL('../workers/pythonRunner.worker.ts', import.meta.url), {
    type: 'module',
  });
  pythonWorker = worker;
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    if (event.data.status === 'runtime_ready') {
      pythonRuntimeReady = true;
      pythonRuntimePreparing = false;
      pythonPreloadRequestId = null;
    } else if (
      event.data.status === 'internal_error' &&
      event.data.requestId === pythonPreloadRequestId
    ) {
      pythonRuntimePreparing = false;
      pythonPreloadRequestId = null;
      console.warn('python-runtime-preload-failed', event.data.message);
    }
    activePythonRunner?.onmessage?.(event);
  };
  worker.onerror = (event) => {
    pythonWorker = null;
    pythonRuntimeReady = false;
    pythonRuntimePreparing = false;
    pythonPreloadRequestId = null;
    const runner = activePythonRunner;
    activePythonRunner = null;
    worker.terminate();
    runner?.onerror?.(event);
  };
  return worker;
}

/** Start fetching Pyodide as soon as Python is selected, without blocking the UI. */
export function preparePythonRuntime(): void {
  if (pythonRuntimeReady || pythonRuntimePreparing) return;

  const worker = getPythonWorker();
  const requestId = crypto.randomUUID();
  pythonRuntimePreparing = true;
  pythonPreloadRequestId = requestId;
  worker.postMessage({ type: 'preload', requestId } satisfies PythonPreloadRequest);
}

function createRunner(language: RunnableLanguage): ExecutionRunner {
  if (language === 'Python') {
    const worker = getPythonWorker();
    const runner: ExecutionRunner = {
      onmessage: null,
      onerror: null,
      postMessage: (message) => worker.postMessage(message),
      terminate: (discard = false) => {
        if (activePythonRunner === runner) activePythonRunner = null;
        if (!discard) return;
        worker.terminate();
        if (pythonWorker === worker) pythonWorker = null;
        pythonRuntimeReady = false;
        pythonRuntimePreparing = false;
        pythonPreloadRequestId = null;
      },
    };
    activePythonRunner = runner;
    return runner;
  }

  const frame = document.createElement('iframe');
  frame.title = 'Isolated JavaScript runner';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.tabIndex = -1;
  frame.hidden = true;

  let loaded = false;
  let terminated = false;
  let pendingRequest: RunRequest | null = null;
  let replyPort: MessagePort | null = null;
  const runner: ExecutionRunner = {
    onmessage: null,
    onerror: null,
    postMessage: (message) => {
      pendingRequest = message;
      startIfReady();
    },
    terminate: () => {
      terminated = true;
      pendingRequest = null;
      replyPort?.close();
      replyPort = null;
      frame.onload = null;
      frame.onerror = null;
      frame.remove();
    },
  };

  const startIfReady = () => {
    if (!loaded || !pendingRequest || terminated || !frame.contentWindow) return;

    const channel = new MessageChannel();
    replyPort = channel.port1;
    replyPort.onmessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerMessage(event.data)) {
        runner.onerror?.(new ErrorEvent('error', { message: 'Invalid sandbox response.' }));
        return;
      }
      runner.onmessage?.(
        new MessageEvent<WorkerMessage>('message', {
          data: {
            ...event.data,
            stdout: event.data.stdout?.slice(0, 20_000),
            stderr: event.data.stderr?.slice(0, 20_000),
            message: event.data.message?.slice(0, 20_000),
          },
        }),
      );
    };
    frame.contentWindow.postMessage({ type: 'run', ...pendingRequest }, '*', [channel.port2]);
    pendingRequest = null;
  };

  frame.onload = () => {
    loaded = true;
    startIfReady();
  };
  frame.onerror = () => runner.onerror?.(new ErrorEvent('error', { message: 'Sandbox failed to load.' }));
  frame.src = new URL('/javascript-runner.html', window.location.href).href;
  document.body.append(frame);

  return runner;
}

/**
 * Runs Python in a reusable worker and JavaScript in a network-restricted,
 * opaque-origin sandbox. Python keeps its runtime warm between completed runs.
 */
export async function runBrowserCode(
  language: RunnableLanguage,
  sourceCode: string,
  stdin: string,
  onProgress?: ProgressHandler,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const executionMode = language === 'Python' ? 'browser_python' : 'browser_javascript';

  if (new Blob([sourceCode]).size > MAX_CODE_BYTES) {
    return {
      status: 'internal_error',
      stdout: '',
      stderr: '',
      message: 'Your code is larger than the 50 KB safe learning limit.',
      time: null,
      errorLine: null,
      errorLineConfidence: 'unknown',
      executionMode,
    };
  }
  if (new Blob([stdin]).size > MAX_STDIN_BYTES) {
    return {
      status: 'internal_error',
      stdout: '',
      stderr: '',
      message: 'Program input is larger than the 10 KB safe learning limit.',
      time: null,
      errorLine: null,
      errorLineConfidence: 'unknown',
      executionMode,
    };
  }

  const worker = createRunner(language);

  return new Promise<ExecutionResult>((resolve) => {
    if (signal?.aborted) {
      worker.terminate(true);
      resolve({
        status: 'cancelled',
        stdout: '',
        stderr: '',
        message: 'Program stopped.',
        time: null,
        errorLine: null,
        errorLineConfidence: 'unknown',
        executionMode,
      });
      return;
    }
    let settled = false;
    let executionTimer: number | undefined;
    let bootstrapTimer: number | undefined;

    const finish = (result: ExecutionResult, discardWorker = false) => {
      if (settled) return;
      settled = true;
      if (bootstrapTimer !== undefined) window.clearTimeout(bootstrapTimer);
      if (executionTimer !== undefined) window.clearTimeout(executionTimer);
      signal?.removeEventListener('abort', abort);
      worker.terminate(discardWorker);
      resolve(result);
    };
    const abort = () =>
      finish({
        status: 'cancelled',
        stdout: '',
        stderr: '',
        message: 'Program stopped.',
        time: null,
        errorLine: null,
        errorLineConfidence: 'unknown',
        executionMode,
      }, true);
    signal?.addEventListener('abort', abort, { once: true });

    bootstrapTimer = window.setTimeout(() => {
      finish({
        status: 'internal_error',
        stdout: '',
        stderr: 'Runtime preparation timed out.',
        message: 'The browser runtime took too long to prepare. Please check your connection and try again.',
        time: null,
        errorLine: null,
        errorLineConfidence: 'unknown',
        executionMode,
      }, true);
    }, BOOTSTRAP_MS);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (!isWorkerMessage(data)) {
        finish({
          status: 'internal_error',
          stdout: '',
          stderr: '',
          message: 'The local runner returned an invalid response.',
          time: null,
          errorLine: null,
          errorLineConfidence: 'unknown',
          executionMode,
        }, true);
        return;
      }

      if (data.status === 'preparing') {
        onProgress?.('preparing', data.message ?? 'Preparing runtime…');
        return;
      }
      if (data.status === 'runtime_ready') return;
      if (data.status === 'running') {
        // The learner's code is starting now, so the 3s budget begins here.
        onProgress?.('running', data.message ?? 'Running your program…');
        if (bootstrapTimer !== undefined) window.clearTimeout(bootstrapTimer);
        executionTimer = window.setTimeout(() => {
          finish({
            status: 'timeout',
            stdout: '',
            stderr: 'Execution timed out.',
            message: 'Your program took longer than the 3 second learning timeout.',
            time: TIMEOUT_MS,
            errorLine: null,
            errorLineConfidence: 'unknown',
            executionMode,
          }, true);
        }, TIMEOUT_MS);
        return;
      }

      finish({
        status: data.status,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        message: data.message ?? '',
        time: data.time ?? null,
        errorLine: data.errorLine ?? null,
        errorLineConfidence: data.errorLineConfidence ?? 'unknown',
        executionMode,
      }, data.status === 'internal_error');
    };

    worker.onerror = () => {
      finish({
        status: 'internal_error',
        stdout: '',
        stderr: 'The browser worker could not complete this run.',
        message: 'The local runner stopped unexpectedly. Try running again or review the code structure.',
        time: null,
        errorLine: null,
        errorLineConfidence: 'unknown',
        executionMode,
      }, true);
    };

    worker.postMessage({ requestId: crypto.randomUUID(), sourceCode, stdin });
  });
}
