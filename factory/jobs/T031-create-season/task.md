## T031

**Create a season for a community**

Phase: P1 · Depends on: [T030](E03-seasons-questions.md#t030), [T020](E02-communities.md#t020) · Tags: —
Skills: `api-endpoint`, `firestore-data`

**Goal.** An admin sets up 'Ramadan 1448' with dates and times for their community.

**Scope**

- `seasons/{seasonId}` (tenantId, name, kind: ramadan|dhul_hijjah|muharram|weekly|custom, rules from T030)
- `POST /v1/t/:tenantId/seasons` (admin+), `GET .../seasons`, `PATCH` (only before start, except closesAt)
- Web: minimal season form with Hijri start suggestion

**Acceptance criteria**

- [ ] Editors and members cannot create seasons
- [ ] Start date and length can't be changed once the season has started (409)
- [ ] e2e: admin creates a season and sees it listed with its state

**Notes**

For T031: the zod season contract should mirror `assertValidSeason` — `startDate` strict real `YYYY-MM-DD`, `lengthDays` integer 1..366, `timezone` accepted by `isValidTimeZone`, `opensAtLocal`/`closesAtLocal` `HH:mm` 00:00–23:59 with ASCII digits. Call `assertValidSeason` in the use case as well. Answer routes must use `isOpen(season, dayIndexAt(season, clock.now()), now)` and never a client-sent day. `suggestRamadan` / `nextRamadanSuggestion` are advisory (Umm al-Qura via `Intl`); the stored `startDate`/`lengthDays` is always what the admin confirms.

Tags: —
Phase: P1
