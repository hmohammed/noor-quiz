VERDICT: PASS
# Security review — T031 round 3

## Findings
None.

Round 3 (`7f9b491`) changes only `handleSuggest` in `apps/web/src/features/seasons/SeasonsPage.tsx`. A suggestion started from `list-error` never sets `suggesting` or `suggest-error`; success and rejection both restore `list-error`. An in-flight ref blocks a second click while that status stays put. The call is still `suggestRamadanStart(tenantId, timezone)` through the session API client. It does not post a season, send a role, or supply a clock. Create stays blocked while `status === 'list-error'`.

The API gates are unchanged. Create, patch, and the Ramadan suggestion run `requireUser`, `requireConsent`, then `requireMember('admin')`. Listing is `requireMember('member')`. `requireMember` loads the membership for the path tenant and the authenticated user; the role comes from that document. `tenantId` and `userId` passed into the use cases are `c.var.membership.tenantId` and `c.var.membership.userId`. `CreateSeasonRequest` and `UpdateSeasonRequest` are strict, so a body that adds `tenantId`, `role`, `state`, `hijriYear`, or `createdBy` is `VALIDATION` and is not spread over the membership. The season id on create comes from `IdGenerator`. Patch takes the id from the path, brands it with `asSeasonId`, and loads it with the membership tenant. A well-formed id from another tenant is `NOT_FOUND` and the other document is not written. `get`, `list`, and `update` keep that tenant check in the Firestore adapter and the in-memory fake. `list` is a single-field `tenantId` equality.

State is computed from the stored rules and one `deps.clock.now()` read. The started lock uses the stored document before the patch is applied. The response view omits `createdBy` and `schemaVersion`. Error bodies stay `{ error: { code, message } }`. `firebase/firestore.rules` is unchanged: every client read and write is denied. The `seasons` seed is in the existing deny loop (get, list, create, overwrite, update, delete), including forged claims. The page talks only to the API client. The form is shown for `admin` and `owner` from the server community summary. There is no client clock override and no answer route.

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
11. religious content provenance — ok (no question is stored or marked approved)
