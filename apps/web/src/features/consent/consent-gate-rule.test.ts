import type { MeResponse } from '@noor/contracts';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '../auth/session-context';
import { shouldShowConsentGate } from './consent-gate-rule';

const me = (required: boolean): MeResponse => ({
  userId: '01J9Z8X7W6V5T4S3R2Q1P0NMKH',
  displayName: 'Amina',
  locale: null,
  timezone: null,
  consent: { currentVersion: 'v1', acceptedVersion: required ? null : 'v1', required },
});
const pending: SessionState = { kind: 'signed-in', me: me(true) };
const accepted: SessionState = { kind: 'signed-in', me: me(false) };

describe('shouldShowConsentGate', () => {
  it.each(['/', '/profile', '/privacy-other', '/privacy/x'])(
    'shows the gate on %s while consent is required',
    (path) => {
      expect(shouldShowConsentGate(pending, path)).toBe(true);
    },
  );

  it.each(['/privacy', '/privacy/'])('never shows it on %s', (path) => {
    expect(shouldShowConsentGate(pending, path)).toBe(false);
  });

  it('does not show it once consent is accepted', () => {
    for (const path of ['/', '/profile', '/privacy']) {
      expect(shouldShowConsentGate(accepted, path)).toBe(false);
    }
  });

  it.each<SessionState>([
    { kind: 'loading' },
    { kind: 'signed-out' },
    { kind: 'unavailable' },
    { kind: 'error', hasSession: true },
    { kind: 'error', hasSession: false },
  ])('does not show it for $kind', (state) => {
    for (const path of ['/', '/profile', '/privacy']) {
      expect(shouldShowConsentGate(state, path)).toBe(false);
    }
  });
});
