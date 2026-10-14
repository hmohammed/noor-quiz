SPLIT
Why: T010 adds three ports (AuthVerifier, UserRepo, IdGenerator for ULIDs), two Firestore collections with a transactional emulator contract test, a middleware plus route, and web sign-in through the Firebase client SDK with an auth-emulator e2e. That is more than one new port plus one screen and more than a day of work. Each part below is tested on its own.

## T010a

**Own user and identity records: getOrCreateUser with a transaction**

Phase: P1 · Depends on: T002, T003 · Tags: `sec`
Skills: `port-adapter`, `firestore-data`, `vertical-slice`

**Goal.** Given an identity that has already been verified (`provider`, `subject`, `email`, `emailVerified`, optional `name`), core returns our own ULID `userId`. On the first call it creates exactly one `users` doc and one `identities` doc in a single transaction. No HTTP and no auth yet.

**Scope**

- Port `IdGenerator` (`packages/core/src/ports/id-generator.ts`): `newId(): string`, which returns a ULID. Adapter `apps/api/src/adapters/system/ulid-id-generator.ts` builds the ULID from the `Clock` plus `crypto.getRandomValues`, written by hand in about 20 lines with Crockford base32, so no new dependency. The testkit fake `FakeIdGenerator` returns deterministic, increasing ULIDs.
- Port `UserRepo` (`packages/core/src/ports/repos.ts`):
  - `getByIdentity(key): Promise<User | null>`
  - `createWithIdentity(user, identity): Promise<User>`. This is atomic. If the identity already exists, it creates nothing and returns the existing user.
  - `getById(userId): Promise<User | null>`
  
  `users` and `identities` are global, not tenant-owned, so they have no `tenantId`. Write that in the port JSDoc so reviewers know it is deliberate.
- Domain types in core: `UserId` (branded ULID string), `IdentityKey = { provider: 'firebase'; subject: string }`, `User = { id, displayName: string | null, createdAt, updatedAt, schemaVersion: 1 }`, `Identity = { id: '<provider>_<subject>', provider, subject, userId, email: string | null, emailVerified, createdAt, schemaVersion: 1 }`. `subject` must match `/^[A-Za-z0-9_-]{1,128}$/`. Anything else throws `DomainError('UNAUTHENTICATED')`, so a doc-id path can never be injected.
- Use case `packages/core/src/usecases/get-or-create-user.ts`: `getOrCreateUser(deps: { clock, ids, users }, input: VerifiedIdentity): Promise<User>`. On creation, `displayName` comes from `input.name`: NFC-normalised, trimmed, and truncated to 32 code points. If fewer than 2 characters remain, store `null`. Timestamps are UTC ISO strings from `Clock`.
- Testkit: `InMemoryUserRepo` (the check-and-create is atomic, so it holds under concurrent `Promise.all`). Shared contract `packages/testkit/src/contracts/user-repo.contract.ts` with `runUserRepoContract(makeImpl)`. Add both new fakes to `makeTestDeps()`, and `ids` + `users` to `Deps`.
- Firestore adapter `apps/api/src/adapters/firebase/user-repo.ts`. `createWithIdentity` runs in `runTransaction`: it reads `identities/{provider}_{subject}`, returns the linked user if the doc exists, and otherwise sets `users/{ulid}` and `identities/{id}`. A converter maps Firestore to domain, so no Firestore types leak out. Wire it in `composition.ts` with the `firebase-admin` Firestore.
- Contract test on the emulator: `apps/api/src/adapters/firebase/user-repo.contract.test.ts`. Extend `npm run test:emulator` so it also runs this file (the Firestore emulator is already started).
- `firebase/rules.test.ts`: replace the placeholder `users`/`identities` seeds with the real shapes. All client reads and writes stay denied.

**Acceptance criteria**

- [ ] First call creates exactly one user + identity; repeated and concurrent calls return the same `userId` (transaction test). The contract suite runs 10 concurrent `getOrCreateUser` calls for one identity and checks they return one `userId`, with 1 `users` doc and 1 `identities` doc. It runs against both `InMemoryUserRepo` and the Firestore emulator adapter.

## T010b

**Verify the token and return GET /v1/me**

Phase: P1 · Depends on: T010a · Tags: `sec`
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

## T010c

**Web: sign in with Google and see my name**

Phase: P1 · Depends on: T010b · Tags: `sec`
Skills: `vertical-slice`, `i18n-rtl`

**Goal.** A visitor clicks sign in, completes Google sign-in, and the header shows their display name from `/v1/me`. They can sign out.

**Scope**

- Add `firebase` (the client SDK, `firebase/auth` only) as an `apps/web` dependency. Justification: Google sign-in popup and ID token refresh. Exit path: any OIDC client behind `apps/web/src/auth/session.ts`.
- `apps/web/src/auth/session.ts` is the only file that imports `firebase/auth`. It exposes `signIn()`, `signOut()`, `onChange(cb)` and `getIdToken()`. It connects to the Auth emulator when `VITE_AUTH_EMULATOR_HOST` is set. Add the Firebase web config and the emulator host as `VITE_*` keys in `apps/web/.env.example`. The web config is public, not a secret.
- `apiClient.getMe()` sends `Authorization: Bearer <idToken>` and parses `MeResponse`.
- `apps/web/src/features/auth/AuthButton.tsx` goes in the existing layout or HomePage header. It has signed-out, loading, signed-in (display name, or a `t('auth.noName')` fallback) and error states. All strings go through `t()`, and it uses logical CSS properties.
- e2e `apps/web/e2e/sign-in.spec.ts` runs against the Auth emulator, which `dev:emulators` already starts.

**Acceptance criteria**

- [ ] e2e with the auth emulator: sign in → see my name.
