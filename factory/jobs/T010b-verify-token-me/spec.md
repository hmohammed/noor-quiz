# Spec — T010b Verify the token and return GET /v1/me

Size check: one new port (`AuthVerifier`) + its adapter, one middleware, one read-only route, no UI. Fits in a day, so no split.

## Acceptance tests

Port contract (`packages/testkit/src/contracts/auth-verifier.contract.ts`, `runAuthVerifierContract(name, makeHarness)`), run against both `FakeAuthVerifier` and the Firebase adapter on the Auth emulator:

1. A valid token resolves to `{ provider: 'firebase', subject, email, emailVerified, name }` matching the identity it was issued for (`name`/`email` are `null` when absent) — adapter — contract
2. Two different identities resolve to two different subjects — adapter — contract
3. `''`, `'garbage'`, `'a.b.c'` (malformed JWT) each reject with `DomainError('UNAUTHENTICATED')` — adapter — contract
4. A token that was valid and is then revoked (fake: `reject(token)`; emulator: `revokeRefreshTokens(uid)`) rejects with `UNAUTHENTICATED` — adapter — contract
5. Every rejection is a `DomainError` (checked with `isDomainError`) whose `message` and `details` do not contain the token string — adapter — contract

Fake-only (`packages/testkit/src/fake-auth-verifier.test.ts`):

6. `runAuthVerifierContract('FakeAuthVerifier', …)` runs in `npm test` — adapter — `packages/testkit/src/fake-auth-verifier.test.ts`
7. `issue()` returns opaque tokens that never contain the subject, email or name; an unknown token throws `UNAUTHENTICATED`; `verify` returns a copy (mutating the result does not change later results); `verifyCalls` counts calls — adapter — same file

Firebase adapter on the emulator (`apps/api/src/adapters/firebase/auth-verifier.contract.test.ts`):

8. `runAuthVerifierContract('FirebaseAuthVerifier (emulator)', …)` passes — adapter — `auth-verifier.contract.test.ts`
9. An **expired** token (unsigned emulator JWT with correct `iss`/`aud`/`sub` for `demo-noor` and `exp` in the past) rejects with `UNAUTHENTICATED` — adapter — same file
10. A token for a **disabled** user and for a **deleted** user rejects with `UNAUTHENTICATED` — adapter — same file
11. A token for a wrong project (`aud`/`iss` = `other-project`) rejects with `UNAUTHENTICATED` — adapter — same file
12. Refuses to run unless `FIREBASE_AUTH_EMULATOR_HOST` is set (same `requireEmulator` pattern as `user-repo.contract.test.ts`) — adapter — same file
13. On rejection the adapter writes nothing to `console.*` containing the token (spy on `console.error/warn/log/info`) — adapter — same file

Middleware + route (`apps/api/src/routes/me.test.ts`, `app.request()` with `makeTestDeps()`):

14. Valid token → 200, `content-type` JSON, body passes `MeResponse.parse`, `userId` is a ULID and equals the user stored in `InMemoryUserRepo` for that identity, `displayName` is the normalised name — api — `me.test.ts`
15. Two requests with the same identity (and 5 concurrent ones via `Promise.all`) return the same `userId`; `users.counts()` is `{ users: 1, identities: 1 }` — api — `me.test.ts`
16. Identity with `name: null` (or a 1-char name) → 200 with `displayName: null` — api — `me.test.ts`
17. 401 + `ErrorResponse` body with `error.code === 'UNAUTHENTICATED'` for each of: no `Authorization` header; `Basic abc`; `Bearer` (no token); `Bearer ` (empty token); `Bearer a b` (two tokens); `Bearertoken` (no space); a token longer than 4096 chars; an unknown token; a token the fake has `reject`ed — api — `me.test.ts`
18. For the header-shape cases in test 17 (all except unknown/rejected token), `auth.verifyCalls` stays 0 and no user is created (`users.counts()` is zeros) — api — `me.test.ts`
19. Scheme is case-insensitive: `bearer <token>` and `BEARER <token>` → 200 (RFC 6750) — api — `me.test.ts`
20. uid never leaks: issue a token for subject `SENTINELuid0123456789abcdef` (and email `sentinel@leak.test`); the raw text of the 200 body does not contain the subject or email; the raw text of a 401 body after `reject(token)` does not contain the subject or the token — api — `me.test.ts`
21. `MeResponse.parse` throws for `{ userId, displayName, uid: 'x' }` and `{ userId, displayName, subject: 'x' }` — api/contract — `packages/contracts/src/me.test.ts`
22. `MeResponse` accepts a ULID + `null`, `'Åsa'`, `'حسن'`, `'ሀሰን'`, a 32-code-point Ge'ez name and a 32-emoji string (64 UTF-16 units); rejects a non-ULID `userId`, a 1-code-point name and a 33-code-point name — contract — `packages/contracts/src/me.test.ts`
23. If the user repo returns a user with extra keys (a test double wrapping `InMemoryUserRepo` that adds `subject` and `email`), the 200 body still has exactly `userId` and `displayName` and does not contain those values — api — `me.test.ts`
24. `POST /v1/me` → 404; `GET /v1/health` with no token still → 200 (`requireUser` is not global) — api — `me.test.ts`
25. `requireUser` unit: on success `c.var.user` is exactly `{ id, displayName }` (no email, no subject), checked through a tiny test route mounted on a test app — api — `apps/api/src/middleware/require-user.test.ts`

Wiring:

26. `createComposition` with a valid env wires `deps.auth` as `FirebaseAuthVerifier`; with an invalid env it throws `ConfigError` before building the auth client (extend the existing counting mock) and still leaves one admin app after two calls — api — `apps/api/src/composition.test.ts`
27. `makeTestDeps()` returns a `FakeAuthVerifier` (fresh per call, overridable) and still satisfies `Deps` — adapter — `packages/testkit/src/make-test-deps.test.ts`

Wrong-tenant tests: not applicable. `/v1/me` is not tenant-scoped and `users`/`identities` are global by design (see `UserRepo` JSDoc).

Mapping of task acceptance criteria:
- "401 without or with an invalid token … no header, non-Bearer scheme, empty token, a token the fake rejects, expired token on the emulator contract, every case `ErrorResponse` with `UNAUTHENTICATED`" → tests 3, 4, 9, 10, 11, 17, 18.
- "Firebase uid never appears in API responses … sentinel … 200 and 401 body … `MeResponse` strict rejects `uid`/`subject`" → tests 20, 21, 25.

## Files and modules to touch

- `packages/core/src/ports/auth-verifier.ts` (new) — `AuthVerifier` interface; reuses `VerifiedIdentity` from `users/user.ts` (do **not** redefine it).
- `packages/core/src/deps.ts` — add `auth: AuthVerifier`.
- `packages/core/src/index.ts` — `export type * from './ports/auth-verifier'`.
- `packages/testkit/src/fake-auth-verifier.ts` (+ `.test.ts`) (new) — `FakeAuthVerifier`.
- `packages/testkit/src/contracts/auth-verifier.contract.ts` (new) — `runAuthVerifierContract`.
- `packages/testkit/src/make-test-deps.ts` (+ test) — add `auth: FakeAuthVerifier` to `TestDeps` and `makeTestDeps`.
- `packages/testkit/src/index.ts` — export the fake and the contract.
- `apps/api/src/adapters/firebase/auth.ts` (new) — `getAdminAuth()`: `getAuth(getApps()[0] ?? initializeApp())`, same pattern as `getAdminFirestore()` so both share the one default admin app.
- `apps/api/src/adapters/firebase/auth-verifier.ts` (new) — `FirebaseAuthVerifier` taking an injected `Auth`.
- `apps/api/src/adapters/firebase/auth-verifier.contract.test.ts` (new) — emulator contract + expired/disabled/deleted/wrong-project/logging tests. Picked up by the existing `src/**/*.contract.test.ts` include.
- `apps/api/src/app-env.ts` (new) — `AppEnv` and `RequestUser` types.
- `apps/api/src/middleware/require-user.ts` (+ `.test.ts`) (new) — `requireUser()`.
- `apps/api/src/routes/me.ts` (+ `.test.ts`) (new) — `meRoutes()`.
- `apps/api/src/app.ts` — `createApp` returns `Hono<AppEnv>`; first middleware sets `c.set('deps', root.deps)`; mount `meRoutes()`. Health stays public.
- `apps/api/src/composition.ts` (+ test) — `auth: new FirebaseAuthVerifier(getAdminAuth())`.
- `packages/contracts/src/me.ts` (+ `.test.ts`) (new), `packages/contracts/src/index.ts` — export `MeResponse`.
- `package.json` (root) — `test:emulator`: `--only firestore` → `--only auth,firestore`. The `auth` emulator port (9099) is already in `firebase/firebase.json`; `emulators:exec` sets `FIREBASE_AUTH_EMULATOR_HOST` for the child process.
- `apps/api/src/routes/health.test.ts`, `apps/api/src/errors.test.ts` — only if typecheck needs it after `createApp`'s return type changes.
- `docs/tasks/BOARD.md` — T010b row → `done` (builder does this in the PR, per DoD).

No ADR needed: Firebase Auth is already the chosen vendor in ADR 0002, behind `AuthVerifier` as listed in AGENT.md. No new dependency (`firebase-admin` is already in `apps/api`). No new config or env keys, so `.env.example` is unchanged.

## Contracts and data shapes

Core port:
```ts
// packages/core/src/ports/auth-verifier.ts
import type { VerifiedIdentity } from '../users/user';

/**
 * Verifies a bearer token from the client. Throws DomainError('UNAUTHENTICATED') for
 * any invalid, expired, revoked, disabled-user or malformed token. Never logs the token.
 */
export interface AuthVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}
```

Fake:
```ts
export class FakeAuthVerifier implements AuthVerifier {
  /** Returns a new opaque token (`fake-token-<n>`), never derived from the identity. */
  issue(identity: VerifiedIdentity): string;
  /** Makes a previously issued (or any) token fail from now on. */
  reject(token: string): void;
  /** Number of verify() calls, so tests can prove header checks short-circuit. */
  get verifyCalls(): number;
  verify(token: string): Promise<VerifiedIdentity>; // copy; unknown/rejected → UNAUTHENTICATED
}
```

Contract harness:
```ts
export interface AuthVerifierHarness {
  verifier: AuthVerifier;
  /** Creates the identity in the backing store and returns a currently valid token. */
  issue(identity: Omit<VerifiedIdentity, 'provider' | 'subject'> & { subject?: string }):
    Promise<{ token: string; subject: string }>;
  /** Revokes a token issued by `issue` (fake: reject; emulator: revokeRefreshTokens). */
  revoke(token: string, subject: string): Promise<void>;
}
export function runAuthVerifierContract(name: string, makeImpl: () => Promise<AuthVerifierHarness>): void;
```
The emulator harness creates the user with `auth.createUser({ uid?, email, emailVerified, displayName })` and gets an ID token from the emulator REST endpoint `POST http://$FIREBASE_AUTH_EMULATOR_HOST/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key` (create the user with a password) — or `accounts:signInWithCustomToken` with a token from `createCustomToken`. Because revocation compares whole seconds (`auth_time` vs `tokensValidAfterTime`), `revoke` waits just over 1 s before calling `revokeRefreshTokens`. Clear emulator accounts between tests with `DELETE http://$FIREBASE_AUTH_EMULATOR_HOST/emulator/v1/projects/demo-noor/accounts`.

Expired token for test 9: an unsigned JWT (`alg: 'none'`) built in the test with `iss: 'https://securetoken.google.com/demo-noor'`, `aud: 'demo-noor'`, `sub`/`user_id` of an existing emulator user, `iat`/`auth_time` 2 h ago, `exp` 1 h ago. The admin SDK accepts unsigned tokens only in emulator mode, so this cannot work against a real project.

Adapter mapping (`FirebaseAuthVerifier.verify`):
- `typeof token !== 'string' || token.length === 0` → throw `UNAUTHENTICATED` without calling the SDK.
- `const d = await auth.verifyIdToken(token, true)` inside `try`; **any** thrown value → `throw new DomainError('UNAUTHENTICATED', { reason: 'token-rejected', sdkCode })` where `sdkCode` is the SDK's `code` string only if it matches `/^auth\/[a-z-]+$/` (never the message, which can embed token parts). No `console.*` call.
- Return `{ provider: 'firebase', subject: d.uid, email: typeof d.email === 'string' ? d.email : null, emailVerified: d.email_verified === true, name: typeof d.name === 'string' ? d.name : null }`.
- Subject format is enforced later by `identityId()` in `getOrCreateUser` (→ `UNAUTHENTICATED`), so the adapter does not duplicate it.

Hono env:
```ts
// apps/api/src/app-env.ts
export interface RequestUser { id: UserId; displayName: string | null }
export interface AppEnv { Variables: { deps: Deps; user: RequestUser } }
```

Middleware:
```ts
// apps/api/src/middleware/require-user.ts
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;
const MAX_TOKEN_LENGTH = 4096;

export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const match = BEARER.exec(c.req.header('Authorization') ?? '');
    const token = match?.[1];
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      throw new DomainError('UNAUTHENTICATED', { reason: 'bad-authorization-header' });
    }
    const deps = c.var.deps;
    const identity = await deps.auth.verify(token);
    const user = await getOrCreateUser(deps, identity);
    c.set('user', { id: user.id, displayName: user.displayName });
    await next();
  };
}
```
Errors are thrown, so the single `onError` in `errors.ts` produces the 401 `ErrorResponse`; no new error mapping is needed (`UNAUTHENTICATED` → 401 already exists).

Contract:
```ts
// packages/contracts/src/me.ts
/** Our ULID format (mirrors core's ULID_PATTERN; contracts does not import core). */
export const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export const MeResponse = z.strictObject({
  userId: Ulid,
  displayName: z.string().min(2).max(32).nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;
```
Note: zod `.min/.max` on strings count UTF-16 units, while core's `normaliseDisplayName` caps at 32 **code points**. A name of 32 astral code points (e.g. 32 emoji, 64 UTF-16 units) would make `.parse` throw → 500. Use `.refine` with `Array.from(s).length` between 2 and 32 instead of `.min/.max`, and test both a 32-code-point Ge'ez name and a 32-emoji string (test 22).

Route:
```ts
// apps/api/src/routes/me.ts
export function meRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/v1/me', requireUser(), (c) =>
    c.json(MeResponse.parse({ userId: c.var.user.id, displayName: c.var.user.displayName }), 200),
  );
}
```

Error codes → HTTP: `UNAUTHENTICATED` → 401 (header missing/malformed, verifier rejection, invalid subject from `identityId`); `INTERNAL` → 500 (corrupt stored user, `MeResponse.parse` failure). Firestore docs: unchanged from T010a (`users/{userId}`, `identities/{provider}_{subject}`, global, no `tenantId`).

## Hard rules that apply here

- **Rule 1 (core is vendor-free):** the port uses only `VerifiedIdentity`; no `firebase-admin` or `hono` types in core. `firebase-admin/auth` is imported only in `apps/api/src/adapters/firebase/`.
- **Rule 2 (port + adapter + fake):** `AuthVerifier` in core, `FirebaseAuthVerifier` in apps/api, `FakeAuthVerifier` in testkit, and one shared contract suite run against both.
- **Rule 6 (roles server-side):** `c.var.user` holds only our `id` and `displayName`. Do not read custom claims or roles in this task.
- **Rule 8 (our own IDs):** the response carries `userId` (ULID) only. The uid is used once, as `subject` for `getOrCreateUser`, and never stored on `c.var` or put in a response. `MeResponse` is strict and the route builds the object from two named fields, never by spreading a user/identity.
- **Rule 9 (no secrets in logs):** neither middleware nor adapter logs the token, the header, or SDK error messages. `DomainError.details` holds only a fixed `reason` and an `auth/...` code; `errors.ts` never serialises details. Test 13 checks the adapter; tests 20 checks the bodies.
- **Rule 5 (Clock):** `getOrCreateUser` already uses `deps.clock`; the middleware and route must not call `Date.now()`. Token expiry is checked by the Firebase SDK inside the adapter, which is allowed (vendor-side time), and by the fake not at all.
- **Emulator safety:** the auth contract test refuses to run without `FIREBASE_AUTH_EMULATOR_HOST` and uses project `demo-noor`, so it can never hit a real project.

## Out of scope

- Any web UI, `firebase` client SDK, `apiClient.getMe()`, sign-in button or e2e (T010c).
- `PATCH /v1/me`, syncing `displayName`/email from later tokens, locale, timezone (T011).
- Memberships, `requireMember`, tenant routes, roles or platform-admin claims.
- Rate limiting, CORS, `WWW-Authenticate` response header, session cookies, token caching.
- Changing `errors.ts` mapping, `DomainError`, `getOrCreateUser`, `UserRepo` or Firestore rules.
- New dependencies (no `jose`/`jsonwebtoken`; build the unsigned test JWT with `Buffer.from(JSON.stringify(...)).toString('base64url')`).
- Making `requireUser` global or protecting `/v1/health`.
