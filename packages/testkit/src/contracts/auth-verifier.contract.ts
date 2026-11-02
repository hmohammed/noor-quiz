import { describe, expect, it } from 'vitest';
import { isDomainError, type AuthVerifier, type VerifiedIdentity } from '@noor/core';

export interface AuthVerifierHarness {
  verifier: AuthVerifier;
  /** Creates the identity in the backing store and returns a currently valid token. */
  issue(
    identity: Omit<VerifiedIdentity, 'provider' | 'subject'> & { subject?: string },
  ): Promise<{ token: string; subject: string }>;
  /** Revokes a token issued by `issue` (fake: reject; emulator: revokeRefreshTokens). */
  revoke(token: string, subject: string): Promise<void>;
}

const MALFORMED_TOKENS = ['', 'garbage', 'a.b.c'];

/**
 * Asserts `p` rejects with DomainError('UNAUTHENTICATED') whose message and details
 * never contain `token`. Exported so adapter-only tests reuse the same check.
 */
export async function expectUnauthenticated(p: Promise<unknown>, token: string): Promise<void> {
  const err = await p.then(
    () => expect.fail('expected DomainError(UNAUTHENTICATED)'),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  const domainError = err as { code: string; message: string; details?: unknown };
  expect(domainError.code).toBe('UNAUTHENTICATED');
  if (token.length > 0) {
    expect(domainError.message).not.toContain(token);
    expect(JSON.stringify(domainError.details ?? null)).not.toContain(token);
  }
}

/**
 * Behaviour every AuthVerifier must have. Runs against FakeAuthVerifier in testkit and
 * against FirebaseAuthVerifier on the Auth emulator. `makeImpl` must return an empty store.
 */
export function runAuthVerifierContract(
  name: string,
  makeImpl: () => Promise<AuthVerifierHarness>,
): void {
  describe(`AuthVerifier contract: ${name}`, () => {
    it('resolves a valid token to the identity it was issued for', async () => {
      const { verifier, issue } = await makeImpl();
      const { token, subject } = await issue({
        email: 'alice@example.com',
        emailVerified: true,
        name: 'Alice',
      });

      expect(await verifier.verify(token)).toEqual({
        provider: 'firebase',
        subject,
        email: 'alice@example.com',
        emailVerified: true,
        name: 'Alice',
      });
    });

    it('gives null email and name when the identity has none', async () => {
      const { verifier, issue } = await makeImpl();
      const { token, subject } = await issue({ email: null, emailVerified: false, name: null });

      expect(await verifier.verify(token)).toEqual({
        provider: 'firebase',
        subject,
        email: null,
        emailVerified: false,
        name: null,
      });
    });

    it('resolves two identities to two different subjects', async () => {
      const { verifier, issue } = await makeImpl();
      const a = await issue({ email: 'a@example.com', emailVerified: false, name: 'Alice' });
      const b = await issue({ email: 'b@example.com', emailVerified: false, name: 'Bob' });

      const [va, vb] = await Promise.all([verifier.verify(a.token), verifier.verify(b.token)]);
      expect(va.subject).toBe(a.subject);
      expect(vb.subject).toBe(b.subject);
      expect(va.subject).not.toBe(vb.subject);
    });

    it.each(MALFORMED_TOKENS)('rejects the malformed token %j with UNAUTHENTICATED', async (t) => {
      const { verifier } = await makeImpl();
      await expectUnauthenticated(verifier.verify(t), t);
    });

    it('rejects a token after it was revoked, without echoing the token', async () => {
      const { verifier, issue, revoke } = await makeImpl();
      const { token, subject } = await issue({
        email: 'alice@example.com',
        emailVerified: true,
        name: 'Alice',
      });
      await verifier.verify(token);

      await revoke(token, subject);

      await expectUnauthenticated(verifier.verify(token), token);
    });
  });
}
