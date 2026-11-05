VERDICT: CHANGES
# Code review — T031 round 2

## Findings
- [must-fix] apps/web/src/features/seasons/SeasonsPage.tsx:215 — After a successful create, a failed list sets `list-error`, and `handleSuggest` records `returnToListError`. The success path restores `list-error` (line 213). The rejection path always calls `setStatus('suggest-error')`. `SeasonsView` then treats the status as not `list-error`: `season.empty` is shown when `seasons` is still empty (`SeasonsView.tsx:156`), `season.error.created` is removed, and Create is enabled again (`disabled` is only `busy || listError`, `SeasonsView.tsx:298`). The name was already cleared at line 195, but the dates are still in the form, so the admin can submit a second season. There is no delete on this screen. On that rejection, set `list-error` when `returnToListError` is true, the same flag as the success path.

## Acceptance tests
1. ok — create-season.test.ts "stores the submitted start and length when they differ from the Ramadan suggestion, and writes one document"
2. ok — create-season.test.ts "throws VALIDATION for %s and writes nothing" (invalid date, length, timezone, local time)
3. ok — create-season.test.ts "accepts Ramadan 1448 and a trimmed Arabic name" and "throws VALIDATION for a name normaliseCommunityName rejects and writes nothing"
4. ok — list-seasons.test.ts "returns only that tenant, newest createdAt then id, with state from one clock read, and [] when empty"
5. ok — update-season.test.ts "changes start and length before day 1 opens and keeps identity fields, with updatedAt from the clock"
6. ok — update-season.test.ts "rejects a new start date or length once the season has started and leaves the document unchanged"
7. ok — update-season.test.ts "rejects a new %s once started and writes nothing" and "saves a new close after the start, and the next state uses that close"
8. ok — update-season.test.ts "rejects a locked field together with a new close and does not write the close"
9. ok — update-season.test.ts "still saves a new start one minute before day 1 opens, and rejects it at the open instant"
10. ok — update-season.test.ts "throws NOT_FOUND for an unknown id and for another tenant, and leaves every document unchanged"
11. ok — suggest-ramadan-start.test.ts "returns nextRamadanSuggestion for the clock and timezone and writes no season" and "throws VALIDATION for timezone %s and writes nothing"
12. ok — packages/contracts/src/season.test.ts "accepts a real date, lengths 1 and 366, a canonical zone and 00:00" and "rejects %s"
13. ok — seasons.test.ts "returns 201 for an owner and GET lists that season with its state"
14. ok — seasons.test.ts "returns 403 FORBIDDEN for a %s" (editor, member, scholar-reviewer)
15. ok — seasons.test.ts POST "returns 401 UNAUTHENTICATED without a token"
16. ok — seasons.test.ts POST "returns 403 FORBIDDEN for an admin of another tenant"
17. ok — seasons.test.ts "returns 403 CONSENT_REQUIRED when consent is missing"
18. ok — seasons.test.ts "returns 400 VALIDATION for %s"
19. ok — seasons.test.ts "returns 200 with the new start date and length before day 1 opens"
20. ok — seasons.test.ts "returns 409 CLOSED when startDate changes after the season has started" (stored start date read back)
21. ok — seasons.test.ts "returns 409 CLOSED when lengthDays changes after the season has started" (stored length read back)
22. ok — seasons.test.ts "returns 200 when closesAtLocal changes after the season has started"
23. ok — seasons.test.ts PATCH "returns 403 FORBIDDEN for a %s" (editor, member)
24. ok — seasons.test.ts PATCH "returns 401 UNAUTHENTICATED without a token"
25. ok — seasons.test.ts PATCH "returns 403 FORBIDDEN for an admin of another tenant"
26. ok — seasons.test.ts "returns 404 NOT_FOUND for a season id that belongs to another tenant"
27. ok — seasons.test.ts "returns 200 for a member, including an empty list"
28. ok — seasons.test.ts GET "returns 401 UNAUTHENTICATED without a token"
29. ok — seasons.test.ts "returns 403 FORBIDDEN for a member of another tenant"
30. ok — seasons.test.ts "returns an advisory suggestion and does not create a season; a later POST keeps the submitted dates"
31. ok — seasons.test.ts suggestion "returns 403 FORBIDDEN for a %s" (editor, member)
32. ok — seasons.test.ts suggestion "returns 401 UNAUTHENTICATED without a token"
33. ok — seasons.test.ts suggestion "returns 403 FORBIDDEN for an admin of another tenant"
34. ok — seasons.test.ts "returns 400 VALIDATION when timezone is %s"
35. ok — firebase/rules.test.ts seasons seed in the existing get, list, create, overwrite, update, and delete deny loop
36. ok — season-repo.contract.ts run from in-memory-season-repo.test.ts and season-repo.contract.test.ts
37. ok — apps/web/e2e/seasons.spec.ts "an admin creates a season and sees it listed as upcoming"
38. ok — apps/web/e2e/seasons.spec.ts "a suggestion can be replaced, and the season screen stays readable in RTL"
39. ok — SeasonsView.test.tsx lists the name and upcoming state, shows the form only for admin and owner, and applyRamadanSuggestion fills start date and length only. Round 2 adds the active-day label, the `bdi` date, and the `list-error` alert.

## Hard rules
1. ok — new core files import only core modules. No firebase, hono, zod, or fetch. Use cases call `assertValidSeason`, `seasonState`, `normaliseCommunityName`, `canonicalTimeZone`, and `nextRamadanSuggestion`.
2. ok — `SeasonRepo` is the port. `InMemorySeasonRepo` is the testkit fake. `FirestoreSeasonRepo` is the adapter. Firestore types and the stored-doc zod parse stay in the adapter. `makeTestDeps` supplies its own seasons repo.
3. ok — the page uses the API client. `firestore.rules` is unchanged. Test 35 denies client access to `seasons`.
4. ok — documents carry `tenantId`. Repo methods take `tenantId` first. Routes pass `c.var.membership.tenantId` after `requireMember` checks the path. Another tenant's season id is `NOT_FOUND`.
5. ok — create timestamps, the started check, listed state, and the suggestion use `deps.clock.now()`. Routes do not call `Date.now` or `new Date`. Tests move a clock.
6. ok — `requireMember('admin')` gates create, patch, and suggestion. List is `requireMember('member')`. Request bodies are strict and reject `role`.
7. ok — no plan-name check, no `requireFeature`, no Stripe.
8. ok — `seasonId` is a ULID from `IdGenerator`, branded with `asSeasonId`. `createdBy` is the membership user id.
9. ok — no new env, secrets, or production config.
10. ok — no AI in this slice.
11. ok — no question is stored or scheduled.

## Nits (non-blocking)
- `tooling/src/docs-commands.test.ts` failing on Windows because AGENT.md is CRLF is not a product defect.
- apps/web/src/features/seasons/SeasonsPage.tsx:209 — `setStatus('suggesting')` leaves `list-error` immediately, so `season.empty` shows and the created alert unmounts until the suggestion settles.
- apps/web/src/features/seasons/SeasonsPage.tsx:178 — `refreshList` always writes `idle` or `list-error` when it settles. Try again and Suggest are both enabled in `list-error`, so a late list result can clear `suggesting`, or a suggest completion that captured `returnToListError` can put the form back on `list-error` after the list has already loaded.
