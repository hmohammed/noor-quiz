VERDICT: PASS
# Security review — T022 round 1

## Findings
None.

## Focus checks
- **Authz on members routes** — `GET`/`PATCH`/`DELETE …/members` use `requireUser` → `requireConsent` → `requireMember('admin')`. `POST …/leave` uses the same chain with `requireMember('member')`. Actor id is `c.var.user.id`; path `:tenantId` is bound via membership load; use cases receive `c.var.membership.tenantId` (not a body field). Bodies are strict (`role` only / `{}`); client `userId`/`tenantId` in the body is 400.
- **Role escalation** — `canChangeRole` blocks self-raise and admin→`owner`; admins cannot change peers/owners. Use cases re-read the actor membership and ignore any client role. Route tests cover self-promote to `owner`, admin create-owner, and admin peer assign.
- **Last-owner** — Enforced only in `MembershipRepo.updateRole` / `remove` (in-memory + Firestore transaction: `tenantId` query, role filtered in memory). Sole-owner demote/leave → `CONFLICT` (`reason: 'last-owner'`), no write. Public responses keep `details` server-side; clients treat 409 on these routes as last-owner.
- **Cross-tenant** — Wrong-tenant admin gets 403 on list/change/remove/leave; targets unchanged; list body has no member fields on forbidden. `listByTenant` / `remove` keep other-tenant memberships. Document id and query both keyed by `tenantId`.
- **Remove / leave** — `canRemoveMember` forbids self-`DELETE` (leave is `POST …/leave` only); admin cannot remove owner/admin; owner may remove others. Removed/demoted users lose access on the next request because `requireMember` reloads membership (no role cache). Leave of a non-member of that tenant is 403.

## Hard rules
1. core vendor-free — ok (use cases / `canChangeRole` touch ports and Clock only; Firestore txn in adapter)
2. ports + adapters + fakes — ok (`MembershipRepo` extended; contract covers in-memory + Firestore)
3. no client Firestore writes — ok (web calls API only; rules/indexes unchanged)
4. tenant isolation — ok (membership `tenantId` on routes; repo methods take `tenantId`; cross-tenant tests)
5. time from Clock — ok (`changeMemberRole` only; `FakeClock` in tests; no `Date.now` in new core/routes)
6. roles server-side — ok (`requireMember` + use-case re-read; proposal `role` gated by `canChangeRole` + repo invariant)
7. entitlements by feature — ok (no plan checks; no `requireFeature`, per spec)
8. our own IDs — ok (ULID `asUserId` / `asTenantId` on path and inputs)
9. secrets — ok (no new secrets; errors do not log request bodies)
10. AI output untrusted — ok (N/A for this slice)
11. religious content provenance — ok (N/A for this slice)

## Nits (non-blocking)
- Write routes (`PATCH`/`DELETE`/`POST …/leave`) have no rate-limit middleware; deferred explicitly by the spec (later task). Not a blocker for this round.
