VERDICT: PASS
# Security review — T010c round 1

Scope: `git diff main...factory/T010c-web-google-sign-in` (web only; no API, contract, core, rules or emulator config change).

## Findings

None at P0–P2.

Verified:
- **Token handling.** `apps/web/src/auth/session.ts:550-553` returns the ID token only to the caller; `AuthButton.tsx:620-623` passes it straight to `apiClient.getMe`. `client.ts` sends it only as `authorization: Bearer …` in a header (never in the URL), to `baseUrl` which is `''` (same origin, `apiClient = createApiClient()` at `client.ts:79`), so the token cannot be sent to a third-party origin. No `localStorage`/`sessionStorage` use by our code; Firebase's own persistence holds the session. `getHealth` still sends no auth header (unit test).
- **No logging of tokens or config.** The only `console.*` in `apps/web/src` is `session.ts:34`, `console.error(err.message)` for `AuthConfigError`, whose message is a fixed string naming keys only (`config.ts:401-403`); `config.test.ts` asserts the message omits project id, host and api key. SDK errors from `signInWithPopup` are reduced to `SessionError('cancelled'|'failed')` without the original error or cause. `ApiError` on network failure keeps `cause` but is never logged. The e2e checks the header against `^Bearer \S+$` without printing it. `ensure-env-local.mjs` prints file names only and uses `COPYFILE_EXCL` (never reads or overwrites `.env.local`).
- **Emulator refused for a non-demo project.** `config.ts:400-404` throws `AuthConfigError` when `VITE_AUTH_EMULATOR_HOST` is set and `VITE_FIREBASE_PROJECT_ID` does not start with `demo-`; `session.ts` catches it and treats auth as not configured (fail closed: `unavailable`, no emulator connection). Empty/whitespace host means no emulator. Firebase reserves the `demo-` prefix, so a real project can't satisfy the check. Covered by `config.test.ts`.
- **Firebase uid / identity not shown.** `onChange` exposes only a boolean (`session.ts:546`); `AuthButton` renders only `MeResponse.displayName` from `/v1/me`; `MeResponse` is strict, and `client.test.ts` proves an extra `uid` key is rejected. React escapes the name (`AuthButtonView.test.tsx` "escapes the display name"). No email, Firebase `displayName` or uid reaches the UI, and no userId is sent to the API.
- **Firebase boundary.** Only `auth/session.ts` imports Firebase, and only `firebase/app` + `firebase/auth` (no Firestore SDK in the web bundle); enforced by `firebase-boundary.test.ts`.
- **Secrets.** Only `apps/web/.env.example` is tracked (public demo values); `apps/web/.env.local` is ignored by `.gitignore:7 .env.*` (verified with `git check-ignore`).
- **Server side unchanged.** `/v1/me` stays behind `requireUser()` from T010b; the server derives the user from the verified token.

## Nits (non-blocking)
- [P3] `apps/web/scripts/ensure-env-local.mjs` / Vite — Vite also loads `.env.local` in `vite build`, so a production build run on a dev machine after `dev:web` would bake in the `demo-noor` + emulator config. It is harmless (demo-only, points at localhost, sign-in just fails) and CI has no `.env.local`, but when the deploy-dev follow-up adds real `VITE_FIREBASE_*` keys, build with an explicit mode/env file (e.g. `.env.production`) so local `.env.local` can't leak into a deploy.
- [P3] `apps/web/src/auth/session.ts:530-533` — consider also mapping `auth/popup-blocked` to a distinct UX state later; today it is `failed`, which is safe.

## Hard rules
1. core vendor-free — ok (no `packages/core` change)
2. ports + adapters + fakes — ok (Firebase confined to `apps/web/src/auth/session.ts`, boundary test; client stays Firebase-free)
3. no client Firestore writes — ok (no Firestore SDK imported in web; only `firebase/app`, `firebase/auth`)
4. tenant isolation — ok (n/a: no tenant data or route touched)
5. time from Clock — ok (no client clock/test-mode; `Date.now()` only in e2e for unique emails)
6. roles server-side — ok (no role/tenant/userId sent by client; identity derived server-side from the token)
7. entitlements not plan names — ok (n/a)
8. our own IDs — ok (UI shows only `/v1/me` data; Firebase uid never shown or sent; strict `MeResponse` rejects `uid`)
9. secrets — ok (only `.env.example` committed with public demo values; `.env.local` gitignored; no token/config value logged)
10. AI output untrusted — ok (n/a)
11. religious content provenance — ok (n/a)
