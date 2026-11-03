# Spec — T011 Edit my profile: display name, locale, timezone

Size check: one slice, no new port (one new method on the existing `UserRepo`), one new page (`/profile`) plus a small layout/session refactor the T010c notes asked for. Fits in a day, so no SPLIT.

## Acceptance tests

Task criterion A — "Names in Amharic (ሀሰን), Arabic (حسن), Swedish (Åsa) accepted; empty, emoji-only, >32 chars rejected":

1. `normaliseProfileName` accepts `ሀሰን`, `حسن`, `Åsa`, `Åsa` written decomposed (`A\u030Asa`, returned NFC as `Åsa`), Arabic with harakat (`حَسَن`), `Anna Lena`, `  Åsa  ` (trimmed), `Anna   Lena` (inner whitespace collapsed to one U+0020), exactly 32 Ge'ez code points. It rejects (returns null) `''`, `'   '`, `'A'`, `'😀'`, `'😀😀😀'`, `'Åsa 😀'`, 33 code points, `'Åsa1'`, `'<b>'`, `'a\u0000b'`, `'\u200Dab'`, a mark-only string (`'\u0301\u0301'`) — core — `packages/core/src/users/profile.test.ts`
2. `UpdateMeRequest` accepts and rejects the same table as test 1, and on success its parsed `displayName` equals the core result (NFC, trimmed, collapsed) — core-free contract — `packages/contracts/src/me.test.ts`
3. Parity: the shared case table (exported once from `packages/testkit/src/profile-cases.ts`) gives the same accept/reject and the same normalised output through core `normaliseProfileName` and contracts `UpdateMeRequest`; core `SUPPORTED_LOCALES` equals contracts `SUPPORTED_LOCALES` — api — `apps/api/src/profile-parity.test.ts`
4. `PATCH /v1/me` with `{ displayName: 'ሀሰን' }`, `{ displayName: 'حسن' }`, `{ displayName: 'Åsa' }` each returns 200, a `MeResponse` with that name, and a later `GET /v1/me` returns it — api — `apps/api/src/routes/me.test.ts`
5. `PATCH /v1/me` with `displayName` `''`, `'😀😀'`, 33 code points returns 400 `ErrorResponse` code `VALIDATION`, and the stored user is unchanged (`updatedAt` too) — api — `apps/api/src/routes/me.test.ts`

Task criterion B — "Invalid timezone and unsupported locale rejected with 400":

6. `isProfileTimeZone` / `canonicalTimeZone`: accepts `Europe/Stockholm`, `Africa/Addis_Ababa`, `Asia/Riyadh`, `America/Argentina/Buenos_Aires`, `Etc/GMT+3`, `UTC`; `europe/stockholm` canonicalises to `Europe/Stockholm`. Rejects `''`, `Mars/Olympus`, `+01:00`, `Europe/Stockholm ` (trailing space), `../etc`, a 65-char string, a non-string — core — `packages/core/src/users/profile.test.ts`
7. `UpdateMeRequest` rejects the same invalid timezones, rejects locales `'fr'`, `'EN'`, `'en-US'`, `''`, `null`, and accepts each of `en`, `sv`, `ar`, `am`, `so` — contract — `packages/contracts/src/me.test.ts`
8. `PATCH /v1/me` with `{ timezone: 'Mars/Olympus' }`, `{ timezone: '+01:00' }`, `{ locale: 'fr' }` returns 400 `VALIDATION`; nothing is written — api — `apps/api/src/routes/me.test.ts`
9. `PATCH /v1/me` with `{ locale: 'am', timezone: 'Africa/Addis_Ababa' }` returns 200 with both fields; `{ timezone: 'europe/stockholm' }` stores and returns `Europe/Stockholm` — api — `apps/api/src/routes/me.test.ts`

Task criterion C — "e2e: change name → shown in header":

10. Sign in on the Auth emulator → click the header "Profile" link → change the name to `ሀሰን` → Save → the header `auth-name` shows `ሀሰን` without reload; after `page.reload()` it still shows `ሀሰን` (persisted) — e2e — `apps/web/e2e/profile.spec.ts`

Scope item — "timezone defaulted from browser on first sign-in":

11. With Playwright `timezoneId: 'Africa/Addis_Ababa'`, a fresh sign-in triggers one `PATCH /v1/me` with body `{ "timezone": "Africa/Addis_Ababa" }`, and the profile page shows that timezone selected — e2e — `apps/web/e2e/profile.spec.ts`
12. The default logic (`timezoneDefault(me, browserTz)`) returns `{ timezone }` only when `me.timezone === null` and `browserTz` passes `UpdateMeRequest`; returns null when the user already has a timezone, when the browser zone is missing/undefined, or when it is invalid — web unit — `apps/web/src/features/auth/timezone-default.test.ts`

Use case, repository and route hardening:

13. `updateProfile` writes only the given fields, sets `updatedAt` from `FakeClock` (after `clock.advance`), keeps `id`, `createdAt`, `schemaVersion` and the untouched fields; throws `VALIDATION` for an empty patch, an invalid name, locale or timezone (even when called directly, without the contract); throws `NOT_FOUND` for an unknown userId — core — `packages/core/src/usecases/update-profile.test.ts`
14. After `updateProfile` sets a name, a later `getOrCreateUser` for the same identity with a different token `name` returns the edited name (sign-in never overwrites the profile) — core — `packages/core/src/usecases/update-profile.test.ts`
15. `getOrCreateUser` creates new users with `locale: null` and `timezone: null` — core — `packages/core/src/usecases/get-or-create-user.test.ts`
16. `UserRepo.updateProfile` contract: updates only the patched fields + `updatedAt`, returns the stored user, `getById` sees it, counts unchanged, `NOT_FOUND` for an unknown ULID, `VALIDATION` for a non-ULID id, returned object is a copy — adapter (fake + emulator) — `packages/testkit/src/contracts/user-repo.contract.ts` (run by `packages/testkit/src/in-memory-user-repo.test.ts` and `apps/api/src/adapters/firebase/user-repo.contract.test.ts`)
17. Firestore adapter reads a `users` doc written before T011 (no `locale`/`timezone` keys) as `locale: null, timezone: null`, and `updateProfile` on it succeeds — adapter (emulator only) — `apps/api/src/adapters/firebase/user-repo.contract.test.ts`
18. `PATCH /v1/me` returns 401 `UNAUTHENTICATED` with no header, a non-Bearer scheme, and a token the fake rejects; no user is created or changed — api — `apps/api/src/routes/me.test.ts`
19. `PATCH /v1/me` returns 400 `VALIDATION` for: a non-JSON body, a JSON array, `{}` (empty patch), an unknown key (`{ userId: '…' }`, `{ displayName: 'Åsa', role: 'admin' }`), `displayName: null`, a body over 4 KB — api — `apps/api/src/routes/me.test.ts`
20. User A's token can only change user A: after A patches, user B's stored doc is byte-for-byte unchanged (the route uses `c.var.user.id`, never a body id). No tenant applies: `/v1/me` is not tenant-scoped and `users` is global, so there is no wrong-tenant case — api — `apps/api/src/routes/me.test.ts`
21. `GET /v1/me` and `PATCH /v1/me` bodies have exactly the keys `userId, displayName, locale, timezone` even with `LeakyUserRepo` (extend it to also leak from `updateProfile`); neither contains the sentinel subject or email (update the existing "exactly userId and displayName" test) — api — `apps/api/src/routes/me.test.ts`
22. `apiClient.updateMe` sends `PATCH /v1/me` with `authorization: Bearer <token>`, `content-type: application/json`, the JSON body; parses `MeResponse`; throws `ApiError` with `status: 400` on a 400 and on a contract-breaking body — web unit — `apps/web/src/api/client.test.ts`
23. `ProfileFormView` (rendered with `renderToStaticMarkup`): labelled inputs for name (`dir="auto"`), locale `<select>` with the five endonyms each carrying its `lang` attribute, timezone `<select>`; states `loading` (`role="status" aria-busy`), `signed-out` (prompt, no form), `saving` (submit disabled), `saved` (`role="status"`), `invalid-name` / `error` (`role="alert"`); no raw `profile.*` key rendered — web unit — `apps/web/src/features/profile/ProfileFormView.test.tsx`
24. `MeResponse` now requires `locale` (supported list or null) and `timezone` (valid zone or null), stays strict — contract — `packages/contracts/src/me.test.ts`
25. Existing `apps/web/e2e/sign-in.spec.ts` and `AuthButtonView.test.tsx` still pass after the header moves into the layout — e2e / web unit — existing files

## Files and modules to touch

Contracts
- `packages/contracts/src/me.ts` — add `SUPPORTED_LOCALES`, `Locale`, `TimeZoneName`, `ProfileDisplayName`, `UpdateMeRequest`; extend `MeResponse` with `locale` and `timezone`.
- `packages/contracts/src/me.test.ts` — tests 2, 7, 24; update existing cases for the two new required keys.

Core
- `packages/core/src/users/profile.ts` (+ `profile.test.ts`) — `SUPPORTED_LOCALES`, `type Locale`, `isSupportedLocale`, `normaliseProfileName(s): string | null`, `canonicalTimeZone(s): string | null` (uses existing `isValidTimeZone` from `time/zoned.ts` plus the name pattern; returns `resolvedOptions().timeZone`), `type ProfilePatch`.
- `packages/core/src/users/user.ts` — `User` gains `locale: Locale | null` and `timezone: TimeZone | null`. Keep `USER_SCHEMA_VERSION = 1` (additive, nullable; readers default missing keys to null).
- `packages/core/src/usecases/update-profile.ts` (+ `.test.ts`) — `updateProfile(deps: { clock; users }, input: { userId: UserId } & ProfilePatch): Promise<User>`.
- `packages/core/src/usecases/get-or-create-user.ts` (+ test) — create with `locale: null, timezone: null`; fix the doc comment ("profile sync is T011" → sign-in never overwrites the profile).
- `packages/core/src/ports/repos.ts` — add `updateProfile` to `UserRepo`; update the doc-shape JSDoc.
- `packages/core/src/index.ts` — export `users/profile` and `usecases/update-profile`.

Testkit
- `packages/testkit/src/in-memory-user-repo.ts` — implement `updateProfile`.
- `packages/testkit/src/contracts/user-repo.contract.ts` — test 16; update `userDoc()` fixture with the new fields.
- `packages/testkit/src/profile-cases.ts` (+ export from `index.ts`) — the shared name/timezone/locale accept/reject table used by tests 1, 2 (copy is acceptable in contracts if it cannot depend on testkit), 3, 6, 7.

API
- `apps/api/src/adapters/firebase/user-repo.ts` — `UserDoc` gains `locale: z.enum(SUPPORTED_LOCALES).nullable().default(null)` and `timezone: z.string().nullable().default(null)`; `toUserDoc` writes both; `updateProfile` in `runTransaction` (read → `NOT_FOUND` if missing → `tx.update` with only the patch keys + `updatedAt` → return merged `toUserDoc`).
- `apps/api/src/adapters/firebase/user-repo.contract.test.ts` — test 17.
- `apps/api/src/app-env.ts` — `RequestUser` gains `locale`, `timezone`.
- `apps/api/src/middleware/require-user.ts` — set the two new fields (named fields, no spread).
- `apps/api/src/http/parse-json-body.ts` (+ test) — `parseJsonBody(c, schema)`: reads JSON, `safeParse`s, throws `DomainError('VALIDATION', { reason })` for bad JSON or schema failure; never puts body values in `details`. No `@hono/zod-validator` (not installed; avoid a new dependency).
- `apps/api/src/routes/me.ts` — add `PATCH /v1/me`: `bodyLimit({ maxSize: 4096, onError: → throw VALIDATION })` from `hono/body-limit` (built in), `requireUser()`, `parseJsonBody(c, UpdateMeRequest)`, `updateProfile(c.var.deps, { userId: c.var.user.id, ...body })`, respond `MeResponse.parse({ userId, displayName, locale, timezone })` built from named fields. GET builds the same four named fields.
- `apps/api/src/routes/me.test.ts` — tests 4, 5, 8, 9, 18–21; the existing "POST /v1/me returns 404" test must still pass.
- `apps/api/src/profile-parity.test.ts` — test 3.

Firebase
- `firebase/rules.test.ts` — users seed gains `locale: null, timezone: null`. Rules unchanged (all client reads/writes stay denied).

Web
- `apps/web/src/api/client.ts` (+ test) — generalise `getJson` into a `request(method, path, schema, init)`; add `updateMe({ idToken, body: UpdateMeRequest input, signal })`.
- `apps/web/src/i18n/locales.ts` — `LOCALES: { code, nativeName, dir }[]` for `en` English, `sv` Svenska, `ar` العربية (rtl), `am` አማርኛ, `so` Soomaali; codes typed from contracts `SUPPORTED_LOCALES`. Endonyms are data, not translated strings.
- `apps/web/src/features/auth/session-context.tsx` — `SessionProvider` + `useSession()`: moves the `/v1/me` loading logic out of `AuthButton` (same generation/abort handling), exposes `{ state, signIn, signOut, updateMe(patch) }`. `updateMe` gets a fresh token, calls `apiClient.updateMe`, and on success replaces the `me` in state so the header updates without reload. After the first successful `getMe`, applies `timezoneDefault` once (fire-and-forget; failure is silent and leaves state as is).
- `apps/web/src/features/auth/timezone-default.ts` (+ test) — pure `timezoneDefault(me, browserTz)`; browser zone read by the caller via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `apps/web/src/features/auth/AuthButton.tsx` — becomes a consumer of `useSession()`; `AuthButtonView` and its tests unchanged.
- `apps/web/src/features/layout/AppLayout.tsx` — `SessionProvider`, `<header className="site-header">` with a nav (`Home`, and `Profile` when signed in, via React Router `Link`) and `AuthButton`, then `<Outlet />`.
- `apps/web/src/features/home/HomePage.tsx` — drop its own header (now in the layout).
- `apps/web/src/router.tsx` — layout route with children `/` (HomePage) and `/profile` (ProfilePage).
- `apps/web/src/features/profile/ProfilePage.tsx` — container: reads `useSession()`, holds form values, client-validates with `UpdateMeRequest.safeParse` before sending, sends only changed fields, maps errors to view states.
- `apps/web/src/features/profile/ProfileFormView.tsx` (+ test) — pure view (test 23). Timezone options from `Intl.supportedValuesOf('timeZone')`, always including the current value; locale select has a "not set" option when `locale` is null.
- `apps/web/src/i18n/en.json` — `nav.home`, `nav.profile`, `profile.title`, `profile.displayName`, `profile.displayNameHint` (letters and spaces, 2–32), `profile.locale`, `profile.localeUnset`, `profile.timezone`, `profile.save`, `profile.saving`, `profile.saved`, `profile.loading`, `profile.signedOut`, `profile.error.displayName`, `profile.error.generic`.
- `apps/web/src/styles.css` — `.site-nav`, `.profile-form` and field styles with logical properties and existing CSS variables only; header layout becomes `justify-content: space-between`.
- `apps/web/e2e/helpers/sign-in.ts` — extract the emulator sign-in steps from `sign-in.spec.ts` (keep the CDN route blocking); `sign-in.spec.ts` uses it.
- `apps/web/e2e/profile.spec.ts` — tests 10 and 11.

Docs
- `docs/tasks/E01-identity-privacy.md` T011 Notes — for T013/T061/T080: `users` now carries `locale`/`timezone` (nullable), `useSession()` is the shared session, the profile saves `locale` but UI language switching is T080.

## Contracts and data shapes

```ts
// packages/contracts/src/me.ts (mirrors core users/profile.ts; contracts does not import core)
export const SUPPORTED_LOCALES = ['en', 'sv', 'ar', 'am', 'so'] as const;
export const Locale = z.enum(SUPPORTED_LOCALES);

const TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/; // max 64 chars
// Valid when it matches TZ_PATTERN and `new Intl.DateTimeFormat('en-US', { timeZone })` does not throw.
// Transforms to resolvedOptions().timeZone (canonical casing). Rejects offsets like '+01:00'.
export const TimeZoneName = z.string().max(64).refine(isIanaName).transform(canonical);

// NFC → trim → collapse /\s+/ to ' ' → must match
//   /^\p{L}[\p{L}\p{M}]*(?: \p{L}[\p{L}\p{M}]*)*$/u  and be 2–32 code points.
// Rejects (does not truncate or strip) emoji, digits, punctuation, controls, ZWJ.
export const ProfileDisplayName = z.string().transform(normalise).pipe(/* refine as above */);

export const UpdateMeRequest = z
  .strictObject({
    displayName: ProfileDisplayName.optional(),
    locale: Locale.optional(),
    timezone: TimeZoneName.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'empty patch');
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;       // parsed (normalised)
export type UpdateMeRequestInput = z.input<typeof UpdateMeRequest>;  // what the client sends

export const MeResponse = z.strictObject({
  userId: Ulid,
  displayName: DisplayName.nullable(),   // unchanged lax rule: Google names stored by T010 may hold emoji
  locale: Locale.nullable(),
  timezone: z.string().max(64).nullable(),
});
```

```ts
// packages/core
export type ProfilePatch = { displayName?: string; locale?: Locale; timezone?: TimeZone };

interface UserRepo {
  // ...existing
  /**
   * Applies only the keys present in `patch` plus `updatedAt`, returns the stored user.
   * Throws NOT_FOUND for an unknown user, VALIDATION for a non-ULID id.
   */
  updateProfile(userId: UserId, patch: ProfilePatch, updatedAt: string): Promise<User>;
}

// updateProfile use case: re-validates every field with normaliseProfileName /
// isSupportedLocale / canonicalTimeZone (VALIDATION on failure, details carry only a
// reason, never the value), rejects an empty patch, updatedAt = toIso(clock.now()).
```

Firestore doc `users/{userId}` (global, no `tenantId` — see `UserRepo` JSDoc):
`{ id, displayName: string | null, locale: 'en'|'sv'|'ar'|'am'|'so' | null, timezone: string | null, createdAt, updatedAt, schemaVersion: 1 }`. Docs without `locale`/`timezone` read as null.

HTTP:

| Request | Result |
| --- | --- |
| `PATCH /v1/me` valid body | 200 `MeResponse` |
| bad JSON, schema failure, empty patch, unknown key, body > 4 KB | 400 `VALIDATION` |
| missing / invalid token | 401 `UNAUTHENTICATED` |
| user vanished between auth and update | 404 `NOT_FOUND` (already mapped) |

No new `DomainErrorCode`; `errors.ts` unchanged.

## Hard rules that apply here

- Rule 1 (core is vendor-free): name, locale and timezone rules use only `Intl`, regex and zod-free TypeScript in core; `hono/body-limit` stays in `apps/api`.
- Rule 2 (ports): no new port; `UserRepo.updateProfile` is added to the port, the in-memory fake and the Firestore adapter, with the shared contract run against both.
- Rule 3 (browser never writes Firestore): the profile page only calls `PATCH /v1/me`; rules stay deny-all and `rules.test.ts` keeps proving it.
- Rule 4 (tenant isolation): `users` is global by design (documented in `repos.ts`); the route takes the user id from `c.var.user.id` only, and test 20 proves one user cannot change another.
- Rule 5 (Clock): `updatedAt` comes from `deps.clock`; no `Date.now()` in core or the route. The web reads the browser zone with `Intl`, not time.
- Rule 6 (never trust the client): the body is a strict object, so `userId`, `role`, `tenantId`, `updatedAt` are rejected, not ignored; core re-validates every field.
- Rule 8 (own IDs): responses carry our ULID only; the leak tests extend to PATCH.
- Rule 9 (secrets / PII in logs): validation `details` hold a reason, never the name or timezone; nothing logs the body or token.
- Conventions: user-facing strings via `t()`; logical CSS only; name input and name display use `dir="auto"`; display names accept Unicode letters per AGENT.md.

## Out of scope

- Switching the UI language, setting `<html lang/dir>`, `useI18n()`, translated JSON files, the Arabic RTL Playwright check — T080/T081. The profile only stores `locale`.
- Defaulting `locale` from the browser (only timezone is defaulted).
- Re-validating or migrating names already stored from Google tokens; `MeResponse.displayName` keeps the T010 rule.
- Allowing hyphens, apostrophes or digits in names, or clearing a name (`displayName: null`).
- A rate-limit middleware (none exists yet; adding one needs its own store/port) — leave a note for a follow-up task.
- Consent, account deletion, avatars, email changes — T013 and later.
- Any membership, tenant or community profile fields (per-community nicknames).
- A global state library or new web/API dependency (`@hono/zod-validator`, a timezone picker package).
- Bumping `USER_SCHEMA_VERSION` or writing a backfill job.
