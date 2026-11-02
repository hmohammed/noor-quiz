# Build — T010c (round 1)
Branch: factory/T010c-web-google-sign-in
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T010c-web-google-sign-in

## Changes
- apps/web/package.json — add `firebase@^12.19.0` to `dependencies`; `dev` now runs `node scripts/ensure-env-local.mjs && vite`.
- package-lock.json — `@noor/web` gains `firebase`; the already-installed firebase packages lose `dev: true`. No new packages downloaded.
- apps/web/.env.example (new) — the public demo Firebase web config and `VITE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, exactly as in the spec.
- apps/web/scripts/ensure-env-local.mjs (+ .test.mjs) (new) — `ensureWebEnvLocal(webRoot)` reuses the exported `ensureEnvLocal` from apps/api. It copies `.env.example` to `.env.local` only when it is missing, and prints file names only.
- apps/web/vitest.config.ts — include `scripts/**/*.test.mjs`.
- apps/web/src/env.d.ts (new) — `ImportMetaEnv` with the four optional `VITE_*` keys (`types: []` is kept).
- apps/web/src/auth/config.ts (+ test) (new) — pure `readAuthConfig(env)` and `AuthConfigError`. Missing, empty or whitespace keys return null. An emulator host with a non-`demo-*` project throws, and the message names keys but never values.
- apps/web/src/auth/session.ts (new) — the only Firebase importer (`firebase/app`, `firebase/auth`). It initialises lazily from `readAuthConfig({ ...import.meta.env })`, reuses the app on HMR through `getApps()`, and calls `connectAuthEmulator` once (guarded by `auth.emulatorConfig`). It exposes `isConfigured`, `signIn` (popup; popup-closed and cancelled-popup map to `SessionError('cancelled')`, everything else to `'failed'`), `signOut`, `onChange(boolean)` and `getIdToken`. An `AuthConfigError` is caught, logged by message only, and treated as "not configured", so importing the module never throws and the page still renders.
- apps/web/src/auth/firebase-boundary.test.ts (new) — scans `src/**/*.{ts,tsx}` for static, side-effect, re-export and dynamic imports. Only `auth/session.ts` may import `firebase*` or `@firebase/*`, and only `firebase/app` and `firebase/auth`.
- apps/web/src/api/client.ts (+ test) — `getMe({ idToken, signal })` calls `GET /v1/me` with `authorization: Bearer …` and parses the strict `MeResponse`. The private `getJson` takes optional extra headers; `getHealth` is unchanged and sends no auth header. The client does not import `session.ts`.
- apps/web/src/features/auth/AuthButtonView.tsx (+ test) (new) — a presentational component for the seven states, with strings from `t()`. The name element has `dir="auto"` and `data-testid="auth-name"`. Loading has `role="status"` and `aria-busy`; errors use `role="alert"`.
- apps/web/src/features/auth/AuthButton.tsx (new) — the stateful container. It starts in `loading`, or `unavailable` when not configured. It subscribes through `onChange` and, when someone is signed in, gets the token and calls `getMe`. A generation counter plus an AbortController per request drop late `/v1/me` results after sign-out or unmount, and it unsubscribes on unmount. Cancelling the popup returns to `signed-out` without an error. Only `MeResponse.displayName` is shown.
- apps/web/src/features/home/HomePage.tsx — adds `<header className="site-header"><AuthButton /></header>` above the existing `<main>`; `api-status` is unchanged.
- apps/web/src/styles.css — `.site-header` and `.auth*` styles using only logical properties, one new variable `--color-accent`, and a visible `:focus-visible` outline on the buttons.
- apps/web/src/i18n/en.json — the six `auth.*` keys from the spec.
- apps/web/e2e/sign-in.spec.ts (new) — acceptance tests 1 and 2.
- docs/tasks/E01-identity-privacy.md — T010c **Notes** (boundary, a T011 hint about refreshing the header name, the CI/deploy-dev web config follow-up, and why the e2e blocks CDNs).

New dependency: `firebase` (apps/web, only `firebase/app` and `firebase/auth` are imported). Justification: Google sign-in popup and ID token refresh. Exit path: any OIDC client behind `apps/web/src/auth/session.ts`.

## Acceptance tests → test files
1. Sign in through the emulator's Google popup; the header shows `Amina E2E`; `/v1/me` returned 200 with a Bearer token and the same `displayName` → apps/web/e2e/sign-in.spec.ts "sign in with Google, see my name from /v1/me, then sign out"
2. Sign out brings back the sign-in button and removes the name → same test (second half)
3. Home e2e still shows `API ok` → apps/web/e2e/home.spec.ts (unchanged) "home page shows that the API is reachable"
4. `getMe` URL, Bearer and accept headers, parsed body, `displayName: null` → apps/web/src/api/client.test.ts "calls GET {baseUrl}/v1/me with the bearer token…", "returns displayName: null as is", "passes the abort signal through"
5. `getMe` 401 → ApiError(401); extra `uid` key → ApiError; fetch rejects → ApiError → client.test.ts "throws ApiError with status 401…", "throws ApiError when the body has an extra key (strict contract)", "getMe › throws ApiError when fetch itself rejects"
6. `getHealth` sends no Authorization → client.test.ts "getHealth › sends no Authorization header"
7. `readAuthConfig` cases → apps/web/src/auth/config.test.ts (all 8 tests, including "refuses an emulator host for a non-demo project, naming keys but not values")
8. `AuthButtonView` states and no raw `auth.` keys → apps/web/src/features/auth/AuthButtonView.test.tsx (9 tests, one per state plus escaping and "never renders a raw auth.* key")
9. Firebase boundary → apps/web/src/auth/firebase-boundary.test.ts "only auth/session.ts imports Firebase", "auth/session.ts imports only firebase/app and firebase/auth"
10. Web ensure-env-local → apps/web/scripts/ensure-env-local.test.mjs "creates .env.local next to .env.example and never overwrites it"

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass (after rewriting CRLF working copies as LF; see notes) |
| npm run typecheck | pass |
| npm test | pass — 43 files, 542 tests |
| npm run test:e2e | pass — 2/2 (home, sign-in) |
| npm run test:emulator | not relevant (no adapter or Firestore rules change) |

## Commits
- 84356f2 T010c: Add the firebase client SDK to apps/web
- 66d6886 T010c: Create apps/web/.env.local from .env.example on dev:web
- 34a7ff9 T010c: Read the Firebase web config and refuse an emulator for real projects
- 98b07ca T010c: Add apiClient.getMe with a bearer token
- 6e2201d T010c: Confine Firebase Auth to apps/web/src/auth/session.ts
- 33bed02 T010c: Add AuthButtonView with every sign-in state
- 1c58db7 T010c: Show the sign-in button and my name in the home header
- 399a152 T010c: e2e sign in with the Auth emulator and see my name
- fdf6cac T010c: Format the session module and AuthButton
- 36c21f4 T010c: Notes for T011 and the CI web config follow-up

## Notes for reviewers
- **The e2e blocks CDN requests.** The Auth emulator's sign-in page loads `material-components-web` from unpkg with a blocking `<script>` before its own inline script. On this machine unpkg timed out after more than 30 s, so "Add new account" did nothing and the first run failed. The page is written to work without it (`window.mdc && …`). The test now aborts `unpkg.com`, `fonts.googleapis.com` and `fonts.gstatic.com` through `context.route`. This keeps the test independent of the network (CI included) and changes nothing in the app.
- **How e2e ran on Windows.** `dev:emulators` uses sh-style `&&FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase …`, which cmd.exe cannot run. I started the same steps by hand in PowerShell (ensure-env-local, the api build, then `firebase emulators:start --only auth,firestore,functions --config firebase/firebase.json --project demo-noor` with the env var set) and ran `npm run dev:web`. Playwright reused those servers (`reuseExistingServer` is true outside CI). No config was changed. This Windows-only limitation already existed.
- **CRLF.** `core.autocrlf=true` leaves CRLF working copies, so `prettier --check` (and `tooling/src/docs-commands.test.ts`, whose regex expects `\n` in AGENT.md) fail on an untouched checkout. For the checks I rewrote the tracked text files in the worktree as LF. `git diff` shows no line-ending changes, and none were committed.
- `npm install` warned that the postinstall scripts of `@firebase/util`, `esbuild` and `protobufjs` were not run (npm `allowScripts`). The esbuild api build, Vite and the tests all worked without them.
- In `signed-in` with `displayName: null`, the fallback text has no `data-testid="auth-name"`, so the testid always means "a name from the API".
- `AuthConfigError` is logged with `console.error(err.message)` only. The message names keys, never values. No token, SDK error or Firebase user is logged.
- The e2e checks the Authorization header against `^Bearer \S+$` and never prints the header.
- `apps/web/.env.local` was created in the worktree by `dev:web`. It is gitignored and not committed.

## Round 2
- review-ux.md: `.auth__button` was about 40px tall and "Sign out" was a narrow target → fixed in apps/web/src/styles.css with `min-block-size: 2.75rem` (44px) and `min-inline-size: 6rem`, logical properties only (1f3da2c). Non-blocking nits not changed, as instructed.

| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass — 43 files, 542 tests |
| npm run test:e2e | pass — 2/2 (home, sign-in); stack started by hand as in round 1 |
| npm run test:emulator | not relevant |

Commits:
- 1f3da2c T010c: Give the auth buttons a 44px touch target
