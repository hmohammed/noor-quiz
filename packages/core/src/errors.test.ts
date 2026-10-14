import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, DomainError, isDomainError, isDomainErrorCode } from './errors';

describe('DomainError', () => {
  it('carries code, details and name', () => {
    const err = new DomainError('NOT_FOUND', { tenantId: 't1' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DomainError');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.details).toEqual({ tenantId: 't1' });
    expect(err.message).toBe('NOT_FOUND');
  });

  it('omits details when none are given', () => {
    expect('details' in new DomainError('CONFLICT')).toBe(false);
  });
});

describe('isDomainError', () => {
  it.each(DOMAIN_ERROR_CODES)('recognises a DomainError with code %s', (code) => {
    expect(isDomainError(new DomainError(code))).toBe(true);
  });

  it('recognises a structurally identical error from another module copy', () => {
    const foreign = Object.assign(new Error('x'), { name: 'DomainError', code: 'FORBIDDEN' });
    expect(isDomainError(foreign)).toBe(true);
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['an unknown code', Object.assign(new Error('x'), { name: 'DomainError', code: 'NOPE' })],
    ['a wrong name', Object.assign(new Error('x'), { code: 'FORBIDDEN' })],
    ['null', null],
    ['a string', 'DomainError'],
  ])('rejects %s', (_label, value) => {
    expect(isDomainError(value)).toBe(false);
  });
});

describe('isDomainErrorCode', () => {
  it('accepts known codes only', () => {
    expect(isDomainErrorCode('VALIDATION')).toBe(true);
    expect(isDomainErrorCode('validation')).toBe(false);
    expect(isDomainErrorCode(42)).toBe(false);
  });
});
