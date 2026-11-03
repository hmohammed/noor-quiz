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

**Notes**

- `apps/web/src/auth/session.ts` is the only Firebase importer (`apps/web/src/auth/firebase-boundary.test.ts` enforces it). Get a token with `getIdToken()` and pass it to `apiClient` methods; never read the Firebase user.
- T011: the header (`features/auth/AuthButton.tsx`) shows `MeResponse.displayName` from `/v1/me`. After a profile edit, refresh that state (today it reloads only on an auth change). There is no shared auth store yet; add one only if a second component needs the session.
- Follow-up (not in this task): CI / deploy-dev need the real `noor-dev` `VITE_FIREBASE_*` keys and Google enabled as a provider. Without them the built app shows `auth.unavailable`.
- The e2e blocks the Auth emulator page's CDN assets (unpkg, Google Fonts); the page works without them and otherwise stalls on slow or offline networks.

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

- For T013/T061/T080: `users/{userId}` now carries `locale` (`en|sv|ar|am|so` or null) and `timezone` (IANA or null), still `schemaVersion: 1`; docs written before T011 read both as null.
- `useSession()` (`apps/web/src/features/auth/session-context.tsx`) is the one shared session: `state`, `signIn`, `signOut`, `updateMe(patch)`. The header and `/profile` live under `AppLayout`.
- The profile saves `locale`, but nothing switches the UI language yet — that is T080 (`useI18n()`, `<html lang/dir>`).
- `PATCH /v1/me` has no rate limit; a `rateLimit` middleware needs its own store/port and a follow-up task.

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

Split into T013a, T013b and T013c. Memberships and answers do not exist yet, so deletion of those moves to T020 and T040.

## T013a

**Consent: record it and block protected endpoints without it**

Phase: P1 · Depends on: [T011](E01-identity-privacy.md#t011) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`, `vertical-slice`

**Goal.** The API knows whether a user has accepted the current privacy terms. Protected endpoints refuse users who have not.

**Scope**

- Core `packages/core/src/users/consent.ts`: `CURRENT_CONSENT_VERSION` (a string constant, e.g. `'2026-11-01'`), type `Consent = { version: string; acceptedAt: string }` and `hasCurrentConsent(user): boolean`. `User` gains `consent: Consent | null`. It stays `schemaVersion: 1`, and docs written without the key read it as `null` (the same approach T011 took). The `getOrCreateUser` use case creates users with `consent: null`.
- Add a new `DomainErrorCode` `CONSENT_REQUIRED`. `apps/api/src/errors.ts` maps it to 403 with the public message `'Consent required'`. The map is exhaustive, so typecheck enforces this.
- Add `UserRepo.recordConsent(userId, consent, updatedAt): Promise<User>`. It writes only `consent` and `updatedAt`, and throws `NOT_FOUND` or `VALIDATION` the same way `updateProfile` does. Implement it in `InMemoryUserRepo`, extend `runUserRepoContract` to cover it, and implement it in `FirestoreUserRepo`. The `UserDoc` schema becomes `consent: z.strictObject({ version, acceptedAt }).nullable().default(null)`.
- Use case `packages/core/src/usecases/accept-consent.ts`: `acceptConsent(deps: { clock, users }, { userId, version })`.
  - If `version` is not `CURRENT_CONSENT_VERSION`, it throws `CONFLICT` (the client showed outdated terms).
  - If the user already accepted this version, it writes nothing and returns the user, keeping the original `acceptedAt`.
  - Otherwise it records `{ version, acceptedAt: clock.now() }`.
- Contracts `packages/contracts/src/me.ts`:
  - `AcceptConsentRequest = z.strictObject({ version: z.string().min(1).max(32) })`.
  - `MeResponse` gains `consent: z.strictObject({ currentVersion: z.string(), acceptedVersion: z.string().nullable(), required: z.boolean() })`, where `required` is true when the user has not accepted the current version. Never include `acceptedAt` or any other user-doc field.
  - Update every `MeResponse` fixture in apps/api and apps/web tests.
- `RequestUser` (`apps/api/src/app-env.ts`) gains `consentVersion: string | null`, set by `requireUser()`.
- Middleware `apps/api/src/middleware/require-consent.ts`: `requireConsent()` runs after `requireUser()`. It throws `CONSENT_REQUIRED` unless `consentVersion === CURRENT_CONSENT_VERSION`. Future routes (T020 onward) use `requireUser(), requireConsent()`.
- Routes in `apps/api/src/routes/me.ts`:
  - `GET /v1/me` needs no consent and returns the consent block.
  - `POST /v1/me/consent` needs no consent. It uses the same `bodyLimit` and `parseJsonBody` as PATCH, takes `AcceptConsentRequest`, and returns `MeResponse` with status 200.
  - `PATCH /v1/me` now requires consent. It is the first protected endpoint, because it processes personal data.
  - (`DELETE /v1/me` will also be exempt; T013c adds it.)

**Acceptance criteria**

- [ ] Calls to a protected endpoint without consent return 403 `CONSENT_REQUIRED`. Route tests check that `PATCH /v1/me` returns 403 with an `ErrorResponse` code `CONSENT_REQUIRED` for a new user and for a user who accepted an older version, and returns 200 after `POST /v1/me/consent`. A middleware unit test on a throwaway Hono route checks the same.
- [ ] `GET /v1/me` and `POST /v1/me/consent` succeed without consent. `GET` reports `required: true` for a new user and `false` after accepting.
- [ ] `POST /v1/me/consent` returns 401 without a token, 400 for a malformed body, an extra key (e.g. `acceptedAt`, `userId`) or an oversized body, and 409 `CONFLICT` for a version that is not current. A second accept keeps the first `acceptedAt` (core test using `FakeClock`).
- [ ] The `UserRepo` contract (in-memory and Firestore emulator) covers `recordConsent`. It writes only `consent` and `updatedAt`, other users are untouched, and an unknown user gives `NOT_FOUND`. A doc without a `consent` key reads as `consent: null`.
- [ ] `MeResponse` stays strict. A route test checks that the serialised body contains no `acceptedAt`, Firebase uid or email.

**Notes**

Future routes (T020 onward) use `requireUser(), requireConsent()`.

## T013b

**Web: consent screen at first sign-in and a /privacy page**

Phase: P1 · Depends on: [T013a](E01-identity-privacy.md#t013a) · Tags: `sec`
Skills: `vertical-slice`, `i18n-rtl`

**Goal.** A signed-in user who has not accepted the current terms sees a consent screen before anything else and can read the privacy page.

**Scope**

- Consent gate `apps/web/src/features/consent/ConsentGate.tsx` (+ a `ConsentGateView.tsx` with view tests). It is not a route. `AppLayout` renders it in place of `<Outlet />` while `me.consent.required` is true, except on `/privacy`. It shows a short summary, a link to `/privacy`, and an "I agree" button. It has loading and error states, and its error state covers a 409 (outdated terms), where it reloads `/v1/me`.
- `useSession()` gains `acceptConsent()`. It calls `apiClient.acceptConsent({ idToken, body: { version: me.consent.currentVersion } })` (`POST /v1/me/consent`, parses `MeResponse`) and replaces `me`. The client's `request()` method type widens to `'POST'`.
- The timezone default in `SessionProvider` must not fire `PATCH /v1/me` while consent is required, because it would now get 403. Run it after consent is accepted instead.
- Page `apps/web/src/features/privacy/PrivacyPage.tsx` at `/privacy` is public. Its placeholder text comes from config: a small `apps/web/src/features/privacy/policy.ts` lists the section i18n keys, and the text lives in `en.json` under `privacy.*`. Add a footer or header link to it in `AppLayout`.
- All strings go through `t()` (`consent.*`, `privacy.*` in `en.json`). Use logical CSS properties, and the page must work in RTL.
- e2e `apps/web/e2e/consent.spec.ts` on the Auth emulator: a new user signs in, sees the consent screen, opens `/privacy`, accepts, and then sees the home page and can open `/profile`. Update `e2e/helpers/sign-in.ts` (and `profile.spec.ts` if needed) so existing specs accept consent first.

**Acceptance criteria**

- [x] A new user sees the consent screen after sign-in. After agreeing they reach the app, and a reload does not show the screen again (e2e).
- [x] `/privacy` is reachable signed out and while consent is pending (view test and e2e).
- [x] View tests cover the loading, error and outdated-terms states, and every string is an i18n key.

**Notes**

- `useSession().acceptConsent()` posts `me.consent.currentVersion` and replaces `me`. On a 409 it reloads `/v1/me` and throws `ConsentOutdatedError`. The gate (`features/consent/`) is UX only; the API's `requireConsent()` stays the enforcement.
- The browser-timezone default runs once on first load (skipped while consent is required) and once after a successful accept, through one `applyTimezoneDefault` helper in `session-context.tsx`.
- Real policy text goes in `en.json` under `privacy.*`; add or reorder sections in `features/privacy/policy.ts` (`PRIVACY_SECTIONS`). `/privacy` is `PRIVACY_PATH` and is exempt from the gate.
- T080: the RTL e2e check in `e2e/consent.spec.ts` forces `document.documentElement.dir = 'rtl'`. Replace it with the real `ar` locale switch, and translate `consent.*`, `privacy.*` and `nav.privacy`.
- T013c: after deleting an account and signing in again, the API creates a new user with `consent.required: true`, so e2e should expect the gate (use `acceptConsentOnScreen(page)` from `e2e/helpers/sign-in.ts`).
- e2e helpers no longer read the `authorization` header; `acceptConsentViaApi` is gone.

## T013c

**Delete my account**

Phase: P1 · Depends on: [T013a](E01-identity-privacy.md#t013a) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`, `vertical-slice`, `i18n-rtl`

**Goal.** A user deletes their account themselves. Their user record and every linked identity are gone, and signing in again starts from scratch.

**Scope**

- Add `UserRepo.deleteUserAndIdentities(userId): Promise<void>`. It is atomic and deletes `users/{userId}` and every `identities` doc whose `userId` matches. An unknown user is a no-op, not an error, and a non-ULID id gives `VALIDATION`. Implement it in `InMemoryUserRepo`, cover it in `runUserRepoContract`, and implement it in `FirestoreUserRepo` with a `runTransaction` that reads the `identities where userId ==` query and deletes everything. That is a single-field equality query, so it needs no composite index (say so in the PR).
- Use case `packages/core/src/usecases/delete-account.ts`: `deleteAccount(deps: { users }, { identity: IdentityKey })`. It looks the user up with `getByIdentity`. If there is no user it returns `{ deleted: false }`; otherwise it calls `deleteUserAndIdentities` and returns `{ deleted: true }`. Its JSDoc names T020 (memberships) and T040 (anonymise answers: drop `userId`, keep scores) as the tasks that extend it.
- Middleware `requireIdentity()` in `apps/api/src/middleware/require-user.ts`. It parses the bearer token the same way as `requireUser()` (share the parsing code), calls `deps.auth.verify`, and sets `c.var.identity`. It never calls `getOrCreateUser`, so a repeated DELETE does not create and then delete a fresh user.
- Route `DELETE /v1/me` uses `requireIdentity()` with no consent check and no body, and returns 204 in both cases. Do not revoke the Firebase Auth account or its tokens; that needs a port change and is a follow-up.
- Web:
  - A "Delete my account" section on the existing `/profile` page. It has a confirm step, pending and error states, and RTL-safe layout.
  - On success it signs out and navigates to `/`.
  - `apiClient.deleteMe({ idToken })` returns `void` and accepts 204 with no body.
  - Add `useSession().deleteAccount()`.
  - Put strings in `en.json` under `profile.delete.*`.
- e2e `apps/web/e2e/delete-account.spec.ts`: sign in, accept consent, set a name, delete the account, then sign in again with the same emulator account. The user sees the consent screen again, and once past it, the old name is gone.

**Acceptance criteria**

- [ ] After delete, the same Google account signing in gets a new userId and no old data. Core and route tests sign in, accept consent, set a profile, then call DELETE and `GET /v1/me` with the same fake identity. They check that the `userId` differs, `displayName`/`locale`/`timezone` are back to the new-user values, and `consent.required` is true. The `UserRepo` contract (in-memory and emulator) checks that no `users` or `identities` doc for the old id remains, and that a second user is untouched. The e2e covers the same flow.
- [ ] Deletion is idempotent. Two DELETEs in a row both return 204, and the second writes nothing and creates no user (counts stay 0). `deleteUserAndIdentities` on an unknown ULID resolves without an error in both implementations.
- [ ] `DELETE /v1/me` returns 401 without a token or with a rejected token, and works without consent.

**Notes**

Do not revoke the Firebase Auth account or its tokens here. That needs a change to the auth port and is a follow-up.
