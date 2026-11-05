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

Tags: sec
Phase: P1
