// Runs only against temp directories, never against apps/web itself.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureWebEnvLocal } from './ensure-env-local.mjs';

describe('ensureWebEnvLocal', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'noor-web-env-'));
    await writeFile(join(dir, '.env.example'), 'VITE_FIREBASE_PROJECT_ID=demo-noor\n');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates .env.local next to .env.example and never overwrites it', async () => {
    expect(await ensureWebEnvLocal(dir)).toBe(true);
    expect(await readFile(join(dir, '.env.local'), 'utf8')).toBe(
      'VITE_FIREBASE_PROJECT_ID=demo-noor\n',
    );

    await writeFile(join(dir, '.env.local'), 'VITE_FIREBASE_PROJECT_ID=demo-other\n');
    expect(await ensureWebEnvLocal(dir)).toBe(false);
    expect(await readFile(join(dir, '.env.local'), 'utf8')).toBe(
      'VITE_FIREBASE_PROJECT_ID=demo-other\n',
    );
  });
});
