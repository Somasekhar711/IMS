// `npm run test:junit`: compiles and runs the JUnit 5 API tests in ../junit against
// the application started on a fresh database. Needs a JDK (javac/java) on PATH.
// The JUnit console launcher (one jar) is fetched from Maven Central on first use.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStack, API_URL } from './stack.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const JUNIT_DIR = path.resolve(here, '../../junit');
const VERSION = '1.10.2';
const JAR = path.join(JUNIT_DIR, 'lib', `junit-platform-console-standalone-${VERSION}.jar`);
const JAR_URL = `https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/${VERSION}/junit-platform-console-standalone-${VERSION}.jar`;
const OUT = path.join(JUNIT_DIR, 'out');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw new Error(`Could not run ${command}: is a JDK installed and on PATH?`);
  return result.status;
}

if (!fs.existsSync(JAR)) {
  console.log('Downloading the JUnit 5 console launcher...');
  const response = await fetch(JAR_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${JAR_URL}`);
  fs.mkdirSync(path.dirname(JAR), { recursive: true });
  fs.writeFileSync(JAR, Buffer.from(await response.arrayBuffer()));
}

fs.rmSync(OUT, { recursive: true, force: true });
if (run('javac', ['-cp', JAR, '-d', OUT, path.join(JUNIT_DIR, 'src', 'StockItApiTest.java')]) !== 0) process.exit(1);

const stack = await startStack();
let status = 1;
try {
  status = run('java', [`-Dstockit.api=${API_URL}`, '-jar', JAR, 'execute', '--class-path', OUT, '--scan-class-path', '--details', 'tree', '--details-theme', 'ascii', '--disable-banner']);
} finally {
  await stack.stop();
}
process.exit(status);
