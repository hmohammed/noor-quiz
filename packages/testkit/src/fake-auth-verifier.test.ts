import { describe, expect, it } from 'vitest';
import type { VerifiedIdentity } from '@noor/core';
import { expectUnauthenticated, runAuthVerifierContract } from './contracts/auth-verifier.contract';
import { FakeAuthVerifier } from './fake-auth-verifier';

runAuthVerifierContract('FakeAuthVerifier', async () => {
  const verifier = new FakeAuthVerifier();
  let n = 0;
  return {
    verifier,
    issue: async ({ subject, ...rest }) => {
      n += 1;
      const s = subject ?? `fake-subject-${n}`;
      return { token: verifier.issue({ provider: 'firebase', subject: s, ...rest }), subject: s };
    },
    revoke: async (token) => verifier.reject(token),
  };
});

const SENTINEL: VerifiedIdentity = {
  provider: 'firebase',
  subject: 'SENTINELuid0123456789abcdef',
  email: 'sentinel@leak.test',
  emailVerified: true,
  name: 'Sentinel Name',
};

describe('FakeAuthVerifier', () => {
  it('issues opaque tokens that never contain the subject, email or name', () => {
    const fake = new FakeAuthVerifier();
    const tokens = [fake.issue(SENTINEL), fake.issue(SENTINEL)];

    expect(tokens[0]).not.toBe(tokens[1]);
    for (const token of tokens) {
      expect(token).toMatch(/^fake-token-\d+$/);
      expect(token).not.toContain(SENTINEL.subject);
      expect(token).not.toContain('sentinel');
      expect(token).not.toContain('Sentinel');
    }
  });

  it('rejects an unknown token with UNAUTHENTICATED', async () => {
    const fake = new FakeAuthVerifier();
    fake.issue(SENTINEL);
    await expectUnauthenticated(fake.verify('fake-token-999'), 'fake-token-999');
  });

  it('rejects a token passed to reject() even if it was never issued', async () => {
    const fake = new FakeAuthVerifier();
    fake.reject('never-issued');
    await expectUnauthenticated(fake.verify('never-issued'), 'never-issued');
  });

  it('returns a copy, so changing a result does not change later results', async () => {
    const fake = new FakeAuthVerifier();
    const token = fake.issue(SENTINEL);

    const first = await fake.verify(token);
    first.subject = 'mallory';
    first.name = 'Mallory';

    expect(await fake.verify(token)).toEqual(SENTINEL);
  });

  it('copies the identity on issue, so changing the input later does not change results', async () => {
    const fake = new FakeAuthVerifier();
    const input = { ...SENTINEL };
    const token = fake.issue(input);
    input.subject = 'mallory';

    expect((await fake.verify(token)).subject).toBe(SENTINEL.subject);
  });

  it('counts verify() calls, including failed ones', async () => {
    const fake = new FakeAuthVerifier();
    const token = fake.issue(SENTINEL);
    expect(fake.verifyCalls).toBe(0);

    await fake.verify(token);
    await fake.verify('unknown').catch(() => undefined);

    expect(fake.verifyCalls).toBe(2);
  });
});
