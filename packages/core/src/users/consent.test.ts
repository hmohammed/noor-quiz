import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION_MAX,
  CURRENT_CONSENT_VERSION,
  hasCurrentConsent,
  isValidConsent,
} from './consent';

const AT = '2026-11-01T00:00:00.000Z';

describe('hasCurrentConsent', () => {
  it('is true only for the current version', () => {
    expect(hasCurrentConsent({ consent: { version: CURRENT_CONSENT_VERSION, acceptedAt: AT } })).toBe(
      true,
    );
  });

  it.each([
    ['no consent', null],
    ['an older version', { version: '2000-01-01', acceptedAt: AT }],
  ])('is false for %s', (_label, consent) => {
    expect(hasCurrentConsent({ consent })).toBe(false);
  });
});

describe('CURRENT_CONSENT_VERSION', () => {
  it('is a non-empty string of at most 32 chars', () => {
    expect(typeof CURRENT_CONSENT_VERSION).toBe('string');
    expect(CURRENT_CONSENT_VERSION.length).toBeGreaterThan(0);
    expect(CURRENT_CONSENT_VERSION.length).toBeLessThanOrEqual(32);
    expect(CONSENT_VERSION_MAX).toBe(32);
  });
});

describe('isValidConsent', () => {
  it('accepts the current version with a UTC ISO time', () => {
    expect(isValidConsent({ version: CURRENT_CONSENT_VERSION, acceptedAt: AT })).toBe(true);
    expect(isValidConsent({ version: 'v'.repeat(32), acceptedAt: AT })).toBe(true);
  });

  it.each([
    ['an empty version', { version: '', acceptedAt: AT }],
    ['a 33-char version', { version: 'v'.repeat(33), acceptedAt: AT }],
    ['a non-ISO acceptedAt', { version: 'v', acceptedAt: 'yesterday' }],
    ['an offset acceptedAt', { version: 'v', acceptedAt: '2026-11-01T00:00:00+01:00' }],
  ])('rejects %s', (_label, consent) => {
    expect(isValidConsent(consent)).toBe(false);
  });
});
