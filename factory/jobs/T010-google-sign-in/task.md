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

---
BOARD row: Tags: sec · Phase: P1
