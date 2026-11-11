export default async function globalTeardown() {
  await globalThis.__STOCKIT_STACK__?.stop();
}
