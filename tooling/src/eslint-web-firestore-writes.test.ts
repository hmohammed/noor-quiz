import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// tooling/src/<this file> -> repo root is two levels up.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Virtual paths: these files must NOT exist on disk, or `npm run lint` would fail.
const webFixture = join(repoRoot, 'apps/web/src/__lint_fixture__.ts');
const webTsxFixture = join(repoRoot, 'apps/web/src/__lint_fixture__.tsx');
const apiFixture = join(repoRoot, 'apps/api/src/__lint_fixture__.ts');

const eslint = new ESLint({ cwd: repoRoot });

async function restrictedImportMessages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result).toBeDefined();
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports');
}

const writeApis = ['setDoc', 'addDoc', 'updateDoc', 'deleteDoc', 'writeBatch', 'runTransaction'];
const sources = ['firebase/firestore', 'firebase/firestore/lite'];
const cases = sources.flatMap((source) => writeApis.map((api) => [api, source] as const));

function expectOneError(messages: Awaited<ReturnType<typeof restrictedImportMessages>>) {
  expect(messages).toHaveLength(1);
  expect(messages[0]?.severity).toBe(2);
  expect(messages[0]?.message).toContain('AGENT.md rule 3');
}

describe('ESLint: apps/web never imports Firestore write APIs (AGENT.md rule 3)', () => {
  // The first lintText call loads eslint.config.js and the TS parser, which can take
  // several seconds on slow filesystems. Pay that cost once, outside any single test.
  beforeAll(async () => {
    await eslint.lintText('export {};\n', { filePath: webFixture });
  }, 60_000);

  it("flags `import { setDoc } from 'firebase/firestore'` in apps/web", async () => {
    const code = "import { setDoc } from 'firebase/firestore';\nexport { setDoc };\n";
    expectOneError(await restrictedImportMessages(code, webFixture));
  });

  it.each(cases)('flags %s imported from %s in apps/web', async (api, source) => {
    const code = `import { ${api} } from '${source}';\nexport { ${api} };\n`;
    expectOneError(await restrictedImportMessages(code, webFixture));
  });

  it('flags the import in a .tsx file', async () => {
    const code = "import { setDoc } from 'firebase/firestore';\nexport { setDoc };\n";
    expectOneError(await restrictedImportMessages(code, webTsxFixture));
  });

  it('flags an aliased import', async () => {
    const code = "import { setDoc as s } from 'firebase/firestore';\nexport { s };\n";
    expectOneError(await restrictedImportMessages(code, webFixture));
  });

  it('flags a namespace import', async () => {
    const code = "import * as fs from 'firebase/firestore';\nexport { fs };\n";
    expectOneError(await restrictedImportMessages(code, webFixture));
  });

  it('flags a re-export', async () => {
    const code = "export { setDoc } from 'firebase/firestore';\n";
    expectOneError(await restrictedImportMessages(code, webFixture));
  });

  it('allows Firestore read APIs in apps/web', async () => {
    const code =
      "import { getDoc, onSnapshot, doc, collection, query } from 'firebase/firestore';\n" +
      'export { getDoc, onSnapshot, doc, collection, query };\n';
    expect(await restrictedImportMessages(code, webFixture)).toHaveLength(0);
  });

  it('does not apply the ban outside apps/web', async () => {
    const code = "import { setDoc } from 'firebase/firestore';\nexport { setDoc };\n";
    expect(await restrictedImportMessages(code, apiFixture)).toHaveLength(0);
  });
});
