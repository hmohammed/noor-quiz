VERDICT: PASS
# Security review — T011 round 1

Scope: `git diff main...factory/T011-edit-profile` (47 files). Read in full: `apps/api/src/routes/me.ts`, `http/parse-json-body.ts`, `adapters/firebase/user-repo.ts`, `middleware/require-user.ts`, `app-env.ts`, `errors.ts`, `packages/core/src/usecases/update-profile.ts`, `users/profile.ts`, `packages/contracts/src/me.ts`, `apps/web/src/api/client.ts`, `apps/web/src/features/auth/session-context.tsx`; checked the route tests for 401, cross-user, unknown-key and body-limit cases.

## Findings
None at P0–P2.

What I checked:
- AuthN/AuthZ: `PATCH /v1/me` runs `bodyLimit(4096)`, then `requireUser()` (token verified through `AuthVerifier`, user resolved on the server), then `parseJsonBody(UpdateMeRequest)`. The user id comes only from `c.var.user.id`. `UpdateMeRequest` is a `strictObject`, so `userId`, `role`, `tenantId` and `updatedAt` are rejected with 400 rather than ignored (`me.test.ts:340`). Core `updateProfile` validates every field again (name, locale and canonical timezone) and rejects an empty patch.
- Tenant isolation: `users` is global and the route is not tenant-scoped, so no tenant id is involved. `me.test.ts:391` shows user A's token cannot change user B.
- Firestore: the rules files are unchanged and the `rules.test.ts` seed only gained the two null fields. The web app writes only through `PATCH /v1/me`. The adapter's `updateProfile` builds `updates` from named keys inside a transaction and returns `NOT_FOUND` for a missing doc.
- Time: `updatedAt` comes from `deps.clock`. The browser timezone is a stored display preference, not an authority, and it is validated on both client and server.
- Leakage and PII: GET and PATCH build `MeResponse` from four named fields, and the strict contract plus the `LeakyUserRepo` test (`me.test.ts:226`) block leaks of the subject or email. `DomainError` details carry only a `reason`. `errors.ts` sends only the code and a fixed message, and it logs only non-domain or `INTERNAL` errors, never the body or headers. The web client never logs the token.
- Abuse: the 4 KB body limit runs before token verification (`me.test.ts:355`). Name length is capped at 32 code points and timezone length at 64 characters. Names allow only letters and marks, so controls, ZWJ, `<`, `>` and emoji are rejected.

## Hard rules
1. core vendor-free: ok. `profile.ts` and `update-profile.ts` use only `Intl` and regex; `hono/body-limit` stays in `apps/api`.
2. ports, adapters and fakes: ok. `UserRepo.updateProfile` is added to the port, the in-memory fake and the Firestore adapter, and the shared contract runs against both.
3. no client Firestore writes: ok. Rules are unchanged (deny-all) and the web app calls only the API.
4. tenant isolation: ok. `users` is global by design and the id comes from the token only (cross-user test present).
5. time from Clock: ok. `updatedAt` uses `toIso(deps.clock.now())`, with no `Date.now()` in core or the route.
6. never trust the client: ok. The strict body rejects authority keys and core validates again.
7. answer secrecy: ok (n/a). No question or answer data is touched.
8. own IDs: ok. Responses carry only our ULID, never the provider subject or email.
9. no secrets or PII in logs: ok. Errors carry a reason only and nothing logs the body or token.
10. billing through entitlements: ok (n/a). No billing or entitlement change.
11. AI prompts delimited and validated: ok (n/a). No AI or messaging change.

## Nits (non-blocking)
- [P3] `apps/api/src/routes/me.ts:30`: `{ userId: c.var.user.id, ...patch }` puts the token id first, so a `userId` key in `patch` would override it. The strict contract blocks this today. Writing `{ ...patch, userId: c.var.user.id }` would keep it safe even if the contract is loosened later.
- [P3] `PATCH /v1/me` has no rate limit. The spec puts this out of scope and the epic notes record it as a follow-up. It should be tracked before public launch, because each call is a Firestore transaction.
- [P3] `requireUser()` runs before body validation, so a valid token plus an invalid body can still create the user on first sight. This behaves the same as `GET /v1/me` and is documented in `build.md`, so no change is needed.
