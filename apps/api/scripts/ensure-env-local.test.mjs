// Runs only against temp directories, never against apps/api itself.
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureEnvLocal } from './ensure-env-local.mjs';

describe('ensureEnvLocal', () => {
  let dir = '';
  let target = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'noor-env-'));
    target = join(dir, 'build');
    await writeFile(join(dir, '.env.example'), 'NOOR_ENV=local\n');
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('copies .env.example into the target dir as .env.local, creating the dir', async () => {
    expect(await ensureEnvLocal(dir, target)).toBe(true);
    expect((await stat(target)).isDirectory()).toBe(true);
    expect(await readFile(join(target, '.env.local'), 'utf8')).toBe('NOOR_ENV=local\n');
  });

  it('defaults the target to the example dir', async () => {
    expect(await ensureEnvLocal(dir)).toBe(true);
    expect(await readFile(join(dir, '.env.local'), 'utf8')).toBe('NOOR_ENV=local\n');
  });

  it('is idempotent and never overwrites an existing .env.local', async () => {
    expect(await ensureEnvLocal(dir, target)).toBe(true);
    await writeFile(join(target, '.env.local'), 'NOOR_ENV=dev\n');
    expect(await ensureEnvLocal(dir, target)).toBe(false);
    expect(await ensureEnvLocal(dir, target)).toBe(false);
    expect(await readFile(join(target, '.env.local'), 'utf8')).toBe('NOOR_ENV=dev\n');
  });

  it('prints nothing itself', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await ensureEnvLocal(dir, target);
    expect(log).not.toHaveBeenCalled();
  });

  it('fails loudly when .env.example is missing', async () => {
    await rm(join(dir, '.env.example'));
    await expect(ensureEnvLocal(dir, target)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
