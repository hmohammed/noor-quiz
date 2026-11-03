VERDICT: CHANGES
# Security review — T013c round 3

## Findings
- [P2] apps/web/src/features/auth/session-context.tsx:179 — After consent is saved, `acceptConsent` calls `applyTimezoneDefault` with no `AbortSignal`. `timezoneDefault` returns null while `consent.required` is true, so the controller created on sign-in never wraps a real timezone PATCH. `deleteAccount` only aborts `pending`. On a first agreement the profile link appears in the same turn that this PATCH is sent, and a PATCH that reaches the API after `DELETE /v1/me` runs `requireUser()` → `getOrCreateUser`, which writes a new user and identity (token display name plus timezone) after the person has signed out. Store that call's controller on `pending` and pass its signal into `applyTimezoneDefault`, so `cancelPending` aborts it and the generation check still drops a late response. Start the PATCH only when the generation has not already moved.

## Hard rules
1. core vendor-free — ok (`delete-account.ts` imports only core; the transaction stays in `FirestoreUserRepo`)
2. ports + adapters + fakes — ok (`deleteUserAndIdentities` is on `UserRepo`, implemented in the in-memory fake and the Firestore adapter, covered by one shared contract; the route calls the use case)
3. no client Firestore writes — ok (the web calls `DELETE /v1/me` only; `firebase/firestore.rules` is unchanged and still denies every client read and write)
4. tenant isolation — ok (`users` and `identities` are global by design; the delete key comes from the verified subject, and a JSON `userId` in the body is never read)
5. time from Clock — ok (the delete path does not read a clock or accept a client time)
6. roles server-side — ok (no role, tenantId, score, or user id is taken from the client; `requireIdentity` sets `{ provider, subject }` from `AuthVerifier` only and does not call `getOrCreateUser`)
7. entitlements not plan name — ok (no plan or Stripe call on this path)
8. our own IDs — ok (deletion is by our ULID after `getByIdentity`; the Firebase uid is used only through `identityId()`, which rejects an unsafe subject)
9. secrets — ok (the bearer helper does not log the header; error bodies stay the fixed public message; the 204 body is empty; the e2e compares a hash of `sub` and does not print it)
10. AI output untrusted — ok (no AI on this path)
11. religious content provenance — ok (no questions; the consent record and profile live on the user doc and are deleted with it)
