VERDICT: PASS
# Security review — T031 round 1

## Findings
None.

Create and patch both run `requireUser`, `requireConsent`, then `requireMember('admin')`. Role rank is `member` < `scholar-reviewer` < `editor` < `admin` < `owner`, and the role is loaded from the membership document, so an editor, member, or scholar-reviewer is `FORBIDDEN` and only an admin or owner proceeds. The same gate covers the Ramadan suggestion. Listing is `requireMember('member')`. A caller who is an admin only of another tenant is `FORBIDDEN` and never reaches the season repository.

`tenantId` and `userId` passed into `createSeason` and `updateSeason` are `c.var.membership.tenantId` and `c.var.membership.userId`. `CreateSeasonRequest` and `UpdateSeasonRequest` are strict objects, so a body that adds `tenantId`, `role`, `state`, `hijriYear`, or `createdBy` is `VALIDATION` and is not spread over the membership. The season id on create comes from `IdGenerator`. Patch takes the id from the path, brands it with `asSeasonId`, and loads it with the membership tenant. A well-formed id from another tenant is `NOT_FOUND` and the other document is not written. `get`, `list`, and `update` all keep that tenant check in both the Firestore adapter and the in-memory fake. `list` is a single-field `tenantId` equality.

State is not a stored field and not a request field. `listSeasons`, `createSeason`, and `updateSeason` compute it from the stored rules and one `deps.clock.now()` read. The started lock uses the stored document before the patch is applied. `createdBy`, `createdAt`, `id`, `tenantId`, and `schemaVersion` are kept from the stored document; the response view omits `createdBy` and `schemaVersion`. Error bodies stay `{ error: { code, message } }`.

`firebase/firestore.rules` is unchanged: every client read and write is denied. The new `seasons` seed sits in the existing per-collection deny loop (get, list, create, overwrite, update, delete), including a client with forged claims. The web page talks only to the API client. The form is shown for `admin` and `owner` from the server community summary, and the posted body is `CreateSeasonRequest` (name, kind, dates, times, timezone). There is no client clock override and no answer route.

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
