// Runs before each test file: point the app at the throwaway test database.
import { TEST_DATABASE_URL } from './testDb.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'stockit-test-secret';

// The pool logs "Connected to PostgreSQL" on every connection; keep test output readable.
console.log = () => {};
