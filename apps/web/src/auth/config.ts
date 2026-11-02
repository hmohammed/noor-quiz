/** Public Firebase web config read from `VITE_*` keys. Pure: no Firebase import. */
export interface AuthConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  /** `http://<VITE_AUTH_EMULATOR_HOST>`, or null to use real Firebase Auth. */
  emulatorUrl: string | null;
}

/** The env asks for something unsafe. Messages name keys, never values. */
export class AuthConfigError extends Error {
  override name = 'AuthConfigError';
}

function read(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

/** Returns null when sign-in is not configured; throws when an emulator meets a real project. */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  const apiKey = read(env, 'VITE_FIREBASE_API_KEY');
  const authDomain = read(env, 'VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = read(env, 'VITE_FIREBASE_PROJECT_ID');
  if (!apiKey || !authDomain || !projectId) return null;

  const emulatorHost = read(env, 'VITE_AUTH_EMULATOR_HOST');
  if (emulatorHost && !projectId.startsWith('demo-')) {
    throw new AuthConfigError(
      'VITE_AUTH_EMULATOR_HOST is only allowed when VITE_FIREBASE_PROJECT_ID starts with "demo-"',
    );
  }
  return {
    apiKey,
    authDomain,
    projectId,
    emulatorUrl: emulatorHost ? `http://${emulatorHost}` : null,
  };
}
