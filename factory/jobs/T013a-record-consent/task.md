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

Tags: `sec`
Phase: P1
