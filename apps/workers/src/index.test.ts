import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@noor/workers', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@noor/workers');
  });
});
