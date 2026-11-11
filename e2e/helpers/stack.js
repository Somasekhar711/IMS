// Starts the whole application for the UI tests with zero setup:
//   1. a throwaway PostgreSQL with every migration applied (no account or password needed)
//   2. the Express API on port 3100
//   3. the React client (Vite) on port 5174, pointed at that API
//
// `npm run stack` (helpers/runStack.js) keeps it up so you can click around by hand.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestDatabase, TEST_DATABASE_URL } from '../../server/tests/helpers/testDb.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');

export const API_PORT = 3100;
export const CLIENT_PORT = 5174;
export const API_URL = `http://localhost:${API_PORT}/api`;
export const APP_URL = `http://localhost:${CLIENT_PORT}/`;

async function waitFor(url, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${label} did not start at ${url} within ${timeoutMs / 1000}s`);
}

function startNode(args, cwd, env, label) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.stdout.resume();
  return child;
}

export async function startStack() {
  const database = await startTestDatabase({ dataDir: path.join(ROOT, 'e2e', '.pgdata') });

  const api = startNode(['server.js'], path.join(ROOT, 'server'), {
    PORT: String(API_PORT),
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'stockit-e2e-secret',
    NODE_ENV: 'development',
  }, 'api');

  const client = startNode(
    [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--port', String(CLIENT_PORT), '--strictPort'],
    path.join(ROOT, 'client'),
    { VITE_API_URL: API_URL },
    'client'
  );

  const stop = async () => {
    client.kill();
    api.kill();
    await database.stop();
  };

  try {
    await waitFor(`${API_URL}/health`, 'API');
    await waitFor(APP_URL, 'Client');
  } catch (error) {
    await stop();
    throw error;
  }

  return { stop };
}
