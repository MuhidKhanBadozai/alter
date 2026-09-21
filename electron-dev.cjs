/**
 * Simple Electron launcher for development.
 * Waits for the Vite dev server to be ready before opening Electron.
 */
const { spawn } = require('child_process');
const http = require('http');

const VITE_URL = 'http://localhost:3000';
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000; // ms

function checkServer(retries) {
  http.get(VITE_URL, (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      console.log('[electron-dev] Vite is ready! Launching Electron...');
      const electronPath = require('electron');
      const proc = spawn(electronPath, ['.'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'development',
          ELECTRON_START_URL: VITE_URL,
        },
      });
      proc.on('close', (code) => {
        console.log('[electron-dev] Electron exited with code', code);
        process.exit(code);
      });
    } else {
      retry(retries);
    }
  }).on('error', () => retry(retries));
}

function retry(retries) {
  if (retries <= 0) {
    console.error('[electron-dev] Vite did not start in time. Aborting.');
    process.exit(1);
  }
  console.log(`[electron-dev] Waiting for Vite... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
  setTimeout(() => checkServer(retries - 1), RETRY_INTERVAL);
}

checkServer(MAX_RETRIES);
