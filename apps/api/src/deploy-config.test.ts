// Guards the Firebase deploy config: functions ship from the esbuild output, and Hosting
// sends /v1/** to the `api` function in the same region the function declares.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGION } from './region';

const firebaseDir = join(import.meta.dirname, '../../../firebase');
const readJson = (file: string) => JSON.parse(readFileSync(join(firebaseDir, file), 'utf8'));

const firebaseJson = readJson('firebase.json');
const firebaserc = readJson('.firebaserc');

describe('firebase/firebase.json', () => {
  it('deploys functions from the bundled build directory', () => {
    expect(firebaseJson.functions).toHaveLength(1);
    const [fn] = firebaseJson.functions;
    expect(fn.source).toBe('../apps/api/build');
    expect(fn.codebase).toBe('api');
    expect(fn.runtime).toBe('nodejs22');
  });

  it('serves the web build from Hosting', () => {
    expect(firebaseJson.hosting.public).toBe('../apps/web/dist');
  });

  it('rewrites /v1/** to the api function first, then falls back to the SPA', () => {
    const rewrites = firebaseJson.hosting.rewrites;
    expect(rewrites[0]).toEqual({
      source: '/v1/**',
      function: { functionId: 'api', region: REGION },
    });
    const fallback = rewrites.findIndex(
      (r: { source: string; destination?: string }) =>
        r.source === '**' && r.destination === '/index.html',
    );
    expect(fallback).toBeGreaterThan(0);
  });
});

describe('region', () => {
  it('is europe-west1', () => {
    expect(REGION).toBe('europe-west1');
  });
});

describe('firebase/.firebaserc', () => {
  it('maps the dev alias to the dev project and has no default alias', () => {
    expect(firebaserc.projects.dev).toBe('noor-quiz-bec90');
    expect(firebaserc.projects).not.toHaveProperty('default');
  });
});
