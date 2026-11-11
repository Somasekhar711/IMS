// `npm run test:headed`: runs the Selenium suite with a visible browser window,
// slowed down so each step can be watched (useful for a live demo).
import { spawn } from 'node:child_process';

const child = spawn(
  process.execPath,
  ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--forceExit', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, HEADED: '1' } }
);
child.on('exit', (code) => process.exit(code ?? 1));
