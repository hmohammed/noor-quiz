# Spec — T010c Web: sign in with Google and see my name

Size: one day or less. One new UI component on the existing page, one new auth module in `apps/web`, one new client method. No new port in core, no new route, no new page. No split.

What exists today and is reused:
- `GET /v1/me` (T010b) behind `requireUser()`; returns `MeResponse = { userId, displayName | null }` (strict). The API already verifies emulator tokens: the Functions emulator sets `FIREBASE_AUTH_EMULATOR_HOST` because `dev:emulators` starts `auth` on `127.0.0.1:9099`, project `demo-noor`.
- `apps/web/src/api/client.ts` with `createApiClient`, `getJson`, `ApiError`, and its node-env Vitest tests.
- `apps/web/src/i18n/t.ts` (English-only `t()`, replaced by T080) and `en.json`.
- `HomePage.tsx` is the only page (no layout component); `styles.css` uses logical properties and CSS variables.
- `firebase@^12.19.0` is already a **root devDependency** (for rules tests). Add the same range to `apps/web` `dependencies` so the web bundle owns it.
- Vite proxies `/v1` to the functions emulator; Playwright starts `dev:emulators` and `dev:web`.

## Acceptance tests

1. Signed-out visitor clicks "Sign in with Google", completes the Auth emulator's Google popup with a fresh account whose display name is `Amina E2E`, and the header shows `Amina E2E`. The test waits for the `/v1/me` response, checks it is 200, that its request carried `Authorization: Bearer …`, and that `displayName` in the body equals the shown text (so the name comes from our API, not from the Firebase user). — e2e — `apps/web/e2e/sign-in.spec.ts` *(task acceptance criterion)*
2. Same test continues: clicking "Sign out" shows the sign-in button again and the name is gone. — e2e — `apps/web/e2e/sign-in.spec.ts`
3. The existing home e2e still passes (health status still shows `API ok` with the header added). — e2e — `apps/web/e2e/home.spec.ts` (unchanged)
4. `getMe({ idToken })` calls `GET {baseUrl}/v1/me` with headers `Authorization: Bearer <idToken>` and `accept: application/json`, and returns the parsed body, including `displayName: null`. — unit — `apps/web/src/api/client.test.ts`
5. `getMe` throws `ApiError` with `status: 401` on a 401 response; throws `ApiError` when the body breaks `MeResponse` (e.g. an extra `uid` key, because the schema is strict); throws `ApiError` when fetch rejects. — unit — `apps/web/src/api/client.test.ts`
6. `getHealth` still sends no `Authorization` header. — unit — `apps/web/src/api/client.test.ts`
7. `readAuthConfig(env)` returns `{ apiKey, authDomain, projectId, emulatorUrl: null }` when the three `VITE_FIREBASE_*` keys are set and no emulator host; returns `emulatorUrl: 'http://127.0.0.1:9099'` for `VITE_AUTH_EMULATOR_HOST=127.0.0.1:9099` with a `demo-*` project; returns `null` (not configured) when any required key is missing or empty; throws `AuthConfigError` when an emulator host is set but the project id does not start with `demo-` (so a real project can never be pointed at an emulator by a stray `.env.local`). Error messages name keys, never values. — unit — `apps/web/src/auth/config.test.ts`
8. `AuthButtonView` renders, for each state (via `react-dom/server` `renderToStaticMarkup`, no new test dependency):
   - `signed-out`: a button with `t('auth.signIn')`;
   - `loading`: `t('auth.loading')` with `role="status"`/`aria-busy`, and no enabled sign-in button;
   - `signed-in` with a name: the name inside an element with `dir="auto"` and `data-testid="auth-name"`, plus a `t('auth.signOut')` button;
   - `signed-in` with `displayName: null`: `t('auth.noName')` instead of a name;
   - `error` (no session): `t('auth.error')` with `role="alert"` and the sign-in button to retry;
   - `error` (session exists, `/v1/me` failed): `t('auth.error')` and the sign-out button;
   - `unavailable` (config missing): `t('auth.unavailable')` and no button.
   No rendered output contains a raw `auth.` key (every key exists in `en.json`). — unit — `apps/web/src/features/auth/AuthButtonView.test.tsx`
9. Boundary test: scanning `apps/web/src/**/*.{ts,tsx}`, only `apps/web/src/auth/session.ts` imports from `firebase/*` or `@firebase/*`, and it imports only `firebase/app` and `firebase/auth`. — unit — `apps/web/src/auth/firebase-boundary.test.ts`
10. `ensure-env-local` for web creates `apps/web/.env.local` from `apps/web/.env.example` when missing and never overwrites an existing one (reuse the exported `ensureEnvLocal` and cover the web entry point with one test, mirroring `apps/api/scripts/ensure-env-local.test.mjs`). — unit — `apps/web/scripts/ensure-env-local.test.mjs` (add `'scripts/**/*.test.mjs'` to `include` in `apps/web/vitest.config.ts`, as `apps/api/vitest.config.ts` does)

No new API route, so no new unauthorised/wrong-tenant route tests. The 401 path of `/v1/me` is already covered by T010b; test 5 covers the client's handling of it.

## Files and modules to touch

- `apps/web/package.json` — add `"firebase": "^12.19.0"` to `dependencies`. Change `dev` to `node scripts/ensure-env-local.mjs && vite`. PR text: justification "Google sign-in popup and ID token refresh"; exit path "any OIDC client behind `apps/web/src/auth/session.ts`".
- `apps/web/.env.example` (new) — public, non-secret web config for local/emulator use:
  ```
  # Public Firebase web config (not a secret). Copied to .env.local by `npm run dev:web`.
  VITE_FIREBASE_API_KEY=demo-api-key
  VITE_FIREBASE_AUTH_DOMAIN=demo-noor.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=demo-noor
  # host:port of the Auth emulator. Only allowed with a demo-* project. Remove for real projects.
  VITE_AUTH_EMULATOR_HOST=127.0.0.1:9099
  ```
- `apps/web/scripts/ensure-env-local.mjs` (new) — copies `.env.example` → `.env.local` in `apps/web` if missing, by importing `ensureEnvLocal` from `../../api/scripts/ensure-env-local.mjs` (it is exported and has no import side effects). Prints file names only.
- `apps/web/vitest.config.ts` — include `scripts/**/*.test.mjs`.
- `apps/web/src/env.d.ts` (new) — `ImportMetaEnv` with the four optional `VITE_*` string keys (tsconfig has `types: []`, so declare them; do not widen `types`).
- `apps/web/src/auth/config.ts` (+ `config.test.ts`) (new) — pure `readAuthConfig(env)` and `AuthConfigError`. No Firebase import.
- `apps/web/src/auth/session.ts` (new) — the only Firebase importer (`firebase/app`, `firebase/auth`). Lazily initialises the app on first use from `readAuthConfig(import.meta.env)`, so importing it never throws and the home page renders without config. Calls `connectAuthEmulator(auth, emulatorUrl)` once when `emulatorUrl` is set. Exposes:
  - `isConfigured(): boolean`
  - `signIn(): Promise<void>` — `signInWithPopup(auth, new GoogleAuthProvider())`. `auth/popup-closed-by-user` and `auth/cancelled-popup-request` reject with `SessionError('cancelled')`; anything else with `SessionError('failed')`. No SDK error object or token is logged.
  - `signOut(): Promise<void>`
  - `onChange(cb: (signedIn: boolean) => void): () => void` — wraps `onAuthStateChanged`; exposes only a boolean, never the Firebase `User`, uid, email or provider name.
  - `getIdToken(): Promise<string | null>` — `auth.currentUser?.getIdToken()` (the SDK refreshes expired tokens); `null` when signed out.
  - `SessionError` with `code: 'cancelled' | 'failed'`.
- `apps/web/src/auth/firebase-boundary.test.ts` (new) — test 9 (reads files with `node:fs`; Vitest env is already `node`).
- `apps/web/src/api/client.ts` — add `getMe(init: { idToken: string; signal?: AbortSignal }): Promise<MeResponse>`. Extend the private `getJson` to accept extra headers (`authorization`) without changing `getHealth` behaviour. The client does **not** import `session.ts`; the caller passes the token, so the client stays Firebase-free and testable.
- `apps/web/src/api/client.test.ts` — tests 4–6.
- `apps/web/src/features/auth/AuthButtonView.tsx` (new) — presentational component: props `{ state: AuthViewState; onSignIn(): void; onSignOut(): void }`. Strings via `t()`.
- `apps/web/src/features/auth/AuthButtonView.test.tsx` (new) — test 8.
- `apps/web/src/features/auth/AuthButton.tsx` (new) — stateful container: subscribes with `session.onChange`, on `signedIn=true` gets the token and calls `apiClient.getMe`, maps results to `AuthViewState`, handles sign-in/out clicks. Rules:
  - starts in `loading` until the first `onChange` callback (or `unavailable` if `!isConfigured()`);
  - `SessionError('cancelled')` returns to `signed-out` without an error;
  - ignores stale `/v1/me` results after sign-out or unmount (AbortController per request, and check the latest signed-in generation); unsubscribes on unmount (StrictMode mounts twice);
  - shows only `MeResponse.displayName`, never anything from Firebase.
- `apps/web/src/features/home/HomePage.tsx` — wrap content with a `<header className="site-header">` containing `<AuthButton />`, above the existing `<main>`. Keep the `api-status` element and test id.
- `apps/web/src/styles.css` — `.site-header` and `.auth` classes using only logical properties (`padding-inline`, `margin-inline-start`, `gap`, `justify-content: flex-end` is fine since flex follows direction). Reuse existing variables; add at most an `--color-accent` if a button colour is needed. Visible focus style on buttons.
- `apps/web/src/i18n/en.json` — add:
  ```json
  "auth.signIn": "Sign in with Google",
  "auth.signOut": "Sign out",
  "auth.loading": "Signing in…",
  "auth.noName": "Signed in",
  "auth.error": "Sign-in failed. Please try again.",
  "auth.unavailable": "Sign-in is not available right now."
  ```
- `apps/web/e2e/sign-in.spec.ts` (new) — tests 1–2. Flow: `page.goto('/')` → `const popup = page.waitForEvent('popup')` → click the sign-in button by role/name → in the emulator popup click "Add new account", fill the email (unique per run, e.g. `e2e-<timestamp>@example.com`, so the stored name is always fresh) and display name `Amina E2E`, then click "Sign in with Google.com" (confirm the exact labels on the emulator's page; select by role/label, not CSS classes) → expect `getByTestId('auth-name')` to have text `Amina E2E` → sign out → expect the sign-in button. Run with the existing `playwright.config.ts`; no config change is expected.
- `docs/tasks/E01-identity-privacy.md` — T010c **Notes** for the next task (T011 header name, CI web config follow-up below). BOARD row is handled by the orchestrator.

## Contracts and data shapes

No new contract and no Firestore change. Reuse `MeResponse` from `@noor/contracts`:
```ts
MeResponse = z.strictObject({ userId: Ulid, displayName: DisplayName.nullable() })
```

Web-only types:
```ts
// apps/web/src/auth/config.ts
export interface AuthConfig {
  apiKey: string; authDomain: string; projectId: string;
  emulatorUrl: string | null;            // 'http://<VITE_AUTH_EMULATOR_HOST>'
}
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null;
export class AuthConfigError extends Error {}   // emulator host with a non-demo project

// apps/web/src/features/auth/AuthButtonView.tsx
export type AuthViewState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; displayName: string | null }
  | { kind: 'error'; hasSession: boolean };
```

HTTP: `GET /v1/me` with `Authorization: Bearer <Firebase ID token>`. 200 → `MeResponse`; 401 `UNAUTHENTICATED` (from T010b) → `ApiError(status 401)` → AuthButton `error` with `hasSession: true` (user can sign out and retry).

## Hard rules that apply here

- **Rule 2 (ports/adapters, vendor lock-in).** Firebase is confined to `apps/web/src/auth/session.ts`; its API exposes plain booleans, strings and our own `SessionError`. Test 9 enforces the boundary. `client.ts` never imports Firebase.
- **Rule 3 (browser never writes to Firestore).** Only `firebase/app` and `firebase/auth` are imported; no Firestore SDK. The existing ESLint ban on Firestore write APIs stays untouched.
- **Rule 6 / rule 8 (server-side identity, our own IDs).** The UI shows only `/v1/me` data. It never shows or sends the Firebase uid, email or Firebase `displayName`, and never sends a userId; the API derives the user from the verified token.
- **Rule 9 (secrets, `.env`).** Only `apps/web/.env.example` is committed; `.env.local` is gitignored (`.env.*`). The Firebase web config is public by design, but tokens are never logged, printed in tests, stored by us (Firebase's own persistence handles the session) or put in URLs.
- **Emulator safety.** `readAuthConfig` refuses an emulator host for any non-`demo-*` project (test 7), so a real project can't be silently wired to an emulator.
- **i18n/RTL conventions.** Every string via `t()` with keys in `en.json`; CSS only logical properties; the name element uses `dir="auto"` so Arabic or Ge'ez names render correctly inside an LTR page.

## Out of scope

- Real Firebase web config for `noor-dev` in CI / deploy-dev, and enabling Google as a provider in the dev project. Without `VITE_*` keys the built app shows the `unavailable` state; note a follow-up in the E01 Notes.
- Editing the display name, locale, timezone or a profile page (T011); consent screen (T013).
- Other sign-in providers, email link, redirect flow (`signInWithRedirect`), account linking.
- Full i18n layer, `useI18n()`, locale switching, Arabic locale and the `ar` Playwright RTL check (T080/T081). Keep calling `t()` from `i18n/t.ts`.
- A router layout component, new routes or pages, protected routes, React context/global auth store.
- New test dependencies (jsdom, Testing Library). Use `renderToStaticMarkup` in the node environment.
- Any API, contract, core, testkit, Firestore rules or emulator config change. `firebase.json` and `dev:emulators` already run the Auth emulator.
- New ESLint rules for the Firebase boundary (test 9 covers it without touching the T012 lint config).
