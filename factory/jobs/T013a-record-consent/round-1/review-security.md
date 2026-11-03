VERDICT: PASS
# Security review — T013a round 1

Scope reviewed: `git diff main...factory/T013a-record-consent` (32 files), with full reads of `apps/api/src/routes/me.ts`, `apps/api/src/adapters/firebase/user-repo.ts`, `apps/api/src/middleware/require-user.ts`, `require-consent.ts`, `packages/core/src/usecases/accept-consent.ts`, `packages/core/src/users/consent.ts`, `packages/testkit/src/in-memory-user-repo.ts`, `packages/contracts/src/me.ts`, `apps/web/e2e/helpers/sign-in.ts`, `firebase/firestore.rules`.

## Findings
None at P0–P2.

What I checked and found correct:
- **AuthN:** `POST /v1/me/consent` runs `limitBody() → requireUser() → parse`. `requireUser` verifies the bearer token through `deps.auth.verify` and resolves our user server-side. `userId` passed to `acceptConsent` is `c.var.user.id` only (`me.ts:64-65`).
- **AuthZ / gate:** `PATCH /v1/me` is `limitBody → requireUser → requireConsent → parse` (`me.ts:57`), so consent is checked before the body is read. `requireConsent` compares `c.var.user.consentVersion` (server-loaded) to the code constant `CURRENT_CONSENT_VERSION` with strict equality; an outdated version is refused (`require-consent.ts:12-17`).
- **Never trust the client:** `AcceptConsentRequest` is `z.strictObject({ version: 1..32 })`, so `acceptedAt`/`userId` are rejected (tested, me.test 29). The client `version` is only compared to the constant; what is stored is the server constant, not the client string (`accept-consent.ts:19-31`). `required` is computed server-side in `meBody`.
- **Time:** `acceptedAt` and `updatedAt` come from `toIso(deps.clock.now())`. No `Date`/override introduced.
- **Write safety:** Both repos validate with `isValidConsent` and copy `consent` by named keys before writing; Firestore uses a transaction with `tx.update(ref, { consent, updatedAt })` and `NOT_FOUND` on a missing doc (no upsert). `UserDoc.consent` is a strict schema, so an extra key reads as `INTERNAL` rather than leaking through.
- **Cross-user isolation:** `users` is the documented global collection (no tenantId). Writes target only the token user's ULID; test 32 checks user B is byte-identical.
- **PII / data minimisation:** `MeResponse` stays strict, `MeConsent` is strict and never carries `acceptedAt`; `RequestUser` holds only `consentVersion`; bodies are built from named fields (`meBody`, `requestUserOf`). Leak test covers GET/PATCH/POST. Error details carry only a reason, never the submitted version.
- **Abuse:** 4 KB `bodyLimit` runs before token verification on the new route (test 30). Re-accepting is a no-op (no write), so repeated calls do not amplify writes.
- **Firestore rules:** unchanged; `match /{document=**} allow read, write: if false` still denies all client access.
- **e2e helper:** calls the real public endpoint with the signed-in user's own token; it does not log the header or token and adds no backdoor or test-mode path to production code.

## Hard rules
1. core vendor-free — ok (`consent.ts`, `accept-consent.ts` import only core modules; `isValidConsent` uses core `instantFromIso`)
2. ports + adapters + fakes — ok (`UserRepo.recordConsent` on the existing port, implemented in `FirestoreUserRepo` and `InMemoryUserRepo`, covered by the shared contract)
3. no client Firestore writes — ok (rules unchanged, deny-all)
4. tenant isolation — ok / n.a. (`users` is the documented global collection; user id from the verified token only)
5. time from Clock — ok (`acceptedAt`/`updatedAt` from `deps.clock`; client cannot send `acceptedAt`)
6. roles server-side / never trust client — ok (consent state, version and `required` decided on the server)
7. entitlements, not plan names — n.a.
8. our own IDs — ok (ULID `userId`; no Firebase uid or email in responses, leak test)
9. secrets — ok (no secrets or tokens logged; e2e helper does not print the header)
10. AI output untrusted — n.a.
11. religious content provenance — n.a.

## Nits (non-blocking)
- [P3] apps/api/src/routes/me.ts:63 — `POST /v1/me/consent` has no rate limit. Out of scope per spec (no `rateLimit` middleware exists yet) and the repeat-accept path writes nothing, so the impact is only token-verify + one read per call. Apply the shared rate limiter here when it lands.
- [P3] GDPR special-category note: consent is recorded but withdrawal/deletion is deferred to T013c (`DELETE /v1/me`). Make sure T013c deletes the `consent` field with the user doc.
