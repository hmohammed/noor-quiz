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

_(implementer adds notes for the next task here)_

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
