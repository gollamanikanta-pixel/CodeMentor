import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { Sandbox } from 'e2b';
import { WebSocket, WebSocketServer } from 'ws';
import { errorLineFromOutput } from './diagnostics.mjs';

const host = process.env.RUNNER_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.RUNNER_PORT || process.env.PORT) || 5101;
const secret = process.env.RUNNER_SHARED_SECRET || '';
const e2bApiKey = process.env.E2B_API_KEY || '';
const template = process.env.E2B_TEMPLATE || 'codementor-interactive';
const maxSourceBytes = 51200;
const maxInputBytes = 10240;
const maxOutputBytes = Number(process.env.RUNNER_MAX_OUTPUT_BYTES) || 200000;
const timeoutMs = Number(process.env.RUNNER_TIMEOUT_MS) || 60000;
const sandboxTimeoutMs = Number(process.env.E2B_SANDBOX_TIMEOUT_MS) || 120000;
const maxSessions = 5;
let activeSessions = 0;

const languageSpecs = {
  python: { filename: 'main.py', compile: '', run: 'python3 -u main.py' },
  javascript: { filename: 'main.js', compile: '', run: 'node -r ./terminal-input.cjs main.js' },
  c: { filename: 'main.c', compile: 'gcc -std=c17 -O0 -pipe main.c -o cm-program', run: './cm-program' },
  cpp: { filename: 'main.cpp', compile: 'g++ -std=c++17 -O0 -pipe main.cpp -o cm-program', run: './cm-program' },
  java: { filename: 'Main.java', compile: 'javac Main.java', run: 'java Main' },
  csharp: { filename: 'main.cs', compile: 'mcs -out:cm-program.exe main.cs', run: 'mono cm-program.exe' },
  go: { filename: 'main.go', compile: 'GO111MODULE=off go build -o cm-program main.go', run: './cm-program' },
  php: { filename: 'main.php', compile: '', run: 'php main.php' },
  ruby: { filename: 'main.rb', compile: '', run: 'ruby main.rb' },
  rust: { filename: 'main.rs', compile: 'rustc -C opt-level=0 main.rs -o cm-program', run: './cm-program' },
  kotlin: {
    filename: 'Main.kt',
    compile: 'kotlinc Main.kt -include-runtime -d cm-program.jar',
    run: 'java -jar cm-program.jar',
  },
};

const javascriptInputShim = `const fs = require('node:fs');
globalThis.input = function input(prompt = '') {
  if (prompt) process.stdout.write(String(prompt));
  const bytes = [];
  const byte = Buffer.alloc(1);
  while (true) {
    const count = fs.readSync(0, byte, 0, 1, null);
    if (count === 0 || byte[0] === 10) break;
    if (byte[0] !== 13) bytes.push(byte[0]);
  }
  return Buffer.from(bytes).toString('utf8');
};
`;

function safeSend(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function readBearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length);
}

function commandFor(spec, startMarker, compileFailureMarker, endMarker) {
  const printMarker = (marker, suffixFormat = '') => {
    const encodedMarker = Buffer.from(marker).toString('base64');
    const format = suffixFormat ? `%s${suffixFormat}` : '%s';
    return `printf '\\n${format}\\n' "$(printf '%s' '${encodedMarker}' | base64 -d)"`;
  };
  const compile = spec.compile
    ? `${spec.compile}; compile_status=$?; if [ "$compile_status" -ne 0 ]; then ${printMarker(compileFailureMarker)}; exit 65; fi;`
    : '';
  return `stty -echo; ${compile} ${printMarker(startMarker)}; stty echo; ${spec.run}; run_status=$?; ${printMarker(endMarker, '%s')} "$run_status"; exit "$run_status"\n`;
}

function withoutShellCommandEcho(output) {
  const newline = output.indexOf('\n');
  return newline < 0 ? '' : output.slice(newline + 1);
}

function unmatchedMarkerSuffixLength(text, marker) {
  const maxLength = Math.min(text.length, marker.length - 1);
  for (let length = maxLength; length > 0; length -= 1) {
    if (text.endsWith(marker.slice(0, length))) return length;
  }
  return 0;
}

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(
      JSON.stringify({
        ok: true,
        configured: Boolean(secret && e2bApiKey),
        provider: 'e2b',
        activeSessions,
        maxSessions,
      }),
    );
    return;
  }
  response.writeHead(404);
  response.end();
});

const websocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: Math.max(maxSourceBytes + maxInputBytes + 4096, maxOutputBytes * 6 + 16_384),
  perMessageDeflate: false,
});

httpServer.on('upgrade', (request, socket, head) => {
  if (request.url !== '/session') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!secret || readBearerToken(request) !== secret) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  if (activeSessions >= maxSessions) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    activeSessions += 1;
    websocketServer.emit('connection', websocket);
  });
});

websocketServer.on('connection', (websocket) => {
  let sandbox;
  let terminal;
  let started = false;
  let phase = 'preparing';
  let closed = false;
  let outputBytes = 0;
  let inputBytes = 0;
  let pendingOutput = '';
  let compilerOutput = '';
  let programOutput = '';
  let currentLanguageKey = '';
  let currentSourceLineCount = 0;
  let durationTimer;
  const outputDecoder = new TextDecoder();
  const startMarker = `__CODEMENTOR_START_${randomUUID().replaceAll('-', '')}__`;
  const compileFailureMarker = `__CODEMENTOR_COMPILE_FAILURE_${randomUUID().replaceAll('-', '')}__`;
  const endMarker = `__CODEMENTOR_END_${randomUUID().replaceAll('-', '')}__`;
  const startTime = Date.now();

  const cleanup = async () => {
    clearTimeout(durationTimer);
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        console.error('Failed to close an E2B sandbox.');
      }
      sandbox = undefined;
    }
  };

  const finish = async (status, details = {}) => {
    if (closed) return;
    closed = true;
    if (status === 'compilation_error' || status === 'runtime_error' || status === 'syntax_error') {
      const diagnostic = status === 'compilation_error'
        ? String(details.compileOutput ?? compilerOutput)
        : `${programOutput}\n${pendingOutput}`;
      const errorLine = errorLineFromOutput(
        currentLanguageKey,
        diagnostic,
        currentSourceLineCount,
      );
      if (errorLine) {
        details.errorLine = errorLine;
        details.errorLineConfidence = 'exact';
      }
    }
    safeSend(websocket, { type: 'finished', status, timeMs: Date.now() - startTime, ...details });
    await cleanup();
    if (websocket.readyState === WebSocket.OPEN) websocket.close(1000, 'Program finished');
  };

  const sendOutput = (text) => {
    if (!text || closed) return;
    safeSend(websocket, { type: 'output', stream: 'stdout', text });
  };

  const consumeOutput = (text) => {
    if (closed || !text) return;
    outputBytes += Buffer.byteLength(text);
    if (outputBytes > maxOutputBytes) {
      safeSend(websocket, { type: 'error', message: 'Output exceeded the 200 KB session limit; the program was stopped.' });
      void finish('internal_error', { message: 'Output limit exceeded.' });
      return;
    }
    pendingOutput += text;

    if (phase === 'preparing') {
      const compileFailureIndex = pendingOutput.indexOf(compileFailureMarker);
      const startIndex = pendingOutput.indexOf(startMarker);
      if (compileFailureIndex >= 0) {
        const compileOutput = withoutShellCommandEcho(pendingOutput.slice(0, compileFailureIndex)).trim();
        compilerOutput = compileOutput;
        if (compileOutput) safeSend(websocket, { type: 'compile', text: compileOutput });
        pendingOutput = '';
        phase = 'finished';
        void finish('compilation_error', {
          compileOutput,
          message: 'The compiler reported errors. Read the compiler output, then try one small change.',
          exitCode: 65,
        });
        return;
      }
      if (startIndex >= 0) {
        const compileOutput = withoutShellCommandEcho(pendingOutput.slice(0, startIndex)).trim();
        compilerOutput = compileOutput;
        if (compileOutput) safeSend(websocket, { type: 'compile', text: compileOutput });
        pendingOutput = pendingOutput.slice(startIndex + startMarker.length).replace(/^\r?\n/, '');
        phase = 'running';
        safeSend(websocket, { type: 'started' });
      } else {
        if (pendingOutput.length > maxOutputBytes) {
          safeSend(websocket, { type: 'compile', text: pendingOutput.slice(0, maxOutputBytes) });
          pendingOutput = '';
        }
        return;
      }
    }

    if (phase === 'running') {
      const endIndex = pendingOutput.indexOf(endMarker);
      if (endIndex >= 0) {
        const finalOutput = pendingOutput.slice(0, endIndex);
        programOutput += finalOutput;
        sendOutput(finalOutput);
        const result = pendingOutput.slice(endIndex + endMarker.length).match(/^(-?\d+)/);
        const exitCode = result ? Number(result[1]) : 1;
        pendingOutput = '';
        phase = 'finished';
        void finish(exitCode === 0 ? 'success' : 'runtime_error', {
          exitCode,
          message: exitCode === 0 ? 'The program finished.' : 'The program stopped with a runtime error.',
        });
        return;
      }
      const safeLength = pendingOutput.length - unmatchedMarkerSuffixLength(pendingOutput, endMarker);
      if (safeLength) {
        const output = pendingOutput.slice(0, safeLength);
        programOutput += output;
        sendOutput(output);
        pendingOutput = pendingOutput.slice(safeLength);
      }
    }
  };

  const startProgram = async (message) => {
    if (started) {
      safeSend(websocket, { type: 'error', message: 'Only one program can run in a terminal session.' });
      return;
    }
    const spec = languageSpecs[message.language];
    if (!spec || typeof message.source !== 'string' || !message.source.trim()) {
      safeSend(websocket, { type: 'error', message: 'Choose a supported language and provide code to run.' });
      return;
    }
    currentLanguageKey = message.language;
    currentSourceLineCount = message.source.split(/\r\n|\r|\n/).length;
    if (Buffer.byteLength(message.source, 'utf8') > maxSourceBytes) {
      safeSend(websocket, { type: 'error', message: 'Code exceeds the 50 KB interactive-runner limit.' });
      return;
    }
    if (!secret || !e2bApiKey) {
      safeSend(websocket, {
        type: 'error',
        message: 'Hosted execution is not configured. Set E2B_API_KEY in runner/.env and follow the E2B setup instructions.',
      });
      await finish('unavailable', { message: 'Hosted E2B runner is not configured.' });
      return;
    }
    started = true;
    durationTimer = setTimeout(() => {
      safeSend(websocket, { type: 'error', message: 'This program reached the 60 second time limit.' });
      void finish('timeout', { message: 'This program reached the 60 second time limit.' });
    }, timeoutMs);

    try {
      const sandboxOptions = {
        apiKey: e2bApiKey,
        timeoutMs: sandboxTimeoutMs,
        allowInternetAccess: false,
      };
      sandbox = template
        ? await Sandbox.create(template, sandboxOptions)
        : await Sandbox.create(undefined, sandboxOptions);
      if (closed) {
        await cleanup();
        return;
      }
      const workspace = `/tmp/codementor-${randomUUID().replaceAll('-', '')}`;
      await sandbox.commands.run(`mkdir -p ${workspace}`);
      if (closed) {
        await cleanup();
        return;
      }
      await sandbox.files.write(`${workspace}/${spec.filename}`, message.source);
      if (message.language === 'javascript') {
        await sandbox.files.write(`${workspace}/terminal-input.cjs`, javascriptInputShim);
      }
      if (closed) {
        await cleanup();
        return;
      }
      const onData = (data) => consumeOutput(outputDecoder.decode(data, { stream: true }));
      terminal = await sandbox.pty.create({
        cols: 100,
        rows: 30,
        cwd: workspace,
        timeoutMs: 0,
        onData,
      });
      const command = commandFor(spec, startMarker, compileFailureMarker, endMarker);
      await sandbox.pty.sendInput(terminal.pid, new TextEncoder().encode(command));
      void terminal.wait().then(
        (result) => {
          if (closed || phase === 'finished') return;
          const exitCode = typeof result?.exitCode === 'number' ? result.exitCode : 1;
          void finish(exitCode === 0 ? 'success' : 'runtime_error', {
            exitCode,
            message: exitCode === 0 ? 'The program finished.' : 'The program stopped before returning its result.',
          });
        },
        () => {
          if (!closed && phase !== 'finished') {
            void finish('runtime_error', { message: 'The hosted program session ended unexpectedly.' });
          }
        },
      );
    } catch {
      console.error('E2B sandbox session failed.');
      safeSend(websocket, {
        type: 'error',
        message: 'The E2B cloud runner could not start this program. Check the E2B API key, template and account limits.',
      });
      await finish('unavailable', { message: 'The E2B cloud runner could not start this program.' });
    }
  };

  websocket.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      safeSend(websocket, { type: 'error', message: 'Invalid terminal message.' });
      return;
    }
    if (message?.type === 'start') {
      void startProgram(message);
      return;
    }
    if (message?.type === 'input' && typeof message.text === 'string') {
      const messageBytes = Buffer.byteLength(message.text, 'utf8') + 1;
      if (inputBytes + messageBytes > maxInputBytes) {
        safeSend(websocket, { type: 'error', message: 'Input exceeds the 10 KB limit.' });
        return;
      }
      inputBytes += messageBytes;
      if (sandbox && terminal) {
        void sandbox.pty.sendInput(terminal.pid, new TextEncoder().encode(`${message.text}\n`)).catch(() => {
          if (!closed) safeSend(websocket, { type: 'error', message: 'Could not send input to the hosted program.' });
        });
      }
      return;
    }
    if (message?.type === 'eof' && sandbox && terminal) {
      void sandbox.pty.sendInput(terminal.pid, new Uint8Array([4])).catch(() => {
        if (!closed) safeSend(websocket, { type: 'error', message: 'Could not close program input.' });
      });
      return;
    }
    if (message?.type === 'cancel') {
      void finish('cancelled', { message: 'Program stopped by learner.' });
      return;
    }
    safeSend(websocket, { type: 'error', message: 'Invalid terminal message.' });
  });

  websocket.on('close', () => {
    if (!closed) {
      closed = true;
      void cleanup();
    }
  });
  websocket.on('error', () => {
    if (!closed) {
      closed = true;
      void cleanup();
    }
  });
  websocket.once('close', () => {
    activeSessions = Math.max(0, activeSessions - 1);
  });
});

httpServer.listen(port, host, () => {
  console.log(`CodeMentor E2B interactive runner listening on http://${host}:${port}`);
});
