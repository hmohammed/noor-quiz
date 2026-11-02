VERDICT: PASS
# Code review — T010c round 1

Reviewed `git diff main...factory/T010c-web-google-sign-in` (21 files, 10 commits) against spec.md and build.md. Re-ran the web Vitest project: 7 files, 37 tests, all pass.

## Findings
No must-fix findings.

## Acceptance tests
1. ok — `apps/web/e2e/sign-in.spec.ts` "sign in with Google, see my name from /v1/me, then sign out". It waits for `GET /v1/me`, checks status 200 and `^Bearer \S+$`, compares `body.displayName` to `Amina E2E`, and asserts `auth-name` has that text. It fails without the change because there is no button, header or `getMe`.
2. ok — same test: sign out, the sign-in button is visible, `auth-name` count is 0.
3. ok — `apps/web/e2e/home.spec.ts` is unchanged, and `data-testid="api-status"` is kept in `HomePage.tsx`.
4. ok — `client.test.ts` "calls GET {baseUrl}/v1/me with the bearer token…", "returns displayName: null as is", "passes the abort signal through".
5. ok — `client.test.ts` "throws ApiError with status 401…", "…extra key (strict contract)", "getMe › throws ApiError when fetch itself rejects".
6. ok — `client.test.ts` "getHealth › sends no Authorization header".
7. ok — `config.test.ts`: all five cases are covered, including the non-demo emulator throw, with a check that the message has no values.
8. ok — `AuthButtonView.test.tsx` covers signed-out, loading (`role="status"`, `aria-busy`, no button), signed-in (`dir="auto"`, `data-testid`), signed-in with null name, both error variants, unavailable, and "never renders a raw auth.* key".
9. ok — `firebase-boundary.test.ts` handles static, side-effect, re-export and dynamic imports. Only `auth/session.ts` imports Firebase, and only `firebase/app` and `firebase/auth`.
10. ok — `apps/web/scripts/ensure-env-local.test.mjs` creates the file and never overwrites it. `vitest.config.ts` includes `scripts/**/*.test.mjs`.

## Hard rules
1. ok — `packages/core` is untouched; Firebase is confined to `apps/web/src/auth/session.ts`.
2. ok — `session.ts` is the adapter seam and exposes only booleans, strings and `SessionError`. `client.ts` imports no Firebase. No new core port was needed.
3. ok — only `firebase/app` and `firebase/auth` are imported; no Firestore SDK.
4. ok — no tenant-owned data or routes are touched.
5. ok — no `Date.now()` in core or routes. The only use is the unique e2e email in `sign-in.spec.ts:9`, which is test code and outside the rule's scope.
6. ok — the UI shows only `MeResponse.displayName` and sends only the Bearer token. It never sends or trusts a role, userId or score.
7. ok — no plan checks.
8. ok — the Firebase uid, email and Firebase `displayName` are never read or shown. `onChange` exposes a boolean only.
9. ok — only `.env.example` is committed, with public demo values. Only `err.message` (keys, no values) is logged, and the e2e never prints the token.
10. ok — no AI is involved. The client validates the `/v1/me` body with the strict `MeResponse` schema.
11. ok — no question content is touched.

## Scope
Files changed beyond the spec's list: `package-lock.json` (needed for the new dependency) and the T010c Notes in `docs/tasks/E01-identity-privacy.md` (spec'd). `BOARD.md` and `board.json` are untouched. No unrelated refactors.

## Correctness checked
- `AuthButton.tsx`: the generation counter and per-request `AbortController` drop stale `/v1/me` results after sign-out or unmount. Cleanup unsubscribes, so React StrictMode double-mounting is safe. A token or `getMe` failure becomes `error` with `hasSession: true`. A cancelled popup returns to `signed-out` with no error.
- `session.ts`: the `demo-` guard is enforced before `connectAuthEmulator`. `getApps()` keeps HMR from double-initialising the app. Importing the module never throws.

## Nits (non-blocking)
- `AuthButtonView.tsx:25`: `auth.loading` reads "Signing in…" while the page first checks for an existing session, even if the visitor never clicked sign in. A neutral string would fit better, but the spec fixed the copy (T080 can revisit).
- `apps/web/.env.local` (created from `.env.example`, with the emulator host) is also read by `vite build`. A local production build would bake in the demo project and emulator host. The `demo-` guard keeps this harmless, but the CI/deploy-dev follow-up in the E01 Notes should build without `.env.local`.
- `firebase-boundary.test.ts:11`: the import regex also matches `from 'x'` inside comments. This can only cause a false failure, never a miss, so it is acceptable.
- `sign-in.spec.ts:9`: `Date.now()` for the unique email is fine in e2e. A random suffix would avoid any same-millisecond collision.
