import { afterAll } from '@jest/globals';

afterAll(async () => {
  const { default: pool } = await import('../../config/db.js');
  await pool.end();
});
