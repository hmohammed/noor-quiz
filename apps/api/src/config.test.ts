import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

function errorOf(call: () => unknown): ConfigError {
  try {
    call();
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e as ConfigError;
  }
  throw new Error('expected loadConfig to throw');
}

describe('loadConfig', () => {
  it('fails fast naming NOOR_ENV when it is missing', () => {
    const err = errorOf(() => loadConfig({}));
    expect(err.message).toMatch(/^Invalid API config: /);
    expect(err.message).toContain('NOOR_ENV is required');
  });

  it('treats an empty NOOR_ENV as missing', () => {
    expect(errorOf(() => loadConfig({ NOOR_ENV: '' })).message).toContain('NOOR_ENV is required');
  });

  it('names NOOR_ENV and lists the allowed values when it is invalid', () => {
    const err = errorOf(() => loadConfig({ NOOR_ENV: 'banana' }));
    expect(err.message).toContain('NOOR_ENV must be one of: local, dev, staging, prod');
  });

  it('names LOG_LEVEL and lists the allowed values when it is invalid', () => {
    const err = errorOf(() => loadConfig({ NOOR_ENV: 'local', LOG_LEVEL: 'loud' }));
    expect(err.message).toContain('LOG_LEVEL must be one of: debug, info, warn, error');
  });

  it('never puts env values in the error message', () => {
    const err = errorOf(() =>
      loadConfig({
        NOOR_ENV: 'banana',
        LOG_LEVEL: 'loud-sentinel',
        SOME_SECRET: 'hunter2-sentinel',
      }),
    );
    expect(err.message).not.toContain('hunter2-sentinel');
    expect(err.message).not.toContain('banana');
    expect(err.message).not.toContain('loud-sentinel');
    expect(err.message).not.toContain('SOME_SECRET');
  });

  it('returns a typed config with defaults applied', () => {
    expect(loadConfig({ NOOR_ENV: 'local' })).toEqual({ env: 'local', logLevel: 'info' });
    expect(loadConfig({ NOOR_ENV: 'prod', LOG_LEVEL: 'warn' })).toEqual({
      env: 'prod',
      logLevel: 'warn',
    });
  });

  it('ignores unknown env keys and does not copy them into the config', () => {
    const config = loadConfig({ NOOR_ENV: 'dev', PATH: '/usr/bin', SOME_SECRET: 'x' });
    expect(Object.keys(config).sort()).toEqual(['env', 'logLevel']);
    expect(JSON.stringify(config)).not.toContain('SOME_SECRET');
  });
});
