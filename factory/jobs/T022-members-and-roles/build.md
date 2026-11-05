# T022 build
branch: factory/T022-members-and-roles
worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T022-members-and-roles

## Changes
- `packages/core` — `canChangeRole` / `canRemoveMember`; use cases `listMembers`, `changeMemberRole`, `removeMember`, `leaveCommunity`. `MembershipRepo` gains `listByTenant`, `updateRole`, `remove` with the last-owner invariant.
- `packages/testkit` + `FirestoreMembershipRepo` — same three methods; owner count is in-transaction, `tenantId` query only, role filtered in memory.
- `packages/contracts` — `ChangeMemberRoleRequest`, `LeaveCommunityRequest`, `MemberView`, `MembersResponse`.
- `apps/api` — `GET/PATCH/DELETE …/members`, `POST …/leave` with existing auth/consent/member middleware.
- `apps/web` — `/communities/:tenantId/members` page; communities list Members link (admin/owner) and Leave (every member); API client + session helpers; `en.json` + `members__*` / leave styles (logical properties).

## Acceptance tests → test files
1. Full `canChangeRole` table → `packages/core/src/communities/role.test.ts`
2–3, 6–7, 12–15. Route cases → `apps/api/src/routes/members.test.ts`
4. Last-owner demotion → `packages/core/src/usecases/change-member-role.test.ts`
5. Last-owner leave → `packages/core/src/usecases/leave-community.test.ts`
8. `canRemoveMember` table → `packages/core/src/communities/role.test.ts`
9. Remove authorisation → `packages/core/src/usecases/remove-member.test.ts`
10. List sort and fields → `packages/core/src/usecases/list-members.test.ts`
11. Repo invariant → `packages/testkit/src/contracts/community-store.contract.ts` (in-memory + Firestore emulator)
16. Members e2e → `apps/web/e2e/members.spec.ts`
17. Members view states → `apps/web/src/features/members/MembersView.test.tsx`
18. Communities leave / Members link → `apps/web/src/features/communities/CommunitiesView.test.tsx`

## How I tested
| command | result |
| --- | --- |
| `npx eslint . --max-warnings 0` | pass |
| `npx prettier --check --end-of-line auto .` | pass (`npm run lint`'s bare `prettier --check .` fails on Windows CRLF; same as T021) |
| `npm run typecheck` | pass |
| `npm test` | 1423 product tests passed. `tooling/src/docs-commands.test.ts` failed because AGENT.md is CRLF. Known Windows issue; not treated as a product failure. |
| `npm run test:emulator` | pass (277 tests, including membership `listByTenant` / last-owner contract) |
| `npx playwright test e2e/members.spec.ts` | pass. Emulators + Vite started manually in this worktree (`FUNCTIONS_DISCOVERY_TIMEOUT=60` via PowerShell), then stopped. |

## Commits
- 83c07e4 T022: members list, role changes, leave, and web page

## Notes for reviewers
- Last-owner is enforced only in `MembershipRepo.updateRole` / `remove`. `canChangeRole` does not count owners.
- Web role controls mirror core predicates in `member-access.ts`; the API remains the authority. The browser does not import `@noor/core`.
- Path `tenantId` for use cases is `c.var.membership.tenantId`. Bodies are strict (no client `userId` / `tenantId`).
- No Firestore rules or index changes. No new npm dependencies.

## Round 2
Fixed round-1 UI/UX must-fixes only:
- Styled `.members__confirm-button` / `.members__cancel` and `.community__leave-confirm-button` / `.community__leave-cancel` like `.profile-delete__confirm` / `.profile-delete__cancel` (font inherit, 2.75rem min height, padding, colours, focus-visible, disabled opacity).
- Added `members.remove.removing` ("Removing…") for in-flight remove; kept `members.saving` for role Save only. Updated MembersView + en.json + MembersView.test.

### How I tested (round 2)
| command | result |
| --- | --- |
| `npx eslint . --max-warnings 0` | pass |
| `npx prettier --check --end-of-line auto .` | pass |
| `npm run typecheck` | pass |
| `npx vitest run apps/web/src/features/members/MembersView.test.tsx apps/web/src/features/communities/CommunitiesView.test.tsx` | pass (29 tests) |

### Commits (round 2)
- bc214d0 T022: style remove/leave confirm buttons and fix removing copy
