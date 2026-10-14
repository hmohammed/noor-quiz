VERDICT: PASS
# Code review — T003 round 1

Scope of this review: `git diff main...factory/T003-clock-config-errors`, using the branch worktree. I re-ran `npx vitest run` (24 files, 171 tests, all pass) and `npx eslint .` (clean). I did not read or create any `.env*` file.

## Findings
No must-fix findings in the code.

- [known gap, already escalated] `apps/api/.env.example` is missing. Apart from that file, the branch is correct and complete against spec.md. Once the file is added (content as in build.md), nothing else needs to change. `ensure-env-local.mjs` (apps/api/scripts/ensure-env-local.mjs:15) and the `dev:emulators` script depend on it. It must be committed together with this branch, because `NOOR_ENV` is now required and the function fails at cold start without it. The human still needs to run `npm run dev` once, as build.md says.

## Acceptance tests
1. ok — packages/testkit/src/fake-clock.test.ts Stockholm winter
2. ok — fake-clock.test.ts Stockholm summer
3. ok — fake-clock.test.ts Stockholm DST (4 cases)
4. ok — fake-clock.test.ts Addis Ababa (both cases)
5. ok — fake-clock.test.ts Gregorian ASCII, plus zoned.test.ts. The formatter pins `calendar: 'gregory'` and `numberingSystem: 'latn'` (packages/core/src/time/zoned.ts:30).
6. ok — fake-clock.test.ts API cases. The implementation is at packages/testkit/src/fake-clock.ts:14-44.
7. ok — packages/core/src/time/zoned.test.ts and instant.test.ts
8. ok — apps/api/src/adapters/system/clock.test.ts
9. ok — apps/api/src/errors.test.ts `it.each` over `statusForCode`, plus an exhaustiveness check
10. ok — errors.test.ts details not leaked (sentinels checked in the body)
11. ok — errors.test.ts generic 500
12. ok — errors.test.ts 404, and health.test.ts still passes
13. ok — packages/contracts/src/error.test.ts
14. ok — apps/api/src/config.test.ts missing NOOR_ENV
15. ok — config.test.ts invalid NOOR_ENV lists the allowed values
16. ok — config.test.ts sentinel absent. It also asserts that `banana` and `SOME_SECRET` are absent.
17. ok — config.test.ts typed config, defaults, unknown keys ignored
18. ok — apps/api/src/composition.test.ts. It counts SystemClock constructions to prove nothing is built when config is invalid.
19. ok — packages/testkit/src/make-test-deps.test.ts

The tests assert real behaviour, and all of them would fail without the change: the modules do not exist on main.

## Hard rules
1. ok — core imports only TS and `Intl`. The `Date.parse` and `new Date(ms)` calls in instant.ts are deterministic and allowed by the spec.
2. ok — Clock port in core, SystemClock in api, FakeClock in testkit. `composition.ts` is the only place that picks the adapter.
3. ok — no Firestore or client writes in this diff.
4. ok — no tenant-owned data or repositories in this task.
5. ok — `Date.now()` appears only in apps/api/src/adapters/system/clock.ts:6. The new lint rule is in eslint.config.js and has its own test. There is no test-mode env var or header, and testkit is imported only by tests.
6. ok — nothing reads client time, role or tenant.
7. ok — no plan-name checks.
8. ok — no ids introduced.
9. ok — `ConfigError` messages are built from key names and allowed values only. Unknown errors log only the error, not the request (apps/api/src/errors.ts:52). No secrets in the diff.
10. ok — no AI code.
11. ok — no content scheduling.

## Scope
Within spec. The extras are small and justified:
- the Feb-30 overflow check in `instantFromIso`
- `tooling/src/eslint-clock-rule.test.ts`
- `ensure-env-local.test.mjs`
- the vitest include for `scripts/**/*.test.mjs`

## Correctness
- Day boundaries, DST and Addis Ababa are covered with exact second-level instants.
- `isDomainError` works across module copies. An unknown code maps to INTERNAL.
- `ensure-env-local` uses COPYFILE_EXCL, so it is atomic and idempotent.
- Empty-string env values count as missing, which is documented.
- `localDateTime` formats from `formatToParts(i)` with `h23`, so there is no "24:00" edge.

## Tests
Fakes come from testkit. There are no sleeps and no network. The `console.error` spy is restored in `afterEach`. The tooling lint tests take about 5 s each, which is acceptable.

## i18n/RTL
No UI. The API messages are fixed English fallbacks keyed by `code`, as the spec says.

## Dependencies
`@noor/core` and `@noor/testkit` are workspace packages. `zod ^4.6.6` is already in the lockfile and uses the same range as contracts. No new third-party package.

## Nits (non-blocking)
- package.json `dev:emulators`: `&&FUNCTIONS_DISCOVERY_TIMEOUT=60` lost the space after `&&` that the original had. It is valid in POSIX shells, but restore the space for readability.
- `FakeClock.advance` throws `RangeError` rather than `DomainError`. The spec only says "throws", and build.md justifies this.
