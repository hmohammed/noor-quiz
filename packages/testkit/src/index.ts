import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@noor/core';

export const PACKAGE_NAME = '@noor/testkit' as const;

/** The core package whose ports this testkit will provide fakes for. */
export const CORE_PACKAGE = CORE_PACKAGE_NAME;
