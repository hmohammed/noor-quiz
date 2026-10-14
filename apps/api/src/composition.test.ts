import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemClock } from './adapters/system/clock';
import { createComposition } from './composition';
import { ConfigError } from './config';

const built = vi.hoisted(() => ({ clocks: 0 }));

// Same SystemClock, but counts constructions so we can prove no adapter is built
// when config is invalid.
vi.mock('./adapters/system/clock', async (importOriginal) => {
  const real = await importOriginal<typeof import('./adapters/system/clock')>();
  class CountingSystemClock extends real.SystemClock {
    constructor() {
      super();
      built.clocks += 1;
    }
  }
  return { SystemClock: CountingSystemClock };
});

describe('createComposition', () => {
  beforeEach(() => {
    built.clocks = 0;
  });

  it.each([
    ['missing NOOR_ENV', {}],
    ['invalid NOOR_ENV', { NOOR_ENV: 'banana' }],
  ])('throws ConfigError before building any deps (%s)', (_label, env) => {
    expect(() => createComposition(env, { version: 'test-1' })).toThrow(ConfigError);
    expect(built.clocks).toBe(0);
  });

  it('wires a SystemClock and the typed config with a valid env', () => {
    const root = createComposition({ NOOR_ENV: 'local', OTHER: 'x' }, { version: 'test-1' });

    expect(root.deps.clock).toBeInstanceOf(SystemClock);
    expect(built.clocks).toBe(1);
    expect(root.config).toEqual({ env: 'local', logLevel: 'info' });
    expect(root.version).toBe('test-1');
  });
});
