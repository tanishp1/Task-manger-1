import 'dotenv/config';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 5000);

try {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(1500),
  });
  const health = await response.json();
  if (response.ok && health.status === 'ok') {
    console.log(`Taskflow API is already running on port ${port}; reusing it.`);
    process.exit(0);
  }
} catch {
  // No healthy Taskflow API is listening; start the development server below.
}

const server = spawn(process.execPath, ['--watch', 'server/index.js'], {
  env: process.env,
  stdio: 'inherit',
});

server.on('error', (error) => {
  console.error('Unable to start the Taskflow API:', error.message);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
