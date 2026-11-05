VERDICT: PASS
# Security review — T031 round 4

## Findings
- No issues. The rebase onto origin/main keeps T021 invite exports, `invitesRoutes`, `FirestoreInviteRepo`, the API client and session invite methods, the join route, the community invite panel, invite copy, and the invites rules seed. Season routes, the season repository, and the seasons page sit beside that behaviour.

Checked in the season slice: `requireUser` verifies the bearer token through `AuthVerifier` before `requireConsent` and `requireMember`. Create, patch, and the Ramadan suggestion require `admin`; list requires `member`. `requireMember` loads the membership for the path tenant and sets `tenantId`, `userId`, and `role` from that document. The use cases receive `c.var.membership.tenantId` and, on create, `c.var.membership.userId`. `CreateSeasonRequest` and `UpdateSeasonRequest` are strict objects, so `tenantId`, `role`, `hijriYear`, `state`, and `createdBy` are rejected. The season id is a server ULID. `createdBy` and `schemaVersion` are omitted from `SeasonView`. Cross-tenant get and update return null / `NOT_FOUND` and do not write. List is a `tenantId` equality plus a second tenant check. State, including `dayIndex`, comes from `seasonState` and one `clock.now()` read. There is no answer route and no client clock override. `firestore.rules` is still a blanket deny, and the rules test seeds `seasons` into the existing get/list/create/overwrite/update/delete deny loop. Error responses stay code plus the fixed public message.

## Hard rules
1. core vendor-free — ok
2. ports + adapters + fakes — ok
3. no client Firestore writes — ok
4. tenant isolation — ok
5. time from Clock — ok
6. roles server-side — ok
7. entitlements, not plan names — ok
8. our own ids — ok
9. secrets — ok
10. AI output untrusted — ok (no AI in this slice)
11. religious content provenance — ok (no questions in this slice)
