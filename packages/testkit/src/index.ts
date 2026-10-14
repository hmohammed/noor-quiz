import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@noor/core';

export const PACKAGE_NAME = '@noor/testkit' as const;

/** The core package whose ports this testkit provides fakes for. */
export const CORE_PACKAGE = CORE_PACKAGE_NAME;

export * from './fake-clock';
export * from './make-test-deps';
