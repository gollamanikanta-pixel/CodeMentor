type Request = { requestId: string; sourceCode: string; stdin: string };

const PYODIDE_VERSION = 'v0.26.2';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<any> | null = null;

/**
 * Pyodide's `batched` writers report one entry per printed line, with the
 * newline already removed, so the newlines have to be put back.
 */
function joinLines(chunks: string[]): string {
  return chunks.join('\n');
}

/**
 * This worker is a module worker, so classic `importScripts` is unavailable.
 * Load the Pyodide ESM build instead. Vite is told to leave the runtime URL
 * alone so it is fetched from the CDN exactly as written.
 */
async function loadPyodideRuntime() {
  if (!pyodidePromise) {
    self.postMessage({ status: 'preparing', message: 'Preparing Python runtime…' });
    const module = (await import(/* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`)) as any;
    pyodidePromise = module.loadPyodide({ indexURL: PYODIDE_CDN });
  }
  return pyodidePromise;
}

async function handleRun(event: MessageEvent<Request>) {
  const started = performance.now();
  // Declared outside the try so a failure can still hand back whatever the
  // learner's program printed before it stopped.
  const stdout: string[] = [];
  const stderr: string[] = [];
  try {
    const pyodide = await loadPyodideRuntime();

    /*
     * Build the input lines. A textarea's value always ends with a newline
     * after the learner types their last value, so the trailing empty string
     * is an artifact of the panel — not a real input line. Dropping it prevents
     * the classic `ValueError: invalid literal for int() with base 10: ''`.
     */
    const rawLines = event.data.stdin.split(/\r?\n/);
    if (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();
    const inputLines = rawLines;
    let inputIndex = 0;

    // Pyodide hands `batched` one entry per printed line; joinLines below puts
    // the newlines back so multi-line programs do not collapse into one line.
    pyodide.setStdout({ batched: (value: string) => stdout.push(value) });
    pyodide.setStderr({ batched: (value: string) => stderr.push(value) });

    /*
     * Expose a JS-backed input() so learner programs read stdin lines. When the
     * program asks for more input than the panel provides, raise the same
     * EOFError real Python raises — with a calm hint — instead of feeding an
     * empty string and letting int('') produce a confusing ValueError.
     */
    pyodide.globals.set('__codementor_next_input', () =>
      inputIndex < inputLines.length ? inputLines[inputIndex++] : null,
    );
    await pyodide.runPythonAsync(
      [
        'import builtins',
        'def _codementor_input(prompt=""):',
        '    value = __codementor_next_input()',
        '    if value is None:',
        '        raise EOFError("your program asked for input, but Program Input (stdin) has no lines left — add one value per line")',
        '    print(prompt, end="")',
        '    print(value)',
        '    return value',
        'builtins.input = _codementor_input',
      ].join('\n'),
    );

    // The runtime is ready, so the execution timeout can start counting now.
    self.postMessage({ status: 'running', message: 'Running your program…' });

    // Run the learner's source directly so reported line numbers match it.
    await pyodide.runPythonAsync(event.data.sourceCode);

    self.postMessage({
      requestId: event.data.requestId,
      status: 'success',
      stdout: joinLines(stdout),
      stderr: joinLines(stderr),
      message: '',
      time: performance.now() - started,
      errorLine: null,
      errorLineConfidence: 'unknown',
    });
  } catch (error: any) {
    const text = String(error?.name ? `${error.name}: ${error.message}` : error?.message || error);
    const isSyntax = /SyntaxError|IndentationError|TabError/.test(text);

    /*
     * A Pyodide traceback includes runtime-internal frames such as
     * `File "/lib/python312.zip/_pyodide/_base.py", line 596`. Taking the first
     * `line N` in the text therefore points at the interpreter, not the learner.
     * Collect every frame, keep only the learner's own, and use the deepest one —
     * that is the statement that actually failed.
     */
    const frames: Array<{ learner: boolean; runtime: boolean; line: number }> = [];
    const framePattern = /File "([^"]+)", line (\d+)/g;
    let frame: RegExpExecArray | null;
    while ((frame = framePattern.exec(text)) !== null) {
      const file = frame[1];
      frames.push({
        learner: file === '<exec>' || file === '<string>' || file === '<module>',
        runtime: /_pyodide|python\d+\.zip|^\/lib\//.test(file),
        line: Number(frame[2]),
      });
    }
    const learnerFrames = frames.filter((item) => item.learner);
    const usableFrames = learnerFrames.length ? learnerFrames : frames.filter((item) => !item.runtime);
    const deepest = usableFrames.length ? usableFrames[usableFrames.length - 1].line : null;

    // The learner-facing message is the final exception line, not the whole dump.
    const lastLine = text.trim().split('\n').filter((line) => line.trim() !== '').pop() ?? text;

    self.postMessage({
      requestId: event.data.requestId,
      status: isSyntax ? 'syntax_error' : 'runtime_error',
      // Whatever the program printed before it failed still belongs to the learner.
      stdout: joinLines(stdout),
      // `stderr` keeps the raw traceback; `message` is the calm one-line summary.
      stderr: text,
      message: lastLine.trim().slice(0, 300),
      time: performance.now() - started,
      errorLine: deepest,
      errorLineConfidence: deepest ? 'estimated' : 'unknown',
    });
  }
}

/**
 * A failure in the code above must never leave the learner staring at a silent
 * screen until the timeout fires, so it is reported as a plain internal error.
 */
self.onmessage = (event: MessageEvent<Request>) => {
  void handleRun(event).catch((error: unknown) => {
    self.postMessage({
      requestId: event.data.requestId,
      status: 'internal_error',
      stdout: '',
      stderr: '',
      message:
        error instanceof Error
          ? `The local runner stopped unexpectedly (${error.name}).`
          : 'The local runner stopped unexpectedly.',
      time: null,
      errorLine: null,
      errorLineConfidence: 'unknown',
    });
  });
};

export {};
