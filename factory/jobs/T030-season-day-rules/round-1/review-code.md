VERDICT: PASS
# Code review — T030 round 1

Reviewed `git diff main...factory/T030-season-day-rules` (6 commits, 11 files, all under `packages/core` plus the E03 notes). Re-ran `npx vitest run packages/core` in the worktree (7 files, 236 tests pass) and `npm run typecheck` (clean).

## Findings
None must-fix.

## Acceptance tests
1. ok — local-date.test.ts "addDays(%s, %i)", "daysBetween(%s, %s)" (all spec rows, incl. leap day, year end, negative)
2. ok — local-date.test.ts "isValidLocalDate accepts/rejects" (includes Arabic-Indic digits, `T00:00` suffix, `2026-2-18`, empty)
3. ok — local-date.test.ts "parseLocalTime parses / rejects … DomainError VALIDATION"
4. ok — zoned.test.ts "zonedInstant %s %s in %s is %s" (all four spec rows)
5. ok — zoned.test.ts spring-forward gap (Stockholm, Toronto)
6. ok — zoned.test.ts fall-back overlap, earlier instant (Stockholm, Toronto)
7. ok — zoned.test.ts rejects unknown zone / invalid date / invalid time with reason; implementation uses only `Intl` with explicit `timeZone` and UTC math
8. ok — season-rules.test.ts "assertValidSeason rejects %s" (every listed case, reason asserted)
9. ok — season-rules.test.ts "every public season function rejects an invalid season" (questionWindow, dayIndexAt, seasonState, isOpen)
10–15. ok — season-rules.test.ts "questionWindow %s" (Stockholm, Riyadh, Addis, Toronto DST, Stockholm gap, Stockholm fall-back; expected instants match spec)
16. ok — "rejects dayIndex %j as day-out-of-range"
17. ok — "windows are non-empty and never overlap", over all table seasons plus the extra Santiago case
18–22, 24. ok — "day index and state at boundaries" asserts `dayIndexAt`, `seasonState` and `isOpen` together on every spec row; the `one day` season covers 24
23. ok — "day index never exceeds lengthDays" sweep (30-minute steps plus every edge ±1 min, monotonic, `null` exactly for upcoming/ended)
25. ok — "isOpen never trusts an arbitrary day" (0, 31, NaN, 1.5, −1, Infinity; true only for the day in effect)
26. ok — hijri.test.ts "suggests 18 February 2026 for 1447" (plain-object check included)
27. ok — hijri.test.ts "is Umm al-Qura 1 Ramadan for %i", years 1440–1460
28. ok — hijri.test.ts "rejects hijri year %j"
29. ok — hijri.test.ts "at %s in Europe/Stockholm suggests %i" plus the local-date-per-zone test
30. ok — verified in code: `season-rules.ts` imports nothing from `hijri.ts`; `hijri.ts` returns a plain value. There is no automated test for this, which the spec allows ("code review").
31. ok — index.test.ts "exports %s" lists all 12 new functions; `index.ts` re-exports the three new modules
32. ok — typecheck and the core tests re-run green; lint and the full suite were not re-run (build.md reports them passing). Coverage is not measurable because `@vitest/coverage-v8` is not installed (disclosed in build.md; not blocking).

All of these tests fail without the change, because the functions do not exist on main.

## Hard rules
1. ok — core imports only relative modules and `Intl` / `Date`; no new dependency
2. ok — no Firestore access added
3. ok — nothing persisted; no tenant data touched (T031 owns `tenantId`)
4. ok — no `Date.now()` or argless `new Date()` in non-test sources. `new Date(0)` / `new Date(ms)` is only used for calendar math on explicit values. `now` is always a parameter.
5. ok — no plan-name checks
6. ok — `isOpen` is the single gate and returns `false` (never throws) for any out-of-range or non-integer `dayIndex`; no client override parameter exists
7. ok — no uid used as a key
8. ok — no secrets in code or logs; error `details` carry only `reason` strings
9. ok — no AI output involved
10. ok — no questions or scheduling involved
11. ok — the Hijri helper is advisory, and `season-rules.ts` does not depend on it (moon-sighting rule respected)

## Scope
Changes are limited to the spec's file list. `docs/tasks/E03-seasons-questions.md` has the T031 notes. BOARD.md is untouched (the orchestrator owns it). The extra Santiago midnight fall-back test case stays inside this task's scope and strengthens the DST coverage.

## Correctness notes (checked by reading the code)
- `zonedInstant`: offsets are sampled one day either side of the wall time. Candidates are kept only if they round-trip, then the earliest is taken. For a gap, the pre-transition offset is used. I traced Stockholm 02:30 on 29 Mar (gap → 01:30Z) and 25 Oct (overlap → 00:30Z) by hand and both match.
- `dayInEffect`: the start guess is clamped to `1..lengthDays`, then it steps down and up on `opensAt`. Opens are strictly increasing, so the result is exact. A Riyadh `now` that falls on a local date after the last season date (spec test 19) clamps correctly to day 30.
- `addDays` and `daysBetween` use `setUTCFullYear`, so years 0–99 (Hijri epoch 0622 is fine, but this is safe for 00xx too) are not shifted to 19xx.

## Nits (non-blocking)
- season-rules.ts:70–79 — when `closesAtLocal > opensAtLocal` on the same date and the open time falls in a spring-forward gap while the close time exists, e.g. open `02:30` (→ 03:30), close `03:15` in a gap zone, `closesAt < opensAt` and the day's window is negative (never open). This follows the spec's definition literally and the spec's property test only covers its table seasons. T031 may want `assertValidSeason` or the admin form to warn about open/close times that straddle a DST transition, or a later task to clamp `closesAt` to at least `opensAt`.
- hijri.ts:52 — `nextRamadanSuggestion` throws `VALIDATION invalid-hijri-year` when the current Hijri year is at the 1500 edge. That is harmless for decades, but the error reason is misleading for a caller who passed a valid `now`.
- build.md notes `core.autocrlf=true` produced CRLF checkouts that broke `prettier --check` and a docs test. A `.gitattributes` (`* text=auto eol=lf`) is a reasonable separate task.
- Test 30 (no import of `hijri.ts` from `season-rules.ts`) is only enforced by review. If lint tooling later supports import-boundary rules, this is a good candidate.
