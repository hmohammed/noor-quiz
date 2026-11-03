import type { SessionState } from '../auth/session-context';
import { PRIVACY_PATH } from '../privacy/policy';

const EXEMPT_PATHS: ReadonlySet<string> = new Set([PRIVACY_PATH, `${PRIVACY_PATH}/`]);

/**
 * Whether the consent screen replaces the page. UX only: the API's `requireConsent()`
 * is the real enforcement.
 */
export function shouldShowConsentGate(state: SessionState, pathname: string): boolean {
  return state.kind === 'signed-in' && state.me.consent.required && !EXEMPT_PATHS.has(pathname);
}
