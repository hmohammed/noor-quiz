---
name: api-endpoint
description: Add or change a Hono API route in apps/api with zod contracts, the auth → tenant → role → entitlement middleware chain, error mapping and route tests. Use for any new or changed HTTP endpoint or webhook.
---

# Add an API endpoint

## Shape
```ts
// apps/api/src/routes/answers.ts
export const answers = new Hono<AppEnv>()
  .post('/v1/t/:tenantId/questions/:questionId/answers',
    requireUser(),                       // AuthVerifier → c.var.user
    requireMember('member'),             // memberships → c.var.membership, checks :tenantId
    requireFeature('answering'),         // entitlements (skip for always-free features)
    zValidator('json', SubmitAnswerRequest),
    async (c) => {
      const result = await submitAnswer(c.var.deps, {
        tenantId: c.var.membership.tenantId,
        userId: c.var.user.id,
        questionId: c.req.param('questionId'),
        ...c.req.valid('json'),
      });
      return c.json(SubmitAnswerResponse.parse(result), 201);
    });
```

## Rules
- Paths are versioned `/v1/...`; tenant-scoped routes live under `/v1/t/:tenantId/...`.
- `tenantId` used by the use case comes from the resolved membership, never straight from the body.
- Parse input with the contract schema; parse output too (catches leaks like returning `correctAnswer` early).
- Map `DomainError` codes to HTTP once in `apps/api/src/errors.ts` (`NOT_FOUND`→404, `FORBIDDEN`→403, `CLOSED`→409, `QUOTA_EXCEEDED`→402…).
- Rate-limit write endpoints (middleware `rateLimit({ key: 'user', per: '1m', max })`).
- Webhooks (Stripe, Telegram, WhatsApp): verify signature first, store event id for idempotency, return 2xx fast and enqueue work.

## Tests (`*.test.ts` next to the route)
- happy path (status + contract-valid body)
- 401 without token
- 403 for a user in another tenant
- 403 for insufficient role (if role-gated)
- 402/fallback when the entitlement is missing (if gated)
- validation error for a malformed body
Use `app.request()` with a composition of fakes from `packages/testkit`.
