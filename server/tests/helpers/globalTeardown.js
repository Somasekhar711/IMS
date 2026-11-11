export default async function globalTeardown() {
  await globalThis.__STOCKIT_TEST_DB__?.stop();
}
