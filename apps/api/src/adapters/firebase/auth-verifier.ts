import { DomainError, type AuthVerifier, type VerifiedIdentity } from '@noor/core';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

const SDK_CODE = /^auth\/[a-z-]+$/;

/** The SDK's `auth/...` code, if any. Never its message, which can embed token parts. */
function sdkCodeOf(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && SDK_CODE.test(code) ? code : undefined;
}

/**
 * Verifies Firebase ID tokens with revocation and disabled-user checks. Every SDK
 * failure becomes UNAUTHENTICATED; nothing is logged. The subject format is enforced
 * later by `identityId()` in `getOrCreateUser`.
 */
export class FirebaseAuthVerifier implements AuthVerifier {
  readonly #auth: Auth;

  constructor(auth: Auth) {
    this.#auth = auth;
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new DomainError('UNAUTHENTICATED', { reason: 'empty-token' });
    }
    let decoded: DecodedIdToken;
    try {
      decoded = await this.#auth.verifyIdToken(token, true);
    } catch (err) {
      const sdkCode = sdkCodeOf(err);
      throw new DomainError(
        'UNAUTHENTICATED',
        sdkCode ? { reason: 'token-rejected', sdkCode } : { reason: 'token-rejected' },
      );
    }
    return {
      provider: 'firebase',
      subject: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : null,
      emailVerified: decoded.email_verified === true,
      name: typeof decoded.name === 'string' ? decoded.name : null,
    };
  }
}
