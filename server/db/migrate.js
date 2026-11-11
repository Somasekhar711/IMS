// `npm run migrate`: applies every numbered .sql file in this folder, in order,
// to the database named by DATABASE_URL in server/.env. Each migration is
// written to be safe to re-run (IF NOT EXISTS / IF EXISTS), so this can be
// repeated on a database that already has some or all of the tables.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();

try {
  for (const file of files) {
    await pool.query(fs.readFileSync(path.join(here, file), 'utf8'));
    console.log(`applied ${file}`);
  }
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log(`\n${tables.rowCount} tables: ${tables.rows.map((row) => row.table_name).join(', ')}`);
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
