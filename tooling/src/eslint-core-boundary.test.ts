import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// tooling/src/<this file> -> repo root is two levels up.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Virtual paths: these files must NOT exist on disk, or `npm run lint` would fail.
const coreFixture = join(repoRoot, 'packages/core/src/__lint_fixture__.ts');
const apiFixture = join(repoRoot, 'apps/api/src/__lint_fixture__.ts');

const eslint = new ESLint({ cwd: repoRoot });

async function restrictedImportMessages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result).toBeDefined();
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports');
}

const bannedSpecifiers = [
  'firebase',
  'firebase/app',
  'firebase-admin',
  'firebase-admin/firestore',
  'firebase-functions',
  'firebase-functions/v2/https',
  '@firebase/app',
  'stripe',
  'openai',
  'hono',
  'hono/cors',
  'node:http',
  'http',
];

describe('ESLint core boundary (AGENT.md rule 1)', () => {
  // The first lintText call loads eslint.config.js and the TS parser, which can take
  // several seconds on slow filesystems. Pay that cost once, outside any single test.
  beforeAll(async () => {
    await eslint.lintText('export {};\n', { filePath: coreFixture });
  }, 60_000);

  it("flags `import 'firebase-admin'` in packages/core", async () => {
    const messages = await restrictedImportMessages("import 'firebase-admin';\n", coreFixture);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(2);
  });

  it.each(bannedSpecifiers)('flags a value import of %s in packages/core', async (specifier) => {
    const code = `import x from '${specifier}';\nexport { x };\n`;
    const messages = await restrictedImportMessages(code, coreFixture);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(2);
  });

  it.each(bannedSpecifiers)('flags a type import of %s in packages/core', async (specifier) => {
    const code = `import type { X } from '${specifier}';\nexport type { X };\n`;
    const messages = await restrictedImportMessages(code, coreFixture);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(2);
  });

  it('does not apply the ban outside packages/core', async () => {
    const messages = await restrictedImportMessages("import 'firebase-admin';\n", apiFixture);
    expect(messages).toHaveLength(0);
  });

  it('allows zod and relative imports in packages/core', async () => {
    const code = "import { z } from 'zod';\nimport { y } from './other';\nexport { z, y };\n";
    const messages = await restrictedImportMessages(code, coreFixture);
    expect(messages).toHaveLength(0);
  });
});
