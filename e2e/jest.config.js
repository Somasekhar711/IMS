export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.e2e.test.js'],
  globalSetup: './helpers/globalSetup.js',
  globalTeardown: './helpers/globalTeardown.js',
  transform: {},
  testTimeout: 90000,
  verbose: true,
};
