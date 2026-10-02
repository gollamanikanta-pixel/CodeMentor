import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { authenticateSessionCookie } from '../auth/auth.js';
import { env, terminalRunnerConfigured } from '../config/env.js';
import { executionGuard, recordExecution } from '../providers/secureExecutionProvider.js';

const LANGUAGES = new Set([
  'python',
  'javascript',
  'c',
  'cpp',
  'java',
  'csharp',
  'go',
  'php',
  'ruby',
  'rust',
  'kotlin',
]);
const SUBPROTOCOL = 'codementor.terminal.v1';
const MAX_SOURCE_BYTES = 51200;
const MAX_INPUT_BYTES = 10240;
const MAX_CONNECTIONS = 10;

function cookieValues(header = ''): Map<string, string> {
  const values = new Map<string, string>();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    try {
      values.set(key, decodeURIComponent(part.slice(separator + 1).trim()));
    } catch {
      continue;
    }
  }
  return values;
}

function reject(socket: import('node:stream').Duplex, status: number, message: string): void {
  const phrase = status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : status === 503 ? 'Service Unavailable' : 'Bad Request';
  socket.write(`HTTP/1.1 ${status} ${phrase}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  socket.destroy();
}

function requestProtocols(req: IncomingMessage): string[] {
  return (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function requestOriginAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  return Boolean(origin && env.clientOrigin.split(',').map((value) => value.trim()).includes(origin));
}

type ClientMessage =
  | { type: 'start'; language: string; source: string }
  | { type: 'input'; text: string }
  | { type: 'eof' }
  | { type: 'cancel' };

function rawDataBuffer(data: WebSocket.RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function parseMessage(data: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(rawDataBuffer(data).toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value.type === 'start' && typeof value.language === 'string' && typeof value.source === 'string') {
      return { type: 'start', language: value.language, source: value.source };
    }
    if (value.type === 'input' && typeof value.text === 'string') return { type: 'input', text: value.text };
    if (value.type === 'eof') return { type: 'eof' };
    if (value.type === 'cancel') return { type: 'cancel' };
    return null;
  } catch {
    return null;
  }
}

export function attachTerminalGateway(server: Server): void {
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_SOURCE_BYTES + 4096 });
  let activeConnections = 0;

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/terminal') {
      reject(socket, 404, 'Unknown WebSocket endpoint.');
      return;
    }
    if (!requestOriginAllowed(request)) {
      reject(socket, 403, 'The terminal connection origin is not allowed.');
      return;
    }
    if (activeConnections >= MAX_CONNECTIONS) {
      reject(socket, 503, 'The interactive runner is busy. Please try again shortly.');
      return;
    }
    if (!terminalRunnerConfigured()) {
      reject(socket, 503, 'The hosted interactive runner is not configured. Check the E2B runner service settings.');
      return;
    }

    const protocols = requestProtocols(request);
    const csrf = protocols.find((protocol) => protocol !== SUBPROTOCOL);
    const cookies = cookieValues(request.headers.cookie);
    const sessionName = env.sessionCookieName;
    let userId: string | null = null;
    try {
      userId = await authenticateSessionCookie(cookies.get(sessionName));
    } catch {
      reject(socket, 503, 'The account service is unavailable. Please try again shortly.');
      return;
    }
    if (!userId) {
      reject(socket, 401, 'Sign in to use the interactive runner.');
      return;
    }
    if (!protocols.includes(SUBPROTOCOL) || !csrf || csrf !== cookies.get('codementor_csrf')) {
      reject(socket, 403, 'Refresh the page and retry the secure terminal connection.');
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      activeConnections += 1;
      websocketServer.emit('connection', client, request);
    });
  });

  websocketServer.on('connection', (client) => {
    const upstream = new WebSocket(env.terminalRunnerUrl, {
      headers: { authorization: `Bearer ${env.terminalRunnerSecret}` },
      maxPayload: env.terminalRunnerMaxOutputBytes * 6 + 16_384,
    });
    let started = false;
    let closed = false;
    let inputBytes = 0;
    const queued: string[] = [];

    const sendClient = (payload: Record<string, unknown>) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
    };
    const closeBoth = (code = 1000, reason = 'Session ended') => {
      if (closed) return;
      closed = true;
      if (client.readyState === WebSocket.OPEN) client.close(code, reason.slice(0, 120));
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close();
      }
    };

    const timeout = setTimeout(() => {
      sendClient({ type: 'error', message: 'This interactive session reached its time limit.' });
      closeBoth(1000, 'Execution time limit reached');
    }, env.terminalRunnerTimeoutMs);

    client.on('message', (data) => {
      if (rawDataBuffer(data).byteLength > MAX_INPUT_BYTES + 2048) {
        sendClient({ type: 'error', message: 'Input is larger than the 10 KB limit.' });
        closeBoth(1009, 'Input limit exceeded');
        return;
      }
      const message = parseMessage(data);
      if (!message) {
        sendClient({ type: 'error', message: 'The terminal received an invalid message.' });
        closeBoth(1008, 'Invalid message');
        return;
      }

      if (!started) {
        if (message.type !== 'start') {
          sendClient({ type: 'error', message: 'Start a program before sending terminal input.' });
          return;
        }
        if (!LANGUAGES.has(message.language) || Buffer.byteLength(message.source, 'utf8') > MAX_SOURCE_BYTES || !message.source.trim()) {
          sendClient({ type: 'error', message: 'Choose a supported language and provide code within the 50 KB limit.' });
          closeBoth(1008, 'Invalid run request');
          return;
        }
        const guard = executionGuard();
        if (!guard.ok) {
          sendClient({ type: 'error', message: guard.message });
          closeBoth(1008, 'Runner rate limit');
          return;
        }
        recordExecution();
        started = true;
        const serialized = JSON.stringify(message);
        if (upstream.readyState === WebSocket.OPEN) upstream.send(serialized);
        else queued.push(serialized);
        return;
      }

      if (!['input', 'eof', 'cancel'].includes(message.type)) {
        sendClient({ type: 'error', message: 'A program can only receive input after it starts.' });
        return;
      }
      if (message.type === 'input') {
        const messageBytes = Buffer.byteLength(message.text, 'utf8') + 1;
        if (inputBytes + messageBytes > MAX_INPUT_BYTES) {
          sendClient({ type: 'error', message: 'This program has reached the 10 KB input limit.' });
          return;
        }
        inputBytes += messageBytes;
      }
      const serialized = JSON.stringify(message);
      if (upstream.readyState === WebSocket.OPEN) upstream.send(serialized);
      else if (upstream.readyState === WebSocket.CONNECTING) queued.push(serialized);
    });

    upstream.on('open', () => {
      for (const message of queued.splice(0)) {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
      }
    });
    upstream.on('message', (data) => {
      if (rawDataBuffer(data).byteLength > env.terminalRunnerMaxOutputBytes + 16_384) {
        sendClient({ type: 'error', message: 'The runner output exceeded its safe limit.' });
        closeBoth(1009, 'Output limit exceeded');
        return;
      }
      if (client.readyState === WebSocket.OPEN) client.send(rawDataBuffer(data).toString('utf8'));
    });
    upstream.on('close', () => closeBoth());
    upstream.on('error', () => {
      sendClient({ type: 'error', message: 'The E2B runner could not be reached. Check the runner service and its cloud configuration.' });
      closeBoth(1011, 'Runner unavailable');
    });
    client.on('close', () => closeBoth());
    client.on('error', () => closeBoth(1011, 'Client connection error'));
    client.once('close', () => {
      clearTimeout(timeout);
    });
    upstream.once('close', () => {
      clearTimeout(timeout);
    });
  });

  websocketServer.on('close', () => {
    activeConnections = 0;
  });
  websocketServer.on('connection', (client) => {
    client.once('close', () => {
      activeConnections = Math.max(0, activeConnections - 1);
    });
  });
}
