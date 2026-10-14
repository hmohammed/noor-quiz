// Runs only against a temp directory, never against apps/api itself.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureEnvLocal } from './ensure-env-local.mjs';

describe('ensureEnvLocal', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'noor-env-'));
    await writeFile(join(dir, '.env.example'), 'NOOR_ENV=local\n');
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('copies .env.example to .env.local when it is missing', async () => {
    expect(await ensureEnvLocal(dir)).toBe(true);
    expect(await readFile(join(dir, '.env.local'), 'utf8')).toBe('NOOR_ENV=local\n');
  });

  it('is idempotent and never overwrites an existing .env.local', async () => {
    await writeFile(join(dir, '.env.local'), 'NOOR_ENV=dev\n');
    expect(await ensureEnvLocal(dir)).toBe(false);
    expect(await ensureEnvLocal(dir)).toBe(false);
    expect(await readFile(join(dir, '.env.local'), 'utf8')).toBe('NOOR_ENV=dev\n');
  });

  it('prints nothing itself', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await ensureEnvLocal(dir);
    expect(log).not.toHaveBeenCalled();
  });

  it('fails loudly when .env.example is missing', async () => {
    await rm(join(dir, '.env.example'));
    await expect(ensureEnvLocal(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
