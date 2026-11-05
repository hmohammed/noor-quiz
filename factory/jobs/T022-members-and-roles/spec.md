# Spec — T022 Members list and role management

Admins list the members of one community and assign roles. Any member can leave. Role changes and removals are decided in core, then applied by the existing `MembershipRepo`. One new page: `/communities/:tenantId/members`.

`canChangeRole` does not know how many owners exist. The "last owner" rule is an invariant on `MembershipRepo.updateRole` and `MembershipRepo.remove`: a write that would leave the tenant with zero owners throws `CONFLICT` and writes nothing.

## Acceptance tests

1. Every role transition is decided by `canChangeRole` — core — `packages/core/src/communities/role.test.ts`. Generate the full table: each `actorRole` in `ROLES` × each `targetRole` × each `newRole` × `{ same userId, different userId }` (250 rows). Expected value is the predicate in **Contracts and data shapes**. Include the three named cases inside that table: a self transition whose `newRole` ranks above `targetRole` is false; an `admin` acting on someone else with `newRole === 'owner'` is false; an `owner` acting on someone else may set `owner`.
2. Nobody can raise their own role through the API — api — `apps/api/src/routes/members.test.ts`. An admin `PATCH`es their own membership to `owner` and gets 403 `FORBIDDEN`. The stored role is still `admin`.
3. An admin cannot create an owner — api — `apps/api/src/routes/members.test.ts`. An admin `PATCH`es another member to `owner` and gets 403 `FORBIDDEN`. The target role is unchanged. A separate row: an owner `PATCH`es a member to `owner` and gets 200 with `role: 'owner'`.
4. The last owner cannot be demoted — core — `packages/core/src/usecases/change-member-role.test.ts`. The sole owner sets their own role to `admin` and the use case rejects with `CONFLICT` (`reason: 'last-owner'`). The membership stays `owner` and `updatedAt` is unchanged. With two owners, one owner setting the other to `admin` succeeds and exactly one `owner` remains.
5. The last owner cannot leave — core — `packages/core/src/usecases/leave-community.test.ts`. The sole owner's leave rejects with `CONFLICT` (`reason: 'last-owner'`) and the membership remains. With two owners, one owner's leave deletes only that membership.
6. Last-owner leave and demotion on the routes — api — `apps/api/src/routes/members.test.ts`. Sole owner `POST .../leave` and sole owner `PATCH` to `member` both return 409 `CONFLICT` and the membership is still `owner`. After a second owner exists, the first owner's `POST .../leave` returns 204 and their next `GET .../members` is 403.
7. A removed member loses access on the next request — api — `apps/api/src/routes/members.test.ts`. Owner deletes a member (204). That user's next `POST .../leave` is 403 `FORBIDDEN`, and their next `GET .../members` is 403 `FORBIDDEN`. `memberships.get` for that pair is null. `GET /v1/me/communities` for that user no longer lists the tenant. The same test demotes an admin to `member` and asserts the demoted user's next `GET .../members` is 403 while `POST .../leave` is 204 (the role check is read again, not cached).
8. `canRemoveMember` for every pair — core — `packages/core/src/communities/role.test.ts`. Same axes as test 1 without `newRole`: each actor role × each target role × `{ same userId, different userId }`. Expected value is the remove predicate below.
9. Remove authorisation — core — `packages/core/src/usecases/remove-member.test.ts`. Owner removes an editor (membership gone). Owner `DELETE` of themselves is `FORBIDDEN` and the membership remains. Admin cannot remove an owner or another admin (`FORBIDDEN`, unchanged). Admin can remove an editor. Removing a user does not delete that user's membership in another tenant. Missing target is `NOT_FOUND`.
10. List is tenant-scoped and safe — core — `packages/core/src/usecases/list-members.test.ts`. Admin lists only that tenant's memberships. A member, editor, or scholar-reviewer actor gets `FORBIDDEN`. Sort is role rank descending, then non-null `displayName` by UTF-16 code unit, null display names last, then `userId` ascending. A membership whose user doc is missing is still returned with `displayName: null`. The result has no email, locale, timezone, consent, `updatedAt`, or `schemaVersion`.
11. Repo invariant and tenant scope — adapter — `packages/testkit/src/contracts/community-store.contract.ts` (already run for `InMemoryMembershipRepo` and `FirestoreMembershipRepo`). `listByTenant` returns only that tenant. `updateRole` on a missing doc is `NOT_FOUND` and creates nothing. `updateRole` of the sole owner to a non-owner is `CONFLICT` and leaves the doc unchanged. `updateRole` of an owner to `owner` succeeds. `remove` of the sole owner is `CONFLICT` and leaves the doc. `remove` of one tenant leaves the same user's other membership in place. A non-ULID `tenantId` or `userId` is `VALIDATION` and writes nothing. `updatedAt` that fails `instantFromIso` is `VALIDATION` and writes nothing.
12. `GET /v1/t/:tenantId/members` — api — `apps/api/src/routes/members.test.ts`. 200 and a contract-valid body for an admin and for an owner. 401 without a token. 403 `CONSENT_REQUIRED` before consent. 403 `FORBIDDEN` for a member, editor, and scholar-reviewer of this tenant. 403 `FORBIDDEN` for an admin of another tenant (response body has no member fields). 400 `VALIDATION` for a non-ULID `:tenantId`.
13. `PATCH /v1/t/:tenantId/members/:userId` — api — `apps/api/src/routes/members.test.ts`. Owner changes an editor to `scholar-reviewer` and gets 200 with that role and a new `updatedAt` from the clock. 401 without a token. 403 `CONSENT_REQUIRED`. 403 for member, editor, and scholar-reviewer. 403 for an admin of another tenant, target unchanged. 400 for a non-ULID `:userId`, a body that is not JSON, an unknown role, and a strict-object failure (`userId`, `tenantId`, or `role` plus an extra key). 404 `NOT_FOUND` when the target has no membership in this tenant. 403 when an admin assigns `admin` to another admin (peer). The path tenant used by the use case is `c.var.membership.tenantId`.
14. `DELETE /v1/t/:tenantId/members/:userId` — api — `apps/api/src/routes/members.test.ts`. Owner removes a member and gets 204 with an empty body. 401, 403 `CONSENT_REQUIRED`, 403 for member/editor/scholar-reviewer, 403 for the wrong tenant (target unchanged), 404 for an unknown member, 400 for a non-ULID `:userId`, 403 when the target is the actor.
15. `POST /v1/t/:tenantId/leave` — api — `apps/api/src/routes/members.test.ts`. A member sends `{}` and gets 204; the membership is gone. 401, 403 `CONSENT_REQUIRED`, 403 for a user who is not a member, 403 for a member of another tenant (this tenant's membership stays), 400 when the body is not a strict empty object (`role` is rejected).
16. Members page — e2e — `apps/web/e2e/members.spec.ts`. User A creates a community, invites user B, B joins. A opens Members from the communities list, sees both display names, and changes B's role to Editor (`PATCH` 200). The row shows Editor. A member row has no control that offers Owner while A is the only owner besides that action (B is not an owner). B, signed in as a member, does not see a Members link. B leaves from the communities list (`POST` 204) and the community disappears from B's list. A's next load of Members does not show B.
17. Members view states — e2e is not required for these; web unit — `apps/web/src/features/members/MembersView.test.tsx`. Renders loading, signed-out, unavailable, load-error, forbidden (no member names in the markup), and a ready list. Own row has no role select and no Remove. An admin's row for an editor offers Member, Scholar reviewer, Editor, and Admin, and not Owner. An owner's row for an editor also offers Owner. An admin's row for an owner has neither a select nor Remove. Display names use `dir="auto"`. Remove uses a confirm step before it calls the handler. A 409 from a role save shows the last-owner copy.
18. Communities list entry points — web — `apps/web/src/features/communities/CommunitiesView.test.tsx`. Admin and owner rows link to `/communities/:tenantId/members`. Member, scholar-reviewer, and editor rows do not. Every row can start Leave. Confirming leave calls the handler. A failed leave with the last-owner signal shows the last-owner copy and keeps the row.

## Files and modules to touch

- `packages/core/src/communities/role.ts` (+ `role.test.ts`) — add `canChangeRole` and `canRemoveMember`. Keep `ROLES` and `roleAtLeast` as they are.
- `packages/core/src/ports/repos.ts` — extend `MembershipRepo` with `listByTenant`, `updateRole`, and `remove`. Update the comment that says there is no `setRole`. No new port.
- `packages/core/src/usecases/list-members.ts` (+ `.test.ts`) — admin+ list.
- `packages/core/src/usecases/change-member-role.ts` (+ `.test.ts`) — role change.
- `packages/core/src/usecases/remove-member.ts` (+ `.test.ts`) — admin removes someone else.
- `packages/core/src/usecases/leave-community.ts` (+ `.test.ts`) — the caller leaves.
- `packages/core/src/index.ts` — export the new use cases (the role functions already export through `role.ts`).
- `packages/testkit/src/in-memory-community-store.ts` — implement the three methods on `InMemoryMembershipRepo`. Count and write with no `await` between them, matching `InMemoryInviteRepo.accept`.
- `packages/testkit/src/contracts/community-store.contract.ts` — the cases in test 11. Both adapters already run this suite.
- `apps/api/src/adapters/firebase/community-repo.ts` — the same three methods on `FirestoreMembershipRepo`. `listByTenant` is a single-field `tenantId` equality. `updateRole` and `remove` run in one transaction that reads the target and every membership with that `tenantId` (single-field query only), then writes or throws. Do not add a composite index.
- `packages/contracts/src/member.ts` (+ `member.test.ts`) — request and response schemas below. Export from `packages/contracts/src/index.ts`.
- `apps/api/src/routes/members.ts` (+ `members.test.ts`) — the four routes. Mount them in `apps/api/src/app.ts`.
- `apps/web/src/api/client.ts` (+ `client.test.ts`) — `listMembers`, `changeMemberRole`, `removeMember`, `leaveCommunity`.
- `apps/web/src/features/auth/session-context.tsx` — the same four calls with the session token.
- `apps/web/src/features/members/MembersPage.tsx`, `MembersView.tsx`, `MembersView.test.tsx` — the page.
- `apps/web/src/features/communities/CommunitiesPage.tsx`, `CommunitiesView.tsx`, `CommunitiesView.test.tsx` — Members link (admin and owner) and Leave (every member).
- `apps/web/src/router.tsx` — `{ path: '/communities/:tenantId/members', element: <MembersPage /> }`.
- `apps/web/src/i18n/en.json` — the keys below. Other locales fall back.
- `apps/web/src/styles.css` — `members__*` rules using logical properties only (`margin-inline-start`, `padding-inline`, no physical `left`/`right`).
- `apps/web/e2e/members.spec.ts` — test 16, same two-context shape as `apps/web/e2e/invites.spec.ts`.

Do not add a `UserRepo` method. The list use case calls the existing `users.getById` once per membership (`Promise.all`). Do not change `firebase/firestore.rules` or `firestore.indexes.json`.

## Contracts and data shapes

### Rank

`ROLES` stays `['member', 'scholar-reviewer', 'editor', 'admin', 'owner']` (lowest rank first). `rank(role)` is `ROLES.indexOf(role)`.

### `canChangeRole(actor, target, newRole): boolean`

```ts
actor: { userId: UserId; role: Role }
target: { userId: UserId; role: Role }
newRole: Role
```

True only when:

- Same `userId`: `rank(newRole) <= rank(target.role)`. A raise is false. An equal or lower role is true. This is the only self-service rule; it does not look at whether the actor is an admin.
- Different `userId` and `actor.role === 'owner'`: true for every target role and every `newRole`.
- Different `userId` and `actor.role === 'admin'`: true only when `rank(target.role) < rank('admin')` and `newRole !== 'owner'`. An admin may set `member`, `scholar-reviewer`, `editor`, or `admin` on a member, scholar-reviewer, or editor. An admin may not change another admin or an owner, and may not assign `owner`.
- Different `userId` and any other actor role: false.

The function does not throw for those inputs and does not read a clock or a repo.

### `canRemoveMember(actor, target): boolean`

Same subject shape. True only when the user ids differ and either the actor is `owner`, or the actor is `admin` and `rank(target.role) < rank('admin')`. Self-remove is false. The last-owner case is not this function's job.

### Use cases

All four reject a non-object input and any key outside the allow-list with `VALIDATION` (`reason: 'forbidden-field'` or `invalid-input`), the same way `createInvite` does. `tenantId` is `asTenantId`'d and `userId`s are `asUserId`'d. They re-read the actor's membership; they do not trust a role argument.

`listMembers(deps, { tenantId, userId })` where `deps` is `{ memberships, users }`. Actor missing or below `admin` → `FORBIDDEN` (`not-an-admin`). Then `memberships.listByTenant(tenantId)` and `users.getById` for each `userId`. Each item is `{ userId, role, displayName, createdAt }` with `displayName` copied from the user or `null` when the user is missing. Sort as in test 10.

`changeMemberRole(deps, { tenantId, actorUserId, targetUserId, role })` where `deps` is `{ clock, memberships, users }`. Actor missing or below `admin` → `FORBIDDEN` (`not-an-admin`). Target missing in this tenant → `NOT_FOUND`. `canChangeRole` false → `FORBIDDEN` (`role-change-denied`) even when `role` equals the current role. When `canChangeRole` is true and the role is unchanged, return the current member view and do not write. Otherwise call `memberships.updateRole(tenantId, targetUserId, role, toIso(clock.now()))` once. Let a `CONFLICT` from the repo propagate. Return the member view (display name via `users.getById`).

`removeMember(deps, { tenantId, actorUserId, targetUserId })` where `deps` is `{ memberships }`. Actor missing or below `admin` → `FORBIDDEN` (`not-an-admin`). Target missing → `NOT_FOUND`. `canRemoveMember` false → `FORBIDDEN` (`remove-denied`). Otherwise `memberships.remove(tenantId, targetUserId)`, and let `CONFLICT` propagate.

`leaveCommunity(deps, { tenantId, userId })` where `deps` is `{ memberships }`. Missing membership → `FORBIDDEN` (`not-a-member`). Otherwise `memberships.remove(tenantId, userId)`. A sole owner hits the repo invariant. Any non-owner, including a member, may leave. One owner of two may leave.

### `MembershipRepo` additions

Doc shape is unchanged: `memberships/{userId}_{tenantId}` = `{ id, tenantId, userId, role, createdAt, updatedAt, schemaVersion: 1 }`.

- `listByTenant(tenantId)` → memberships whose `tenantId` matches. Copies, not the stored objects. Order is not significant. Bad id → `VALIDATION` before the read.
- `updateRole(tenantId, userId, role, updatedAt)` → the stored membership. Bad id, a role that fails `isRole`, or an `updatedAt` that fails `instantFromIso` → `VALIDATION`, no write. Missing doc → `NOT_FOUND`, no create. When the current role is `owner` and `role !== 'owner'`, count owner docs for this tenant inside the same transaction; if that count is less than 2, throw `CONFLICT` (`reason: 'last-owner'`) and do not write. Otherwise set `role` and `updatedAt` only. `createdAt`, `id`, `tenantId`, `userId`, and `schemaVersion` stay. Stored `updatedAt` is the caller string.
- `remove(tenantId, userId)` → `void`. Bad id → `VALIDATION`, no write. Missing doc → `NOT_FOUND`. When the current role is `owner` and this tenant has fewer than 2 owners, `CONFLICT` (`reason: 'last-owner'`) and the doc stays. Otherwise delete that one doc.

The owner count is `memberships` of this `tenantId` whose `role` is `owner`, read in the same transaction as the write. Query `tenantId` only and filter `role` in memory so Firestore needs no composite index. In-memory does the same filter on its map. A tenant that already has zero owners does not block removing a non-owner.

### HTTP

| Route | Middleware | Success | Notes |
| --- | --- | --- | --- |
| `GET /v1/t/:tenantId/members` | `requireUser`, `requireConsent`, `requireMember('admin')` | 200 `MembersResponse` | No query is read. No body. |
| `PATCH /v1/t/:tenantId/members/:userId` | same, body limit 4096 | 200 `MemberView` | JSON `ChangeMemberRoleRequest`. |
| `DELETE /v1/t/:tenantId/members/:userId` | same, no body | 204 empty | |
| `POST /v1/t/:tenantId/leave` | `requireUser`, `requireConsent`, `requireMember('member')`, body limit 4096 | 204 empty | JSON `LeaveCommunityRequest` (`{}`). |

`tenantId` passed into every use case is `c.var.membership.tenantId`. The actor id is `c.var.user.id`. The target id is `asUserId` of the path `:userId` only. Parse the JSON with the contract, parse the JSON response with the contract, and map `DomainError` only through the existing `apps/api/src/errors.ts` (`FORBIDDEN` 403, `CONFLICT` 409, `NOT_FOUND` 404, `VALIDATION` 400). Do not put `details.reason` in the response. No `requireFeature`. No new rate-limit middleware.

### Zod (`packages/contracts` does not import core)

```ts
export const ChangeMemberRoleRequest = z.strictObject({ role: CommunityRole });
export const LeaveCommunityRequest = z.strictObject({});

const MemberDisplayName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 1 && length <= 32;
});

export const MemberView = z.strictObject({
  userId: Ulid,
  displayName: MemberDisplayName.nullable(),
  role: CommunityRole,
  createdAt: UtcIso, // same Z-terminated pattern as CommunitySummary
});
export const MembersResponse = z.strictObject({ members: z.array(MemberView) });
```

`CommunityRole` and `Ulid` already exist. A response that contains `email` or `schemaVersion` fails the strict parse.

### Web

The page follows `SeasonsPage` / `SeasonsView`: the page talks to the session, the view is props in and events out. Route `/communities/:tenantId/members`.

- Signed-out, loading, unavailable, and load-error states match the seasons copy pattern, with `members.*` keys.
- 403 on the list renders `members.forbidden` and no names.
- Ready list: display name or `members.unnamed`, the existing `community.role.<role>` label, and `dir="auto"` on the name.
- Controls are derived from the actor's role on `GET /v1/me/communities` for this `tenantId` (server-provided `role`), using the predicates above. The web app does not import `@noor/core`; a small helper in the feature is enough, and the view test locks the controls. The API remains the authority.
- Own row: text only. Another row the actor may change: a select of the roles `canChangeRole` allows, then Save. Another row the actor may remove: Remove, then a confirm step in the same style as `DeleteAccountView` (no `window.confirm`).
- Save sends `PATCH`. 409 shows `members.error.lastOwner`. Any other failure shows `members.error.save`.
- Communities list: a Members link only when `role` is `admin` or `owner`, next to the existing Seasons link. Leave on every community row, with the same confirm step. 409 shows `community.leave.lastOwner`. Success reloads my communities.

English keys to add: `members.link`, `members.title`, `members.loading`, `members.signedOut`, `members.unavailable`, `members.error.load`, `members.retry`, `members.forbidden`, `members.empty`, `members.unnamed`, `members.role`, `members.save`, `members.saving`, `members.remove`, `members.remove.confirmPrompt`, `members.remove.confirm`, `members.remove.cancel`, `members.error.save`, `members.error.remove`, `members.error.lastOwner`, `members.leave`, `community.leave`, `community.leave.confirmPrompt`, `community.leave.confirm`, `community.leave.cancel`, `community.leave.leaving`, `community.leave.error`, `community.leave.lastOwner`. Reuse `community.role.*`. No hard-coded user-facing strings in components.

## Hard rules that apply here

1. **Core stays vendor-free.** The use cases and `canChangeRole` call ports and `Clock` only. The Firestore transaction lives in `FirestoreMembershipRepo`.
2. **No new port.** Listing, role change, and removal extend `MembershipRepo`. Tests go in the existing community-store contract, so the fake and the emulator adapter stay in lockstep.
3. **The browser never writes Firestore.** The page calls the API. Rules stay deny-all for client reads and writes of `memberships`. Do not add a client read so the members page can skip the API.
4. **Tenant isolation.** Every new repo method takes `tenantId` and uses it in the document id or the query. Routes pass the membership's `tenantId`, not a body field. Wrong-tenant cases are tests 12–15. `listByTenant` must not return another tenant's rows.
5. **Time comes from `Clock`.** `changeMemberRole` is the only use case that writes a timestamp, via one `clock.now()`. Repos do not read a clock. Tests pass `FakeClock` through `makeTestDeps`.
6. **Roles are server-side.** `requireMember` loads the membership on every request, which is what makes test 7 pass after a delete or a demotion. Do not cache a role on the client or in a module-level map. The requested `role` is a proposal; `canChangeRole` and the repo invariant decide. A client `userId` or `tenantId` in the body is a 400 because the objects are strict.
7. **Entitlements are not involved.** Member caps and plan checks are later. Do not call `requireFeature` and do not read a plan name.
8. **Our ids.** Path ids are ULIDs branded with `asUserId` / `asTenantId`. The Firebase uid is not a membership key.
9. **Public errors stay generic.** `reason` stays in `DomainError.details`. The client tells last-owner apart from other conflicts because these two routes have no other `CONFLICT`.

## Out of scope

- A `rateLimit` middleware or port. Write limits are a later task; this slice does not invent one.
- Entitlements, member caps, pagination, or a composite index.
- `UserRepo.getByIds`, profile editing, showing email, or inviting from this page.
- A dedicated ownership-transfer wizard. Promoting another member to `owner` is the way a second owner appears.
- Letting `DELETE` remove the caller. Self-removal is `POST .../leave` only.
- Community switcher, `/c/:slug`, or `GET /v1/communities/by-slug/:slug` (T023).
- Platform-admin custom claims, an audit log, or notifications on role change.
- Changing Firestore rules, relaxing client access, or caching memberships between requests.
- New npm dependencies.
- Marking questions approved, seasons, or billing.
