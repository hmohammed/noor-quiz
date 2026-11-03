## T013b

**Web: consent screen at first sign-in and a /privacy page**

Phase: P1 · Depends on: [T013a](E01-identity-privacy.md#t013a) · Tags: `sec`
Skills: `vertical-slice`, `i18n-rtl`

**Goal.** A signed-in user who has not accepted the current terms sees a consent screen before anything else and can read the privacy page.

**Scope**

- Consent gate `apps/web/src/features/consent/ConsentGate.tsx` (+ a `ConsentGateView.tsx` with view tests). It is not a route. `AppLayout` renders it in place of `<Outlet />` while `me.consent.required` is true, except on `/privacy`. It shows a short summary, a link to `/privacy`, and an "I agree" button. It has loading and error states, and its error state covers a 409 (outdated terms), where it reloads `/v1/me`.
- `useSession()` gains `acceptConsent()`. It calls `apiClient.acceptConsent({ idToken, body: { version: me.consent.currentVersion } })` (`POST /v1/me/consent`, parses `MeResponse`) and replaces `me`. The client's `request()` method type widens to `'POST'`.
- The timezone default in `SessionProvider` must not fire `PATCH /v1/me` while consent is required, because it would now get 403. Run it after consent is accepted instead.
- Page `apps/web/src/features/privacy/PrivacyPage.tsx` at `/privacy` is public. Its placeholder text comes from config: a small `apps/web/src/features/privacy/policy.ts` lists the section i18n keys, and the text lives in `en.json` under `privacy.*`. Add a footer or header link to it in `AppLayout`.
- All strings go through `t()` (`consent.*`, `privacy.*` in `en.json`). Use logical CSS properties, and the page must work in RTL.
- e2e `apps/web/e2e/consent.spec.ts` on the Auth emulator: a new user signs in, sees the consent screen, opens `/privacy`, accepts, and then sees the home page and can open `/profile`. Update `e2e/helpers/sign-in.ts` (and `profile.spec.ts` if needed) so existing specs accept consent first.

**Acceptance criteria**

- [ ] A new user sees the consent screen after sign-in. After agreeing they reach the app, and a reload does not show the screen again (e2e).
- [ ] `/privacy` is reachable signed out and while consent is pending (view test and e2e).
- [ ] View tests cover the loading, error and outdated-terms states, and every string is an i18n key.

**Notes**

_(implementer adds notes for the next task here)_

Tags: `sec`
Phase: P1
