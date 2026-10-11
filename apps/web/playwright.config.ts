import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : 'list',
  // The functions emulator runs one request per worker. StrictMode's double effect sends
  // two overlapping health requests, so the second one cold-starts a new worker. That takes
  // ~1-2 s on a native Linux disk but ~25 s when the repo lives on a Windows drive under WSL
  // (/mnt/c), plus Vite's first dependency pre-bundle. Allow for the slow case.
  timeout: 90_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Answers only once the function is loaded, so tests never race the emulator.
      command: 'npm run dev:emulators',
      cwd: repoRoot,
      url: 'http://127.0.0.1:5001/demo-noor/europe-west1/api/v1/health',
      timeout: 180_000,
      reuseExistingServer,
      // The Firestore emulator (Java) runs in its own process group. The default SIGKILL
      // of our group would orphan it; SIGINT lets the firebase CLI stop it cleanly.
      gracefulShutdown: { signal: 'SIGINT', timeout: 30_000 },
    },
    {
      command: 'npm run dev:web',
      cwd: repoRoot,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer,
    },
  ],
});
