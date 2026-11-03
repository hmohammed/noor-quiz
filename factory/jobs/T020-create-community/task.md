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

Extend `deleteAccount` from T013c: when a user deletes their account, remove their memberships too.

Tags: sec
Phase: P1
