import { startStack } from './stack.js';

export default async function globalSetup() {
  globalThis.__STOCKIT_STACK__ = await startStack();
}
