import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@noor/core';
import { CORE_PACKAGE, PACKAGE_NAME } from './index';

describe('@noor/testkit', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@noor/testkit');
  });

  it('resolves @noor/core through the workspace', () => {
    expect(CORE_PACKAGE_NAME).toBe('@noor/core');
    expect(CORE_PACKAGE).toBe(CORE_PACKAGE_NAME);
  });
});
