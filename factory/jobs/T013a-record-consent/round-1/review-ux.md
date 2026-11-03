VERDICT: PASS
# UX review — T013a round 1

Scope checked: `git diff main...factory/T013a-record-consent -- apps/web` (`timezone-default.ts`, its test, `client.test.ts`, `e2e/helpers/sign-in.ts`, `e2e/profile.spec.ts`) plus the callers in `session-context.tsx`, `ProfilePage.tsx` and `ProfileFormView.tsx`. The spec says this task adds no visible UI, and the diff matches that: no new component, no new string, no CSS, no markup change.

## Findings

None. No must-fix items.

What I verified:
- **Flow:** `timezoneDefault` returns `null` while `me.consent.required` is true (`timezone-default.ts:12`). `applyTimezoneDefault` in `session-context.tsx:92-94` returns early on `null`, so the background `PATCH /v1/me` is never sent before consent. The user sees no change when they sign in. Before this guard, that silent PATCH would have got a 403 which the code swallows (`() => undefined`), so the user would have had no timezone and no signal.
- **States:** no state is added or removed. The loading, signed-in and error states in `session-context.tsx` are unchanged. The strict `MeResponse` parse in the web client now requires `consent`. A body without it surfaces as `ApiError` and so the existing `error` state (test in `client.test.ts`). That is the correct fail-closed behaviour.
- **Copy and i18n:** no user-facing string is added or changed in `apps/web/src`. The e2e helper's `expect` messages are test-only. Nothing needs `t('key')`.
- **Accessibility and RTL:** no markup, focus, label or layout change, so there is no new a11y or RTL risk.
- **Spoilers:** not touched.
- **E2E helper:** `acceptConsentViaApi` uses the real public endpoint with the user's own token and does not log the token. It reloads and waits for the next `GET /v1/me`. In the timezone test the PATCH waiter is registered before the helper runs, and `patches` must still have length 1.

## Nits (non-blocking)

- `apps/web/src/features/profile/ProfilePage.tsx:120-121` and `ProfileFormView.tsx:183-186` — Until T013b ships, a real signed-in user who has not consented can open `/profile` and press Save. They will get the generic `profile.error.generic` alert, because `PATCH /v1/me` now returns 403 `CONSENT_REQUIRED`. They have no way to accept consent from the web. This is the expected gap the spec puts out of scope, and the error is announced with `role="alert"`, so nothing is silent. But T013a should not ship to real users on its own. T013b is `todo` on BOARD.md with T013a as its only dependency, so it is queued. When T013b lands, consider treating a 403 `CONSENT_REQUIRED` from `updateMe` as "show the consent screen" instead of the generic error.
- `apps/web/e2e/helpers/sign-in.ts` — The JSDoc says T013b replaces the helper with the consent screen. Good. When it does, the two profile tests should also assert the consent screen (heading and Accept button reachable by keyboard), not only click through it.
