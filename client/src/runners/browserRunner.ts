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
  status: RunStatus | ProgressStatus;
  message?: string;
};

function createWorker(language: RunnableLanguage): Worker {
  const url =
    language === 'Python'
      ? new URL('../workers/pythonRunner.worker.ts', import.meta.url)
      : new URL('../workers/javascriptRunner.worker.ts', import.meta.url);
  return new Worker(url, { type: 'module' });
}

/**
 * Runs learner code in a dedicated browser worker. The worker is always
 * terminated afterwards — on success, error or timeout — so no long-running
 * student code can keep the page busy. Nothing here touches the network.
 */
export async function runBrowserCode(
  language: RunnableLanguage,
  sourceCode: string,
  stdin: string,
  onProgress?: ProgressHandler,
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

  const worker = createWorker(language);

  return new Promise<ExecutionResult>((resolve) => {
    let settled = false;
    let executionTimer: number | undefined;
    let bootstrapTimer: number | undefined;

    const finish = (result: ExecutionResult) => {
      if (settled) return;
      settled = true;
      if (bootstrapTimer !== undefined) window.clearTimeout(bootstrapTimer);
      if (executionTimer !== undefined) window.clearTimeout(executionTimer);
      worker.terminate();
      resolve(result);
    };

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
      });
    }, BOOTSTRAP_MS);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;

      if (data.status === 'preparing') {
        onProgress?.('preparing', data.message ?? 'Preparing runtime…');
        return;
      }
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
          });
        }, TIMEOUT_MS);
        return;
      }

      finish({
        status: data.status as RunStatus,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        message: data.message ?? '',
        time: data.time ?? null,
        errorLine: data.errorLine ?? null,
        errorLineConfidence: data.errorLineConfidence ?? 'unknown',
        executionMode,
      });
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
      });
    };

    worker.postMessage({ requestId: crypto.randomUUID(), sourceCode, stdin });
  });
}
