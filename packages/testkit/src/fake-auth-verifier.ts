import { DomainError, type AuthVerifier, type VerifiedIdentity } from '@noor/core';

/**
 * In-memory AuthVerifier. Tokens are opaque counters, so a test can never pass by
 * reading identity data out of a token. Returns copies, never stored objects.
 */
export class FakeAuthVerifier implements AuthVerifier {
  readonly #identities = new Map<string, VerifiedIdentity>();
  readonly #rejected = new Set<string>();
  #issued = 0;
  #verifyCalls = 0;

  /** Returns a new opaque token (`fake-token-<n>`), never derived from the identity. */
  issue(identity: VerifiedIdentity): string {
    this.#issued += 1;
    const token = `fake-token-${this.#issued}`;
    this.#identities.set(token, { ...identity });
    return token;
  }

  /** Makes a previously issued (or any) token fail from now on. */
  reject(token: string): void {
    this.#rejected.add(token);
  }

  /** Number of verify() calls, so tests can prove header checks short-circuit. */
  get verifyCalls(): number {
    return this.#verifyCalls;
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    this.#verifyCalls += 1;
    if (this.#rejected.has(token)) {
      throw new DomainError('UNAUTHENTICATED', { reason: 'token-rejected' });
    }
    const identity = this.#identities.get(token);
    if (!identity) throw new DomainError('UNAUTHENTICATED', { reason: 'unknown-token' });
    return { ...identity };
  }
}
