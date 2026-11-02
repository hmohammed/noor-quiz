## T010b

**Verify the token and return GET /v1/me**

Phase: P1 · Depends on: [T010a](E01-identity-privacy.md#t010a) · Tags: `sec`
Skills: `port-adapter`, `api-endpoint`, `vertical-slice`

**Goal.** An HTTP request with a valid bearer token resolves to our own user through `requireUser()`. `GET /v1/me` returns that user and never returns the Firebase uid.

**Scope**

- Port `AuthVerifier` (`packages/core/src/ports/auth-verifier.ts`): `verify(token: string): Promise<VerifiedIdentity>` with `VerifiedIdentity = { provider: 'firebase'; subject: string; email: string | null; emailVerified: boolean; name: string | null }`. On any invalid, expired, revoked or malformed token it throws `DomainError('UNAUTHENTICATED')`. `name` is added to the scope's tuple because the web slice must show the name.
- Testkit `FakeAuthVerifier`: `issue(identity) → token` and `reject(token)`. Unknown tokens throw `UNAUTHENTICATED`. Shared contract `packages/testkit/src/contracts/auth-verifier.contract.ts`.
- Firebase adapter `apps/api/src/adapters/firebase/auth-verifier.ts` uses `firebase-admin/auth` `verifyIdToken(token, true)` and maps `uid` to `subject`. Every SDK error becomes `UNAUTHENTICATED`, and the adapter logs no token. Contract test against the Auth emulator in `auth-verifier.contract.test.ts`. Extend `test:emulator` so it also starts `auth`.
- Middleware `apps/api/src/middleware/require-user.ts`:
  - parse `Authorization: Bearer <token>`; a missing or malformed header gives 401
  - `deps.auth.verify`, then `getOrCreateUser`, then set `c.var.user = { id, displayName }`
  - add a typed `AppEnv` for Hono variables
- Contract `packages/contracts/src/me.ts`: `MeResponse = z.strictObject({ userId: z.string().regex(ULID), displayName: z.string().min(2).max(32).nullable() })`.
- Route `apps/api/src/routes/me.ts`: `GET /v1/me` → `requireUser()` → `MeResponse.parse(...)`. Mount it in `app.ts`. Add `auth` to `Deps`/composition.

**Acceptance criteria**

- [ ] 401 without or with an invalid token. Route tests cover: no header, a non-Bearer scheme, an empty token, a token the fake rejects, and an expired token on the emulator contract. Every case returns the `ErrorResponse` body with code `UNAUTHENTICATED`.
- [ ] Firebase uid never appears in API responses. A route test sets the fake subject to a sentinel string and checks that the serialised `/v1/me` body (and the 401 body) does not contain it. `MeResponse` is strict, so an extra `uid` or `subject` key fails `.parse`.

Tags: sec
Phase: P1
