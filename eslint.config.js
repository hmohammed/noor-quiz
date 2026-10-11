import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const vendorMessage = 'No vendor imports in packages/core (AGENT.md rule 1). Add a port.';

const coreBanned = {
  paths: [
    { name: 'node:http', message: 'core has no I/O (AGENT.md rule 1)' },
    { name: 'http', message: 'core has no I/O (AGENT.md rule 1)' },
  ],
  patterns: [
    {
      group: ['firebase', 'firebase/*', 'firebase-*', 'firebase-*/*', '@firebase/*'],
      message: vendorMessage,
    },
    {
      group: ['stripe', 'stripe/*', 'openai', 'openai/*', 'hono', 'hono/*'],
      message: vendorMessage,
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'docs/**',
      'factory/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', coreBanned] },
  },
  prettier,
);
