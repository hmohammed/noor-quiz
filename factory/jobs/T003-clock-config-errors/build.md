# Build — T003 (round 1)
Branch: factory/T003-clock-config-errors
Worktree: /mnt/c/Users/hassen.mohammed/Downloads/noor-quiz/.claude/worktrees/agent-ad31d0fba8b0573db

## NEEDS HUMAN: `apps/api/.env.example` is NOT in this branch
A permission deny rule blocked my write to `apps/api/.env.example` (the Write tool reported that the file "is covered by a Read deny rule"). I did not try to get around it. The rest of the spec is done. **Do not merge until a human adds this file.** Without it, `npm run dev:emulators` (and so `npm run dev` and `npm run test:e2e`) stops at `ensure-env-local.mjs` with ENOENT. Even without that script, the function now fails at cold start because `NOOR_ENV` is required. Intended content (no secrets):

```
# Non-secret API config, validated at startup by src/config.ts.
# `npm run dev` copies this file to .env.local (gitignored) if that file is missing;
# the Functions emulator loads .env.local from this directory.
#
# Never put secrets here or in any .env file. Secrets come from Secret Manager /
# function secrets (AGENT.md rule 9).

# Deployment environment: local | dev | staging | prod
NOOR_ENV=local

# Log level: debug | info | warn | error (default: info)
LOG_LEVEL=info
```
`.gitignore` already has `!.env.example`, so it can be committed. Check it with `npx prettier --check apps/api/.env.example` (prettier probably ignores it anyway).

## Changes
- packages/contracts/src/error.ts (+ test, index export): strict `ErrorResponse` / `ErrorCode` schema.
- packages/core/src/errors.ts (+ test): `DOMAIN_ERROR_CODES`, `DomainErrorCode`, `DomainError(code, details?)` (`details` is `declare`d so it is absent when not given), `isDomainError` (checks name + known code, works across module copies), `isDomainErrorCode`.
- packages/core/src/time/instant.ts (+ test): branded `Instant`, `Duration`, `instantFromIso` (Z-only regex plus a calendar-overflow check, e.g. rejects Feb 30), `instantFromMs`, `toIso`, `durationToMs`, `addDuration`.
- packages/core/src/time/zoned.ts (+ test): `TimeZone`, `LocalDate`, `LocalDateTime`, `isValidTimeZone`, `localDate`, `localDateTime`. Uses `Intl.DateTimeFormat('en-US', { calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23' })` with one cached formatter per zone. An unknown zone throws `DomainError('VALIDATION')`.
- packages/core/src/ports/clock.ts: `Clock { now(): Instant }`.
- packages/core/src/deps.ts: `Deps { clock: Clock }`.
- packages/core/src/index.ts: re-exports. Keeps `PACKAGE_NAME`.
- packages/testkit/src/fake-clock.ts (+ test): `FakeClock` with `DEFAULT_START` = 2026-01-01T00:00:00.000Z, `set(Instant|ISO-Z)`, `advance(ms|Duration)`. `advance` rejects negative or non-finite durations and leaves the state unchanged.
- packages/testkit/src/make-test-deps.ts (+ test): `TestDeps`, `makeTestDeps(overrides?)`.
- apps/api/src/adapters/system/clock.ts (+ test): `SystemClock`, the only `Date.now()` in api.
- apps/api/src/config.ts (+ test): `ConfigSchema`, `Config { env, logLevel }`, `ConfigError`, `loadConfig(env)`. Copies only known keys into the parse input. An empty string counts as missing. Messages are built from key names and the schema's allowed values only, never from received values.
- apps/api/src/errors.ts (+ test): exhaustive `statusForCode` and `publicMessage`, `toErrorResponse`, `installErrorHandling` (onError + JSON notFound). It calls `console.error` only for non-domain errors and `INTERNAL`, and never logs the request.
- apps/api/src/composition.ts (+ test): `createComposition(env, { version })` → `AppRoot`. It runs config first, then builds adapters.
- apps/api/src/app.ts: `createApp({ deps, version })`, calls `installErrorHandling`, health route unchanged.
- apps/api/src/function.ts: `createComposition(process.env, …)` at module load, so it fails fast at cold start.
- apps/api/src/routes/health.test.ts: uses `makeTestDeps()`. Assertions unchanged.
- apps/api/package.json / package-lock.json: `@noor/core`, `zod@^4.6.6` (already in the lockfile, same range as contracts), dev `@noor/testkit`. No new third-party dependency.
- apps/api/tsconfig.json: references core, contracts, testkit. `tsc -b` passes.
- apps/api/scripts/ensure-env-local.mjs (+ `.test.mjs`): `ensureEnvLocal(dir)` uses `copyFile(..., COPYFILE_EXCL)`. It is atomic and idempotent, never reads or overwrites an existing `.env.local`, and prints only a fixed line with file names.
- apps/api/vitest.config.ts: also runs `scripts/**/*.test.mjs`.
- package.json: `dev:emulators` now starts with `node apps/api/scripts/ensure-env-local.mjs &&`.
- eslint.config.js: `no-restricted-syntax` bans `Date.now()` and argument-less `new Date()` in `packages/core/**` and `apps/api/src/routes/**`, with the message "Use the Clock port (AGENT.md rule 5)".
- tooling/src/eslint-clock-rule.test.ts: regression test for that lint rule. It fires in core and routes, not in the adapter folder, and allows `new Date(ms)`.
- docs/tasks/E00-foundation.md: T003 Notes (Instant, Deps in core, per-code public messages, `.env.local` bootstrapping, deferred start-of-day helpers).

## Acceptance tests → test files
1. Stockholm winter → packages/testkit/src/fake-clock.test.ts "Stockholm in winter (UTC+1)"
2. Stockholm summer → fake-clock.test.ts "Stockholm in summer (UTC+2)"
3. Stockholm DST days (4 cases) → fake-clock.test.ts "Stockholm DST: …"
4. Addis Ababa midnight, and local date ahead of UTC → fake-clock.test.ts "Addis Ababa (UTC+3, no DST)", "Addis Ababa is already on the next day while UTC is not"
5. Gregorian ASCII across Ethiopian New Year eve → fake-clock.test.ts "Addis Ababa gives Gregorian ASCII dates across Ethiopian New Year eve" (also packages/core/src/time/zoned.test.ts "is Gregorian with ASCII digits…")
6. FakeClock API → fake-clock.test.ts "starts at the fixed constant…", "set() accepts an Instant or an ISO-Z string", "advance() accepts milliseconds or a duration object", "advance(%j) with a negative duration throws", "set(%j) without a Z suffix throws"
7. Zoned helpers → packages/core/src/time/zoned.test.ts "%s rejects an unknown zone with DomainError VALIDATION", "isValidTimeZone"; packages/core/src/time/instant.test.ts "round-trips %s"
8. SystemClock → apps/api/src/adapters/system/clock.test.ts "returns an Instant between two Date.now() readings"
9. Every code → status + ErrorResponse → apps/api/src/errors.test.ts "a thrown DomainError(%s) gives status %i and a contract-valid body" (+ "maps every core code")
10. details not leaked → errors.test.ts "never puts DomainError details in the response body"
11. Unknown error → generic 500 → errors.test.ts "turns an unknown error into a generic 500 without its message or stack"
12. Unknown path → 404 NOT_FOUND → errors.test.ts "gives a contract-valid 404 NOT_FOUND for an unknown path"; health.test.ts 404 cases still pass
13. ErrorResponse rejects extra keys, a lowercase code and an empty message → packages/contracts/src/error.test.ts "rejects %s"
14. Missing NOOR_ENV → apps/api/src/config.test.ts "fails fast naming NOOR_ENV when it is missing"
15. Invalid NOOR_ENV lists allowed values → config.test.ts "names NOOR_ENV and lists the allowed values when it is invalid"
16. No env values in the message → config.test.ts "never puts env values in the error message"
17. Typed config, defaults, unknown keys ignored → config.test.ts "returns a typed config with defaults applied", "ignores unknown env keys…"
18. Composition fails before deps / SystemClock wired → apps/api/src/composition.test.ts "throws ConfigError before building any deps (%s)" (counts SystemClock constructions via vi.mock), "wires a SystemClock…"
19. makeTestDeps → packages/testkit/src/make-test-deps.test.ts

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (24 files, 171 tests) |
| npm run build -w @noor/api | pass (bundle builds with core + zod) |
| eslint --stdin probe of Date.now()/new Date() in core, routes, adapter | flagged in core and routes, allowed in adapter (now covered by tooling test) |
| npm run test:emulator | not relevant / does not exist yet (T004). No Firestore adapters or rules touched |
| npm run test:e2e | not run: it starts `dev:emulators`, which now runs `ensure-env-local.mjs` in the repo and would create `apps/api/.env.local`. I was told not to do that, and `.env.example` is missing anyway (see above). No UI was touched |

## Needs human check
- Add `apps/api/.env.example` (content above). A permission rule blocked the write.
- After that, run `npm run dev` (or `npm run test:e2e`) once. Confirm `apps/api/.env.local` is created, that the Functions emulator loads it (health returns 200), and that the function does not fail at cold start with `ConfigError`. I did not run this because it writes `apps/api/.env.local`.
- Optional: delete `.env.local` (or set `NOOR_ENV=banana`) and confirm the emulator log shows `Invalid API config: NOOR_ENV …` at load time.

## Commits
- 03836c8 T003: ErrorResponse contract schema
- c0a074a T003: core DomainError, Instant, zoned date helpers, Clock port and Deps
- 9afa266 T003: FakeClock and makeTestDeps in testkit
- 505bdf4 T003: format core instant.ts
- 4e59594 T003: SystemClock adapter and zod-validated API config
- b00f539 T003: DomainError to HTTP mapping, composition root, createApp(root)
- 3da4e30 T003: ensure-env-local bootstrap script for the Functions emulator
- 13a42d6 T003: lint rule banning Date.now()/new Date() in core and routes
- ada890a T003: notes for the next tasks in E00

## Notes for reviewers
- `instantFromIso` checks the parsed value against the input's date/time prefix, so engine rollover (Feb 30 → Mar 2) is rejected. The spec only asked for Z-only, so this is a little stricter.
- `loadConfig` treats `''` as missing. An emulator `.env` line like `NOOR_ENV=` then reports "is required" instead of "must be one of".
- `installErrorHandling` does not log expected DomainErrors (4xx) at all. Only unknown errors and `INTERNAL` reach `console.error`. Their `details` are still never serialised.
- The test-only throwing routes live only in `errors.test.ts`. A test asserts that `createApp` itself returns 404 for them.
- `FakeClock.advance` throws `RangeError` (not `DomainError`) for negative durations, because it is test misuse and not a domain failure. `set()` with a non-Z string throws `DomainError('VALIDATION')` via `instantFromIso`.
- The `ensure-env-local` test runs only in a temp dir from `mkdtemp`.
