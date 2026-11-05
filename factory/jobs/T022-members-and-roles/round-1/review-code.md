VERDICT: PASS
# Code review — T022 round 1

## Findings
(none)

## Acceptance tests
1. ok — `packages/core/src/communities/role.test.ts` full 250-row `canChangeRole` table (independent expected predicate) plus the three named cases
2. ok — `apps/api/src/routes/members.test.ts` admin self-raise to `owner` → 403, role stays `admin`
3. ok — same file: admin → `owner` 403; owner → `owner` 200
4. ok — `packages/core/src/usecases/change-member-role.test.ts` sole-owner demotion `CONFLICT`/`last-owner` with unchanged membership; two-owner demotion leaves one owner
5. ok — `packages/core/src/usecases/leave-community.test.ts` sole-owner leave conflict; second owner may leave
6. ok — `members.test.ts` sole-owner leave + sole-owner PATCH → 409; leave after second owner → 204 then list 403
7. ok — `members.test.ts` remove then leave/list/me-communities; demotion re-read (list 403, leave 204)
8. ok — `role.test.ts` 50-row `canRemoveMember` table
9. ok — `packages/core/src/usecases/remove-member.test.ts` owner/admin matrix, self-remove denied, other-tenant kept, missing → NOT_FOUND
10. ok — `packages/core/src/usecases/list-members.test.ts` tenant scope, sort, null displayName, no private fields, role gates
11. ok — `packages/testkit/src/contracts/community-store.contract.ts` listByTenant / updateRole / remove / last-owner / VALIDATION (in-memory + Firestore)
12–15. ok — `members.test.ts` GET/PATCH/DELETE/leave auth, consent, roles, tenant isolation, validation
16. ok — `apps/web/e2e/members.spec.ts` invite → Members → role PATCH → member leave
17. ok — `apps/web/src/features/members/MembersView.test.tsx` states, controls, confirm, last-owner copy
18. ok — `apps/web/src/features/communities/CommunitiesView.test.tsx` Members link by role, Leave confirm UI, last-owner leave copy

## Hard rules
1. ok — core use cases / `role.ts` have no vendor imports
2. ok — no new port; `MembershipRepo` extended; contract covers fake + Firestore
3. ok — browser calls API only; no rules/index changes
4. ok — repo methods take `tenantId`; routes pass `c.var.membership.tenantId`
5. ok — only `changeMemberRole` writes time via `Clock`; repos take caller `updatedAt`
6. ok — roles re-read from memberships; request body is strict role/`{}` only
7. ok — no `requireFeature` / plan checks
8. ok — path ids branded with `asUserId` / `asTenantId`
9. ok — no secrets introduced
10. ok — N/A (no AI)
11. ok — N/A (no question content)

## Correctness notes
- `canChangeRole` / `canRemoveMember` match the spec predicates; last-owner is only on `MembershipRepo.updateRole` / `remove` (in-memory no-await; Firestore single transaction, `tenantId` query, role filtered in memory).
- Use cases re-read actor membership, map denied predicates to `FORBIDDEN`, and let repo `CONFLICT` propagate.

## Scope
In-scope vertical slice only. Existing MembershipRepo fakes in invite/delete-account/list-my-communities tests updated for the new methods.

## Nits (non-blocking)
- `en.json` key `members.leave` is unused (leave lives on the communities list).
- CommunitiesView “confirming leave calls the handler” only asserts confirm markup under static render; the e2e covers the real leave click path.
