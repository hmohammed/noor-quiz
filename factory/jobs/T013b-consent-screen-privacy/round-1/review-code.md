VERDICT: PASS
# Code review — T013b round 1

Reviewed `git diff main...factory/T013b-consent-screen-privacy` (21 files, all under `apps/web` plus the epic doc). I re-ran in the worktree: `npx vitest run --project web` (13 files, 98 tests pass), `eslint apps/web --max-warnings 0` (clean), `npm run typecheck` (clean). I did not re-run the Playwright e2e, which needs the emulators. I relied on build.md's 8/8 e2e result and read every spec line.

## Findings
No must-fix findings.

## Acceptance tests
1. ok — e2e `consent.spec.ts` "a new user sees the consent screen…": asserts the `Before you start` h1 is visible, `api-status` has count 0 and the `Profile` link is hidden. It cannot pass without the gate.
2. ok — same test: `acceptConsentOnScreen` waits for POST `/v1/me/consent` = 200 and the heading to go, then `api-status` has text `API ok`.
3. ok — same test: after `page.reload()` there is no heading, `API ok` shows, and Profile → `Display name` is visible.
4. ok — `profile.spec.ts` first test: `patches` is empty while the gate shows, then exactly one PATCH with `{ timezone: 'Africa/Addis_Ababa' }` returns 200, with no reload. The pre-click `toHaveLength(0)` is immediate, but the heading wait before it and the exactly-one assertion afterwards make it meaningful.
5. ok — `client.test.ts` "sends POST /v1/me/consent with the bearer token and { version }…" checks URL, method, authorization, content-type, accept and body, and the parsed result.
6. ok — `client.test.ts` it.each([409, 401]) checks `ApiError.status`, plus "200 body leaks acceptedAt inside consent" → `ApiError`.
7. ok — `accept-consent.test.ts` "posts the server's current version…" and "sends whatever currentVersion the server gave…" (v2 and v3).
8. ok — `accept-consent.test.ts`: 409 → calls are exactly `POST`, `GET` and `ConsentOutdatedError.me` is the fresh me. A failing GET gives the 503 `ApiError`, not `ConsentOutdatedError`. A 500 or network failure is rethrown with no GET. A non-ApiError is rethrown as is.
9. ok — `consent-gate-rule.test.ts` covers `/`, `/profile`, `/privacy-other` and `/privacy/x` (shown), `/privacy` and `/privacy/` (not shown), accepted, and loading/signed-out/unavailable/error (both `hasSession` values) on 3 paths.
10. ok — `PrivacyPage.test.tsx` renders with no providers; checks the h1, the placeholder, and the h2 list equals `PRIVACY_SECTIONS` in order, with each body after its title.
11. ok — `PrivacyPage.test.tsx` "every privacy.* key it uses exists in en.json" and "never renders a raw privacy.* key".
12. ok — `consent.spec.ts` "signed out: /privacy is public…" checks the footer `Privacy` link on `/` (via `contentinfo`) and the `/privacy` h1.
13. ok — main `consent.spec.ts` test clicks the gate's link, expects URL `/privacy$` and the privacy h1 with no gate, then Home brings the gate back before accepting.
14. ok — `ConsentGateView.test.tsx` "idle: …".
15. ok — "accepting: …" checks `disabled=""`, the `consent.agreeing` button text, `<p role="status" aria-busy="true"` and no alert.
16. ok — "error: …" checks the generic alert, the outdated text absent and the button enabled.
17. ok — "outdated: …" checks the outdated alert, the generic text absent and the button enabled.
18. ok — "never renders a raw consent.* key" over all 4 statuses, and key-exists checks. All 18 new keys are present in `en.json`; the page keys are also checked in `PrivacyPage.test.tsx`.
19. ok — `consent.spec.ts` RTL test sets `dir=rtl` via `page.evaluate` and checks visibility and non-overlap of the gate heading, link and button. It then re-applies `dir=rtl` after the client-side navigation and checks the privacy h1 and first h2.
20. ok — `profile.spec.ts` all three tests use `acceptConsentOnScreen`. In the "unsaved edit" test both users accept before opening `/profile`. The helper no longer reads the `authorization` header.

## Hard rules
1. ok — no vendor imports in `packages/core`; `packages/*` is untouched. `accept-consent.ts` and `client.ts` are Firebase-free; only `session-context.tsx` gets the token via `auth/session`.
2. ok — no client Firestore writes. Consent goes through `POST /v1/me/consent`, and the body is only `{ version }`.
3. ok — no new data or collections, so `tenantId` is not in play.
4. ok — no `Date.now()` in app code. The e2e emails use `Date.now()`, as the existing specs do, and are not product time.
5. ok — no plan-name checks.
6. ok — the gate is UX only. The version sent comes from the server's `me.consent.currentVersion`, and the API's `requireConsent()` stays the enforcement. There is no client skip or test mode.
7. ok — `userId` from the API is used only as the React `key`. No Firebase uid is used as a primary key.
8. ok — the e2e helper stopped reading headers and nothing logs tokens.
9. ok — no AI output involved.
10. ok — no content scheduling involved.
11. ok — no hard-coded user strings and no hard-coded vendor-specific behaviour. The privacy text is explicitly placeholder, with no compliance claim and no data controller named.

## Scope
Only the files in the spec's "files to touch" list changed. `BOARD.md` is correctly left to the orchestrator, and no `packages/*` or `apps/api` changes. The extra `.privacy__placeholder` CSS class is trivial and within the styling brief.

## Correctness notes (verified, no action needed)
- Race guard: `acceptConsent` captures `generation.current` before any await and re-checks it before `setState`. The generation is bumped on every auth change and unmount (`session-context.tsx:85-86`). The late result of a switched user is dropped, and `ConsentGate` is keyed by `userId`.
- A 409 replaces `me` with the fresh one and rethrows. The gate shows `outdated`, and the next click posts the new `currentVersion`. Any other error leaves state unchanged and shows `error` with the button enabled for retry.
- The timezone default is lifted into one `applyTimezoneDefault` helper. On first load it is a no-op while consent is required (because of `timezoneDefault()`), and it runs once after a successful accept. `useEffect` deps now include the stable `applyTimezoneDefault`, which has `[]` deps, so the auth effect does not re-subscribe.
- CSS uses logical properties only (`margin-block`, `padding-inline/block`, `border-block-start`, `gap`). Every variable used exists (`--color-error`, `--color-muted`, `--space-2`, `--space-4`).
- `PrivacyPage` has no router or session hook. It is mounted under `AppLayout` and is exempted by `EXEMPT_PATHS`.

## Nits (non-blocking)
- `ConsentGateView.tsx`: while accepting, the button text and the `role="status"` line both say `consent.agreeing`, so screen readers may announce it twice (build.md already notes this, and the spec requires both). Consider a visually hidden status class in a later UI task.
- `AppLayout.tsx` `PageOutlet`: the `state.kind === 'signed-in' &&` check is needed only to narrow the type for `state.me.userId`. This is fine, but it duplicates the check inside `shouldShowConsentGate`.
- `consent-gate-rule.ts`: `/privacy/x` still shows the gate (tested). No route exists there, so this is harmless.
- `privacy.rights.body` promises "You will be able to delete your account" before T013c ships (build.md flags this). Reword if T013c slips.
- `npm run lint` and the `tooling` docs test fail only on the Windows CRLF checkout (per build.md, same on main), not because of this change.

## Dependencies
No new packages.
