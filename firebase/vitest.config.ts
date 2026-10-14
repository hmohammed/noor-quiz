import { defineConfig } from 'vitest/config';

// Rules tests need the Firestore emulator. Run them with `npm run test:emulator`.
// This config is deliberately NOT in the root vitest.config.ts projects, so `npm test`
// stays emulator-free.
export default defineConfig({
  test: {
    name: 'rules',
    root: import.meta.dirname,
    include: ['rules.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
