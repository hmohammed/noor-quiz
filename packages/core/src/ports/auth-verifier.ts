import type { VerifiedIdentity } from '../users/user';

/**
 * Verifies a bearer token from the client. Throws DomainError('UNAUTHENTICATED') for
 * any invalid, expired, revoked, disabled-user or malformed token. Never logs the token.
 */
export interface AuthVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}
