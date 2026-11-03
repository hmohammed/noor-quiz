# Spec — T013a Consent: record it and block protected endpoints without it

Size check: one new repo method (no new port), one new use case, one new route, one new middleware, no new screen. About a day of work. No split.

## Acceptance tests

Core (`packages/core`)

1. `hasCurrentConsent` is true only for `consent.version === CURRENT_CONSENT_VERSION`. It is false for `consent: null` and for an older version string. — core — `packages/core/src/users/consent.test.ts`
2. `CURRENT_CONSENT_VERSION` is a non-empty string of at most 32 chars, so it always passes `AcceptConsentRequest`. — core — `packages/core/src/users/consent.test.ts`
3. `acceptConsent` for a new user (consent `null`) records `{ version: CURRENT_CONSENT_VERSION, acceptedAt: <FakeClock now ISO> }`, sets `updatedAt` to the same instant, and returns the stored user. — core — `packages/core/src/usecases/accept-consent.test.ts`
4. A second `acceptConsent` after `clock.advance({ days: 1 })` returns the user with the first `acceptedAt` and the first `updatedAt`, and the repo's `recordConsent` is not called again (spy or call counter). — core — `accept-consent.test.ts`
5. A user who accepted an older version (seeded with `recordConsent(…, { version: '2000-01-01', … })`) gets the current version and a new `acceptedAt` after `acceptConsent`. — core — `accept-consent.test.ts`
6. `acceptConsent` with `version` ≠ `CURRENT_CONSENT_VERSION` (an older string, and `''`) throws `DomainError('CONFLICT')`. The stored user is unchanged (`toStrictEqual` the earlier value). — core — `accept-consent.test.ts`
7. `acceptConsent` for an unknown ULID throws `NOT_FOUND`. For a non-ULID `userId` it throws `VALIDATION`. — core — `accept-consent.test.ts`
8. `getOrCreateUser` creates users with `consent: null`. A later sign-in returns the stored consent unchanged (it never resets consent). — core — `packages/core/src/usecases/get-or-create-user.test.ts`
9. `DOMAIN_ERROR_CODES` includes `CONSENT_REQUIRED`, and the existing `it.each(DOMAIN_ERROR_CODES)` cases pass for it. — core — `packages/core/src/errors.test.ts` (no new test needed; the table drives it)

Repo contract (`runUserRepoContract`, so it runs against `InMemoryUserRepo` and `FirestoreUserRepo` on the emulator)

10. `recordConsent(ULID_A, consent, LATER)` returns `{ ...userDoc(ULID_A), consent, updatedAt: LATER }`. `getById(ULID_A)` returns the same. `getById(ULID_B)` is unchanged, and the counts stay `{ users: 2, identities: 2 }`. — adapter — `packages/testkit/src/contracts/user-repo.contract.ts`
11. `recordConsent` keeps `displayName`, `locale`, `timezone` and `createdAt` set earlier by `updateProfile`, so only `consent` and `updatedAt` change. — adapter — same file
12. `recordConsent` for an unknown ULID throws `NOT_FOUND` and writes nothing (counts stay 0 and `getById` is null). For a non-ULID id it throws `VALIDATION`. — adapter — same file
13. `recordConsent` with a malformed consent (`version: ''`, a `version` of 33 chars, or `acceptedAt: 'yesterday'`) throws `VALIDATION` and writes nothing. This keeps a bad write from producing a doc that later reads as `INTERNAL`. — adapter — same file
14. The value returned by `recordConsent` and `getById` is a copy. Mutating `result.consent.version` does not change the stored user. — adapter — same file
15. `getOrCreateUser` through the contract gives a user with `consent: null`. The existing `userDoc()` fixture gains `consent: null`. — adapter — same file

Firestore only (emulator)

16. The raw `users` doc written by `getOrCreateUser` is exactly `{ id, displayName, locale, timezone, consent: null, createdAt, updatedAt, schemaVersion: 1 }`. — adapter — `apps/api/src/adapters/firebase/user-repo.contract.test.ts`
17. A legacy doc with no `locale`, `timezone` or `consent` key reads as `consent: null` (and `locale`/`timezone` null as before). `recordConsent` on it then gives a raw doc of `{ ...legacy, consent: { version, acceptedAt }, updatedAt: later }` and nothing else. — adapter — same file
18. A `users` doc with `consent: { version: 'v', acceptedAt: AT, extra: 1 }` or `consent: 'yes'` reads as `INTERNAL` (strict schema). — adapter — same file

Middleware (`apps/api`)

19. On a throwaway Hono app with `requireUser(), requireConsent()` and an echo handler: a new user gets 403 with an `ErrorResponse` code `CONSENT_REQUIRED` and the handler is not called. A user who accepted an older version also gets 403 `CONSENT_REQUIRED`. A user who accepted `CURRENT_CONSENT_VERSION` gets 200. No token gives 401 (so `requireUser` still runs first). — api — `apps/api/src/middleware/require-consent.test.ts`
20. `requireUser()` sets `c.var.user` to exactly `{ id, displayName, locale, timezone, consentVersion }`. `consentVersion` is `null` for a new user and the stored version after consent. No `acceptedAt`, email or subject. — api — `apps/api/src/middleware/require-user.test.ts`
21. `errors.ts` maps `CONSENT_REQUIRED` to 403 with the message `'Consent required'`. The existing exhaustive-table tests cover this. — api — `apps/api/src/errors.test.ts`

Routes (`apps/api/src/routes/me.test.ts`)

22. `GET /v1/me` for a new user returns 200 with `consent: { currentVersion: CURRENT_CONSENT_VERSION, acceptedVersion: null, required: true }`. — api
23. `POST /v1/me/consent` with `{ version: CURRENT_CONSENT_VERSION }` and no prior consent returns 200 with a `MeResponse` that has `consent.required: false` and `acceptedVersion` equal to the current version. A later `GET /v1/me` reports `required: false`. The stored `acceptedAt` equals the FakeClock instant. — api
24. A second `POST /v1/me/consent` after `deps.clock.advance({ hours: 1 })` returns 200, and the stored `consent.acceptedAt` is still the first instant. — api
25. `PATCH /v1/me` returns 403 `CONSENT_REQUIRED` (body parses as `ErrorResponse`) for a new user. The stored user is unchanged. — api
26. `PATCH /v1/me` returns 403 `CONSENT_REQUIRED` for a user whose stored consent has an older version (seed it with `deps.users.recordConsent`). The user is unchanged. — api
27. `PATCH /v1/me` returns 200 after `POST /v1/me/consent` for the same user. — api
28. `POST /v1/me/consent` returns 401 `UNAUTHENTICATED` without an Authorization header and with a rejected token. Nothing is created or changed. — api
29. `POST /v1/me/consent` returns 400 `VALIDATION`, writes nothing and leaves consent `null` for each of these bodies: non-JSON, a JSON array, `{}`, `{ version: '' }`, `{ version: 'x'.repeat(33) }`, `{ version: 42 }`, `{ version: CURRENT, acceptedAt: '2020-01-01T00:00:00.000Z' }` and `{ version: CURRENT, userId: <another ULID> }`. — api
30. `POST /v1/me/consent` with a body over 4 KB returns 400 before the token is verified (`deps.auth.verifyCalls` unchanged). — api
31. `POST /v1/me/consent` with `{ version: '2000-01-01' }` (well formed but not current) returns 409 `CONFLICT`, and the user's consent stays `null`. — api
32. User A's `POST /v1/me/consent` changes only user A. User B's stored doc is byte-identical before and after. — api
33. The leak test now covers `GET`, `PATCH` and `POST /v1/me/consent` (`LeakyUserRepo` also overrides `recordConsent`). Each 200 body has exactly the top-level keys `consent, displayName, locale, timezone, userId`. `consent` has exactly `acceptedVersion, currentVersion, required`. The text contains no `acceptedAt` key, no stored `acceptedAt` value, and not the Firebase uid or email sentinels. — api
34. `GET /v1/me/consent` and `DELETE /v1/me/consent` return 404 (only POST exists). The existing `POST /v1/me` → 404 test still passes. — api
35. Every existing PATCH test still passes after its `signedIn()` helper accepts consent first (see "Files"). The `VanishingRepo` 404 test seeds consent before the PATCH so it still reaches the use case. — api

Contracts

36. `AcceptConsentRequest` accepts `{ version: 'a' }` and a 32-char version. It rejects `''`, 33 chars, a number, a missing `version` and any extra key (`acceptedAt`, `userId`). — contracts — `packages/contracts/src/me.test.ts`
37. `MeResponse` requires `consent`. It rejects a missing `consent`, an extra key inside `consent` (`acceptedAt`), a non-boolean `required` and a missing `acceptedVersion`. It accepts `acceptedVersion: null`. — contracts — `me.test.ts`

Web (keeps CI e2e green; see "Hard rules" for why this is in scope)

38. `timezoneDefault` returns `null` when `me.consent.required` is true, even if the timezone is null and the browser zone is valid. It returns the browser zone when consent is not required and the timezone is null, as before. — web unit — `apps/web/src/features/auth/timezone-default.test.ts`
39. The `me()` fixtures in `apps/web/src/api/client.test.ts` include a `consent` block, and a `getMe` body without `consent` throws `ApiError` (strict contract). — web unit — `client.test.ts`
40. `e2e/profile.spec.ts` still passes. The first test sees exactly one `PATCH /v1/me` with the browser timezone, returning 200, after consent is accepted through the API helper. The name-change test saves with 200. `sign-in.spec.ts` and `home.spec.ts` are unchanged and pass. — e2e — `apps/web/e2e/profile.spec.ts`, `apps/web/e2e/helpers/sign-in.ts`

## Files and modules to touch

Core
- `packages/core/src/users/consent.ts` (new): `CURRENT_CONSENT_VERSION = '2026-11-01'`, `interface Consent { version: string; acceptedAt: string }`, `CONSENT_VERSION_MAX = 32`, `hasCurrentConsent(user: Pick<User, 'consent'>): boolean`, and `isValidConsent(c: Consent): boolean` (version 1–32 chars, `acceptedAt` parses with `instantFromIso`). The repos use `isValidConsent` so both reject the same input.
- `packages/core/src/users/consent.test.ts` (new): tests 1, 2.
- `packages/core/src/users/user.ts`: `User` gains `consent: Consent | null` with JSDoc ("null until accepted; docs from before T013a read as null"). `USER_SCHEMA_VERSION` stays `1`.
- `packages/core/src/errors.ts`: add `'CONSENT_REQUIRED'` to `DOMAIN_ERROR_CODES`.
- `packages/core/src/ports/repos.ts`: add `recordConsent(userId: UserId, consent: Consent, updatedAt: string): Promise<User>` with JSDoc: it writes only `consent` and `updatedAt`, throws NOT_FOUND for an unknown user and VALIDATION for a non-ULID id or a malformed consent. Update the `users/{userId}` doc-shape comment to include `consent: { version, acceptedAt } | null` (added in T013a, missing key reads as null).
- `packages/core/src/usecases/accept-consent.ts` (new) + `.test.ts`: tests 3–7.
- `packages/core/src/usecases/get-or-create-user.ts`: create with `consent: null`. `get-or-create-user.test.ts`: test 8.
- `packages/core/src/usecases/update-profile.test.ts`: fixtures gain `consent: null` (typecheck).
- `packages/core/src/index.ts`: export `./users/consent` and `./usecases/accept-consent`.

Testkit
- `packages/testkit/src/in-memory-user-repo.ts`: implement `recordConsent`. Because `consent` is now a nested object, every returned and stored user must copy `consent` too (`consent: u.consent && { ...u.consent }`). Add a private `#copy(user)` helper and use it in every method. Update the "shallow copy is a full copy" comment.
- `packages/testkit/src/contracts/user-repo.contract.ts`: `userDoc()` gains `consent: null`. Add a `describe('recordConsent')` block with tests 10–15.
- `packages/testkit/src/in-memory-user-repo.test.ts`: fix fixtures only if typecheck needs it.

Firestore adapter
- `apps/api/src/adapters/firebase/user-repo.ts`:
  - `UserDoc` gains `consent: z.strictObject({ version: z.string().min(1).max(32), acceptedAt: isoString }).nullable().default(null)`. Update the comment above `UserDoc` to say `consent` arrived in T013a the same way.
  - `toUserDoc` copies `consent` by name (`consent: u.consent && { version: u.consent.version, acceptedAt: u.consent.acceptedAt }`), so no extra key can reach the doc.
  - `recordConsent`: `asUserId(id)`, then `isValidConsent` or VALIDATION, then a transaction that reads the doc (missing → `NOT_FOUND`) and runs `tx.update(ref, { consent: { version, acceptedAt }, updatedAt })`. It returns `toUserDoc({ ...current, consent, updatedAt })`.
- `apps/api/src/adapters/firebase/user-repo.contract.test.ts`: tests 16–18. Add `consent: null` to the inline `createWithIdentity` user fixture, and to the expected value in the legacy read test.

API
- `apps/api/src/errors.ts`: `statusForCode.CONSENT_REQUIRED = 403` and `publicMessage.CONSENT_REQUIRED = 'Consent required'`.
- `apps/api/src/app-env.ts`: `RequestUser` gains `consentVersion: string | null`.
- `apps/api/src/middleware/require-user.ts`: set `consentVersion: user.consent?.version ?? null`, and nothing else from `consent`. `require-user.test.ts`: test 20.
- `apps/api/src/middleware/require-consent.ts` (new): `requireConsent(): MiddlewareHandler<AppEnv>`. It throws `DomainError('CONSENT_REQUIRED', { reason: 'consent-missing' | 'consent-outdated' })` unless `c.var.user.consentVersion === CURRENT_CONSENT_VERSION`. JSDoc: "Runs after `requireUser()`. Every route from T020 onward uses `requireUser(), requireConsent()`." `require-consent.test.ts` (new): test 19, using an echo app like `require-user.test.ts`.
- `apps/api/src/routes/me.ts`:
  - Add one module-local `meBody(u: { id; displayName; locale; timezone; consentVersion })` that builds and `MeResponse.parse`s the body from named fields:
    `consent: { currentVersion: CURRENT_CONSENT_VERSION, acceptedVersion: consentVersion, required: consentVersion !== CURRENT_CONSENT_VERSION }`. GET passes `c.var.user`. PATCH and POST map a `User` with `consentVersion: user.consent?.version ?? null`. Never spread a user.
  - `GET /v1/me`: `requireUser()` only.
  - `PATCH /v1/me`: `bodyLimit(…), requireUser(), requireConsent()`, then the existing handler. So an oversized body is 400 before auth, and consent is checked before the body is parsed.
  - `POST /v1/me/consent`: `bodyLimit(…)` (same `MAX_BODY_BYTES` and `onError`; pull the bodyLimit into one local `limitBody()` so both routes share it), `requireUser()`, then `parseJsonBody(c, AcceptConsentRequest)` and `acceptConsent(c.var.deps, { userId: c.var.user.id, version })`. Return `meBody(…)` with status 200.
- `apps/api/src/routes/me.test.ts`: tests 22–35. Add a `postConsent(authorization, body, raw?)` helper. `signedIn(deps, overrides, { consent = true } = {})` accepts consent through `POST /v1/me/consent` by default and returns `stored` after that. Tests 22, 25 and 26 pass `{ consent: false }`. Update existing `toEqual` bodies to include the consent block. `LeakyUserRepo` overrides `recordConsent`.

Contracts
- `packages/contracts/src/me.ts`:
  - `AcceptConsentRequest = z.strictObject({ version: z.string().min(1).max(32) })` and its type.
  - `MeConsent = z.strictObject({ currentVersion: z.string(), acceptedVersion: z.string().nullable(), required: z.boolean() })`.
  - `MeResponse` gains `consent: MeConsent`. Update its JSDoc to name `POST /v1/me/consent` too.
- `packages/contracts/src/index.ts`: only if it lists exports by name; otherwise no change.
- `packages/contracts/src/me.test.ts`: the `me()` fixture gains `consent: { currentVersion: '2026-11-01', acceptedVersion: null, required: true }`, plus tests 36, 37.

Web (minimum to keep CI green, nothing visible)
- `apps/web/src/features/auth/timezone-default.ts`: the parameter becomes `Pick<MeResponse, 'timezone' | 'consent'>`, and the function returns `null` while `me.consent.required` is true. `timezone-default.test.ts`: test 38, with existing cases passing a consent block.
- `apps/web/src/api/client.test.ts`: `me()` fixture gains the consent block, plus test 39.
- `apps/web/e2e/helpers/sign-in.ts`: add `acceptConsentViaApi(page, meResponse)`. It reads the `authorization` header from `meResponse.request().headers()` and `consent.currentVersion` from the body, runs `page.request.post('/v1/me/consent', { headers: { authorization }, data: { version } })`, expects 200, and then calls `page.reload()` and waits for the next `GET /v1/me`. It never logs the header or the token. Its JSDoc says T013b replaces it with the consent screen.
- `apps/web/e2e/profile.spec.ts`: the first two tests call `acceptConsentViaApi` after `signInWithEmulator`. In the timezone test, start waiting for the PATCH after the helper returns (no PATCH fires before consent). It still checks exactly one PATCH.

Nothing in `firebase/firestore.rules`, `firestore.indexes.json`, BOARD.md or the epic files. (`firebase/rules.test.ts` seeds may add `consent: null` but do not need to.)

## Contracts and data shapes

```ts
// packages/contracts/src/me.ts
export const AcceptConsentRequest = z.strictObject({ version: z.string().min(1).max(32) });
export type AcceptConsentRequest = z.infer<typeof AcceptConsentRequest>;

export const MeConsent = z.strictObject({
  currentVersion: z.string(),
  acceptedVersion: z.string().nullable(),
  required: z.boolean(),
});

export const MeResponse = z.strictObject({
  userId: Ulid,
  displayName: DisplayName.nullable(),
  locale: Locale.nullable(),
  timezone: /* unchanged */,
  consent: MeConsent,
});
```

```ts
// packages/core/src/users/consent.ts
export const CURRENT_CONSENT_VERSION = '2026-11-01';
export interface Consent { version: string; acceptedAt: string } // acceptedAt: UTC ISO from Clock
export function hasCurrentConsent(user: Pick<User, 'consent'>): boolean;

// packages/core/src/usecases/accept-consent.ts
export async function acceptConsent(
  deps: { clock: Clock; users: UserRepo },
  input: { userId: UserId; version: string },
): Promise<User>;
// 1. asUserId(input.userId)                       → VALIDATION
// 2. version !== CURRENT_CONSENT_VERSION          → CONFLICT { reason: 'outdated-consent-version' }
// 3. users.getById → null                         → NOT_FOUND { reason: 'user-not-found' }
// 4. user.consent?.version === CURRENT            → return user (no write)
// 5. users.recordConsent(id, { version, acceptedAt: now }, now) with now = toIso(clock.now())
```

Firestore `users/{userId}` (global collection, no `tenantId`, as documented in `repos.ts`):
```
{ id, displayName, locale, timezone,
  consent: { version: string, acceptedAt: ISO } | null,   // T013a; a missing key reads as null
  createdAt, updatedAt, schemaVersion: 1 }
```

`RequestUser`: `{ id, displayName, locale, timezone, consentVersion: string | null }`.

Error codes → HTTP:
| Code | Status | Message | When |
| --- | --- | --- | --- |
| `CONSENT_REQUIRED` (new) | 403 | `Consent required` | `requireConsent()` with missing or outdated consent |
| `CONFLICT` | 409 | `Conflict` | `POST /v1/me/consent` with a well-formed but non-current version |
| `VALIDATION` | 400 | `Invalid request` | bad JSON, schema failure, extra key, body > 4 KB |
| `UNAUTHENTICATED` | 401 | `Authentication required` | missing or rejected token |

Middleware order:
- `GET /v1/me`: `requireUser()`
- `PATCH /v1/me`: `bodyLimit` → `requireUser()` → `requireConsent()` → parse
- `POST /v1/me/consent`: `bodyLimit` → `requireUser()` → parse

## Hard rules that apply here

- **Rule 1 (core is vendor-free).** `consent.ts` and `accept-consent.ts` import only core modules. `isValidConsent` uses core's `instantFromIso`, not zod-from-firebase or `Date`.
- **Rule 5 (time from Clock).** `acceptedAt` and `updatedAt` come from `toIso(deps.clock.now())`. The client can never send `acceptedAt`: the request is strict, and test 29 checks that.
- **Rule 6 (never trust the client).** `userId` comes only from the verified token. The client's `version` is only compared to the server constant and never stored unless it equals it. `required` is computed on the server.
- **Rule 4 (tenant isolation).** `users` is a global collection by design (see `repos.ts`), so no `tenantId` applies. Cross-user isolation is covered by tests 10 and 32.
- **Rule 8 / PII.** `MeResponse` stays strict and is built from named fields. `acceptedAt` and provider data never leave the API (test 33). Error `details` carry a reason only, never the submitted version or body.
- **Rule 3 (no client writes).** No rules change. Consent is written only through the API.
- **Data compatibility.** `schemaVersion` stays 1. The missing key defaults to `null` in `UserDoc`, the same way T011 did it. Additive only, so no migration script.
- **CI must stay green (Definition of Done).** CI runs Playwright on every PR that touches `apps/`. Once `PATCH /v1/me` requires consent, today's browser-timezone default (a PATCH right after the first `GET /v1/me`) and the profile save in `profile.spec.ts` would get 403. That is why this task includes the one-line `timezoneDefault` guard (moved forward from T013b's scope) and an API-only e2e helper that accepts consent. Neither adds UI, strings or a backdoor: the helper calls the real public endpoint with the signed-in user's own token.

## Out of scope

- Any consent screen, `ConsentGate`, `/privacy` page, i18n strings, `useSession().acceptConsent()`, `apiClient.acceptConsent` or widening the client's `request()` to POST. All of that is T013b. The e2e helper uses `page.request` directly, not the web client.
- Running the timezone default after consent is accepted (T013b). This task only stops it while consent is required.
- `DELETE /v1/me` and `requireIdentity()` (T013c).
- Withdrawing consent, a consent history or audit log, multiple consent purposes, or a configurable version (env or Firestore). The version is a code constant.
- Making `acceptConsent` atomic against two concurrent first accepts. The last write wins by milliseconds, which is fine. Do not add a transactional "set if absent" repo method.
- Rate limiting `POST /v1/me/consent` (no `rateLimit` middleware exists yet).
- Bumping `USER_SCHEMA_VERSION`, migration scripts, or backfilling `consent: null` on existing docs.
- Applying `requireConsent()` to `GET /v1/me`, `/v1/health` or any route other than `PATCH /v1/me`.
- Returning `acceptedAt` or any timestamp in `MeResponse`.
