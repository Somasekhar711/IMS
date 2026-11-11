import { startTestDatabase } from './testDb.js';

export default async function globalSetup() {
  globalThis.__STOCKIT_TEST_DB__ = await startTestDatabase();
}
