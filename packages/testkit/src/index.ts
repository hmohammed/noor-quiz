import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@noor/core';

export const PACKAGE_NAME = '@noor/testkit' as const;

/** The core package whose ports this testkit provides fakes for. */
export const CORE_PACKAGE = CORE_PACKAGE_NAME;

export * from './fake-auth-verifier';
export * from './fake-clock';
export * from './fake-id-generator';
export * from './in-memory-user-repo';
export * from './in-memory-community-store';
export * from './make-test-deps';
export * from './profile-cases';
export * from './contracts/auth-verifier.contract';
export * from './contracts/user-repo.contract';
export * from './contracts/community-store.contract';
