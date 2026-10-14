import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const vendorMessage = 'No vendor imports in packages/core (AGENT.md rule 1). Add a port.';

const clockMessage = 'Use the Clock port (AGENT.md rule 5)';

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

const webWriteMessage = 'The browser never writes to Firestore (AGENT.md rule 3). Call the API.';
const firestoreWriteApis = [
  'setDoc',
  'addDoc',
  'updateDoc',
  'deleteDoc',
  'writeBatch',
  'runTransaction',
];

const webFirestoreWrites = {
  paths: ['firebase/firestore', 'firebase/firestore/lite', '@firebase/firestore'].map((name) => ({
    name,
    importNames: firestoreWriteApis,
    message: webWriteMessage,
  })),
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/build/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/**',
      'factory/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts (e.g. apps/api/scripts/build-function.mjs).
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', coreBanned] },
  },
  {
    files: ['packages/core/**/*.{ts,tsx}', 'apps/api/src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: clockMessage,
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: clockMessage,
        },
      ],
    },
  },
  {
    // Disjoint from the core blocks above, so neither overrides the other.
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', webFirestoreWrites] },
  },
  prettier,
);
