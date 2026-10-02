import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const runnerDirectory = fileURLToPath(new URL('../', import.meta.url));
const javascriptInputPath = fileURLToPath(new URL('./terminal-input.cjs', import.meta.url));
const sharedSecret = 'runner-test-secret';
let runner;
let baseUrl;
let websocketUrl;
let stderr = '';

before(async () => {
  const portServer = createServer();
  await new Promise((resolve, reject) => {
    portServer.once('error', reject);
    portServer.listen(0, '127.0.0.1', resolve);
  });
  const address = portServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a runner test port.');
  const port = address.port;
  await new Promise((resolve, reject) => portServer.close((error) => (error ? reject(error) : resolve())));

  baseUrl = `http://127.0.0.1:${port}`;
  websocketUrl = `ws://127.0.0.1:${port}/session`;
  runner = spawn(process.execPath, ['src/index.mjs'], {
    cwd: runnerDirectory,
    env: {
      ...process.env,
      RUNNER_HOST: '127.0.0.1',
      RUNNER_PORT: String(port),
      RUNNER_SHARED_SECRET: sharedSecret,
      E2B_API_KEY: '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  runner.stderr.setEncoding('utf8');
  runner.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (runner.exitCode !== null) throw new Error(`Runner exited during startup: ${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await delay(50);
    }
  }
  throw new Error(`Runner did not become healthy: ${stderr}`);
});

after(async () => {
  if (!runner || runner.exitCode !== null) return;
  runner.kill();
  await new Promise((resolve) => runner.once('exit', resolve));
});

test('runner health is available and websocket upgrades require the shared secret', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    configured: false,
    provider: 'e2b',
    activeSessions: 0,
    maxSessions: 5,
  });

  const unauthorizedStatus = await new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl, { headers: { authorization: 'Bearer invalid' } });
    socket.once('unexpected-response', (_request, response) => {
      response.resume();
      resolve(response.statusCode);
    });
    socket.once('open', () => {
      socket.close();
      reject(new Error('Runner accepted a connection with an invalid shared secret.'));
    });
    socket.once('error', reject);
  });
  assert.equal(unauthorizedStatus, 401);

  const authorizedSocket = new WebSocket(websocketUrl, {
    headers: { authorization: `Bearer ${sharedSecret}` },
  });
  const responseMessage = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Runner did not respond to the terminal protocol.')), 2000);
    authorizedSocket.once('open', () => authorizedSocket.send('not-json'));
    authorizedSocket.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
      authorizedSocket.close();
    });
    authorizedSocket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  assert.equal(responseMessage.type, 'error');
  assert.equal(responseMessage.message, 'Invalid terminal message.');
});

test('runner reports missing hosted credentials instead of attempting local execution', async () => {
  const socket = new WebSocket(websocketUrl, { headers: { authorization: `Bearer ${sharedSecret}` } });
  const messages = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Runner did not report missing E2B configuration.')), 2000);
    socket.once('open', () =>
      socket.send(JSON.stringify({
        type: 'start',
        language: 'python',
        source: 'print("Hello")',
      })),
    );
    socket.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.some((message) => message.type === 'finished')) {
        clearTimeout(timer);
        socket.close();
        resolve();
      }
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  assert.ok(messages.some((message) => message.type === 'error' && message.message.includes('E2B_API_KEY')));
  assert.ok(messages.some((message) => message.type === 'finished' && message.status === 'unavailable'));
});

test('JavaScript input(prompt) reads a submitted value and prints its prompt', () => {
  const output = execFileSync(
    process.execPath,
    ['-r', javascriptInputPath, '-e', "const value = input('Enter a number: '); console.log('Value:', value);"],
    { input: '10\n', encoding: 'utf8' },
  );
  assert.equal(output, 'Enter a number: Value: 10\n');
});
