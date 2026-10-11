VERDICT: PASS
# Security review — T002 round 1

Scope: `git diff main...factory/T002-local-stack` (42 files), plus spec.md and build.md. I checked the lockfile with local read-only queries only. I did not run `npm audit` again, because that sends the lockfile to the registry. I did not start the emulators.

## Findings
None at P0–P2.

What I checked:
- `firebase/firestore.rules`: a single `match /{document=**} { allow read, write: if false; }` under `rules_version = '2'`. It denies every client read and write. Rules tests are out of scope (spec: later task) and are not needed while it is deny-all.
- Emulator config: `firebase/firebase.json` binds auth/firestore/functions/UI to `127.0.0.1` only and has `singleProjectMode: true`. The project comes only from `--project demo-noor` in `package.json` `dev:emulators`, and Playwright's health URL also points at `demo-noor`. There is no `.firebaserc`, no service account file and no `.env*` in the tree (`git ls-files` checked). No credentials are referenced anywhere. `FUNCTIONS_DISCOVERY_TIMEOUT=60` is a timeout, not a secret.
- `GET /v1/health` (`apps/api/src/routes/health.ts`): reads no client input, returns only `{status:'ok', version}` and sends it through the strict `HealthResponse` schema, so an extra key cannot leak. It has no Date or clock. Tests pin down that the route is public (no Authorization header, and a garbage Bearer header) and that POST and unversioned paths return 404. There is no tenant or user data, so the tenant/auth checks do not apply.
- `apps/api/src/function.ts` is the only firebase-functions import. `app.ts` has no vendor coupling and no side effects. It uses no `process.env` and does no logging.
- Vite proxy (`apps/web/vite.config.ts`): the dev server binds to `127.0.0.1:5173` with `strictPort`. `/v1` is proxied only to `127.0.0.1:5001`, rewritten to the `demo-noor` path. It adds no CORS and no `changeOrigin`, and points at no external target. The web app has no Firebase SDK and makes no direct Firestore access. It talks only to same-origin `/v1/health`, and every response is parsed with the contract.
- I found no `Date.now`/`new Date`/`process.env`/`console.*` in `apps/api/src`, `apps/web/src` or `packages/contracts/src`. The only `process.env` use is `CI` in the Playwright config (dev tooling).
- npm audit increase (24 findings, 21 new). I classified packages with the lockfile `dev` flag:
  - Dev-only, never shipped: everything under `firebase-tools` (basic-ftp 5.3.1, get-uri, re2 1.24.0, braces 3.0.3, @opentelemetry/core 1.30.1, universal-analytics → uuid 8.3.2) and `playwright` 1.51.1. Vite 6.4.4 is also dev-only.
  - Runtime (prod): `uuid` 9.0.1, pulled in by `gaxios`, `google-gax` and `teeny-request` under `firebase-admin`. `firebase-admin` is `external` in the esbuild bundle, so it ships in the deployed function's `node_modules`. Our code does not import firebase-admin or uuid in this task. The known uuid advisory class affects callers that pass a caller-supplied `buf` to v3/v5/v6, which these Google clients do not expose to request input. It is not reachable from `/v1/health`, so it does not block now. It is tracked in the nits.
  - Other prod packages (hono 4.13.13, @hono/node-server 1.19.17, firebase-functions 7.4.0, express 5.3.0, zod 4.6.6, react-router 7.18.4) were not among the findings build.md lists.

## Hard rules
1. core vendor-free — ok (core not touched; contracts imports only zod)
2. ports + adapters + fakes — ok (firebase-functions only in `apps/api/src/function.ts`; app/routes vendor-free; no new port)
3. no client Firestore writes — ok (rules deny all reads and writes; web has no Firebase SDK)
4. tenant isolation — ok (n/a: no tenant data; the only route is public and returns constants)
5. time from Clock — ok (no Date in routes, contracts or web; no test mode; version and fetch injected)
6. roles server-side — ok (no client input read; no role, tenant, score or date accepted)
7. entitlements not plan names — ok (n/a; nothing gated)
8. own IDs — ok (n/a; no IDs introduced)
9. secrets — ok (demo-noor only; no .firebaserc, .env*, service account or login; version is a build constant; nothing logged)
10. AI output untrusted — ok (n/a; no AI code)
11. religious content provenance — ok (n/a; no question content)

## Nits (non-blocking)
- [P3] package-lock.json (`node_modules/uuid` 9.0.1, prod via firebase-admin → google-gax/gaxios/teeny-request): this runtime-transitive audit finding will ship with the function once T004 deploys it. Fix: before the first deploy (T004), check whether a firebase-admin or google-gax update moves to uuid ≥ the patched version, or add an `overrides` entry after testing. Record the result in that task's build.md.
- [P3] apps/web/package.json:`@playwright/test` 1.51.1: dev-only here, and no browser is downloaded. But the CI e2e job (T004) will run `playwright install`, and that is exactly the unverified-TLS download path the advisory covers. Fix: bump to ≥1.55.1 when CI starts installing browsers, and accept one download.
- [P3] apps/api/src/function.ts:14: `onRequest({ region })` relies on the default invoker (public on deploy) and sets no `maxInstances`. That is fine for the local stack. Fix (T004): declare `invoker: 'public'` explicitly, and set `maxInstances` and a concurrency cap to limit cost abuse before the first deploy.
- [P3] apps/api/src/routes/health.ts:9: the public endpoint returns the build version. The spec intends this, and it is low risk. Revisit if the version later carries a commit SHA or env name. The strict contract already blocks extra keys.
