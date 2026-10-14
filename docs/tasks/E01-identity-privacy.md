# E01 · Identity and privacy

Sign-in, our own user records, profile, locked-down rules and GDPR basics — required before any real user joins the pilot.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T010

**Sign in with Google and get my user record**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T003](E00-foundation.md#t003) · Tags: `sec`
Skills: `port-adapter`, `api-endpoint`, `firestore-data`

**Goal.** A visitor signs in with Google and the API knows them by our own `userId`.

**Scope**

- Port `AuthVerifier.verify(token) → { provider, subject, email, emailVerified }`; Firebase adapter; fake in testkit
- Collections `users/{userId}` (ULID) and `identities/{provider_subject}` → userId
- Use case `getOrCreateUser`; middleware `requireUser()`
- `GET /v1/me` → `MeResponse`
- Web: sign-in/out button (Firebase Auth client SDK only for auth), shows display name from `/v1/me`

**Acceptance criteria**

- [ ] 401 without or with an invalid token
- [ ] First call creates exactly one user + identity; repeated and concurrent calls return the same `userId` (transaction test)
- [ ] Firebase uid never appears in API responses
- [ ] e2e with the auth emulator: sign in → see my name

**Notes**

_(implementer adds notes for the next task here)_

## T010a

**Own user and identity records: getOrCreateUser with a transaction**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T003](E00-foundation.md#t003) · Tags: `sec`
Skills: `port-adapter`, `firestore-data`, `vertical-slice`

**Goal.** Given an identity that has already been verified (`provider`, `subject`, `email`, `emailVerified`, optional `name`), core returns our own ULID `userId`. On the first call it creates exactly one `users` doc and one `identities` doc in a single transaction. No HTTP and no auth yet.

**Scope**

- Port `IdGenerator` (`packages/core/src/ports/id-generator.ts`): `newId(): string`, which returns a ULID. Adapter `apps/api/src/adapters/system/ulid-id-generator.ts` builds the ULID from the `Clock` plus `crypto.getRandomValues`, written by hand in about 20 lines with Crockford base32, so no new dependency. The testkit fake `FakeIdGenerator` returns deterministic, increasing ULIDs.
- Port `UserRepo` (`packages/core/src/ports/repos.ts`):
  - `getByIdentity(key): Promise<User | null>`
  - `createWithIdentity(user, identity): Promise<User>`. This is atomic. If the identity already exists, it creates nothing and returns the existing user.
  - `getById(userId): Promise<User | null>`
  
  `users` and `identities` are global, not tenant-owned, so they have no `tenantId`. Write that in the port JSDoc so reviewers know it is deliberate.
- Domain types in core: `VerifiedIdentity = { provider: 'firebase'; subject: string; email: string | null; emailVerified: boolean; name: string | null }` (defined here; T010b's `AuthVerifier` returns it), `UserId` (branded ULID string), `IdentityKey = { provider: 'firebase'; subject: string }`, `User = { id, displayName: string | null, createdAt, updatedAt, schemaVersion: 1 }`, `Identity = { id: '<provider>_<subject>', provider, subject, userId, email: string | null, emailVerified, createdAt, schemaVersion: 1 }`. `subject` must match `/^[A-Za-z0-9_-]{1,128}$/`. Anything else throws `DomainError('UNAUTHENTICATED')`, so a doc-id path can never be injected.
- Use case `packages/core/src/usecases/get-or-create-user.ts`: `getOrCreateUser(deps: { clock, ids, users }, input: VerifiedIdentity): Promise<User>`. On creation, `displayName` comes from `input.name`: NFC-normalised, trimmed, and truncated to 32 code points. If fewer than 2 characters remain, store `null`. Timestamps are UTC ISO strings from `Clock`.
- Testkit: `InMemoryUserRepo` (the check-and-create is atomic, so it holds under concurrent `Promise.all`). Shared contract `packages/testkit/src/contracts/user-repo.contract.ts` with `runUserRepoContract(makeImpl)`. Add both new fakes to `makeTestDeps()`, and `ids` + `users` to `Deps`.
- Firestore adapter `apps/api/src/adapters/firebase/user-repo.ts`. `createWithIdentity` runs in `runTransaction`: it reads `identities/{provider}_{subject}`, returns the linked user if the doc exists, and otherwise sets `users/{ulid}` and `identities/{id}`. A converter maps Firestore to domain, so no Firestore types leak out. Wire it in `composition.ts` with the `firebase-admin` Firestore.
- Contract test on the emulator: `apps/api/src/adapters/firebase/user-repo.contract.test.ts`. Extend `npm run test:emulator` so it also runs this file (the Firestore emulator is already started).
- `firebase/rules.test.ts`: replace the placeholder `users`/`identities` seeds with the real shapes. All client reads and writes stay denied.

**Acceptance criteria**

- [ ] First call creates exactly one user + identity; repeated and concurrent calls return the same `userId` (transaction test). The contract suite runs 10 concurrent `getOrCreateUser` calls for one identity and checks they return one `userId`, with 1 `users` doc and 1 `identities` doc. It runs against both `InMemoryUserRepo` and the Firestore emulator adapter.

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

## T010c

**Web: sign in with Google and see my name**

Phase: P1 · Depends on: [T010b](E01-identity-privacy.md#t010b) · Tags: `sec`
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

## T011

**Edit my profile: display name, locale, timezone**

Phase: P1 · Depends on: [T010](E01-identity-privacy.md#t010) · Tags: —
Skills: `api-endpoint`, `i18n-rtl`

**Goal.** Members choose how their name appears, their language and timezone.

**Scope**

- Contract `UpdateMeRequest`: displayName (Unicode letters/marks/spaces, NFC, 2–32), locale (supported list), timezone (valid IANA)
- `PATCH /v1/me`; timezone defaulted from browser on first sign-in
- Web profile page

**Acceptance criteria**

- [ ] Names in Amharic (ሀሰን), Arabic (حسن), Swedish (Åsa) accepted; empty, emoji-only, >32 chars rejected
- [ ] Invalid timezone and unsupported locale rejected with 400
- [ ] e2e: change name → shown in header

**Notes**

_(implementer adds notes for the next task here)_

## T012

**Firestore rules baseline: deny every client write**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002) · Tags: `sec`
Skills: `firestore-data`

**Goal.** The database is closed by default, so the old app's direct-write exploits are impossible.

**Scope**

- `firebase/firestore.rules`: default deny read+write
- `firebase/rules.test.ts` with `@firebase/rules-unit-testing`
- Lint rule in apps/web banning imports of Firestore write APIs (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `runTransaction`)

**Acceptance criteria**

- [ ] Rules tests: unauthenticated and authenticated clients cannot read or write `users`, `identities` or an arbitrary collection
- [ ] Lint fails on a fixture that imports `setDoc` in apps/web

**Notes**

- `npm run test:emulator` exists (Firestore emulator via `emulators:exec`, runs `firebase/rules.test.ts`). T004 only needs to wire it into CI (needs Java 21 on the runner).
- Add rules tests to `firebase/rules.test.ts` for every future collection or read rule.
- Possible follow-up: the apps/web lint ban covers static imports/re-exports only, not dynamic `import('firebase/firestore')` or wrapper packages (e.g. `reactfire`).

## T013

**Consent at first sign-in and delete my account**

Phase: P1 · Depends on: [T011](E01-identity-privacy.md#t011) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`

**Goal.** GDPR basics before any real user: explicit consent, a privacy page, and self-service deletion.

**Scope**

- `users.consent = { version, acceptedAt }`; API endpoints require current consent except `/v1/me` and consent itself
- `POST /v1/me/consent`; web consent screen + `/privacy` page (placeholder text from config)
- `DELETE /v1/me`: removes user, identities, memberships; anonymises answers (keeps scores for aggregates without userId)

**Acceptance criteria**

- [ ] Calls to a protected endpoint without consent return 403 `CONSENT_REQUIRED`
- [ ] After delete, the same Google account signing in gets a new userId and no old data
- [ ] Deletion is idempotent

**Notes**

_(implementer adds notes for the next task here)_
