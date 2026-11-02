# Spec — T030 Season rules in core: days, open and close times

Pure functions in `packages/core` that answer "which season day is it, and is that day's question open?" for any IANA timezone. No ports, no routes, no UI, no persistence. `now` is always passed in as an `Instant`; callers get it from the `Clock` port.

## Definitions (the builder implements exactly these)

- **Day dates.** Day `d` (1-based, `1..lengthDays`) has local date `addDays(startDate, d - 1)`. Calendar arithmetic, never "add 86 400 000 ms".
- **Question window of day `d`.** `opensAt` = the instant of `opensAtLocal` on day `d`'s local date in `timezone`. If `closesAtLocal > opensAtLocal` (string compare of `HH:mm` is fine), `closesAt` is `closesAtLocal` on the **same** local date; otherwise (`closesAtLocal <= opensAtLocal`, e.g. opens 18:00 closes 01:00, or 00:00/00:00 = a 24-local-hour window) it is `closesAtLocal` on the **next** local date. The window is half-open: open iff `opensAt <= now < closesAt`.
- **Local time → instant (DST).** Use "compatible" disambiguation (same as Temporal): a wall time that does not exist (spring-forward gap) moves forward by the gap length (02:30 → 03:30); a wall time that occurs twice (fall-back overlap) takes the **earlier** instant. This rule is monotonic, so windows of consecutive days never overlap.
- **Season day in effect (`dayIndexAt`).** A season day starts when its question opens and lasts until the next day's question opens. The last day lasts until its question closes. Before day 1 opens → `null`; at or after the last day's `closesAt` → `null`. Between a close and the next open the previous day is still in effect (question closed). The result is always in `1..lengthDays`.
- **Season state.** `upcoming` iff `now < window(1).opensAt`; `ended` iff `now >= window(lengthDays).closesAt`; otherwise `active` with `dayIndex = dayIndexAt(...)` and `open = isOpen(season, dayIndex, now)`.

## Acceptance tests

All tests are Vitest table tests (`it.each`) using `instantFromIso(...)` for `now`. Expected instants below were worked out by hand; the builder confirms each against Node 22's ICU and, if one is wrong, fixes the expected value (not the definition) and says so in `build.md`.

### Local date and zoned-instant helpers — `packages/core/src/time/local-date.test.ts`, `packages/core/src/time/zoned.test.ts`
1. `addDays('2026-02-28', 1) === '2026-03-01'`, `addDays('2028-02-28', 1) === '2028-02-29'`, `addDays('2026-12-31', 1) === '2027-01-01'`, `addDays('2026-03-01', -1) === '2026-02-28'`; `daysBetween('2026-02-18', '2026-03-19') === 29`, `daysBetween(x, x) === 0`, negative when reversed — core — `local-date.test.ts`
2. `isValidLocalDate` accepts `'2026-02-18'`, `'2028-02-29'`; rejects `'2026-02-30'`, `'2026-2-18'`, `'2026-02-18T00:00'`, `'٢٠٢٦-٠٢-١٨'` (non-ASCII digits), `''` — core — `local-date.test.ts`
3. `parseLocalTime` accepts `'00:00'`, `'01:00'`, `'23:59'`; rejects `'24:00'`, `'1:00'`, `'12:60'`, `'12:00:00'`, `''` with `DomainError('VALIDATION')` — core — `local-date.test.ts`
4. `zonedInstant(date, time, tz)` plain cases: `('2026-02-18','04:00','Europe/Stockholm') → 2026-02-18T03:00:00Z`; `('2026-02-18','00:00','Africa/Addis_Ababa') → 2026-02-17T21:00:00Z`; `('2026-02-18','18:00','Asia/Riyadh') → 2026-02-18T15:00:00Z`; `('2026-02-18','05:00','America/Toronto') → 2026-02-18T10:00:00Z` — core — `zoned.test.ts`
5. `zonedInstant` spring-forward gap moves forward: `('2026-03-29','02:30','Europe/Stockholm') → 2026-03-29T01:30:00Z`; `('2026-03-08','02:30','America/Toronto') → 2026-03-08T07:30:00Z` — core — `zoned.test.ts`
6. `zonedInstant` fall-back overlap takes the earlier instant: `('2026-10-25','02:30','Europe/Stockholm') → 2026-10-25T00:30:00Z`; `('2026-11-01','01:30','America/Toronto') → 2026-11-01T05:30:00Z` — core — `zoned.test.ts`
7. `zonedInstant` with an unknown zone, invalid date or invalid time throws `DomainError('VALIDATION')`; it never reads the host timezone (the test sets nothing, but the implementation must not use `Date` local getters/`getTimezoneOffset`) — core — `zoned.test.ts`

### Season validation — `packages/core/src/season/season-rules.test.ts`
8. `assertValidSeason` accepts a valid season; rejects with `DomainError('VALIDATION', { reason })` each of: invalid `startDate` (`'2026-02-30'`), `lengthDays` of `0`, `-1`, `1.5`, `367`, `NaN`; unknown `timezone`; `opensAtLocal`/`closesAtLocal` not `HH:mm` — core — `season-rules.test.ts`
9. Every public season function (`questionWindow`, `dayIndexAt`, `seasonState`, `isOpen`) rejects an invalid season with `DomainError('VALIDATION')` rather than returning a wrong answer — core — `season-rules.test.ts`

### Question windows — `season-rules.test.ts`
10. Europe/Stockholm, `{ startDate:'2026-02-18', lengthDays:30, opensAtLocal:'04:00', closesAtLocal:'20:00' }`: day 1 → `{ date:'2026-02-18', opensAt:'2026-02-18T03:00Z', closesAt:'2026-02-18T19:00Z' }`; day 30 → `{ date:'2026-03-19', opensAt:'2026-03-19T03:00Z', closesAt:'2026-03-19T19:00Z' }` — core
11. **Close after midnight**, Asia/Riyadh, `{ startDate:'2026-02-18', lengthDays:30, opensAtLocal:'18:00', closesAtLocal:'01:00' }`: day 1 → opens `2026-02-18T15:00Z`, closes `2026-02-18T22:00Z` (= 01:00 on 19 Feb local); day 30 → opens `2026-03-19T15:00Z`, closes `2026-03-19T22:00Z` — core
12. **24-hour window**, Africa/Addis_Ababa, opens `00:00` closes `00:00`: day 1 → `2026-02-17T21:00Z`–`2026-02-18T21:00Z`; day 2 opens exactly when day 1 closes — core
13. **DST night, close after midnight**, America/Toronto, `{ startDate:'2026-02-18', lengthDays:30, opensAtLocal:'05:00', closesAtLocal:'01:00' }` (day 19 = 8 March, DST starts 02:00): day 18 → opens `2026-03-07T10:00Z`, closes `2026-03-08T06:00Z`; day 19 → opens `2026-03-08T09:00Z`, closes `2026-03-09T05:00Z` — core
14. **DST night, nonexistent open time**, Europe/Stockholm, `{ startDate:'2026-03-27', lengthDays:5, opensAtLocal:'02:30', closesAtLocal:'01:00' }`: day 2 → opens `2026-03-28T01:30Z`, closes `2026-03-29T00:00Z`; day 3 (29 March) → opens `2026-03-29T01:30Z` (03:30 CEST), closes `2026-03-29T23:00Z` — core
15. **DST fall-back**, Europe/Stockholm, `{ startDate:'2026-10-24', lengthDays:3, opensAtLocal:'02:30', closesAtLocal:'23:00' }`: day 2 (25 Oct) → opens `2026-10-25T00:30Z` (earlier 02:30), closes `2026-10-25T22:00Z` — core
16. `questionWindow` with `dayIndex` `0`, `lengthDays + 1`, `1.5` throws `DomainError('VALIDATION', { reason: 'day-out-of-range' })` — core
17. Property: for every table season above and every day `d < lengthDays`, `window(d).closesAt <= window(d+1).opensAt` and `window(d).opensAt < window(d).closesAt` (windows never overlap, never empty) — core

### Day index and state at boundaries (±1 minute) — `season-rules.test.ts`
Each row asserts `dayIndexAt`, `seasonState` and `isOpen(season, dayIndex, now)` together.

18. Stockholm season from test 10: `2026-02-18T02:59Z` → `null`, `upcoming`; `03:00Z` → `1`, `active/open`; `03:01Z` → `1`, open; `18:59Z` → `1`, open; `19:00Z` → `1`, `active/closed`; `2026-02-19T02:59Z` → `1`, closed; `2026-02-19T03:00Z` → `2`, open; `2026-03-19T18:59Z` → `30`, open; `2026-03-19T19:00Z` → `null`, `ended`; `2026-03-19T19:01Z` → `null`, `ended` — core
19. Riyadh close-after-midnight season from test 11: `2026-02-18T14:59Z` → `upcoming`; `2026-02-18T21:59Z` (00:59 local on 19 Feb) → day `1`, open; `22:00Z` → day `1`, closed; `2026-03-19T21:59Z` (00:59 local on 20 Mar, a date after the season's last date) → day `30`, open; `2026-03-19T22:00Z` → `ended` — core
20. Addis Ababa 24-hour season from test 12: `2026-02-17T20:59Z` → `upcoming`; `21:00Z` → day `1`, open; `2026-02-18T20:59Z` → day `1`, open; `2026-02-18T21:00Z` → day `2`, open; `2026-03-19T20:59Z` → day `30`, open; `2026-03-19T21:00Z` → `ended` — core
21. Toronto DST season from test 13: `2026-03-08T05:59Z` (00:59 EST on 8 Mar) → day `18`, open; `06:00Z` → day `18`, closed; `08:59Z` → day `18`, closed; `09:00Z` (05:00 EDT) → day `19`, open — core
22. Stockholm spring-gap season from test 14: `2026-03-29T01:29Z` → day `2`, closed; `01:30Z` → day `3`, open — core
23. **Day index never exceeds `lengthDays`**: for each table season, sweep `now` from `window(1).opensAt − 1 day` to `window(lengthDays).closesAt + 1 day` in 30-minute steps plus every window edge ±1 minute; assert `dayIndexAt` is `null` or an integer in `1..lengthDays`, never decreases, and is `null` exactly when state is `upcoming`/`ended` — core
24. `lengthDays: 1` season: upcoming before open, `active` day `1` while open and after close only until close (then `ended`) — core
25. `isOpen` returns `false` (does not throw) for `dayIndex` `0`, `lengthDays + 1`, `NaN`, `1.5`, so a client-supplied day can never open anything; `isOpen(season, d, now)` is `false` for every `d` other than the day in effect — core

### Hijri suggestion — `packages/core/src/season/hijri.test.ts`
26. `suggestRamadan(1447)` → `{ hijriYear: 1447, startDate: '2026-02-18', lengthDays: 30 }` (Umm al-Qura; Eid al-Fitr 20 March 2026) — core
27. Property for Hijri years 1440–1460: formatting `startDate` in `islamic-umalqura` gives month 9 day 1, the day before gives month 8, and `addDays(startDate, lengthDays)` gives month 10 day 1; `lengthDays` is 29 or 30 — core
28. `suggestRamadan` rejects a non-integer year or a year outside 1400–1500 with `DomainError('VALIDATION')` — core
29. `nextRamadanSuggestion(now, timezone)`: with `now = 2026-01-15T12:00Z`, `Europe/Stockholm` → the 1447 suggestion; with `now = 2026-02-18T12:00Z` (start day itself) → still 1447; with `now = 2026-02-19T12:00Z` → 1448 (start in Feb 2027) — core
30. The suggestion is advisory only: the returned object is a plain value and nothing in `season-rules.ts` imports `hijri.ts` (a season's `startDate` is always the admin-confirmed value) — core (checked by test 26 shape + code review)

### Exports and hygiene
31. `@noor/core` index re-exports the new functions and types; `packages/core/src/index.test.ts` asserts the public names exist — core — `index.test.ts`
32. `npm run lint && npm run typecheck && npm test` green; `packages/core` coverage does not drop — all

## Files and modules to touch

- `packages/core/src/time/local-date.ts` (+ `.test.ts`) — new. `LocalTime` type (`HH:mm`), `isValidLocalDate`, `parseLocalTime(s) → { hour, minute }`, `addDays(date, n)`, `daysBetween(a, b)`. Calendar math via `Date.UTC(...)` / `new Date(ms).toISOString()` on UTC values only. Move nothing out of `zoned.ts`; reuse its `LocalDate` type.
- `packages/core/src/time/zoned.ts` (+ `zoned.test.ts`) — add `zonedInstant(date: LocalDate, time: LocalTime, tz: TimeZone): Instant` built on the existing `localDateTime` / `formatterFor` (offset-guess and correct: compute the UTC guess from the wall fields, read the zone's wall time at the guess, adjust by the difference, then check candidates for gap/overlap per the "compatible" rule).
- `packages/core/src/season/season-rules.ts` (+ `.test.ts`) — new. `Season` type, `QuestionWindow`, `SeasonState`, `assertValidSeason`, `questionWindow`, `dayIndexAt`, `seasonState`, `isOpen`.
- `packages/core/src/season/hijri.ts` (+ `.test.ts`) — new. `RamadanSuggestion`, `suggestRamadan(hijriYear)`, `nextRamadanSuggestion(now, timezone)` using `Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', ... }).formatToParts`. If `resolvedOptions().calendar !== 'islamic-umalqura'`, throw `DomainError('INTERNAL', { reason: 'umalqura-unsupported' })`.
- `packages/core/src/index.ts` and `index.test.ts` — export the new modules.
- `docs/tasks/E03-seasons-questions.md` — the builder fills T030's **Notes** for T031 (the definitions above, and that T031's zod contract should mirror `assertValidSeason`). BOARD row per the factory flow.

No changes to `packages/contracts`, `packages/testkit`, `apps/*`, `firebase/`.

## Contracts and data shapes

```ts
// packages/core/src/time/local-date.ts
export type LocalTime = string;                       // 'HH:mm', 00:00–23:59, ASCII digits
export function isValidLocalDate(s: string): boolean; // strict YYYY-MM-DD, real calendar date
export function parseLocalTime(s: string): { hour: number; minute: number }; // throws VALIDATION
export function addDays(date: LocalDate, n: number): LocalDate;
export function daysBetween(from: LocalDate, to: LocalDate): number;   // to − from, in days

// packages/core/src/time/zoned.ts (addition)
export function zonedInstant(date: LocalDate, time: LocalTime, tz: TimeZone): Instant;

// packages/core/src/season/season-rules.ts
export interface Season {
  startDate: LocalDate;      // admin-confirmed local date of day 1
  lengthDays: number;        // integer 1..366
  timezone: TimeZone;        // IANA, validated with isValidTimeZone
  opensAtLocal: LocalTime;   // 'HH:mm'
  closesAtLocal: LocalTime;  // 'HH:mm'; <= opensAtLocal means "next local day"
}
export interface QuestionWindow { dayIndex: number; date: LocalDate; opensAt: Instant; closesAt: Instant }
export type SeasonState =
  | { phase: 'upcoming' }
  | { phase: 'active'; dayIndex: number; open: boolean }
  | { phase: 'ended' };

export function assertValidSeason(season: Season): void;                       // VALIDATION + reason
export function questionWindow(season: Season, dayIndex: number): QuestionWindow; // VALIDATION 'day-out-of-range'
export function dayIndexAt(season: Season, now: Instant): number | null;
export function seasonState(season: Season, now: Instant): SeasonState;
export function isOpen(season: Season, dayIndex: number, now: Instant): boolean;  // false for bad dayIndex

// packages/core/src/season/hijri.ts
export interface RamadanSuggestion { hijriYear: number; startDate: LocalDate; lengthDays: 29 | 30 }
export function suggestRamadan(hijriYear: number): RamadanSuggestion;
export function nextRamadanSuggestion(now: Instant, timezone: TimeZone): RamadanSuggestion;
```

`reason` values for `VALIDATION` (server logs only): `invalid-start-date`, `invalid-length`, `unknown-timezone` (already used by `zoned.ts`), `invalid-local-time`, `day-out-of-range`, `invalid-hijri-year`. No new `DomainErrorCode`; no HTTP mapping changes (`VALIDATION` → 400, `INTERNAL` → 500 already exist).

No Firestore shape in this task. T031 stores these five fields on `seasons/{seasonId}` alongside `tenantId`, as UTC-free local values plus the IANA zone (matches the AGENT.md date convention).

## Hard rules that apply here

- **Rule 1 (no vendor imports in core).** Only TypeScript and the platform `Intl` / `Date.UTC`. No `date-fns`, `luxon`, `@js-temporal/polyfill`, no zod (core has no zod dependency yet and this task does not need one). No new dependency at all.
- **Rule 5 (time from Clock).** Every function takes `now: Instant` as a parameter; none calls `Date.now()` or `new Date()` without an argument. `new Date(ms)` / `Date.UTC` are allowed only for pure calendar math on explicit values. No "test day" / override parameter exists — tests vary `now`.
- **Rule 6 (never trust client day/time).** `isOpen` is the single answer to "may this answer be accepted"; it treats any out-of-range or non-integer `dayIndex` as closed and never throws on it. Later routes must compute the day from `Clock` + season, not from the request.
- **Host-timezone independence.** No `Date#getHours`/`getTimezoneOffset`/local getters; all zone work goes through `Intl.DateTimeFormat` with an explicit `timeZone`, Gregorian calendar and `latn` digits (as `zoned.ts` already does), so Africa/Addis_Ababa (Ethiopic locale default) and Asia/Riyadh (Islamic locale default) still yield Gregorian ASCII.
- **Rule 11 / moon sighting.** The Hijri helper only suggests; the season's `startDate` and `lengthDays` are always what the admin confirms. `season-rules.ts` must not depend on `hijri.ts`.

## Out of scope

- zod schemas in `packages/contracts`, the `seasons` collection, repositories, routes, rules, and the web season form (all T031).
- Season `name`, `kind`, `tenantId`, `seasonId`, status flags, per-community timezone inheritance, per-user timezones.
- Weekly / non-daily cadences (Jumu'ah), skipping days, per-day custom times, grace periods, late submissions.
- Moon-sighting overrides beyond the admin entering `startDate`/`lengthDays`; other Hijri calendars (`islamic-civil`, `islamic-tbla`) or other months (Dhul Hijjah, Muharram suggestions).
- Questions, answers, scoring, streaks, reminders or anything that schedules work at `opensAt`.
- Changes to `Clock`, `FakeClock`, `makeTestDeps` or `Deps`.
- An ADR — no architectural choice is made beyond what AGENT.md already says (if the builder wants a Temporal polyfill instead of `Intl`, that is a new dependency and needs an ADR plus a separate task).
