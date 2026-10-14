import { describe, expect, it } from 'vitest';
import { ErrorResponse } from './error';

describe('ErrorResponse', () => {
  it('accepts { error: { code, message } }', () => {
    const body = { error: { code: 'NOT_FOUND', message: 'Not found' } };
    expect(ErrorResponse.parse(body)).toEqual(body);
  });

  it.each([
    ['an extra top-level key', { error: { code: 'X', message: 'm' }, stack: 's' }],
    ['an extra error key', { error: { code: 'X', message: 'm', details: { a: 1 } } }],
    ['a lowercase code', { error: { code: 'not_found', message: 'm' } }],
    ['an empty code', { error: { code: '', message: 'm' } }],
    ['an empty message', { error: { code: 'NOT_FOUND', message: '' } }],
    ['a missing error object', {}],
  ])('rejects %s', (_label, body) => {
    expect(ErrorResponse.safeParse(body).success).toBe(false);
  });
});
