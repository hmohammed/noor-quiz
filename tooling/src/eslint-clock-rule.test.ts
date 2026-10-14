import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Virtual paths: these files must NOT exist on disk, or `npm run lint` would fail.
const coreFixture = join(repoRoot, 'packages/core/src/__clock_fixture__.ts');
const routeFixture = join(repoRoot, 'apps/api/src/routes/__clock_fixture__.ts');
const adapterFixture = join(repoRoot, 'apps/api/src/adapters/system/__clock_fixture__.ts');

const eslint = new ESLint({ cwd: repoRoot });

async function clockMessages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result).toBeDefined();
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax');
}

describe('ESLint Clock rule (AGENT.md rule 5)', () => {
  beforeAll(async () => {
    await eslint.lintText('export {};\n', { filePath: coreFixture });
  }, 60_000);

  it.each([
    ['Date.now()', 'export const a = Date.now();\n'],
    ['new Date()', 'export const a = new Date();\n'],
  ])('flags %s in packages/core and apps/api/src/routes', async (_label, code) => {
    for (const file of [coreFixture, routeFixture]) {
      const messages = await clockMessages(code, file);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.message).toBe('Use the Clock port (AGENT.md rule 5)');
    }
  });

  it('allows new Date(ms), which is deterministic', async () => {
    expect(await clockMessages('export const a = new Date(1);\n', coreFixture)).toHaveLength(0);
  });

  it('allows Date.now() in the SystemClock adapter folder', async () => {
    expect(await clockMessages('export const a = Date.now();\n', adapterFixture)).toHaveLength(0);
  });
});
