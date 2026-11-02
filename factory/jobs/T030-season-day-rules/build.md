# Build — T030 (round 1)
Branch: factory/T030-season-day-rules
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T030-season-day-rules

## Changes
- packages/core/src/time/local-date.ts (+ test) — new. `LocalTime`, `isValidLocalDate` (strict ASCII `YYYY-MM-DD`, real date), `parseLocalTime` (`HH:mm`, VALIDATION `invalid-local-time`), `addDays`, `daysBetween`. Pure UTC calendar math (`setUTCFullYear` so years < 100 such as the Hijri epoch 0622 are not shifted to 19xx). Invalid input → VALIDATION `invalid-local-date` / `invalid-day-count`.
- packages/core/src/time/zoned.ts (+ test) — added `zonedInstant(date, time, tz)`: wall time as UTC, offsets read one day either side, candidates kept only if they round-trip; two valid → earlier (overlap); none → pre-transition offset (gap moves forward). Only `Intl` with explicit `timeZone`, no local `Date` getters.
- packages/core/src/season/season-rules.ts (+ test) — new. `Season`, `QuestionWindow`, `SeasonState`, `assertValidSeason`, `questionWindow`, `dayIndexAt`, `seasonState`, `isOpen` exactly per the spec definitions. Day in effect: start at the day of `now`'s local date (clamped), step down while not opened, step up while the next has opened — exact from any start because opens are strictly increasing, and costs ~2–3 `zonedInstant` calls instead of a binary search. Does not import `hijri.ts`.
- packages/core/src/season/hijri.ts (+ test) — new. `RamadanSuggestion`, `suggestRamadan(year)` (mean-lunar-month estimate, then ±15-day scan with `Intl` `islamic-umalqura`, UTC, `latn`), `nextRamadanSuggestion(now, tz)` (first Ramadan starting on/after today's local date). Throws INTERNAL `umalqura-unsupported` if the runtime lacks the calendar, VALIDATION `invalid-hijri-year` outside integer 1400–1500.
- packages/core/src/index.ts, index.test.ts — re-export the new modules; test asserts every new public function name.
- docs/tasks/E03-seasons-questions.md — T030 Notes for T031 (definitions; zod contract should mirror `assertValidSeason`; routes use `isOpen(season, dayIndexAt(...), now)`).

No new dependency. No changes to contracts, testkit, apps, firebase.

## Acceptance tests → test files
1. addDays / daysBetween → packages/core/src/time/local-date.test.ts "addDays(...)", "daysBetween(...)"
2. isValidLocalDate → local-date.test.ts "isValidLocalDate accepts/rejects"
3. parseLocalTime → local-date.test.ts "parseLocalTime parses / rejects ... with DomainError VALIDATION"
4. zonedInstant plain cases → packages/core/src/time/zoned.test.ts "zonedInstant %s %s in %s is %s"
5. spring-forward gap → zoned.test.ts "moves ... (spring-forward gap) forward"
6. fall-back overlap → zoned.test.ts "takes the earlier instant ... (fall-back overlap)"
7. invalid zone/date/time → zoned.test.ts "rejects an unknown zone / invalid date / invalid time" (implementation uses only `Intl` + UTC math)
8. assertValidSeason → packages/core/src/season/season-rules.test.ts "assertValidSeason accepts / rejects ..."
9. invalid season rejected by every public function → season-rules.test.ts "every public season function rejects an invalid season"
10–15. question windows (Stockholm, Riyadh, Addis 24h, Toronto DST, Stockholm gap, Stockholm fall-back) → season-rules.test.ts "questionWindow <label>"
16. day-out-of-range → season-rules.test.ts "rejects dayIndex %j as day-out-of-range"
17. non-overlap / non-empty property → season-rules.test.ts "%s: windows are non-empty and never overlap"
18–22, 24. boundary rows (dayIndexAt + seasonState + isOpen together) → season-rules.test.ts "day index and state at boundaries" (includes `one day` rows for 24)
23. sweep (30-min steps + every edge ±1 min, monotonic, null iff upcoming/ended) → season-rules.test.ts "day index never exceeds lengthDays"
25. isOpen false for bad days / any day but the one in effect → season-rules.test.ts "isOpen never trusts an arbitrary day"
26. suggestRamadan(1447) → packages/core/src/season/hijri.test.ts "suggests 18 February 2026 for 1447" (also asserts a plain object)
27. 1440–1460 property → hijri.test.ts "is Umm al-Qura 1 Ramadan for %i"
28. invalid Hijri year → hijri.test.ts "rejects hijri year %j"
29. nextRamadanSuggestion → hijri.test.ts "at %s in Europe/Stockholm suggests %i" + "uses the local date in the given zone"
30. advisory only → plain-value shape in test 26; `season-rules.ts` has no import of `hijri.ts` (code review — a source-reading test would need `node:fs` types, which core's tsconfig deliberately excludes)
31. exports → packages/core/src/index.test.ts "exports %s"
32. lint/typecheck/test → see below

All hand-worked expected instants in the spec matched Node 22 ICU; none were changed.

Extra case added: America/Santiago midnight fall-back (4 April 2026 is 25 local hours, local date reads 4 April twice) — day 2 stays in effect until 00:00 −04 on 5 April (04:00Z), also included in the sweep and non-overlap property.

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (30 files, 392 tests) |
| npm run test:emulator | not relevant (no adapter or rules touched) |
| npm run test:e2e | not relevant (no UI) |
| coverage | not measurable: `@vitest/coverage-v8` is not installed; every new branch is exercised by the tables above except the `INTERNAL` throws in `hijri.ts` (runtime without Umm al-Qura / Ramadan not found in the scan window), which cannot occur on Node 22 full-ICU |

## Commits
- f7c7e23 T030: local date helpers (addDays, daysBetween, isValidLocalDate, parseLocalTime)
- c9f7b80 T030: zonedInstant with compatible DST disambiguation
- a57bf1e T030: season rules (question windows, day in effect, state, isOpen)
- f322e38 T030: Umm al-Qura Ramadan start suggestion
- 79db1e2 T030: export season rules and time helpers from @noor/core
- a607819 T030: notes for T031 in E03

## Notes for reviewers
- Windows line endings: system git config has `core.autocrlf=true`, so the worktree was checked out with CRLF and `prettier --check` (94 files) plus `tooling/src/docs-commands.test.ts` (regex on `\n`) failed on untouched files. Repo content is LF. I re-checked out the tracked files in this worktree with `core.autocrlf=false` (no content change, `git status` clean) and then everything passed. Worth a `.gitattributes` (`* text=auto eol=lf`) in a separate task.
- `isOpen` validates the season (throws on an invalid season, per spec test 9) but never throws for a bad `dayIndex`.
- Performance: each public call re-validates the season and formats via cached `Intl.DateTimeFormat`; the full season suite runs in ~2 s, most of it the sweep test.
- BOARD.md row not touched (orchestrator owns it).

## Round 2
- merge.md: rebase onto origin/main (now with T010a, 63b61d9) conflicted in packages/core/src/index.ts at commit "T030: export season rules and time helpers from @noor/core" -> rebased again and kept both export groups: T030 `time/local-date`, `season/season-rules`, `season/hijri` and T010a `users/user`, `usecases/get-or-create-user` (plus T010a's `ports/id-generator` and `ports/repos` type exports, which merged cleanly). Resolved in 9d9722d.
- index.test.ts auto-merged with only the T030 names; extended it in the same commit so it also asserts T010a's public runtime exports (`isUlid`, `asUserId`, `identityId`, `normaliseDisplayName`, `getOrCreateUser`, `ULID_PATTERN`, `SUBJECT_PATTERN`, `USER_SCHEMA_VERSION`).
- No other files conflicted; no T030 logic changed. All six commits were rewritten by the rebase (new hashes below).
- Checks after rebase: npm run lint pass, npm run typecheck pass, npm test pass (35 files, 462 tests). Emulator and e2e not relevant.
- Commits now: fbf1d28, 221899c, aa6bf6f, 5d10f73, 9d9722d, 186758c (same subjects as round 1).
