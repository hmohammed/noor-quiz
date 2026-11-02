import { configDefaults, defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Adapter contract tests need the emulator: `npm run test:emulator` runs them.
    exclude: ['src/**/*.contract.test.ts', ...configDefaults.exclude],
  },
});
