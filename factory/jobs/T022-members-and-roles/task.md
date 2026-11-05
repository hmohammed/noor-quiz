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
