# Spec — T031 Create a season for a community

One slice. An admin creates a season for their community and sees it listed with its state. Rules from T030 stay the source of truth. Membership from T020 stays the only role gate.

## Acceptance tests

1. Creating a season stores the submitted `startDate` and `lengthDays` when they differ from `nextRamadanSuggestion` at the same clock and timezone, and writes one document — core — `packages/core/src/usecases/create-season.test.ts`
2. `createSeason` calls `assertValidSeason` on the rules it is about to store; an invalid start date, length, timezone or local time throws `VALIDATION` and writes nothing — core — `packages/core/src/usecases/create-season.test.ts`
3. A season name is normalised with `normaliseCommunityName` (`Ramadan 1448` and a trimmed Arabic name succeed); a name that function rejects throws `VALIDATION` and writes nothing — core — `packages/core/src/usecases/create-season.test.ts`
4. `listSeasons` returns only that tenant's seasons, newest `createdAt` first (then `id`), each with `seasonState` from `clock.now()`; another tenant's seasons are absent; an empty tenant returns `[]` — core — `packages/core/src/usecases/list-seasons.test.ts`
5. Before day 1 opens, a patch can change `startDate` and `lengthDays`; `createdAt`, `createdBy`, `id`, `tenantId` and `schemaVersion` stay; `updatedAt` comes from the clock — core — `packages/core/src/usecases/update-season.test.ts`
6. Once the stored season has started, a different `startDate` or a different `lengthDays` throws `CLOSED` and the stored document is byte-for-byte unchanged — core — `packages/core/src/usecases/update-season.test.ts`
7. Once started, a different `name`, `kind`, `timezone` or `opensAtLocal` throws `CLOSED` and writes nothing; a different `closesAtLocal` saves, and the next `seasonState` is computed from that new close — core — `packages/core/src/usecases/update-season.test.ts`
8. A patch that changes a locked field and `closesAtLocal` together throws `CLOSED` and writes nothing, including the close time — core — `packages/core/src/usecases/update-season.test.ts`
9. The lock is decided from the stored season: one minute before day 1's `opensAt` a new `startDate` still saves; at that exact open instant the same patch throws `CLOSED` — core — `packages/core/src/usecases/update-season.test.ts`
10. An unknown season id, and a season id whose document belongs to another tenant, throw `NOT_FOUND` and leave every document unchanged — core — `packages/core/src/usecases/update-season.test.ts`
11. `suggestRamadanStart` returns `nextRamadanSuggestion(clock.now(), timezone)` and writes no season; an unknown or offset timezone throws `VALIDATION` — core — `packages/core/src/usecases/suggest-ramadan-start.test.ts`
12. The zod season rules accept a real `YYYY-MM-DD`, integer length `1` and `366`, a canonical IANA timezone, and ASCII `HH:mm` including `00:00`; they reject `2026-02-30`, `2026-2-18`, length `0`, `-1`, `1.5` and `367`, an offset timezone, `4:00`, `24:00`, `20:00:00`, Arabic-Indic digits, and extra keys (`tenantId`, `role`, `hijriYear`, `state`, `createdBy`) — api — `packages/contracts/src/season.test.ts`
13. `POST /v1/t/:tenantId/seasons` as an owner returns 201 and a contract-valid season; `GET` the same path lists it with its `state` — api — `apps/api/src/routes/seasons.test.ts`
14. `POST` returns 403 `FORBIDDEN` for an editor, a member and a scholar-reviewer of that tenant — api — `apps/api/src/routes/seasons.test.ts`
15. `POST` returns 401 `UNAUTHENTICATED` without a token — api — `apps/api/src/routes/seasons.test.ts`
16. `POST` returns 403 `FORBIDDEN` when the caller is an admin of another tenant — api — `apps/api/src/routes/seasons.test.ts`
17. `POST` returns 403 `CONSENT_REQUIRED` when the caller has not accepted the current consent — api — `apps/api/src/routes/seasons.test.ts`
18. `POST` returns 400 `VALIDATION` for an invalid date, a non-integer length, a bad local time, and a body that includes `tenantId`, `role` or `hijriYear` — api — `apps/api/src/routes/seasons.test.ts`
19. `PATCH` before day 1 opens returns 200 and the new start date and length — api — `apps/api/src/routes/seasons.test.ts`
20. `PATCH` of `startDate` after the season has started returns 409 `CLOSED` and the stored start date is unchanged — api — `apps/api/src/routes/seasons.test.ts`
21. `PATCH` of `lengthDays` after the season has started returns 409 `CLOSED` and the stored length is unchanged — api — `apps/api/src/routes/seasons.test.ts`
22. `PATCH` of `closesAtLocal` after the season has started returns 200; start date and length stay as stored — api — `apps/api/src/routes/seasons.test.ts`
23. `PATCH` returns 403 `FORBIDDEN` for an editor and for a member — api — `apps/api/src/routes/seasons.test.ts`
24. `PATCH` returns 401 `UNAUTHENTICATED` without a token — api — `apps/api/src/routes/seasons.test.ts`
25. `PATCH` returns 403 `FORBIDDEN` for an admin of another tenant — api — `apps/api/src/routes/seasons.test.ts`
26. `PATCH` with a well-formed season id that belongs to another tenant returns 404 `NOT_FOUND` and that other document is unchanged — api — `apps/api/src/routes/seasons.test.ts`
27. `GET /v1/t/:tenantId/seasons` returns 200 for a member, including `{ seasons: [] }` when the tenant has none — api — `apps/api/src/routes/seasons.test.ts`
28. `GET` returns 401 `UNAUTHENTICATED` without a token — api — `apps/api/src/routes/seasons.test.ts`
29. `GET` returns 403 `FORBIDDEN` for a member of another tenant — api — `apps/api/src/routes/seasons.test.ts`
30. `GET .../seasons/ramadan-suggestion` as an admin returns 200 with `advisory: true` and creates no season; a following `POST` with different dates lists those submitted dates — api — `apps/api/src/routes/seasons.test.ts`
31. The suggestion route returns 403 `FORBIDDEN` for an editor and for a member — api — `apps/api/src/routes/seasons.test.ts`
32. The suggestion route returns 401 `UNAUTHENTICATED` without a token — api — `apps/api/src/routes/seasons.test.ts`
33. The suggestion route returns 403 `FORBIDDEN` for an admin of another tenant — api — `apps/api/src/routes/seasons.test.ts`
34. The suggestion route returns 400 `VALIDATION` when `timezone` is missing or not an IANA zone — api — `apps/api/src/routes/seasons.test.ts`
35. A seeded `seasons/{id}` document is denied for get, list, create, overwrite, update and delete to an unauthenticated client, an authenticated client and a client with forged claims — rules — `firebase/rules.test.ts`
36. The in-memory season repo and the Firestore season repo pass one shared contract: create, tenant-scoped get and list, update that keeps `id`, `tenantId`, `createdBy`, `createdAt` and `schemaVersion`, and a cross-tenant get that returns null — adapter — `packages/testkit/src/contracts/season-repo.contract.ts` (run from testkit and from `apps/api/src/adapters/firebase/season-repo.contract.test.ts`)
37. An admin creates a community, opens its seasons, submits Ramadan 1448 with a future start date, and sees that season listed with the upcoming state — e2e — `apps/web/e2e/seasons.spec.ts`
38. The suggest control fills a start date, the admin replaces it, and the listed season shows the submitted date; with `documentElement.dir` set to `rtl`, the heading, the list item and the name field stay visible and do not overlap — e2e — `apps/web/e2e/seasons.spec.ts`
39. The seasons view lists the season name and the upcoming state, shows the create form only for `admin` and `owner`, and applying a suggestion fills start date and length without submitting — e2e — `apps/web/src/features/seasons/SeasonsView.test.tsx`

## Files and modules to touch

- `packages/contracts/src/season.ts` — request, patch, list, suggestion and view schemas. Export them from `packages/contracts/src/index.ts`.
- `packages/contracts/src/season.test.ts` — test 12.
- `packages/core/src/season/community-season.ts` — `SeasonKind`, `SeasonId`, `asSeasonId`, `SEASON_SCHEMA_VERSION`, `CommunitySeason`, and `seasonRules(record)` which returns the T030 `Season` (the rules object `assertValidSeason` already takes). Leave `packages/core/src/season/season-rules.ts` and `hijri.ts` behaviour as they are.
- `packages/core/src/usecases/create-season.ts` (+ `.test.ts`) — tests 1–3.
- `packages/core/src/usecases/list-seasons.ts` (+ `.test.ts`) — test 4.
- `packages/core/src/usecases/update-season.ts` (+ `.test.ts`) — tests 5–10.
- `packages/core/src/usecases/suggest-ramadan-start.ts` (+ `.test.ts`) — test 11.
- `packages/core/src/ports/repos.ts` — `SeasonRepo`.
- `packages/core/src/deps.ts` — `seasons: SeasonRepo`.
- `packages/core/src/index.ts` and `packages/core/src/index.test.ts` — export `createSeason`, `listSeasons`, `updateSeason`, `suggestRamadanStart`, `asSeasonId`, `seasonRules`, `SEASON_SCHEMA_VERSION`, `SEASON_KINDS`.
- `packages/testkit/src/in-memory-season-repo.ts` — fake. `makeTestDeps` grows a default `seasons` repo, overridable on its own (it does not share the community store). Update `make-test-deps.ts`, its test, and `packages/testkit/src/index.ts`.
- `packages/testkit/src/contracts/season-repo.contract.ts` — the shared suite for test 36.
- `apps/api/src/adapters/firebase/season-repo.ts` — Firestore adapter. Converter keeps Firestore types inside the file. Zod-parse stored docs the same way `community-repo.ts` does.
- `apps/api/src/adapters/firebase/season-repo.contract.test.ts` — runs the shared suite on the emulator.
- `apps/api/src/routes/seasons.ts` (+ `seasons.test.ts`) — tests 13–34. Mount the router from `apps/api/src/app.ts`.
- `apps/api/src/composition.ts` and `composition.test.ts` — wire `FirestoreSeasonRepo` on `deps.seasons`.
- `firebase/rules.test.ts` — add a `seasons` seed so the existing per-collection deny loop covers test 35. Leave `firebase/firestore.rules` as the blanket deny. Leave `firebase/firestore.indexes.json` empty.
- `apps/web/src/api/client.ts` (+ `client.test.ts`) — `listSeasons`, `createSeason`, `suggestRamadanStart`.
- `apps/web/src/features/auth/session-context.tsx` — the same three methods on the session, next to `createCommunity`.
- `apps/web/src/features/seasons/SeasonsPage.tsx`, `SeasonsView.tsx`, `SeasonsView.test.tsx` — one page. Test 39.
- `apps/web/src/router.tsx` — route `/communities/:tenantId/seasons`.
- `apps/web/src/features/communities/CommunitiesView.tsx` (+ its test) — each community list item gains a "Seasons" link to that route. Keep the existing community name text so the communities e2e still matches.
- `apps/web/src/i18n/en.json` — `season.*` keys. Other locale files stay unchanged and fall back.
- `apps/web/src/styles.css` — `season__*` rules, logical properties only (`margin-inline`, `padding-inline`, `text-align: start`).
- `apps/web/e2e/seasons.spec.ts` — tests 37 and 38, reusing `signInWithEmulator` and `acceptConsentOnScreen`.

No new npm dependency. No `.env` or `.env.example` change.

## Contracts and data shapes

`CommunitySeason` is the stored document. The T030 `Season` type stays the rules value object (`startDate`, `lengthDays`, `timezone`, `opensAtLocal`, `closesAtLocal`). `seasonRules` projects a document onto that value. `assertValidSeason` is called on that projection inside `createSeason` and `updateSeason` after name and timezone normalisation. The use cases do not import zod. The contract package does not import core.

Kinds, in this order: `ramadan`, `dhul_hijjah`, `muharram`, `weekly`, `custom`. Kind is a label. It does not set `lengthDays`.

```ts
// packages/contracts/src/season.ts — sketch. Reuse CommunityName and TimeZoneName.
// LocalDateString: ASCII /^\d{4}-\d{2}-\d{2}$/ plus the same UTC round-trip as
// isValidLocalDate (reject 2026-02-30). LocalTimeString: /^([01]\d|2[0-3]):([0-5]\d)$/.
// LengthDays: z.number().int().min(1).max(366).

CreateSeasonRequest = strictObject({
  name: CommunityName,
  kind: enum(SEASON_KINDS),
  startDate: LocalDateString,
  lengthDays: LengthDays,
  timezone: TimeZoneName,          // canonical IANA; offsets fail
  opensAtLocal: LocalTimeString,
  closesAtLocal: LocalTimeString,
})

UpdateSeasonRequest = strictObject({
  name: CommunityName.optional(),
  kind: enum(SEASON_KINDS).optional(),
  startDate: LocalDateString.optional(),
  lengthDays: LengthDays.optional(),
  timezone: TimeZoneName.optional(),
  opensAtLocal: LocalTimeString.optional(),
  closesAtLocal: LocalTimeString.optional(),
}).refine(at least one key)

SuggestRamadanQuery = strictObject({ timezone: TimeZoneName })

SeasonStateView = discriminatedUnion('phase', [
  { phase: 'upcoming' },
  { phase: 'active', dayIndex: int 1..366, open: boolean },
  { phase: 'ended' },
])

SeasonView = strictObject({
  id: Ulid,
  tenantId: Ulid,
  name, kind, startDate, lengthDays, timezone, opensAtLocal, closesAtLocal,
  state: SeasonStateView,
  createdAt: UtcIso,
  updatedAt: UtcIso,
})
// Omit createdBy and schemaVersion.

SeasonListResponse = strictObject({ seasons: array(SeasonView) })

RamadanSuggestionResponse = strictObject({
  hijriYear: int,
  startDate: LocalDateString,
  lengthDays: literal(29) | literal(30),
  advisory: literal(true),
})
```

`00:00` / `00:00` is a valid pair (the T030 24-hour window). Equal open and close is valid.

Firestore `seasons/{seasonId}` (top-level, ULID id):

```
{
  id,                  // ULID, equals the document id
  tenantId,            // ULID
  name,                // normalised, 2–48
  kind,                // ramadan | dhul_hijjah | muharram | weekly | custom
  startDate,           // YYYY-MM-DD
  lengthDays,          // integer 1..366
  timezone,            // canonical IANA
  opensAtLocal,        // HH:mm
  closesAtLocal,       // HH:mm
  createdBy,           // userId ULID
  createdAt,           // UTC ISO from Clock
  updatedAt,           // UTC ISO from Clock; equals createdAt on create
  schemaVersion        // 1
}
```

No `state`, `phase`, `dayIndex` or `hijriYear` field is stored. State is computed on read.

`SeasonRepo` (every method takes `tenantId` first):

- `get(tenantId, seasonId)` — the document, or `null` when it is missing or its `tenantId` differs.
- `list(tenantId)` — `where tenantId ==`. Single-field equality, so no composite index and no `orderBy`. The use case sorts.
- `create(season)` — document id is `season.id`. An existing id is `CONFLICT` and writes nothing. A non-ULID id, a `tenantId` mismatch, or `schemaVersion !== 1` is `VALIDATION` and writes nothing.
- `update(season)` — transaction. Missing doc or tenant mismatch is `NOT_FOUND` and writes nothing. A change to `id`, `tenantId`, `createdBy`, `createdAt` or `schemaVersion` is `VALIDATION` and writes nothing. Otherwise the use case's document replaces the stored one.

`listSeasons` sorts by `createdAt` descending, then `id` descending.

**Started.** A season has started when `seasonState(seasonRules(stored), clock.now()).phase !== 'upcoming'`, which is `now >=` day 1's open instant. The use case reads the clock once and decides the lock from the stored document before applying the patch. Active and ended are both started. `closesAtLocal` stays editable after start, including after the season has ended; the following read recomputes state from the stored rules.

Locked when started, if the normalised value differs from the stored value: `name`, `kind`, `startDate`, `lengthDays`, `timezone`, `opensAtLocal`. A locked field that is absent, or present and equal after normalisation, is left as stored. Normalisation: name via `normaliseCommunityName`, timezone via `canonicalTimeZone`, dates and times as the contract strings, kind and length by equality. If any locked field differs, throw `DomainError('CLOSED', { reason: 'season-started' })` and skip the write.

`createSeason` may store a season that is already active or ended. The lock applies to later patches. `id` comes from `deps.ids.newId()` then `asSeasonId`. `createdBy` is the `userId` argument. The route passes `c.var.membership.tenantId` and `c.var.membership.userId`. A non-ULID season id is `VALIDATION` (400). A well-formed unknown id is `NOT_FOUND` (404).

`suggestRamadanStart` takes `{ timezone }` and the clock. It calls `nextRamadanSuggestion`. It has no repository.

Routes, middleware order matching `communities.ts` (`parseJsonBody`, body limit 4096 on writes):

| Method and path | Gate | Success |
| --- | --- | --- |
| `POST /v1/t/:tenantId/seasons` | `requireUser`, `requireConsent`, `requireMember('admin')` | 201 `SeasonView` |
| `GET /v1/t/:tenantId/seasons` | `requireUser`, `requireConsent`, `requireMember('member')` | 200 `SeasonListResponse` |
| `PATCH /v1/t/:tenantId/seasons/:seasonId` | `requireUser`, `requireConsent`, `requireMember('admin')` | 200 `SeasonView` |
| `GET /v1/t/:tenantId/seasons/ramadan-suggestion?timezone=` | `requireUser`, `requireConsent`, `requireMember('admin')` | 200 `RamadanSuggestionResponse` |

`requireMember` is used as it exists. A missing membership and a role below the minimum are both `FORBIDDEN`, so a non-member learns nothing about the tenant. The use cases take no role argument. There is no `requireFeature` on these routes.

Error codes already mapped in `apps/api/src/errors.ts`: `VALIDATION` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `CONSENT_REQUIRED` 403, `NOT_FOUND` 404, `CLOSED` 409, `CONFLICT` 409. Add no new code. Responses stay `ErrorResponse` (code plus the fixed public message). `details.reason` stays server-side.

The page is `/communities/:tenantId/seasons`. It loads `GET /v1/me/communities`, finds the summary for the path tenant, and uses that summary's `role` and `timezone`. The form is rendered for `admin` and `owner`. A member, scholar-reviewer or editor sees the list and the state, and no form. The form fields are name, kind (default `ramadan`), timezone (default the community zone), start date, length, open time and close time. Kind `ramadan` shows the hint that the Hijri dates are a suggestion, and a button that calls the suggestion route with the timezone currently in the form and fills start date and length only. Submitting posts the form values. Strings go through `t('season.*')`. The name input and the listed name use `dir="auto"`. Time and timezone controls use `dir="ltr"`. Loading, empty, signed-out, unavailable and error states follow `CommunitiesView`.

E2E dates: name `Ramadan 1448`, kind Ramadan, timezone `Europe/Stockholm`, start `2035-01-01`, length `30`, open `08:00`, close `21:00`. The list item shows the name, that start date, and the English upcoming label. The suggest step fills the start field, then the test replaces it with `2035-01-01` before submit. RTL uses the same force-`dir` approach as `apps/web/e2e/consent.spec.ts` (the locale switch belongs to T080).

## Hard rules that apply here

1. **`packages/core` imports nothing vendor-specific.** Use cases depend on `Clock`, `IdGenerator` and `SeasonRepo` only, and call `assertValidSeason`, `seasonState`, `normaliseCommunityName`, `canonicalTimeZone` and `nextRamadanSuggestion`. They do not import `firebase`, `hono`, `zod` or `fetch`.
2. **Time comes from `Clock`.** Create timestamps, the started check, listed `state` and the Ramadan suggestion all use `deps.clock.now()`. Routes do not call `Date.now` or `new Date`. Tests move a `FakeClock`. There is no client test-mode flag.
3. **The browser never writes Firestore.** The web app talks to the API client. `firestore.rules` keeps the blanket deny, with no `seasons` allow. Test 35 locks that in.
4. **Tenant isolation.** The document carries `tenantId`. Repository methods take `tenantId` first. The route's tenant id is `c.var.membership.tenantId` from `requireMember`, after it has checked the path. A season id from another tenant is `NOT_FOUND` on get and update.
5. **Roles are server-side.** `requireMember('admin')` is what stops editors, scholar-reviewers and members from creating or patching. The body has no role field (`strictObject` rejects one). Listing is `requireMember('member')`.
6. **Our own ids.** `seasonId` is a ULID from `IdGenerator`, branded with `asSeasonId`. The Firebase uid is never stored on the season.
7. **Entitlements, not plan names.** This slice does not check a plan and does not call Stripe. It also does not add `requireFeature`; a season-pass gate is a later billing task.
8. **Secrets and production stay untouched.** No new env vars, no deploy, no production project.
9. **Answer day is never client-supplied.** This slice has no answer route. Listed `state.dayIndex` comes from `seasonState` and the clock. A later answer route must call `isOpen(season, dayIndexAt(season, clock.now()), now)` with that server day.

## Out of scope

- Question drafting, the `questions` collection, sources and review status (T032).
- Scheduling a question onto a day, and scholar review (T033).
- Today's question for members (T034).
- Any answer route, score, or client-sent day index.
- A season edit form, and a web-client `PATCH` method. The 409 behaviour is covered by the core and route tests.
- `GET /v1/t/:tenantId/seasons/:seasonId` as its own route. The list and the patch response carry the view.
- Deleting a season, or a uniqueness constraint on season name.
- Storing `hijriYear`, or writing the suggestion into the document. The suggest button fills the form; the admin submits the dates.
- Deriving `lengthDays` from `kind`, and the weekly Jumu'ah template (T145).
- `rateLimit` (no port yet; E04 owns that middleware).
- `requireFeature`, Stripe, quotas and the season pass.
- A composite Firestore index, an `orderBy` on the list query, and any client read allow-rule.
- A migration script. `schemaVersion` is `1` from the start.
- Changing `requireMember`, community create, or season-rules / Hijri algorithms.
- Board files, deploy, production Firebase, and secrets.
