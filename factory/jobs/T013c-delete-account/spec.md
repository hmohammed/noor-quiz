# Spec — T013c Delete my account

Base: `main` with T013a merged. T013b (consent screen) is **not** on main and is not a dependency. Every web and e2e step below must pass on current main: consent is accepted in e2e through the existing `acceptConsentViaApi` helper, and "consent required again" is asserted on the `GET /v1/me` response body, not on a consent screen.

Size check: one new repo method (no new port), one use case, one middleware, one route, one section on an existing page, one e2e file. About a day. No split.

## Acceptance tests

### Repository — `packages/testkit/src/contracts/user-repo.contract.ts` (`describe('deleteUserAndIdentities')`, runs against `InMemoryUserRepo` in testkit and `FirestoreUserRepo` on the emulator)
1. Seed user A (with identity `uid-alice`) and user B (identity `uid-bob`). Give A a second identity doc whose `userId` is A (for example `identityDoc('alice2', ULID_A)`). `deleteUserAndIdentities(ULID_A)` resolves. Then `getById(ULID_A)` is null, `getByIdentity` for `uid-alice` and `alice2` is null, `counts()` is `{ users: 1, identities: 1 }`, and `getById(ULID_B)` and `getByIdentity(uid-bob)` still equal B's seeded docs. Layer: adapter.
2. A user who has set a profile and accepted consent (via `updateProfile` and `recordConsent`) is deleted just as fully. Then `getOrCreateUser` for the same subject creates a **new** user: a different ULID, `consent: null`, `locale: null`, `timezone: null`, and the token name as `displayName`. `counts()` is `{ users: 1, identities: 1 }`. Layer: adapter.
3. `deleteUserAndIdentities` on an unknown, valid ULID resolves with no error and writes nothing: the counts and B's docs are unchanged. It also resolves on an empty store. Layer: adapter.
4. Calling it twice in a row for the same id resolves both times, and the second call changes nothing. Layer: adapter.
5. A non-ULID id (`'uid-alice'`, `''`) rejects with `VALIDATION` and writes nothing. Layer: adapter.

### Repository, emulator only — `apps/api/src/adapters/firebase/user-repo.contract.test.ts`
6. An orphan `identities` doc whose `userId` is A, with no `users/A` doc, is removed by `deleteUserAndIdentities(A)`. Layer: adapter.
7. A corrupt `identities` doc (for example `schemaVersion: 2`) whose `userId` is A is also removed, and so is a corrupt `users/A` doc. A doc that fails the read converter must never block deletion. Layer: adapter.
8. After the delete, the raw collections hold no doc whose id is A or whose `userId` field is A. Check this with an unconverted `where('userId', '==', A)` query. Layer: adapter.

### Core — `packages/core/src/usecases/delete-account.test.ts` (inline stand-ins as in `accept-consent.test.ts`; core cannot import testkit)
9. When `getByIdentity` returns a user, `deleteUserAndIdentities` is called exactly once with that user's id, and the result is `{ deleted: true }`. Layer: core.
10. When `getByIdentity` returns null, `deleteUserAndIdentities` is never called, and the result is `{ deleted: false }`. Layer: core.
11. Full flow with an inline in-memory stand-in repo: `getOrCreateUser`, then `acceptConsent`, then `updateProfile({ displayName: 'Åsa', locale: 'sv', timezone: 'Europe/Stockholm' })`, then `deleteAccount`, then `getOrCreateUser` with the same identity. The second user has a different id, `displayName` equal to the token name, `locale: null`, `timezone: null` and `consent: null`. Layer: core.
12. An unsafe subject (`'a/b'`) rejects with `UNAUTHENTICATED`, which comes from `getByIdentity` via `identityId`, and never reaches `deleteUserAndIdentities`. Layer: core.

### Middleware — `apps/api/src/middleware/require-user.test.ts` (new `describe('requireIdentity')`, using the same echo-app pattern on `/__test/identity`)
13. With a valid token, `c.var.identity` is exactly `{ provider: 'firebase', subject: 'uid-alice' }`, with no email, name or emailVerified. `deps.users.counts()` stays `{ users: 0, identities: 0 }`, so `getOrCreateUser` is never called. Layer: api.
14. A missing header, a `Basic` scheme or a token over 4096 chars returns 401 with `verifyCalls === 0`. A rejected token returns 401 with `verifyCalls === 1`. Both middlewares share one header parser: a parity `it.each` over the existing header cases runs both `requireUser()` and `requireIdentity()` and expects the same status and `verifyCalls`. Layer: api.

### Route — `apps/api/src/routes/me.test.ts` (new `describe('DELETE /v1/me')`)
15. Use `signedIn(deps)`, which accepts consent, then `PATCH /v1/me { displayName: 'Åsa', locale: 'sv', timezone: 'Europe/Stockholm' }`. `DELETE /v1/me` returns 204 with an empty body (`await res.text() === ''`). `deps.users.counts()` is `{ users: 0, identities: 0 }`, and `getById(oldId)` is null. Then `GET /v1/me` with the same token returns 200 with a `userId` different from the old one, `displayName: 'Alice'` (the token name), `locale: null`, `timezone: null`, and `consent` equal to `CONSENT_REQUIRED` (`required: true`). Layer: api.
16. Two `DELETE /v1/me` in a row both return 204. Before the second call the counts are `{ users: 0, identities: 0 }`, and after it they are still `{ users: 0, identities: 0 }`. A spy (subclass of `InMemoryUserRepo`) records zero `createWithIdentity` calls and zero `deleteUserAndIdentities` calls during the second request. Layer: api.
17. `DELETE` with no prior sign-in (a token issued but never used) returns 204 and creates nothing: counts `{ users: 0, identities: 0 }`, `createWithIdentity` never called. Layer: api.
18. It works without consent: `signedIn(deps, {}, { consent: false })`, then `DELETE` returns 204 and the user is gone. It also works for a user whose consent is on an older version. Layer: api.
19. Each of these returns 401 `UNAUTHENTICATED` and writes nothing, with the seeded user still present and counts `{ users: 1, identities: 1 }`: no Authorization header, a `Basic` scheme, an unknown token, a token the verifier rejects, and a verified subject `'a/b'`. A missing header must not call the verifier. Layer: api.
20. Each user's data stays separate: users A and B sign in, and A's `DELETE` removes only A. B's stored user is byte-identical (`JSON.stringify`), and B's `GET /v1/me` returns the same `userId` as before. This replaces the wrong-tenant test, because users are global. Layer: api.
21. A JSON body (for example `{ "userId": "<B's id>" }`) is ignored: the route still deletes only the caller, B is untouched, and the response is still 204. Layer: api.
22. The existing `it.each(['GET', 'DELETE'])('returns 404 for %s /v1/me/consent')` stays unchanged and green: only `/v1/me` gains DELETE, so `DELETE /v1/me/consent` is still 404. Layer: api.
23. The 204 and 401 bodies never contain the provider subject or email. Reuse `SENTINEL_SUBJECT` and `SENTINEL_EMAIL`. Layer: api.

### Web unit
24. `apps/web/src/api/client.test.ts`, `apiClient.deleteMe`: it sends `DELETE {baseUrl}/v1/me` with `authorization: Bearer <token>` and `accept: application/json`, no body and no content-type. A 204 with no body resolves `undefined`. 401 and 500 throw `ApiError` with that status. A rejected fetch throws `ApiError`. The abort signal is passed through. Layer: web unit.
25. `apps/web/src/features/profile/DeleteAccountView.test.tsx` (static markup, the same style as `ProfileFormView.test.tsx`):
    - `idle` has an `<h2>` with `profile.delete.title`, the intro text, and a `type="button"` start button.
    - `confirming` has the warning text and two `type="button"` buttons, confirm and cancel.
    - `deleting` has a disabled confirm button showing `profile.delete.deleting`, a disabled cancel button, and `aria-busy="true"`.
    - `error` has a `role="alert"` with `profile.delete.error`, and the confirm and cancel buttons are enabled again.
    - No state renders a raw `profile.delete.` key.
    - The section is not inside a `<form>`.
    
    Layer: web unit.

### E2E — `apps/web/e2e/delete-account.spec.ts`
26. Happy path:
    - Sign in with a fresh emulator account (`signInWithEmulator`, displayName `'Delete E2E'`, unique email), then `acceptConsentViaApi`.
    - Go to Profile, set the display name to `'ሀሰን'`, save, and wait for the PATCH with `displayName` to return 200. Record the old `userId` and the ID-token `sub` from the `GET /v1/me` request.
    - Click "Delete my account", then confirm, and wait for `DELETE /v1/me` to return 204.
    - The URL is `/`, and the banner shows "Sign in with Google".
    - Sign in again with the **same** emulator account through the new helper `signInAgainWithEmulator`. The new `GET /v1/me` body has a different `userId`, `consent.required === true` and `displayName === 'Delete E2E'`. The decoded `sub` claim of its bearer token equals the old one, which proves it is the same Firebase account. Decode it in the test and never print it.
    - `acceptConsentViaApi` again. On Profile, the display name field shows `'Delete E2E'`, not `'ሀሰን'`.
    
    Layer: e2e.
27. RTL layout: signed in on `/profile`, set `document.documentElement.dir = 'rtl'` with `page.evaluate`, then open the confirm step. The confirm and cancel buttons are visible, inside the viewport, and their bounding boxes do not overlap. Then press Cancel. Nothing is deleted: no `DELETE /v1/me` request was sent. Layer: e2e.

Every acceptance criterion in task.md is covered:
- "New userId and no old data": tests 1, 2, 6–8, 11, 15, 20 and 26.
- "Idempotent": tests 3, 4, 16 and 17.
- "401, and works without consent": tests 14, 18 and 19.

## Files and modules to touch

- `packages/core/src/ports/repos.ts`: add `deleteUserAndIdentities(userId: UserId): Promise<void>` to `UserRepo`, with JSDoc. It is atomic and deletes `users/{userId}` and every `identities` doc with `userId == userId`. An unknown user is a no-op. A non-ULID id throws `VALIDATION`. Extend the doc-shape comment to say there is no composite index (the query is a single-field equality).
- `packages/core/src/usecases/delete-account.ts` (+ `.test.ts`): `deleteAccount`. Export it from `packages/core/src/index.ts`.
- `packages/testkit/src/in-memory-user-repo.ts`: implement it. Validate with `asUserId` first, then delete synchronously with no `await` between the reads and the deletes, so it is atomic under `Promise.all`, matching `createWithIdentity`.
- `packages/testkit/src/contracts/user-repo.contract.ts`: add the `deleteUserAndIdentities` describe (tests 1–5).
- `apps/api/src/adapters/firebase/user-repo.ts`: implement it with `runTransaction`. In the transaction, read the unconverted user doc ref (`db.collection('users').doc(id)`) and the unconverted query `db.collection('identities').where('userId', '==', id)`, then `tx.delete` the user doc if it exists and every identity in the query snapshot. Use **unconverted** refs so a corrupt doc cannot throw `INTERNAL` and block deletion. Call `asUserId(id)` before building any ref.
- `apps/api/src/adapters/firebase/user-repo.contract.test.ts`: tests 6–8.
- `apps/api/src/middleware/require-user.ts`:
  - Extract one shared helper that parses the header and calls `deps.auth.verify`, for example `async function verifyBearer(c): Promise<VerifiedIdentity>`. It keeps today's `BEARER` regex, the 4096 limit, and the `bad-authorization-header` reason.
  - `requireUser()` uses the helper and otherwise behaves exactly as before. All existing tests stay green unchanged.
  - Add `requireIdentity()`, which sets `c.var.identity = { provider, subject }` (named fields only) and never calls `getOrCreateUser`.
- `apps/api/src/middleware/require-user.test.ts`: tests 13–14.
- `apps/api/src/app-env.ts`: add `identity: IdentityKey` to `Variables`. Update the comment to say it is set only after `requireIdentity()`.
- `apps/api/src/routes/me.ts`: `.delete('/v1/me', requireIdentity(), async (c) => { await deleteAccount(c.var.deps, { identity: c.var.identity }); return c.body(null, 204); })`. It has no `requireConsent`, no `limitBody` and no body parsing.
- `apps/api/src/routes/me.test.ts`: add a `deleteMe(authorization?)` helper to `setup()`, plus tests 15–23.
- `apps/web/src/api/client.ts`:
  - Add `deleteMe(init: { idToken: string; signal?: AbortSignal }): Promise<void>` to `ApiClient`.
  - Widen the method type to include `'DELETE'`.
  - Add a no-content path that checks `res.ok`, maps errors exactly as `request` does, and never reads the body. Share the fetch and error-mapping code rather than copying it.
- `apps/web/src/api/client.test.ts`: test 24.
- `apps/web/src/features/auth/session-context.tsx`: add `deleteAccount(): Promise<void>` to `Session`.
  1. Cancel any in-flight `/v1/me` load or timezone-default PATCH: bump `generation` and abort `pending`. Hoist the existing `cancelPending` so the callback can use it. This matters because a late `PATCH /v1/me` after the DELETE would run `requireUser()`, which would re-create the user.
  2. Get the ID token. If it is null, throw `ApiError('Not signed in', { status: 401 })`, as `updateMe` does.
  3. `await apiClient.deleteMe({ idToken })`. A failure rejects, and the state stays `signed-in`.
  4. `await sessionSignOut()`. If sign-out fails, set `{ kind: 'error', hasSession: true }` but still resolve, because the account is already deleted.
  5. Never call `getMe` after the delete. The `onChange(false)` from sign-out sets `signed-out`.
- `apps/web/src/features/profile/DeleteAccountView.tsx` (+ `.test.tsx`): a pure view.
  - `status: 'idle' | 'confirming' | 'deleting' | 'error'`, with `onStart`, `onConfirm` and `onCancel`.
  - A `<section aria-labelledby>` with an `<h2>`. All buttons are `type="button"`.
  - When it enters `confirming`, focus moves to the Cancel button (the safe default). In `deleting`, both buttons are disabled.
- `apps/web/src/features/profile/ProfilePage.tsx`:
  - `ProfileEditor` renders `<DeleteAccountView>` after the profile form, only in the signed-in form state, and outside the `<form>`.
  - It owns the delete status. On confirm it calls `session.deleteAccount()`, then `navigate('/', { replace: true })` from `react-router`'s `useNavigate`.
  - On rejection it sets `'error'`. A second confirm while `deleting` is ignored.
  - Pass `deleteAccount` in as a prop, as `updateMe` is passed today.
- `apps/web/src/styles.css`: `.profile-delete*` rules.
  - Use logical properties only: `margin-block-start`, `border-block-start`, `padding-block`, `gap`.
  - The actions row is `display: flex; flex-wrap: wrap; gap`, so the buttons never overlap in RTL or on narrow screens.
  - The confirm button uses `--color-error` as its background with white text. #a8322d on white text is about 6.5:1. It keeps the existing `:focus-visible` outline pattern.
- `apps/web/src/i18n/en.json`: keys `profile.delete.title`, `.intro`, `.start`, `.confirmPrompt`, `.confirm`, `.cancel`, `.deleting`, `.error`. The copy must be honest about what is removed:
  - The profile, language, timezone, privacy-consent record and sign-in link are removed.
  - "Your Google account itself is not deleted."
  - "This can't be undone."
  - It must not mention answers or memberships, which do not exist yet.
- `apps/web/e2e/helpers/sign-in.ts`: add `signInAgainWithEmulator(page, { email })`. It opens the popup from the banner button, as `signInWithEmulator` does, picks the **existing** account listed in the Auth emulator popup by its email instead of "Add new account", and resolves with the following `GET /v1/me` response. Keep the CDN-blocking route. Do not change the existing helpers' behaviour.
- `apps/web/e2e/delete-account.spec.ts`: tests 26–27.
- `firebase/firestore.indexes.json`: **no change**. The PR description must say the `identities where userId ==` query is a single-field equality, served by Firestore's automatic single-field index, so it needs no composite index.
- `firebase/firestore.rules`: **no change**. `users` and `identities` stay client-deny.
- `docs/tasks/BOARD.md`: set the T013c row to `done` in the PR, as the Definition of Done requires. The factory handles this; the builder must not touch other rows.

## Contracts and data shapes

No new zod request or response schema. `DELETE /v1/me` takes no body and returns `204 No Content` with an empty body. Errors use the existing `ErrorResponse`.

```ts
// packages/core/src/ports/repos.ts
interface UserRepo {
  // ...existing...
  /**
   * Atomic. Deletes `users/{userId}` and every `identities` doc whose `userId` equals it.
   * Unknown user: resolves, writes nothing. Non-ULID id: throws VALIDATION.
   * Query `identities where userId ==` is single-field equality: no composite index.
   */
  deleteUserAndIdentities(userId: UserId): Promise<void>;
}

// packages/core/src/usecases/delete-account.ts
/**
 * Deletes the signed-in person's account: their user doc and every linked identity, so
 * the next sign-in starts from scratch. Takes the verified identity, not a user id, so a
 * repeat call never creates a user first. Extended by T020 (delete memberships) and
 * T040 (anonymise answers: drop `userId`, keep scores).
 */
export async function deleteAccount(
  deps: { users: UserRepo },
  input: { identity: IdentityKey },
): Promise<{ deleted: boolean }>;

// apps/api/src/app-env.ts
interface AppEnv {
  Variables: { deps: Deps; user: RequestUser; identity: IdentityKey };
}

// apps/web/src/api/client.ts
deleteMe(init: { idToken: string; signal?: AbortSignal }): Promise<void>;

// apps/web/src/features/auth/session-context.tsx
interface Session { /* ... */ deleteAccount(): Promise<void>; }
```

Firestore docs (global collections with no `tenantId`, by design, as documented in `repos.ts`) are unchanged:
- `users/{ULID}`: deleted.
- `identities/{provider}_{subject}` where `userId == ULID`: all deleted, including orphans and corrupt docs.

Error codes to HTTP status (existing map, no change):

| Case | Code | Status |
| --- | --- | --- |
| Missing, malformed or rejected token, or an unsafe subject | `UNAUTHENTICATED` | 401 |
| Non-ULID id at the repo (unreachable from the route) | `VALIDATION` | 400 |
| Identity without a user from `getByIdentity` (should not occur once deletes are atomic) | `INTERNAL` | 500 |
| Success, whether or not a user existed | none | 204 |

## Hard rules that apply here

- **Rule 1 (core is vendor-free).** `delete-account.ts` imports only core modules. The Firestore transaction lives in the adapter.
- **Rule 2 (ports, adapters, fakes).** The new method goes on the existing `UserRepo` port. It is implemented in the in-memory fake and the Firestore adapter, and one shared contract suite runs against both. No route touches Firestore.
- **Rule 3 (the browser never writes to Firestore).** The web calls `DELETE /v1/me` only, and the rules do not change.
- **Rule 4 (tenant isolation).** `users` and `identities` are global and documented as such. Test 20 (user A cannot affect user B) and test 21 (a body cannot redirect the delete) cover isolation instead.
- **Rule 6 (never trust the client).** The user to delete comes only from the verified token's subject. No id is read from the body, path or query.
- **Rule 8 (our own IDs).** The repo deletes by our ULID. The Firebase uid is used only through `identityId()` validation.
- **Rule 9 (secrets and logs).** Nothing logs the Authorization header or token. The e2e decodes the token `sub` in memory and never prints it. The 204 and 401 bodies carry no subject or email (test 23).
- **Idempotency and no re-creation.** `requireIdentity()` never calls `getOrCreateUser`. The web client cancels in-flight `/v1/me` calls before deleting and never calls `getMe` afterwards.
- **i18n and RTL.** All new strings use `t('profile.delete.*')`, the CSS uses logical properties only, and test 27 checks the layout under `dir="rtl"`.

## Out of scope

- Revoking the Firebase Auth account or its refresh tokens, and any change to the `AuthVerifier` port. That is a follow-up; mention it in the PR.
- A consent screen or any consent UI (that is T013b). Do not read or depend on branch `factory/T013b-consent-screen-privacy`.
- Deleting or anonymising memberships, answers, streaks or leaderboard entries (T020 and T040). Name them only in the JSDoc.
- Rate limiting, re-authentication, or a "type DELETE to confirm" step.
- An export-my-data feature, a grace period or a soft delete.
- Translations other than `en.json`, and a runtime locale or `dir` switcher.
- New zod contracts for DELETE, a `{ deleted }` response body, and audit logs.
- Changes to `firestore.rules`, `firestore.indexes.json` or `.env.example`.
- Changes to the behaviour of `requireUser()`, `GET` or `PATCH /v1/me`, or `POST /v1/me/consent`. Only the refactor to share the header parser is allowed.
