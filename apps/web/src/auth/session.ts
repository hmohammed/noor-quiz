// The only module that imports Firebase (enforced by firebase-boundary.test.ts). Its API
// exposes booleans, strings and SessionError, so another OIDC client can replace it here.
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import { AuthConfigError, readAuthConfig } from './config';

export class SessionError extends Error {
  override name = 'SessionError';
  constructor(readonly code: 'cancelled' | 'failed') {
    super(`Sign-in ${code}`);
  }
}

const cancelledCodes = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

// undefined: not initialised yet; null: not configured.
let cached: Auth | null | undefined;

function getSessionAuth(): Auth | null {
  if (cached !== undefined) return cached;
  let config;
  try {
    config = readAuthConfig({ ...import.meta.env });
  } catch (err) {
    if (!(err instanceof AuthConfigError)) throw err;
    console.error(err.message);
    config = null;
  }
  if (!config) return (cached = null);

  const { emulatorUrl, ...options } = config;
  // getApps() keeps Vite HMR from initialising the default app twice.
  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  const auth = getAuth(app);
  if (emulatorUrl && !auth.emulatorConfig) connectAuthEmulator(auth, emulatorUrl);
  return (cached = auth);
}

export function isConfigured(): boolean {
  return getSessionAuth() !== null;
}

export async function signIn(): Promise<void> {
  const auth = getSessionAuth();
  if (!auth) throw new SessionError('failed');
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
    throw new SessionError(typeof code === 'string' && cancelledCodes.has(code) ? 'cancelled' : 'failed');
  }
}

export async function signOut(): Promise<void> {
  const auth = getSessionAuth();
  if (auth) await firebaseSignOut(auth);
}

/** Calls `cb` with whether someone is signed in, now and on every change. Returns unsubscribe. */
export function onChange(cb: (signedIn: boolean) => void): () => void {
  const auth = getSessionAuth();
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, (user) => cb(user !== null));
}

/** A fresh ID token (the SDK refreshes expired ones), or null when signed out. */
export async function getIdToken(): Promise<string | null> {
  const user = getSessionAuth()?.currentUser;
  return user ? user.getIdToken() : null;
}
