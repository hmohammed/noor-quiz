import { describe, expect, it } from 'vitest';
import { AuthConfigError, readAuthConfig } from './config';

const base = {
  VITE_FIREBASE_API_KEY: 'key-value-123',
  VITE_FIREBASE_AUTH_DOMAIN: 'noor-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'noor-dev',
};

describe('readAuthConfig', () => {
  it('returns the config with no emulator when the three keys are set', () => {
    expect(readAuthConfig(base)).toEqual({
      apiKey: 'key-value-123',
      authDomain: 'noor-dev.firebaseapp.com',
      projectId: 'noor-dev',
      emulatorUrl: null,
    });
  });

  it('builds the emulator URL for a demo-* project', () => {
    const config = readAuthConfig({
      ...base,
      VITE_FIREBASE_PROJECT_ID: 'demo-noor',
      VITE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    });
    expect(config?.emulatorUrl).toBe('http://127.0.0.1:9099');
    expect(config?.projectId).toBe('demo-noor');
  });

  it('treats an empty emulator host as no emulator', () => {
    expect(readAuthConfig({ ...base, VITE_AUTH_EMULATOR_HOST: '' })?.emulatorUrl).toBeNull();
  });

  it.each(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'])(
    'returns null when %s is missing or empty',
    (key) => {
      expect(readAuthConfig({ ...base, [key]: undefined })).toBeNull();
      expect(readAuthConfig({ ...base, [key]: '' })).toBeNull();
      expect(readAuthConfig({ ...base, [key]: '   ' })).toBeNull();
    },
  );

  it('returns null for an empty env', () => {
    expect(readAuthConfig({})).toBeNull();
  });

  it('refuses an emulator host for a non-demo project, naming keys but not values', () => {
    const env = { ...base, VITE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' };
    expect(() => readAuthConfig(env)).toThrow(AuthConfigError);
    try {
      readAuthConfig(env);
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('VITE_AUTH_EMULATOR_HOST');
      expect(message).toContain('VITE_FIREBASE_PROJECT_ID');
      expect(message).not.toContain('noor-dev');
      expect(message).not.toContain('127.0.0.1');
      expect(message).not.toContain('key-value-123');
    }
  });
});
