export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './tests/helpers/globalSetup.js',
  globalTeardown: './tests/helpers/globalTeardown.js',
  setupFiles: ['./tests/helpers/env.js'],
  setupFilesAfterEnv: ['./tests/helpers/afterEnv.js'],
  transform: {},
  testTimeout: 30000,
  collectCoverageFrom: ['app.js', 'routes/**/*.js', 'middleware/**/*.js', 'config/**/*.js'],
  coverageDirectory: 'tests/coverage',
  coverageReporters: ['text-summary', 'text', 'html'],
  verbose: true,
};
