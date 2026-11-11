// `npm run stack`: start the whole app on a fresh, empty database and keep it running.
import { startStack, API_URL, APP_URL } from './stack.js';

const stack = await startStack();
console.log(`
StockIt is running with a fresh, empty database:
  App: ${APP_URL}
  API: ${API_URL}

Press Ctrl+C to stop.`);

const shutdown = async () => { await stack.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
