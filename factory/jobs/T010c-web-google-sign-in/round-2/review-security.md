VERDICT: PASS
# Security review — T010c round 2

Scope: `git diff main...factory/T010c-web-google-sign-in` (21 files, web only; no API, contract, core, Firestore rules or emulator config change). The only commit since round 1 is 1f3da2c, which adds `min-block-size: 2.75rem` and `min-inline-size: 6rem` to `.auth__button` in `apps/web/src/styles.css`. It is CSS only and has no security impact. `git diff 36c21f4 factory/T010c-web-google-sign-in` confirms nothing else changed.

## Findings

None at P0–P2.

I re-checked the full diff:
- **Token handling.** `session.ts` `getIdToken()` returns the token only to the caller. `client.ts` `getMe` sends it only as an `authorization: Bearer …` header, never in the URL, to `baseUrl` `''` (same origin, via `apiClient = createApiClient()`). `getHealth` still sends no auth header. Our code uses no `localStorage`, `sessionStorage` or `dangerouslySetInnerHTML` in `apps/web/src`.
- **Logging.** The only `console.*` in `apps/web/src` is `session.ts:34` `console.error(err.message)` for `AuthConfigError`, which has a fixed message that names keys only. Errors from `signInWithPopup` are reduced to `SessionError('cancelled'|'failed')` without the original error.
- **Emulator guard.** `config.ts` throws when `VITE_AUTH_EMULATOR_HOST` is set and the project id does not start with `demo-`. `session.ts` then fails closed: auth is not configured and no emulator connection is made.
- **Identity.** `onChange` exposes only a boolean. The UI shows only `MeResponse.displayName` from `/v1/me`. The strict schema rejects an extra `uid`. The server derives the user from the verified token (T010b `requireUser()`).
- **Firebase boundary.** Only `auth/session.ts` imports Firebase, and only `firebase/app` and `firebase/auth`. `firebase-boundary.test.ts` enforces this.
- **Secrets.** Only `apps/web/.env.example` is committed, and it holds public demo values. `.env.local` is gitignored.

## Nits (non-blocking)
- [P3] These are carried over from round 1. Vite also loads `.env.local` during `vite build`. When real `VITE_FIREBASE_*` keys arrive in the deploy follow-up, build with an explicit mode or env file so that a local demo/emulator config can't end up in a deploy. Mapping `auth/popup-blocked` to its own UX state later is optional; it is safe today because it falls under `failed`.

## Hard rules
1. core vendor-free — ok (no `packages/core` change)
2. ports + adapters + fakes — ok (Firebase confined to `apps/web/src/auth/session.ts`, enforced by the boundary test; the API client stays Firebase-free)
3. no client Firestore writes — ok (no Firestore SDK in web; only `firebase/app` and `firebase/auth`)
4. tenant isolation — ok (n/a: no tenant data or route touched)
5. time from Clock — ok (no client clock or test mode; `Date.now()` appears only in the e2e for unique emails)
6. roles server-side — ok (the client sends no role, tenantId or userId; identity is derived server-side from the token)
7. entitlements not plan names — ok (n/a)
8. our own IDs — ok (the Firebase uid is never shown or sent; strict `MeResponse` rejects `uid`)
9. secrets — ok (only `.env.example` with public demo values is committed; `.env.local` is gitignored; no token or config value is logged)
10. AI output untrusted — ok (n/a)
11. religious content provenance — ok (n/a)
