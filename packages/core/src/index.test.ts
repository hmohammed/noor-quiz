import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@noor/core', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@noor/core');
  });
});
