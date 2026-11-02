VERDICT: PASS
# Security review — T010b round 1

Scope: `git diff main...factory/T010b-verify-token-me` (25 files). Production files read in full: `adapters/firebase/auth-verifier.ts`, `adapters/firebase/auth.ts`, `middleware/require-user.ts`, `routes/me.ts`, `app.ts`, `app-env.ts`, `errors.ts`, `composition.ts`, `contracts/src/me.ts`, `core/src/ports/auth-verifier.ts`, `testkit/src/fake-auth-verifier.ts`, plus `core/src/usecases/get-or-create-user.ts` and `config.ts` for context.

## Findings
None at P0–P2.

What I checked:
- **Token verification:** `FirebaseAuthVerifier.verify` calls `verifyIdToken(token, true)`, so it checks revocation and disabled users. Any SDK throw becomes `DomainError('UNAUTHENTICATED')` with details holding only a fixed `reason` and an `sdkCode` that must match `^auth/[a-z-]+$`. The SDK message, which can contain token fragments, is dropped. There are no `console.*` calls in the adapter or the middleware.
- **Header parsing:** `requireUser` accepts only `Bearer <token68>` (case-insensitive), with a 4096-char cap. It rejects a bad header before calling the verifier, which bounds the input sent to the SDK.
- **Token not echoed:** `errors.ts` serialises only `code` plus a fixed public message, never `message` or `details`. It logs only non-DomainErrors and `INTERNAL`. Every verifier failure is an `UNAUTHENTICATED` DomainError, so it is never logged. A non-domain error from `getOrCreateUser` (for example a Firestore failure) can be logged, but it would not contain the token or the header.
- **uid not leaked:** `c.var.user` holds only `{ id, displayName }`. The route builds the body from those two named fields and passes it through a strict `MeResponse`, so `uid`, `subject` or `email` would fail validation. The uid is used only as `subject` in `getOrCreateUser`. Tests 20 and 23 cover this with a sentinel uid and a leaky repo.
- **Client authority:** nothing is taken from the client except the bearer token. No role, tenant, date or id is read from the request.
- **Scope:** `requireUser` is mounted per-route, and health stays public on purpose. `/v1/me` is not tenant-scoped (`users`/`identities` are global by design), so tenant checks do not apply here.
- **Emulator safety in tests:** the auth contract test refuses to run without `FIREBASE_AUTH_EMULATOR_HOST` and uses a named app on `demo-noor`.

## Nits (non-blocking)
- [P3] apps/api/src/composition.ts:27 — The admin SDK accepts unsigned (`alg: none`) ID tokens whenever `FIREBASE_AUTH_EMULATOR_HOST` is set. If a staging or prod deploy were misconfigured with that variable, auth could be bypassed. Fix: in `createComposition`, throw `ConfigError` when `NOOR_ENV` is `staging` or `prod` and `FIREBASE_AUTH_EMULATOR_HOST` (or `FIRESTORE_EMULATOR_HOST`) is set, and add a composition test. This is defence in depth for a follow-up task. It needs an operator mistake, not client input.
- [P3] Rate limiting on authenticated routes is out of scope per the spec. Track it before join, submit and invite endpoints land.

## Hard rules
1. core vendor-free — ok (`AuthVerifier` uses only `VerifiedIdentity`; `firebase-admin/auth` is imported only under `apps/api/src/adapters/firebase/`)
2. ports + adapters + fakes — ok (`AuthVerifier` port, `FirebaseAuthVerifier` adapter, `FakeAuthVerifier` fake, and a shared contract run against both)
3. no client Firestore writes — ok (not touched; the user is created server-side via `getOrCreateUser`)
4. tenant isolation — n/a (`/v1/me` is global user data; no tenant-owned data touched)
5. time from Clock — ok (no `Date.now()` in the middleware or route; expiry is checked vendor-side in the adapter; `Date.now()` appears only in the emulator test file)
6. roles server-side — ok (no roles or claims read; nothing authoritative taken from the client)
7. entitlements not plan names — n/a
8. our own IDs — ok (the response carries only the ULID `userId`; the uid never reaches `c.var` or a response; strict contract)
9. secrets not logged — ok (the token and header are never logged or put in error bodies; details hold only a fixed reason and an `auth/...` code)
10. AI output untrusted — n/a
11. religious content provenance — n/a
