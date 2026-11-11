// Starts a throwaway PostgreSQL server for the tests (no installed database,
// account, or password needed) and applies every numbered migration to it.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../db');

export const TEST_DB = {
  port: 54329,
  user: 'postgres',
  password: 'stockit-test',
  database: 'stockit_test',
};

export const TEST_DATABASE_URL =
  `postgres://${TEST_DB.user}:${TEST_DB.password}@localhost:${TEST_DB.port}/${TEST_DB.database}`;

export async function startTestDatabase({ dataDir = path.resolve(here, '../.pgdata'), quiet = true } = {}) {
  fs.rmSync(dataDir, { recursive: true, force: true });

  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: TEST_DB.port,
    user: TEST_DB.user,
    password: TEST_DB.password,
    persistent: false,
    // Windows defaults to a WIN1252 cluster, which cannot store the unicode text in the migrations.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: quiet ? () => {} : console.log,
    onError: quiet ? () => {} : console.error,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase(TEST_DB.database);

  const client = server.getPgClient(TEST_DB.database);
  await client.connect();
  const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
  for (const file of migrations) {
    await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  await client.end();

  return { server, migrations, stop: () => stopTestDatabase(server, dataDir) };
}

// Stops the throwaway server. On Windows a worker process can outlive the
// postmaster and keep stop() waiting forever, so give it a few seconds and
// then remove whatever is left of this one data directory.
async function stopTestDatabase(server, dataDir) {
  await Promise.race([
    server.stop().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  if (process.platform === 'win32') {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='postgres.exe'\\" | Where-Object { $_.CommandLine -like '*embedded-postgres*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
        { stdio: 'ignore' }
      );
    } catch {
      // nothing left to clean up
    }
  }

  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
