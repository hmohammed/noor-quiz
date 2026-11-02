import { defineProject } from 'vitest/config';

// Adapter contract tests on the Firebase emulator. Run with `npm run test:emulator`;
// deliberately not part of `npm test`.
export default defineProject({
  test: {
    name: 'api-emulator',
    root: import.meta.dirname,
    include: ['src/**/*.contract.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
