type Request = { requestId: string; sourceCode: string; stdin: string };

/**
 * Every program is wrapped in a fresh function so `await` works at the learner's
 * top level. That wrapper shifts the reported line numbers, so it has to be
 * subtracted again before the line can be shown to the learner.
 *
 * The wrapper is one source line, but the engine also numbers the two lines of
 * its own generated `function anonymous(...) {` header above it. V8 therefore
 * reports `learnerLine + 3`. Rather than trust a hardcoded number across
 * engines, the shift is measured once below and this value is only the fallback.
 */
const FALLBACK_LINE_OFFSET = 3;
const PRELUDE = '"use strict"; return (async () => {';
const GENERATED_FRAME = /<anonymous>:(\d+):(\d+)/;
const ANY_FRAME = /:(\d+):(\d+)\s*$/m;

type LineOffset = { offset: number; measured: boolean };

let lineOffsetPromise: Promise<LineOffset> | null = null;

/**
 * Runs a one-line program that throws inside the exact same wrapper and reads
 * the line the engine blames. The probe's own `throw` is its line 1, so the
 * difference is the shared offset for every real run in this engine. A `false`
 * `measured` flag means this engine labels generated frames differently, and
 * line numbers are then a best effort rather than a fact.
 */
function resolveLineOffset(): Promise<LineOffset> {
  if (!lineOffsetPromise) {
    lineOffsetPromise = (() => {
      try {
        const factory = new Function('console', 'input', `${PRELUDE}\nthrow new Error('__line_probe__');\n})();`);
        return Promise.resolve(factory({ log() {} }, () => '')).then(
          () => ({ offset: FALLBACK_LINE_OFFSET, measured: false }),
          (error: unknown) => {
            const stack = error instanceof Error ? error.stack : '';
            const match = stack ? GENERATED_FRAME.exec(stack) : null;
            return match
              ? { offset: Number(match[1]) - 1, measured: true }
              : { offset: FALLBACK_LINE_OFFSET, measured: false };
          },
        );
      } catch {
        return Promise.resolve({ offset: FALLBACK_LINE_OFFSET, measured: false });
      }
    })();
  }
  return lineOffsetPromise;
}

/**
 * Reads the line a runtime error came from. The first numbered generated frame
 * is the innermost one, so it is the statement that actually threw. When the
 * engine's numbering scheme was proven by the probe, only proven frames are
 * trusted; a wrong line is worse than no line in a learning tool.
 */
function parseErrorLocation(stack: string | undefined, { offset, measured }: LineOffset): number | null {
  if (!stack) return null;
  const match = GENERATED_FRAME.exec(stack) ?? (measured ? null : ANY_FRAME.exec(stack));
  if (!match) return null;
  const line = Number(match[1]) - offset;
  return line > 0 ? line : null;
}

async function handleRun(event: MessageEvent<Request>) {
  const started = performance.now();
  const lineOffset = await resolveLineOffset();
  /*
   * Drop the phantom trailing empty line the stdin panel produces (a textarea
   * value always ends with a newline after the last typed value), then read
   * lines in order. Beyond the last line `input()` returns undefined — the
   * same semantics as an empty browser prompt — so `input() || 'default'`
   * patterns keep working and no phantom `''` line is ever consumed.
   */
  const lines = (() => {
    const raw = event.data.stdin.split(/\r?\n/);
    if (raw.length && raw[raw.length - 1] === '') raw.pop();
    return raw;
  })();
  let inputIndex = 0;
  const output: string[] = [];
  const errors: string[] = [];

  const render = (value: unknown): string =>
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();

  const write = (...values: unknown[]) => output.push(values.map(render).join(' '));
  const writeError = (...values: unknown[]) => errors.push(values.map(render).join(' '));
  const input = (prompt = '') => {
    if (inputIndex >= lines.length) return undefined;
    const value = lines[inputIndex++];
    output.push(`${render(prompt)}${value}`);
    return value;
  };

  const consoleApi = { log: write, info: write, warn: writeError, error: writeError };

  self.postMessage({ status: 'running', message: 'Running your program…' });

  try {
    const factory = new Function('console', 'input', `${PRELUDE}\n${event.data.sourceCode}\n})();`);
    Promise.resolve(factory(consoleApi, input))
      .then(() =>
        self.postMessage({
          requestId: event.data.requestId,
          status: 'success',
          stdout: output.join('\n'),
          stderr: errors.join('\n'),
          message: '',
          time: performance.now() - started,
          errorLine: null,
          errorLineConfidence: 'unknown',
        }),
      )
      .catch((error: unknown) => {
        const name = error instanceof Error ? error.name : 'Error';
        const description = error instanceof Error ? error.message : String(error);
        const text = `${name}: ${description}`;
        const errorLine = error instanceof Error ? parseErrorLocation(error.stack, lineOffset) : null;
        self.postMessage({
          requestId: event.data.requestId,
          status: 'runtime_error',
          stdout: output.join('\n'),
          stderr: text,
          message: text,
          time: performance.now() - started,
          errorLine,
          errorLineConfidence: errorLine ? 'estimated' : 'unknown',
        });
      });
  } catch (error: unknown) {
    /*
     * A syntax error is raised while the function is being compiled, so its
     * stack only points at the wrapper and at this worker — never at the
     * learner's line. No line is reported rather than a misleading one; the
     * local analyzer still guides them to the right place.
     */
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    self.postMessage({
      requestId: event.data.requestId,
      status: 'syntax_error',
      stdout: output.join('\n'),
      stderr: text,
      message: text,
      time: performance.now() - started,
      errorLine: null,
      errorLineConfidence: 'unknown',
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
