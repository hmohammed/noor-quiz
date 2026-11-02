import { defineConfig } from 'vitest/config';

// Everything that needs the Firestore emulator. `npm run test:emulator` starts it.
// Both projects share one emulator project, so files run one at a time.
export default defineConfig({
  test: {
    projects: ['firebase/vitest.config.ts', 'apps/api/vitest.emulator.config.ts'],
    fileParallelism: false,
  },
});
