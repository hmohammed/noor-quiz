# Build — T013b (round 1)
Branch: factory/T013b-consent-screen-privacy
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T013b-consent-screen-privacy

## Changes
- apps/web/src/api/client.ts — `request()` method widened to `'GET' | 'PATCH' | 'POST'`; new `acceptConsent({ idToken, body, signal })` → `POST /v1/me/consent`, parsed with `MeResponse`.
- apps/web/src/api/client.test.ts — tests 5 and 6.
- apps/web/src/features/auth/accept-consent.ts (+ test, new) — `ConsentOutdatedError` and `acceptCurrentConsent(client, { idToken, me })`. Firebase- and React-free. Posts `me.consent.currentVersion`; on 409 does one `GET /v1/me` and throws `ConsentOutdatedError(freshMe)`; a failing GET throws its own `ApiError`; any other failure is rethrown with no GET.
- apps/web/src/features/auth/session-context.tsx — `Session.acceptConsent()`. Same `generation` guard as `updateMe`; reads `me` from a `stateRef` (synced in an effect) so the callback is stable. Timezone default lifted into one `applyTimezoneDefault(idToken, me, { signal?, isCurrent })` used by first load and by a successful accept. On `ConsentOutdatedError` it replaces `me` (if still current) and rethrows; other errors leave state alone.
- apps/web/src/features/consent/consent-gate-rule.ts (+ test, new) — `shouldShowConsentGate(state, pathname)`; `/privacy` and `/privacy/` exempt.
- apps/web/src/features/consent/ConsentGateView.tsx (+ test, new) — pure view for `'idle' | 'accepting' | 'error' | 'outdated'`; all text via `t()`.
- apps/web/src/features/consent/ConsentGate.tsx (new) — container; ignores clicks while accepting; maps `ConsentOutdatedError` → `outdated`, anything else → `error`.
- apps/web/src/features/privacy/policy.ts (new) — `PRIVACY_PATH`, `PRIVACY_SECTIONS` (4 sections).
- apps/web/src/features/privacy/PrivacyPage.tsx (+ test, new) — public page; no session or router hooks.
- apps/web/src/features/layout/AppLayout.tsx — `PageOutlet` renders `<ConsentGate key={userId} />` in place of `<Outlet />` when the rule says so; `Profile` nav link hidden while consent is required; footer link to `/privacy`. Header/AuthButton unchanged.
- apps/web/src/router.tsx — `/privacy` route under `AppLayout`.
- apps/web/src/i18n/en.json — `nav.privacy`, `consent.*` (7 keys), `privacy.*` (10 keys). Plain copy, no compliance claims, no data controller named; the placeholder says the final text follows.
- apps/web/src/styles.css — `.consent*`, `.privacy__placeholder`, `.privacy__section`, `.site-footer`; logical properties and existing variables only. Buttons reuse `.auth__button`, links reuse `.site-nav__link`.
- apps/web/e2e/helpers/sign-in.ts — `acceptConsentViaApi` replaced by `acceptConsentOnScreen(page)`; no header/token is read any more.
- apps/web/e2e/profile.spec.ts — all three tests accept on screen; test 1 asserts 0 PATCHes before the click and exactly 1 after, no reload; in test 3 both members accept before seeing the form.
- apps/web/e2e/consent.spec.ts (new) — tests 1–3, 12, 13, 19.
- docs/tasks/E01-identity-privacy.md — T013b criteria ticked and Notes for T013c/T080.

No new dependency. No change to `packages/*`, `apps/api`, Firestore rules or indexes.

## Acceptance tests → test files
1. Gate appears, home content absent → apps/web/e2e/consent.spec.ts "a new user sees the consent screen, can read /privacy, agrees and reaches the app"
2. Click "I agree", POST 200, home shows `API ok` → same test (via `acceptConsentOnScreen`)
3. Reload: no gate, home shows, Profile link → Display name → same test
4. No PATCH while pending; exactly one `{ timezone: 'Africa/Addis_Ababa' }` after accepting on screen → apps/web/e2e/profile.spec.ts "first sign-in sends the browser timezone once, after consent, and the profile shows it"
5. `acceptConsent` request shape and parsed result → apps/web/src/api/client.test.ts "sends POST /v1/me/consent with the bearer token and { version } …"
6. 409 / 401 / leaked `acceptedAt` → client.test.ts "throws ApiError with status %i …" (409, 401), "throws ApiError when a 200 body leaks acceptedAt inside consent"
7. Posts `currentVersion`, returns new me → apps/web/src/features/auth/accept-consent.test.ts "posts the server's current version…", "sends whatever currentVersion the server gave…"
8. 409 → one GET + `ConsentOutdatedError`; failing GET → its `ApiError`; 500/network rethrown, no GET → accept-consent.test.ts "on 409 reloads /v1/me once…", "on 409 with a failing reload…", "rethrows a 500 / a network failure unchanged, without a reload", "rethrows a non-ApiError…"
9. Gate rule → apps/web/src/features/consent/consent-gate-rule.test.ts (12 cases)
10. PrivacyPage without providers, h1, placeholder, h2+body per section in order → apps/web/src/features/privacy/PrivacyPage.test.tsx "shows the title and the placeholder notice", "renders one heading and body per section, in order"
11. Section keys in en.json, no raw `privacy.` key → PrivacyPage.test.tsx "every privacy.* key it uses exists in en.json", "never renders a raw privacy.* key"
12. Signed out `/privacy` + footer link on `/` → consent.spec.ts "signed out: /privacy is public and the footer links to it"
13. Gate privacy link → privacy page; Home → gate again → consent.spec.ts main test (before accepting)
14. idle → apps/web/src/features/consent/ConsentGateView.test.tsx "idle: …"
15. accepting → ConsentGateView.test.tsx "accepting: …"
16. error → ConsentGateView.test.tsx "error: …"
17. outdated → ConsentGateView.test.tsx "outdated: …"
18. No raw keys, keys exist → ConsentGateView.test.tsx "never renders a raw consent.* key", "every consent.* key it uses exists in en.json"; PrivacyPage.test.tsx (as 11)
19. RTL visible and non-overlapping (gate and /privacy) → consent.spec.ts "RTL: the consent screen and /privacy keep their parts visible and apart"
20. profile.spec.ts (3) and sign-in.spec.ts pass with the gate → e2e run below

## How I tested
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| prettier --check (apps/web/src, apps/web/e2e, the epic file) | pass |
| npm run lint (full) | fails on this Windows checkout only: `core.autocrlf=true` gives CRLF files that Prettier flags (131 files, none mine). Not caused by this change. |
| npm run typecheck | pass |
| npm test | 874/874 tests pass; 1 suite fails to load: `tooling/src/docs-commands.test.ts` ("AGENT.md has no fenced block under ## Commands") because AGENT.md is CRLF in this checkout and the regex expects `\n\n`. AGENT.md untouched; same on origin/main here. |
| npx vitest run --project web | pass (13 files, 98 tests) |
| npm run test:emulator | not relevant (no adapters or rules touched) |
| npm run test:e2e | pass, 8/8 (consent ×3, profile ×3, sign-in, home). The `dev:emulators` script uses POSIX `VAR=x cmd` syntax that Windows cmd can't run, so I started the emulators (`FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase emulators:start …`) and `npm run dev:web` by hand from this worktree after `npm run build -w @noor/api`, then ran `npx playwright test` in apps/web (reuses the servers). |

## Commits
- b990ebe T013b: API client acceptConsent (POST /v1/me/consent)
- 2012fa4 T013b: useSession().acceptConsent with 409 reload; timezone default after consent
- 088dc74 T013b: consent gate in AppLayout and public /privacy page
- e370a23 T013b: e2e consent spec; existing specs accept consent on screen
- 873b7c1 T013b: notes for T013c and T080

## Notes for reviewers
- BOARD.md row not edited: builder rules forbid touching `docs/tasks/BOARD.md`; the orchestrator should set the T013b row per Definition of Done.
- While accepting, the button text and the `role="status"` line both say `consent.agreeing` (spec 15 requires both). Screen readers may hear it twice; a visually hidden status class does not exist yet.
- The gate's privacy link and the footer link reuse `.site-nav__link` for the 2.75rem target size and focus ring rather than adding a new link class.
- `stateRef` is synced in a `useEffect`, so `acceptConsent()` sees the committed state; it is only called from a click after render, so there is no lag in practice.
- The API behaved as T013a's spec describes (200 with `required: false`; PATCH before consent was never sent). Nothing to record against T013a.
- Copy: `privacy.rights.body` says users "will be able to delete" their account, which T013c delivers; adjust if T013c slips.
