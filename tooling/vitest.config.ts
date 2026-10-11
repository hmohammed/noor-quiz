import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'tooling',
    include: ['src/**/*.test.ts'],
    // ESLint Node API calls are slower than plain unit tests.
    testTimeout: 30_000,
  },
});
