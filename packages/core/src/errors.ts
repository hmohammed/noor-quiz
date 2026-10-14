/**
 * Every error code core can raise. The API maps each one to an HTTP status and a
 * fixed public message (apps/api/src/errors.ts); clients localise by code.
 */
export const DOMAIN_ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CLOSED',
  'QUOTA_EXCEEDED',
  'INTERNAL',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(DOMAIN_ERROR_CODES);

export function isDomainErrorCode(code: unknown): code is DomainErrorCode {
  return typeof code === 'string' && CODE_SET.has(code);
}

/**
 * A typed, expected failure. `details` is for server-side logs only and is never
 * serialised into an API response.
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';
  readonly code: DomainErrorCode;
  // `declare` so the property is absent (not `undefined`) when no details are given.
  declare readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: DomainErrorCode, details?: Readonly<Record<string, unknown>>) {
    super(code);
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/**
 * True for a DomainError, also when it was created by another copy of this module
 * (bundles, duplicated workspaces), so it checks `name` + a known `code` rather
 * than relying on `instanceof` alone.
 */
export function isDomainError(e: unknown): e is DomainError {
  if (e instanceof DomainError) return true;
  if (typeof e !== 'object' || e === null) return false;
  const candidate = e as { name?: unknown; code?: unknown };
  return candidate.name === 'DomainError' && isDomainErrorCode(candidate.code);
}
