import { spawn } from 'node:child_process';

const backendJar = '../backend/target/backend-0.0.1-SNAPSHOT.jar';
const backendUrl = 'http://127.0.0.1:8080';
const server = spawn('java', ['-jar', backendJar], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

try {
  await waitForBackend();
  process.exitCode = await runPlaywright();
} finally {
  server.kill();
}

async function waitForBackend() {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendUrl}/actuator/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the backend is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${backendUrl}`);
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/goals.spec.js', '--reporter=line'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: backendUrl
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
