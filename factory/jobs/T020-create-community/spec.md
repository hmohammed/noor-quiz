# Spec — T020 Create a community and list mine

One vertical slice. A signed-in user who has accepted the current consent creates a community, becomes its owner, and sees only the communities they belong to. Deleting an account removes that user's memberships. `requireMember(minRole)` ships and is tested, and no tenant-scoped product route ships in this task.

## Acceptance tests

1. Creating a community stores the caller as `owner` and `createdBy`, a suffix-free slug, the canonical timezone, and `createdAt`/`updatedAt` from `Clock` via `toIso` — core — `packages/core/src/usecases/create-community.test.ts`
2. A second community with the same normalised name gets the slug suffix `-2` and its own owner membership — core — `packages/core/src/usecases/create-community.test.ts`
3. `baseSlug` maps a non-Latin name to `community`, and `chooseSlug` uses `-${tenantId.slice(-8).toLowerCase()}` when the base and `-2`…`-20` are all taken — core — `packages/core/src/communities/slug.test.ts`
4. `normaliseCommunityName` accepts Unicode letters, marks, digits, spaces, hyphens and apostrophes (2–48 code points, must start with a letter) and rejects emoji, markup, controls and a one-character name — core — `packages/core/src/communities/name.test.ts`
5. An invalid name, timezone or user id throws `VALIDATION` and does not call the community repo — core — `packages/core/src/usecases/create-community.test.ts`
6. `roleAtLeast` is true exactly when the actor's rank is greater than or equal to the minimum, for every pair of the five roles — core — `packages/core/src/communities/role.test.ts`
7. Listing returns only communities the user has a membership for, sorted by `createdAt` then `tenantId`, and omits a membership whose community doc is missing — core — `packages/core/src/usecases/list-my-communities.test.ts`
8. `deleteAccount` deletes that user's memberships in every tenant before deleting the user, leaves the community docs, slug docs and every other member, does not touch memberships when no user exists, and still refuses an unsafe subject with `UNAUTHENTICATED` before any delete — core — `packages/core/src/usecases/delete-account.test.ts`
9. The shared community-store contract (in-memory and Firestore emulator) covers owner create, the `-2` suffix, all-or-nothing writes, caller-supplied timestamps, `listByUser` / `get` tenant and user scoping, and idempotent `deleteByUser` that does not delete communities or other users — adapter — `packages/testkit/src/contracts/community-store.contract.ts` (run from `packages/testkit/src/in-memory-community-store.test.ts` and `apps/api/src/adapters/firebase/community-repo.contract.test.ts`)
10. `POST /v1/communities` returns 201 with a contract-valid body whose `role` is `owner`; a second call with the same name returns a different slug ending in `-2` — api — `apps/api/src/routes/communities.test.ts`
11. `POST /v1/communities` returns 400 `VALIDATION` for an extra key (`role`, `tenantId`, `slug`, `createdBy`), a bad name, a bad timezone, invalid JSON, and a body over 4096 bytes — api — `apps/api/src/routes/communities.test.ts`
12. `POST /v1/communities` returns 401 `UNAUTHENTICATED` without a token and 403 `CONSENT_REQUIRED` when consent is missing or stale — api — `apps/api/src/routes/communities.test.ts`
13. `GET /v1/me/communities` returns only the caller's communities for two users, an empty `communities` array when they have none, 401 without a token, and 403 `CONSENT_REQUIRED` without consent; the JSON has no `createdBy`, email, Firebase uid, or slug-reservation field — api — `apps/api/src/routes/communities.test.ts`
14. After `DELETE /v1/me`, the same identity's next `GET /v1/me` is a new `userId` and `GET /v1/me/communities` is empty, while the old community doc and slug doc are still in the repos and another member of that community is unchanged — api — `apps/api/src/routes/communities.test.ts`
15. On a test-only route `GET /v1/t/:tenantId/__member` (not mounted in `createApp`), `requireUser(), requireConsent(), requireMember(minRole)` returns 401 without a token, 403 `CONSENT_REQUIRED` without consent, 403 `FORBIDDEN` for a non-member, a lower role, and a tenant the user does not belong to, and 400 `VALIDATION` for a non-ULID `:tenantId`. A sufficient stored role returns 200 with `c.var.membership` taken from the membership doc. The handler is not called on failure. A forged auth claim does not grant a role — api — `apps/api/src/middleware/require-member.test.ts`
16. Unauthenticated, authenticated, and forged-claims clients cannot get, list, create, update, or delete `communities`, `memberships`, or `communitySlugs` — rules — `firebase/rules.test.ts`
17. The communities view covers loading, signed-out, unavailable, load-error, empty list, a populated list, saving, and save-error. Every `community.*` string is an `en.json` value, the name input has `dir="auto"`, and a community name is escaped. This is a Vitest view test, not Playwright — e2e — `apps/web/src/features/communities/CommunitiesView.test.tsx`
18. A signed-in user accepts consent, opens Communities, submits a name and timezone, and sees that community in the list — e2e — `apps/web/e2e/communities.spec.ts`

The API client parses `CommunityResponse` and `MyCommunitiesResponse` and rejects a body that breaks the contract — covered with the existing client tests in `apps/web/src/api/client.test.ts` (part of tests 10 and 13, not a separate behaviour).

## Files and modules to touch

- `packages/contracts/src/community.ts` — request and response schemas below. Reuse `Ulid` and `TimeZoneName` from `me.ts` (export `TimeZoneName` from `me.ts` if it is not already exported).
- `packages/contracts/src/community.test.ts` — strict-object and name/timezone cases.
- `packages/contracts/src/index.ts` — export the community module.
- `packages/core/src/communities/community.ts` — `TenantId`, `asTenantId`, `Community`, `Membership`, `membershipId`, schema-version constants.
- `packages/core/src/communities/role.ts` — `ROLES`, `Role`, `roleAtLeast`.
- `packages/core/src/communities/role.test.ts`
- `packages/core/src/communities/name.ts` — `normaliseCommunityName`.
- `packages/core/src/communities/name.test.ts`
- `packages/core/src/communities/slug.ts` — `baseSlug`, `slugCandidates`, `chooseSlug`.
- `packages/core/src/communities/slug.test.ts`
- `packages/core/src/ports/repos.ts` — `CommunityRepo` and `MembershipRepo`, with JSDoc doc shapes.
- `packages/core/src/usecases/create-community.ts` (+ `create-community.test.ts`)
- `packages/core/src/usecases/list-my-communities.ts` (+ `list-my-communities.test.ts`)
- `packages/core/src/usecases/delete-account.ts` (+ `delete-account.test.ts`) — add `memberships` to deps. Update the JSDoc: this task removes memberships; T040 still anonymises answers.
- `packages/core/src/deps.ts` — `communities: CommunityRepo` and `memberships: MembershipRepo`.
- `packages/core/src/index.ts` and `packages/core/src/index.test.ts` — export the new functions and constants.
- `packages/testkit/src/in-memory-community-store.ts` — one store, two repo objects that share it. `InMemoryMembershipRepo.seed` is test-only and is not part of the port (so middleware tests can insert a non-owner role). No `setRole` on the port.
- `packages/testkit/src/in-memory-community-store.test.ts`
- `packages/testkit/src/contracts/community-store.contract.ts` — `runCommunityStoreContract`.
- `packages/testkit/src/make-test-deps.ts` and `make-test-deps.test.ts` — default `communities` and `memberships` come from one store. An override replaces that object only; tests that need them to agree pass both from `createInMemoryCommunityStore()`.
- `packages/testkit/src/index.ts`
- `apps/api/src/adapters/firebase/community-repo.ts` — `FirestoreCommunityRepo` and `FirestoreMembershipRepo` on the same Firestore. Zod converters, same style as `user-repo.ts`. Corrupt docs throw `INTERNAL` with a reason only (`corrupt-community-doc`, `corrupt-membership-doc`, `corrupt-community-slug-doc`).
- `apps/api/src/adapters/firebase/community-repo.contract.test.ts` — emulator, same contract as the in-memory store. No production project.
- `apps/api/src/middleware/require-member.ts` (+ `require-member.test.ts`)
- `apps/api/src/routes/communities.ts` (+ `communities.test.ts`)
- `apps/api/src/app.ts` — mount `communitiesRoutes()`.
- `apps/api/src/app-env.ts` — `membership` variable, set only by `requireMember`.
- `apps/api/src/composition.ts` and `composition.test.ts` — construct both Firestore repos from `getAdminFirestore()`.
- `firebase/rules.test.ts` — add `communities`, `memberships`, and `communitySlugs` to `seeds` so the existing client matrix covers them. Do not edit `firebase/firestore.rules` and do not edit `firebase/firestore.indexes.json`.
- `apps/web/src/api/client.ts` and `apps/web/src/api/client.test.ts` — `createCommunity` (`POST /v1/communities`) and `listMyCommunities` (`GET /v1/me/communities`).
- `apps/web/src/features/auth/session-context.tsx` — `createCommunity` and `listMyCommunities` on the session, taking the ID token inside the provider the same way `updateMe` does. Do not store the community list on the session.
- `apps/web/src/features/communities/CommunitiesPage.tsx` — route data: signed-in load and submit. Stays free of Firebase imports.
- `apps/web/src/features/communities/CommunitiesView.tsx` (+ `CommunitiesView.test.tsx`) — form and list presentation.
- `apps/web/src/router.tsx` — `/communities`.
- `apps/web/src/features/layout/AppLayout.tsx` — nav link under the same condition as Profile (signed in and consent not required).
- `apps/web/src/i18n/en.json` — `nav.communities`, `community.*`, and the two delete strings below.
- `apps/web/src/styles.css` — `.community__*` with logical properties only (`margin-inline`, `padding-inline`, `text-align: start`). No `left` / `right`.
- `apps/web/e2e/communities.spec.ts` — use `signInWithEmulator` and `acceptConsentOnScreen` from `e2e/helpers/sign-in.ts`.

## Contracts and data shapes

### Roles

Lowest to highest: `member` < `scholar-reviewer` < `editor` < `admin` < `owner`. `roleAtLeast(role, min)` compares that rank. This is only the gate for `requireMember`. Exact-role checks (scholar approval) and role changes belong to later tasks. An unrecognised stored role fails the gate (`false`); a doc that fails the converter is `INTERNAL`, not a pass.

### Community name

`normaliseCommunityName` (core) and the contract transform do the same work, mirroring `normaliseProfileName` / `ProfileDisplayName`:

- NFC, trim, collapse whitespace to one space.
- 2–48 code points.
- Starts with a Unicode letter. Remaining characters are letters, marks, numbers, spaces, `-`, `'` or `’`.
- Does not start or end with `-`, `'` or `’`.
- Returns null / fails the schema otherwise. Never strip emoji or markup down to a shorter name.

Examples that pass: `Masjid Al-Noor`, `مسجد النور`, `Masjid 99`. Examples that fail: `A`, `123 Mosque`, a name containing `<` or emoji.

### Slug

Pure functions in core. Both repositories call them; they do not invent a second algorithm.

- `baseSlug(name)`: NFC, trim, lower-case, replace every run of characters outside `[a-z0-9]` with `-`, trim hyphens, take at most 40 characters, trim hyphens again. If fewer than 2 characters remain, the base is `community`. `Masjid Al-Noor` → `masjid-al-noor`. `مسجد النور` → `community`.
- Candidates, in order: the base, then `${base}-2` … `${base}-20`, then `${base}-${tenantId.slice(-8).toLowerCase()}`.
- `chooseSlug(base, tenantId, taken)` returns the first candidate not in `taken`, or null when all are taken.
- A slug matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` and is at most 60 characters, so it is safe as a document id.

Slug choice happens inside `createWithOwner`'s transaction (or the in-memory equivalent): read every candidate, `chooseSlug`, then write. Firestore transaction retry covers two creates racing on the same slug. The use case does not loop. If `chooseSlug` returns null, throw `CONFLICT` and write nothing.

### Documents

Flat top-level collections. Timestamps are UTC ISO strings from the use case (`toIso(clock.now())`). Adapters persist those strings and do not call `Date.now`, `new Date`, or the system clock.

`communities/{tenantId}` — tenant-owned, doc id is the tenant id:

```
{
  id: TenantId,          // same as tenantId
  tenantId: TenantId,    // ULID
  name: string,          // normalised
  slug: string,
  timezone: string,      // canonical IANA from canonicalTimeZone
  createdBy: UserId,
  createdAt: string,
  updatedAt: string,
  schemaVersion: 1
}
```

`memberships/{userId}_{tenantId}` — id from `membershipId(userId, tenantId)`. Both parts are ULIDs, so the id contains one underscore.

```
{
  id: string,
  tenantId: TenantId,
  userId: UserId,
  role: "member" | "scholar-reviewer" | "editor" | "admin" | "owner",
  createdAt: string,
  updatedAt: string,
  schemaVersion: 1
}
```

`communitySlugs/{slug}` — uniqueness lock, not a product collection. Same transaction as the community and the owner membership.

```
{
  id: string,            // the slug
  slug: string,
  tenantId: TenantId,
  createdAt: string,
  updatedAt: string,     // equal to createdAt on create
  schemaVersion: 1
}
```

No composite index. `listByUser` and `deleteByUser` are single-field `userId` equality queries (automatic index). Slug reservation is a document get by id. Listing sorts in the use case after the reads. Say this in the repo JSDoc.

`deleteByUser` deletes every matching membership. When more than 400 match, repeat the transaction until none remain. A non-ULID id throws `VALIDATION`. No memberships is a success.

### Repositories

```
CommunityRepo
  getById(tenantId) → Community | null
  getByIds(tenantIds) → Community[]          // missing ids omitted
  createWithOwner({ community without slug, baseSlug, membership })
    → { community, membership }              // membership.role must be "owner"
```

`createWithOwner` checks `community.id === community.tenantId === membership.tenantId`, `membership.userId === community.createdBy`, `membership.role === "owner"`, and `membership.id === membershipId(...)`. Any mismatch is `VALIDATION` and writes nothing. An existing community id, membership id, or a slug that loses the race inside the transaction is `CONFLICT` and writes nothing.

```
MembershipRepo
  get(tenantId, userId) → Membership | null          // tenantId first
  listByUser(userId) → Membership[]                  // not tenant-scoped: the caller's own list
  deleteByUser(userId) → void                        // not tenant-scoped: account deletion only
```

`listByUser` and `deleteByUser` are the only methods that omit `tenantId`. They still take a server-resolved `userId`, never a client id. JSDoc states that exception.

### Use cases

`createCommunity(deps: { clock, ids, communities }, { userId, name, timezone })`

- `asUserId(userId)`.
- `normaliseCommunityName` or `VALIDATION` `invalid-community-name`.
- `canonicalTimeZone` or `VALIDATION` `invalid-timezone`. Store the canonical spelling.
- `tenantId = asTenantId(deps.ids.newId())`.
- One `toIso(deps.clock.now())` for every timestamp.
- `baseSlug(name)`, build the owner membership, call `createWithOwner`.
- `createdBy`, `role`, `tenantId` and `slug` come from this function and the repo, never from the caller object beyond `userId`, `name` and `timezone`.

`listMyCommunities(deps: { communities, memberships }, { userId })`

- `listByUser(asUserId(userId))`, then `getByIds` of those tenant ids.
- Drop a membership with no community doc.
- Each item carries that membership's `role`.
- Sort by `createdAt` ascending, then `tenantId` ascending.

`deleteAccount(deps: { users, memberships }, { identity })`

- Same lookup as today (`getByIdentity`). No user → `{ deleted: false }` and do not call `deleteByUser`.
- Otherwise `deleteByUser(user.id)`, then `deleteUserAndIdentities(user.id)`. Memberships go first so a retry still finds the user.
- Do not delete `communities` or `communitySlugs`. A community can be left with no owner until T022.
- `{ deleted: true }` only after both deletes succeed.

### HTTP

| Route | Middleware | Success |
| --- | --- | --- |
| `POST /v1/communities` | body limit 4096, `requireUser()`, `requireConsent()` | 201 `CommunitySummary` |
| `GET /v1/me/communities` | `requireUser()`, `requireConsent()` | 200 `{ communities: CommunitySummary[] }` |
| `DELETE /v1/me` | unchanged: `requireIdentity()`, no consent, no body | 204 |

No `requireMember` on these two routes. Create has no tenant yet. List is scoped by `c.var.user.id`. `tenantId` on the write comes from `ids.newId()`, and the role is hardcoded `owner`.

`requireMember(minRole)` reads `:tenantId` from the path, `asTenantId` (non-ULID → `VALIDATION`), then `memberships.get(tenantId, c.var.user.id)`. Missing membership or `roleAtLeast` false → `FORBIDDEN`. It does not read a community doc, so a non-member learns nothing about whether the tenant exists. On success set `c.var.membership` to `{ tenantId, userId, role }` from the stored doc. Chain for every future tenant route: `requireUser(), requireConsent(), requireMember(minRole)`.

Reuse `parseJsonBody` and the 4096-byte `bodyLimit` pattern from `routes/me.ts`. Parse the response with the contract before sending it.

```
CreateCommunityRequest = strict { name: CommunityName, timezone: TimeZoneName }

CommunitySummary = strict {
  tenantId: Ulid,
  name: string,          // 1–48 code points
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  timezone: canonical IANA,
  role: enum of the five roles,
  createdAt: UTC ISO Z
}

MyCommunitiesResponse = strict { communities: CommunitySummary[] }
```

`POST` body and `GET` body are those schemas. No `createdBy`, `updatedAt`, `schemaVersion`, email, or Firebase uid.

Error codes already exist. No new `DomainErrorCode`.

| Code | HTTP |
| --- | --- |
| `VALIDATION` | 400 |
| `UNAUTHENTICATED` | 401 |
| `CONSENT_REQUIRED` | 403 |
| `FORBIDDEN` | 403 |
| `CONFLICT` | 409 |
| `INTERNAL` | 500 |

### Web

One page, `/communities`, not two. `CommunitiesPage` talks to the API through the session methods. `CommunitiesView` is the presentation, same split as `ProfilePage` / `ProfileFormView`.

- Signed-out and unavailable states match the profile page (sign-in button only when sign-in works).
- Timezone `<select>` uses `Intl.supportedValuesOf('timeZone')`, same as profile. Initial value: `me.timezone` when set, otherwise `browserTimeZone()` when it is in that list, otherwise empty. Empty submit is a field error, not a request.
- Name field `dir="auto"`. Submit while saving is disabled and labelled with `community.saving`.
- On success, call `listMyCommunities` again and render that list (do not only append local state).
- Empty list keeps the form and shows `community.empty`.
- Load and save failures use `role="alert"`. Loading and saving use `role="status"`.
- List each community's name (`dir="auto"`), slug, and role. Role label is `t('community.role.<role>')` with all five keys in `en.json`: `member`, `scholar-reviewer`, `editor`, `admin`, `owner`.
- Strings only through `t()`. New keys live in `en.json` only. Other locales fall back.
- Update `profile.delete.intro` and `profile.delete.confirmPrompt` so they say memberships are removed and communities the person created are not deleted. Do not change the delete screen's steps. `DeleteAccountView` tests read `en.json`, so they follow the new copy.
- The consent gate still replaces the outlet until consent is accepted. `/communities` is not exempt.

e2e: sign in, accept consent, open the Communities link, fill `Masjid Al Noor` and `Europe/Stockholm`, submit, and see `Masjid Al Noor` in the list. One user, so do not assert a slug suffix here.

## Hard rules that apply here

1. **`packages/core` has no vendor imports.** Repos are interfaces. Slug, name, and role logic are plain TypeScript. Firestore, zod converters, and Hono stay in `apps/api` and `packages/contracts`.
2. **New I/O is a port, a fake, and an adapter, with one shared contract.** `CommunityRepo` and `MembershipRepo` live in `ports/repos.ts` next to `UserRepo`. Both fakes and both Firestore classes run `runCommunityStoreContract`. No new vendor and no ADR.
3. **The browser never writes Firestore.** The page calls the API. `firestore.rules` stays the existing wildcard deny. Rules tests gain the three new collections by seeding them. No client `allow`.
4. **Tenant isolation.** Community and membership docs carry `tenantId`. `get` takes `tenantId` first. Create ignores any tenant or role in the body (strict schema). List joins only the caller's memberships. `requireMember` loads the membership for the path tenant and the authenticated user. A user in tenant A who calls a route for tenant B gets 403. `listByUser` / `deleteByUser` are the documented account-scoped exceptions and still use the server user id.
5. **Time comes from `Clock`.** The use case passes `toIso(clock.now())`. Repos and routes do not read the system clock. Tests use `FakeClock`.
6. **Roles are server-side.** The only role this task writes is `owner`, inside `createWithOwner`. `requireMember` trusts the membership document, not claims, body fields, or the path alone.
7. **Entitlements are not involved.** Creating a community is free here. Do not write `entitlements` and do not call `requireFeature`.
8. **Our own ids.** `tenantId` and `userId` are ULIDs from `IdGenerator` and from `requireUser`. The Firebase uid stays on the identity doc.
9. **No secrets, no deploy, no production.** Emulator contract tests and rules tests only.
10. **i18n and RTL.** User-facing copy goes through `t()`. Name fields use `dir="auto"`. New CSS uses logical properties.

## Out of scope

- Invites, tokens, QR, and join (`T021`).
- Members list, role changes, `canChangeRole`, leave, and removing another member (`T022`). Do not add `MembershipRepo.setRole` or a public create-membership method. The only membership write is the owner row inside `createWithOwner`, plus `deleteByUser`.
- Community switcher, `/c/:slug`, and `GET /v1/communities/by-slug/:slug` (`T023`).
- Seasons, questions, entitlements, or a Free plan document on create (`T031`, `T090`).
- Anonymising answers (`T040`).
- Deleting or renaming a community, transferring ownership, or blocking account deletion for the last owner.
- Rate limiting. `E04` adds `rateLimit` for community create later. Do not add a rate-limit port.
- Pagination, search, and editing the community name or timezone after create.
- Revoking the Firebase Auth user or its tokens.
- A new npm dependency, a transliteration library, composite indexes, or an `allow` rule.
- Mounting any `/v1/t/:tenantId/...` product route. The probe path exists only inside `require-member.test.ts`.
- Arabic, Swedish, Amharic, or Somali translations, and a new locale.
- Editing `docs/tasks/BOARD.md`, `factory/board.json`, `firebase/firestore.rules`, or `firebase/firestore.indexes.json`.
