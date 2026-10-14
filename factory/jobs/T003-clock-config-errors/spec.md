# Spec — T003 Clock port, typed config and domain errors

Size check: one new port (`Clock`) with fake + adapter, no screen, no page, no migration. Fits in a day. No split.

## Acceptance tests

AC1: FakeClock across midnight gives the expected local dates.

1. `localDate(clock.now(), 'Europe/Stockholm')`. In winter (UTC+1): `2026-01-15T22:59:59.000Z` gives `2026-01-15`. After `advance({ seconds: 1 })` it gives `2026-01-16`. Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
2. Stockholm in summer (UTC+2): `2026-07-15T21:59:59.000Z` gives `2026-07-15`. After +1 s it gives `2026-07-16`. Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
3. Stockholm on DST change days. On spring-forward, `2026-03-28T22:59:59Z` gives `2026-03-28` and +1 s gives `2026-03-29`. Then `2026-03-29T21:59:59Z` gives `2026-03-29` and +1 s gives `2026-03-30`. On fall-back, `2026-10-24T21:59:59Z` gives `2026-10-24` and +1 s gives `2026-10-25`. Then `2026-10-25T22:59:59Z` gives `2026-10-25` and +1 s gives `2026-10-26`. Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
4. Africa/Addis_Ababa (UTC+3, no DST): `2026-03-01T20:59:59Z` gives `2026-03-01`. After +1 s it gives `2026-03-02`. Also, `2026-03-01T23:30:00Z` is already `2026-03-02` locally while the UTC date is still 03-01. Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
5. Addis_Ababa always comes out as a Gregorian date with ASCII digits (`/^\d{4}-\d{2}-\d{2}$/`), never an Ethiopic-calendar date. One case: advance by `{ days: 1 }` from `2026-09-10T21:00:00Z`, which is Ethiopian New Year eve. Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
6. FakeClock API:
   - The default start is the fixed constant `2026-01-01T00:00:00.000Z`, never system time.
   - `set()` accepts an Instant or an ISO-Z string.
   - `advance()` accepts ms or `{ days, hours, minutes, seconds, ms }`.
   - `advance()` with a negative duration throws.
   - `set()` with a non-UTC or offset-less ISO string throws. The instant must be timezone-agnostic.
   - Layer: core. File: `packages/testkit/src/fake-clock.test.ts`
7. Zoned helpers in core:
   - `localDate` and `localDateTime` reject an unknown IANA zone with `DomainError('VALIDATION')`.
   - `isValidTimeZone` returns true/false.
   - `instantFromIso` / `toIso` round-trip.
   - Layer: core. File: `packages/core/src/time/zoned.test.ts`, `packages/core/src/time/instant.test.ts`
8. `SystemClock.now()` returns an Instant between two `Date.now()` readings taken in the test. Layer: adapter (plain unit, no emulator). File: `apps/api/src/adapters/system/clock.test.ts`

AC2: thrown DomainError gives `{ error: { code, message } }` with the mapped status.

9. Route test. Build the app with `createApp({ deps: makeTestDeps(), version: 'test-1' })`, add a test-only route that throws `new DomainError(code)`, and run `it.each` over every code in `statusForCode`. Expect the mapped status and a body that passes `ErrorResponse.parse` with the same `code`. Layer: api. File: `apps/api/src/errors.test.ts`
10. `details` passed to DomainError (e.g. `{ tenantId: 'x', secret: 'y' }`) never shows up in the response body. Layer: api. File: `apps/api/src/errors.test.ts`
11. A thrown non-DomainError (`new Error('db password=…')`) gives 500 `{ error: { code: 'INTERNAL', message: 'Internal error' } }`. The original message and stack are not in the body. Layer: api. File: `apps/api/src/errors.test.ts`
12. An unknown path gives 404 with a contract-valid `ErrorResponse` with code `NOT_FOUND`. The existing `health.test.ts` 404 cases still pass. Layer: api. File: `apps/api/src/errors.test.ts`
13. `ErrorResponse` schema rejects:
    - extra keys (strict)
    - a lowercase code
    - an empty message
    - Layer: core (contracts unit). File: `packages/contracts/src/error.test.ts`

AC3: fail fast with a clear message when required config is missing.

14. `loadConfig({})` throws `ConfigError`. Its message names `NOOR_ENV` and says it is missing. Layer: api. File: `apps/api/src/config.test.ts`
15. `loadConfig({ NOOR_ENV: 'banana' })` throws `ConfigError`. The message names `NOOR_ENV` and lists the allowed values. Layer: api. File: `apps/api/src/config.test.ts`
16. When `loadConfig` throws, the error message does not contain any env values. Test it with `{ NOOR_ENV: 'banana', SOME_SECRET: 'hunter2-sentinel' }` and assert the sentinel string is absent. Layer: api. File: `apps/api/src/config.test.ts`
17. `loadConfig({ NOOR_ENV: 'local' })` returns a typed config, and defaults are applied (`LOG_LEVEL` = `info`). Unknown env keys are ignored and not copied into the config. Layer: api. File: `apps/api/src/config.test.ts`
18. `createComposition(env, { version })` throws `ConfigError` before building any deps when config is invalid. With a valid env, `deps.clock` is a `SystemClock`. Layer: api. File: `apps/api/src/composition.test.ts`

Support:

19. `makeTestDeps()` returns `{ clock: FakeClock }` and satisfies the core `Deps` type. `makeTestDeps({ clock })` overrides it. Layer: core. File: `packages/testkit/src/make-test-deps.test.ts`

There are no new business routes, so no unauthorised or wrong-tenant tests apply. The only route added is test-only, inside test files. It must never be registered in `createApp`.

## Files and modules to touch

Core (`@noor/core`, no deps added; Intl is built into the platform):
- `packages/core/src/time/instant.ts` (+ `.test.ts`):
  - `Instant` is a branded epoch-ms number.
  - `instantFromIso(iso)` accepts only `Z` strings and throws `DomainError('VALIDATION')` otherwise.
  - `toIso(i)`, `addDuration(i, d)`, `Duration` type.
  - `toIso` may use `new Date(ms).toISOString()`, which is deterministic. `Date.now()` and argument-less `new Date()` are banned.
- `packages/core/src/time/zoned.ts` (+ `.test.ts`):
  - `type TimeZone = string` (IANA). `type LocalDate = string` (`YYYY-MM-DD`).
  - `isValidTimeZone(tz)`, `localDate(i, tz)`, `localDateTime(i, tz)` → `{ date, hour, minute, second }`.
  - Use `Intl.DateTimeFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23', year/month/day/hour/minute/second numeric/2-digit }).formatToParts(ms)`.
  - Cache formatters per tz.
  - Do not add zoned→instant (start-of-local-day) helpers yet. See Out of scope.
- `packages/core/src/ports/clock.ts`: `export interface Clock { now(): Instant }`. Nothing else.
- `packages/core/src/errors.ts` (+ `.test.ts`):
  - `DOMAIN_ERROR_CODES` as a const array, plus the `DomainErrorCode` union.
  - `class DomainError extends Error { readonly code; readonly details?: Readonly<Record<string, unknown>> }`. `name = 'DomainError'`.
  - `isDomainError(e)` type guard. It must work across module copies, so check `name` and `code` membership, not only `instanceof`.
- `packages/core/src/deps.ts`: `export interface Deps { clock: Clock }`. This is the dependency bag for use cases. Later tasks extend it.
- `packages/core/src/index.ts`: re-export all of the above. Keep `PACKAGE_NAME`.

Contracts:
- `packages/contracts/src/error.ts` (+ `.test.ts`): the `ErrorResponse` schema. Export it from `index.ts`.

Testkit:
- `packages/testkit/src/fake-clock.ts` (+ `.test.ts`): `FakeClock implements Clock` with `now()`, `set()`, `advance()`, and `static readonly DEFAULT_START`.
- `packages/testkit/src/make-test-deps.ts` (+ `.test.ts`): `makeTestDeps(overrides?: Partial<TestDeps>): TestDeps`, where `TestDeps = Deps & { clock: FakeClock }`.
- `packages/testkit/src/index.ts`: re-export these.

API:
- `apps/api/src/adapters/system/clock.ts` (+ `.test.ts`): `SystemClock implements Clock`. This is the only place in api that reads `Date.now()`.
- `apps/api/src/config.ts` (+ `.test.ts`):
  - `ConfigSchema` (zod).
  - `type Config`.
  - `class ConfigError extends Error`.
  - `loadConfig(env: Record<string, string | undefined>): Config`. It takes env as a parameter and never reads `process.env` itself.
- `apps/api/src/errors.ts` (+ `.test.ts`):
  - `statusForCode: Record<DomainErrorCode, ContentfulStatusCode>`. It is an exhaustive `Record`, so a new core code that has no mapping fails typecheck.
  - `publicMessage: Record<DomainErrorCode, string>`.
  - `toErrorResponse(err): { status, body }`.
  - `installErrorHandling(app)`: sets `app.onError` and `app.notFound`.
  - The unknown-error path logs `console.error` with the error, but not the request body or headers.
- `apps/api/src/composition.ts` (+ `.test.ts`):
  - `createComposition(env, { version }): AppRoot`, where `AppRoot = { config: Config; deps: Deps; version: string }`.
  - This is the only place that chooses adapters.
- `apps/api/src/app.ts`:
  - `createApp(root: { deps: Deps; version: string })`, replacing `AppOptions` (as the T002 note asks).
  - Call `installErrorHandling(app)`.
  - Mount health unchanged.
- `apps/api/src/function.ts`:
  - `const root = createComposition(process.env, { version: __NOOR_VERSION__ })` at module load, which makes it fail fast at cold start. Then `createApp(root)`.
- `apps/api/src/routes/health.test.ts`: switch to `createApp({ deps: makeTestDeps(), version: 'test-1' })`. Assertions stay the same.
- `apps/api/package.json`:
  - Add `@noor/core: "*"` and `zod` to dependencies, using the same range as contracts (`^4.6.6`). zod is already in the lockfile, so this is not a new dependency.
  - Add `@noor/testkit: "*"` to devDependencies.
- `apps/api/tsconfig.json`: add references to `../../packages/core` and `../../packages/testkit`. Check that `tsconfig.base.json` / root `tsconfig.json` references still build with `tsc -b`.
- `apps/api/.env.example`: `NOOR_ENV=local` and `LOG_LEVEL=info`, with a comment that secrets never go here and come from Secret Manager.
  - The Functions emulator loads `.env.local` from the functions source dir (`apps/api`). That file is gitignored.
- `apps/api/scripts/ensure-env-local.mjs`: tiny, idempotent. It copies `.env.example` → `.env.local` only if `.env.local` is missing, and prints nothing that it reads.
  - Prefix `dev:emulators` in the root `package.json` with it, so `npm run dev` and e2e keep working now that `NOOR_ENV` is required. This counts as touching `.env.example` and creating a gitignored local file from it; it never reads or edits a real `.env`.

Lint (enforces rule 5, small):
- `eslint.config.js`: add `no-restricted-syntax` for `packages/core/**` and `apps/api/src/routes/**`. It bans:
  - `CallExpression[callee.object.name='Date'][callee.property.name='now']`
  - `NewExpression[callee.name='Date'][arguments.length=0]`
  - The message is "Use the Clock port (AGENT.md rule 5)".

Docs:
- `docs/tasks/E00-foundation.md` T003 Notes: record the decisions for the next tasks:
  - the Instant representation
  - `Deps` lives in core
  - error messages are per-code public strings
  - `.env.local` bootstrapping
  - start-of-day helpers are deferred
- No ADR needed. Ports and adapters is already covered by ADR 0001.

## Contracts and data shapes

```ts
// packages/contracts/src/error.ts
export const ErrorCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
export const ErrorResponse = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string().min(1) }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
```
Contracts does not import core. The code stays a string pattern, so contracts and core stay decoupled. The api test ties them together (test 9).

```ts
// packages/core/src/errors.ts
export const DOMAIN_ERROR_CODES = [
  'VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
  'CONFLICT', 'CLOSED', 'QUOTA_EXCEEDED', 'INTERNAL',
] as const;
```

| Code | HTTP | Public message (en, fixed) |
| --- | --- | --- |
| VALIDATION | 400 | Invalid request |
| UNAUTHENTICATED | 401 | Authentication required |
| FORBIDDEN | 403 | Not allowed |
| NOT_FOUND | 404 | Not found |
| CONFLICT | 409 | Conflict |
| CLOSED | 409 | Closed |
| QUOTA_EXCEEDED | 402 | Quota exceeded |
| INTERNAL | 500 | Internal error |

- The response `message` comes from `publicMessage[code]`, never from `err.message` or `details`.
- `details` stays server-side and is for logs only.
- Clients localise by `code`.

```ts
// packages/core/src/time/instant.ts
export type Instant = number & { readonly __brand: 'Instant' };   // epoch ms, UTC
export type Duration = number | { days?: number; hours?: number; minutes?: number; seconds?: number; ms?: number };
```
- A day is a fixed 86 400 000 ms of absolute time. "Next local day" is computed with `localDate`, never by adding days to a local value.

```ts
// apps/api/src/config.ts
const ConfigSchema = z.object({
  NOOR_ENV: z.enum(['local', 'dev', 'staging', 'prod']),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
```
- The schema is non-strict on input, so the rest of `process.env` is ignored. Map it to a camelCase `Config` (`{ env, logLevel }`).
- The `ConfigError` message format is `Invalid API config: NOOR_ENV is required; …`. It is built from zod issue paths and expectations only, never from received values.

No Firestore documents in this task.

## Hard rules that apply here

- **Rule 1 (core has no vendor imports):**
  - Clock, DomainError and the zoned helpers use only TS and `Intl`.
  - core gets no `zod` dependency in this task, because it doesn't need one.
  - `SystemClock` lives in `apps/api/src/adapters/system/`.
- **Rule 2 (port + adapter + fake):** `Clock` in core, `SystemClock` in api, `FakeClock` in testkit. `composition.ts` is the only place that picks the adapter. A shared contract-test file is optional here; the behaviour is a single `now()`.
- **Rule 5 (time from Clock, no test mode):**
  - FakeClock exists only in testkit. testkit is a devDependency of api and is never imported by `function.ts`, `app.ts` or `composition.ts`.
  - No env var or header can switch the clock.
  - The new lint rule blocks `Date.now()` and `new Date()` in core and routes.
- **Rule 6 (never trust the client):** nothing in this task reads client time or timezone.
- **Rule 9 (secrets):**
  - `ConfigError` and logs never print env values.
  - Only `.env.example` is committed. `.env.local` is generated and gitignored.
  - The config holds no secrets yet. Later secrets go through function secrets, not `.env`.
- **Error leakage:** unknown errors become a generic 500. `details` is never serialised.
- **i18n:** API messages are fixed English fallbacks. The UI must translate by `code` (no UI in this task).

## Out of scope

- Zoned → instant conversion (start/end of a local day, opening times) and season scheduling. Those come with the tasks that need them (E03/E04).
- Auth, tenant or entitlement middleware, `requireFeature`, request body validation middleware, and mapping Hono `HTTPException` / malformed JSON. That is the api-endpoint work in later tasks.
- Structured logging / a Logger port, error tracking, Secret Manager wiring.
- Any business route, Firestore repository, or Firestore rules change.
- Web UI changes, i18n keys, error toasts.
- A `test:emulator` script, CI changes, Hosting rewrites (T004).
- Adding a date library (Luxon, date-fns-tz, Temporal polyfill). Use the platform `Intl`.
- Any "test mode", clock override endpoint or env flag.
