# E02 · Communities

Self-serve tenants: create, invite, join, roles.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T020

**Create a community and list mine**

Phase: P1 · Depends on: [T013](E01-identity-privacy.md#t013) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`

**Goal.** Any signed-in user can start a community and becomes its owner.

**Scope**

- Collections `communities/{tenantId}` (name, slug unique, timezone, createdBy) and `memberships/{userId_tenantId}` (role)
- `POST /v1/communities`, `GET /v1/me/communities`
- Middleware `requireMember(minRole)` resolving `:tenantId` against memberships
- Web: 'Create community' form and 'My communities' list

**Acceptance criteria**

- [ ] Creator gets role `owner`; slug collisions get a suffix
- [ ] A user never sees communities they are not a member of (list test with two users)
- [ ] Rules tests: no client read/write on communities or memberships
- [ ] e2e: create a community → appears in the list

**Notes**

_(implementer adds notes for the next task here)_

## T021

**Invite link and join**

Phase: P1 · Depends on: [T020](E02-communities.md#t020) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`

**Goal.** Admins share a link or QR; people join in one tap.

**Scope**

- `invites/{token}` (tenantId, createdBy, expiresAt, maxUses, uses)
- `POST /v1/t/:tenantId/invites` (admin+), `GET /v1/invites/:token` (public preview: community name only), `POST /v1/invites/:token/accept`
- Web: invite dialog with copy + QR (generated client-side, no external service); `/join/:token` page

**Acceptance criteria**

- [ ] Accepting twice is idempotent (one membership)
- [ ] Expired or used-up tokens rejected with 410
- [ ] Member role cannot create invites (403)
- [ ] e2e: user A creates invite, user B joins, B sees the community

**Notes**

_(implementer adds notes for the next task here)_

## T022

**Members list and role management**

Phase: P1 · Depends on: [T021](E02-communities.md#t021) · Tags: `sec`
Skills: `api-endpoint`

**Goal.** Admins see members and assign roles: owner, admin, editor, scholar-reviewer, member.

**Scope**

- `GET /v1/t/:tenantId/members` (admin+), `PATCH .../members/:userId` role, `DELETE .../members/:userId`, `POST .../leave`
- Role hierarchy and rules in core (`canChangeRole(actor, target, newRole)`)
- Web members page

**Acceptance criteria**

- [ ] Nobody can raise their own role; admins cannot create owners; the last owner cannot leave or be demoted
- [ ] Removed members lose access immediately (next request 403)
- [ ] Core has table-driven tests for every role transition

**Notes**

_(implementer adds notes for the next task here)_

## T023

**Community switcher and community home**

Phase: P2 · Depends on: [T021](E02-communities.md#t021) · Tags: —
Skills: `vertical-slice`, `i18n-rtl`

**Goal.** Members in several communities switch between them; URLs are `/c/:slug`.

**Scope**

- Web route `/c/:slug` with a header switcher; last used community remembered in localStorage
- `GET /v1/communities/by-slug/:slug` (members only)

**Acceptance criteria**

- [ ] Non-members get a 'not a member' page, not data
- [ ] e2e: user in two communities switches and sees each name

**Notes**

_(implementer adds notes for the next task here)_
