// Builds only into a temp directory, never into apps/api/build.
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFunction, deployManifest } from './build-function.mjs';

const apiPkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

describe('deployManifest', () => {
  it('keeps only the runtime Firebase dependencies, with the ranges from apps/api', () => {
    expect(deployManifest(apiPkg)).toEqual({
      name: '@noor/api-function',
      private: true,
      type: 'module',
      main: 'index.js',
      dependencies: {
        'firebase-functions': apiPkg.dependencies['firebase-functions'],
        'firebase-admin': apiPkg.dependencies['firebase-admin'],
      },
    });
  });

  it('has no workspace dependency, devDependencies or scripts', () => {
    const manifest = deployManifest(apiPkg);
    expect(Object.keys(manifest.dependencies).some((d) => d.startsWith('@noor/'))).toBe(false);
    expect(manifest).not.toHaveProperty('devDependencies');
    expect(manifest).not.toHaveProperty('scripts');
  });

  it.each(['firebase-functions', 'firebase-admin'])('throws when %s is missing', (dep) => {
    const dependencies = { ...apiPkg.dependencies };
    delete dependencies[dep];
    expect(() => deployManifest({ ...apiPkg, dependencies })).toThrow(dep);
  });

  it('throws when the input has no dependencies at all', () => {
    expect(() => deployManifest({ name: '@noor/api' })).toThrow('firebase-functions');
  });
});

describe('buildFunction', () => {
  let outdir = '';

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), 'noor-build-'));
    await buildFunction({ outdir, logLevel: 'silent' });
  }, 60_000);
  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  it('writes the bundle and a package.json equal to the deploy manifest', async () => {
    const files = await readdir(outdir);
    expect(files).toContain('index.js');
    const written = JSON.parse(await readFile(join(outdir, 'package.json'), 'utf8'));
    expect(written).toEqual(deployManifest(apiPkg));
  });

  it('writes no dotenv file', async () => {
    const files = await readdir(outdir);
    expect(files.filter((f) => f.startsWith('.env'))).toEqual([]);
  });
});
