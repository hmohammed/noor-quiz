import type { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { isDomainError, type DomainErrorCode } from '@noor/core';
import type { ErrorResponse } from '@noor/contracts';

/** HTTP status per domain error code. Exhaustive: a new core code fails typecheck until mapped. */
export const statusForCode: Record<DomainErrorCode, ContentfulStatusCode> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CLOSED: 409,
  QUOTA_EXCEEDED: 402,
  INTERNAL: 500,
};

/** Fixed English fallback per code. Clients localise by `code`; this never carries user data. */
export const publicMessage: Record<DomainErrorCode, string> = {
  VALIDATION: 'Invalid request',
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'Not allowed',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  CLOSED: 'Closed',
  QUOTA_EXCEEDED: 'Quota exceeded',
  INTERNAL: 'Internal error',
};

function bodyFor(code: DomainErrorCode): ErrorResponse {
  return { error: { code, message: publicMessage[code] } };
}

/**
 * Maps any thrown value to a status and a contract-shaped body. Only the code is
 * taken from a DomainError; its message and `details` stay server-side. Anything
 * else becomes a generic 500.
 */
export function toErrorResponse(err: unknown): {
  status: ContentfulStatusCode;
  body: ErrorResponse;
} {
  const code: DomainErrorCode = isDomainError(err) ? err.code : 'INTERNAL';
  return { status: statusForCode[code], body: bodyFor(code) };
}

/** Installs the single error handler and the JSON 404 on the root app. */
export function installErrorHandling(app: Hono): void {
  app.onError((err, c) => {
    if (!isDomainError(err) || err.code === 'INTERNAL') {
      // Log the error only: never the request body or headers.
      console.error('[api] unhandled error', err);
    }
    const { status, body } = toErrorResponse(err);
    return c.json(body, status);
  });
  app.notFound((c) => c.json(bodyFor('NOT_FOUND'), statusForCode.NOT_FOUND));
}
