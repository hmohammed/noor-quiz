VERDICT: PASS
# Security review — T013c round 1

## Findings
None.

## Nits (non-blocking)
- [P3] apps/web/src/features/auth/session-context.tsx:135 — `deleteAccount` aborts only `pending` (the `/v1/me` load and the timezone PATCH). `updateMe` does not use that controller and does not re-check `generation` before `apiClient.updateMe`, so a profile save that is already awaiting `getIdToken` or in flight can still hit `requireUser()` after the delete and create a new user with that patch. Cancel or generation-gate `updateMe` the same way. Token revocation stays out of scope; a later `GET /v1/me` with the still-valid Firebase token is the documented follow-up, not this race.

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
