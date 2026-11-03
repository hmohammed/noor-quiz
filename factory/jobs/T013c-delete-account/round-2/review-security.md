VERDICT: PASS
# Security review — T013c round 2

## Findings
None. The round 1 profile-save race is closed. `deleteAccount` aborts the shared `/v1/me` controller and bumps `generation` before `DELETE`. `updateMe` uses that same controller and returns before `PATCH` when the generation has already moved. Once confirm starts, the profile fields and Save button are disabled and a new submit is ignored.

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
