VERDICT: PASS
# Code review — T010c round 2

Scope of this round: the single new commit `1f3da2c T010c: Give the auth buttons a 44px touch target` (+2 lines in `apps/web/src/styles.css`). Round 1 was PASS; the rest of `git diff main...factory/T010c-web-google-sign-in` is unchanged from round 1.

## Findings
None. No must-fix.

- `apps/web/src/styles.css:65-66` — adds `min-block-size: 2.75rem` and `min-inline-size: 6rem` to `.auth__button`. Both are logical properties, so RTL is fine. It is a CSS-only change with no behaviour, markup, string, contract or dependency change. It stays inside the "`.site-header` and `.auth` classes" scope in spec.md. It answers the review-ux finding recorded in build.md Round 2. It does not touch `padding`, `focus-visible` or the existing variables.

## Acceptance tests
Unchanged since round 1; the new commit touches no test or source file they exercise.
1. ok — `apps/web/e2e/sign-in.spec.ts` (sign in through the emulator popup; name from `/v1/me`, Bearer header, 200)
2. ok — same test, sign-out half
3. ok — `apps/web/e2e/home.spec.ts` (unchanged)
4. ok — `apps/web/src/api/client.test.ts` `getMe` URL, headers, `displayName: null`
5. ok — `client.test.ts` 401, strict extra key, fetch rejection
6. ok — `client.test.ts` `getHealth` sends no Authorization
7. ok — `apps/web/src/auth/config.test.ts`
8. ok — `apps/web/src/features/auth/AuthButtonView.test.tsx` (all seven states, no raw `auth.` key)
9. ok — `apps/web/src/auth/firebase-boundary.test.ts`
10. ok — `apps/web/scripts/ensure-env-local.test.mjs`

build.md Round 2 reports lint, typecheck, `npm test` (43 files, 542 tests) and e2e (2 of 2) passing. This is plausible for a two-line CSS change, so I did not re-run them.

## Hard rules
1. ok — No vendor imports in `packages/core`; none touched. Firebase stays in `apps/web/src/auth/session.ts`.
2. ok — No client writes to Firestore; the web app imports only `firebase/app` and `firebase/auth`.
3. ok — No `tenantId`-relevant data or queries in this change.
4. ok — No `Date.now()` added.
5. ok — No plan-name checks.
6. ok — Client trusts no role, score or date; the UI shows only `/v1/me` data.
7. ok — Firebase uid is not used as a key and is not shown.
8. ok — No secrets in code or logs; `.env.example` holds public demo config only.
9. ok — No AI output in this task.
10. ok — No content scheduling in this task.
11. ok — No other AGENT.md rule is touched by this commit.

## Nits (non-blocking)
- The `min-inline-size: 6rem` and `min-block-size: 2.75rem` values are literals rather than variables. This is consistent with the surrounding file, so it is fine.
