import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated, runAuthVerifierContract } from '@noor/testkit';
import { FirebaseAuthVerifier } from './auth-verifier';

const PROJECT_ID = 'demo-noor';

/** Refuses to run unless the admin SDK is pointed at the emulator, never a real project. */
function requireEmulator(env: Record<string, string | undefined>): string {
  if (!env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST is not set. Run `npm run test:emulator`.');
  }
  return env.FIREBASE_AUTH_EMULATOR_HOST;
}

let app: App | undefined;
let auth: Auth;
let host: string;

beforeAll(() => {
  host = requireEmulator(process.env);
  app = initializeApp({ projectId: PROJECT_ID }, 'auth-verifier-contract');
  auth = getAuth(app);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

async function clearAccounts(): Promise<void> {
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  if (!res.ok) throw new Error(`clearing emulator accounts failed: ${res.status}`);
}

/** Exchanges a custom token for an ID token on the emulator's REST endpoint. */
async function idTokenFor(uid: string): Promise<string> {
  const customToken = await auth.createCustomToken(uid);
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`emulator sign-in failed: ${res.status}`);
  const body = (await res.json()) as { idToken?: unknown };
  if (typeof body.idToken !== 'string') throw new Error('emulator sign-in returned no idToken');
  return body.idToken;
}

/** An unsigned JWT; the admin SDK accepts `alg: none` only in emulator mode. */
function unsignedJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.`;
}

function claimsFor(uid: string, project: string, issuedAgoSec: number, expiresInSec: number) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    sub: uid,
    user_id: uid,
    iat: now - issuedAgoSec,
    auth_time: now - issuedAgoSec,
    exp: now + expiresInSec,
    firebase: { identities: {}, sign_in_provider: 'custom' },
  };
}

runAuthVerifierContract('FirebaseAuthVerifier (emulator)', async () => {
  await clearAccounts();
  return {
    verifier: new FirebaseAuthVerifier(auth),
    issue: async ({ subject, email, emailVerified, name }) => {
      const user = await auth.createUser({
        ...(subject ? { uid: subject } : {}),
        ...(email !== null ? { email } : {}),
        emailVerified,
        ...(name !== null ? { displayName: name } : {}),
      });
      return { token: await idTokenFor(user.uid), subject: user.uid };
    },
    revoke: async (_token, subject) => {
      // Revocation compares whole seconds (auth_time vs tokensValidAfterTime).
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await auth.revokeRefreshTokens(subject);
    },
  };
});

describe('FirebaseAuthVerifier (emulator only)', () => {
  let verifier: FirebaseAuthVerifier;
  const spies: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(async () => {
    await clearAccounts();
    verifier = new FirebaseAuthVerifier(auth);
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore();
  });

  async function newUserToken(): Promise<{ uid: string; token: string }> {
    const { uid } = await auth.createUser({ email: 'alice@example.com', displayName: 'Alice' });
    return { uid, token: await idTokenFor(uid) };
  }

  it('refuses to run without FIREBASE_AUTH_EMULATOR_HOST', () => {
    expect(() => requireEmulator({})).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('accepts a well-formed unsigned emulator token (so the rejections below are meaningful)', async () => {
    const { uid } = await auth.createUser({});
    const token = unsignedJwt(claimsFor(uid, PROJECT_ID, 60, 3600));

    expect((await verifier.verify(token)).subject).toBe(uid);
  });

  it('rejects an expired token with UNAUTHENTICATED', async () => {
    const { uid } = await auth.createUser({});
    const token = unsignedJwt(claimsFor(uid, PROJECT_ID, 2 * 3600, -3600));

    await expectUnauthenticated(verifier.verify(token), token);
  });

  it('rejects a token for a wrong project with UNAUTHENTICATED', async () => {
    const { uid } = await auth.createUser({});
    const token = unsignedJwt(claimsFor(uid, 'other-project', 60, 3600));

    await expectUnauthenticated(verifier.verify(token), token);
  });

  it('rejects a token for a disabled user with UNAUTHENTICATED', async () => {
    const { uid, token } = await newUserToken();
    await verifier.verify(token);

    await auth.updateUser(uid, { disabled: true });

    await expectUnauthenticated(verifier.verify(token), token);
  });

  it('rejects a token for a deleted user with UNAUTHENTICATED', async () => {
    const { uid, token } = await newUserToken();
    await verifier.verify(token);

    await auth.deleteUser(uid);

    await expectUnauthenticated(verifier.verify(token), token);
  });

  it('keeps only an auth/... SDK code in details, never the SDK message', async () => {
    const { uid } = await auth.createUser({});
    const token = unsignedJwt(claimsFor(uid, PROJECT_ID, 2 * 3600, -3600));

    const err = await verifier.verify(token).catch((e: unknown) => e);

    expect(err).toMatchObject({ details: { reason: 'token-rejected' } });
    const details = (err as { details: Record<string, unknown> }).details;
    expect(Object.keys(details).sort()).toEqual(
      'sdkCode' in details ? ['reason', 'sdkCode'] : ['reason'],
    );
    if ('sdkCode' in details) expect(details.sdkCode).toMatch(/^auth\/[a-z-]+$/);
  });

  it('writes nothing to the console when it rejects a token', async () => {
    for (const method of ['error', 'warn', 'log', 'info'] as const) {
      spies.push(vi.spyOn(console, method).mockImplementation(() => undefined));
    }
    const { uid, token } = await newUserToken();
    const expired = unsignedJwt(claimsFor(uid, PROJECT_ID, 2 * 3600, -3600));
    await auth.updateUser(uid, { disabled: true });

    for (const t of [token, expired, 'garbage', 'a.b.c', '']) {
      await expectUnauthenticated(verifier.verify(t), t);
    }

    for (const spy of spies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(expired);
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
