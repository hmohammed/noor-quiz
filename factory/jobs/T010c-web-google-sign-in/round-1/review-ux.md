VERDICT: CHANGES
# UX review — T010c round 1

Checked: `AuthButtonView.tsx`, `AuthButton.tsx`, `session.ts`, `HomePage.tsx`, `styles.css`, `en.json` and `client.ts` on `factory/T010c-web-google-sign-in`.

States verified in code: signed-out, loading, signed-in with a name, signed-in with no name, error (no session), error (with session) and unavailable. All of them render the right content and every user-facing string goes through `t('auth.*')`, with the keys present in `en.json`. A cancelled popup returns quietly to signed-out. Because the button is replaced by the loading status while the popup is open, double-submit is prevented. RTL looks correct: logical properties only, `dir="auto"` on the name, and flex `flex-end` follows the document direction. Colour contrast is fine (white on `#1f5f8b`, muted text on the page background).

## Findings
- [must-fix] apps/web/src/styles.css:59-68 — `.auth__button` is about 40px tall (0.5rem + 0.5rem padding + 24px line height). The checklist requires touch targets of at least 44px, and this is the only control on a phone-first page. — Add `min-block-size: 2.75rem` (44px). Also add a `min-inline-size` or a wider inline padding so "Sign out" isn't a narrow target. Keep it logical-property only.

## Nits (non-blocking)
- apps/web/src/features/auth/AuthButtonView.tsx:28-35 — `auth.loading` ("Signing in…") shows on every page load before the first auth callback. A signed-out visitor who hasn't clicked anything is told they are signing in. This copy comes from the spec, so consider a neutral "Loading…" next time (T080 copy pass), or reserve "Signing in…" for after the click.
- apps/web/src/features/auth/AuthButtonView.tsx:60-66 — in the error state with a session (sign-in worked but `/v1/me` failed), the text says "Please try again" but the only action is "Sign out". The user must sign out and sign in again to retry. Consider a retry action or copy such as "We couldn't load your account. Sign out and try again."
- apps/web/src/features/auth/AuthButton.tsx:42-45 — while `/v1/me` is loading there is no button at all, and `client.ts` has no timeout. If the API hangs, the user sees "Signing in…" with no way to sign out until the browser gives up. Consider a timeout in `getMe`, or keep the sign-out button visible while loading after a session exists.
- apps/web/src/features/auth/AuthButtonView.tsx:28-51 — the `role="status"` and `role="alert"` nodes are mounted together with their text, which many screen readers don't announce. The move from loading to signed-in (the name) is not announced either. Consider one persistent `aria-live="polite"` wrapper in `.auth` with the content changing inside it. The home page also now has two `role="status"` regions (`api-status` and the auth loading text).
- apps/web/src/features/auth/AuthButtonView.tsx — keyboard focus is lost when the focused sign-in or sign-out button unmounts (the state swaps the whole subtree). Consider moving focus to the new button or the container after the state change.
- apps/web/src/styles.css:51-53 — `.auth__name` has no `overflow-wrap: anywhere` or `min-inline-size: 0`. A very long name, or one with no spaces in Arabic or Ge'ez, can overflow the header on a 320px screen. `flex-wrap` helps, but the name itself can't wrap.
- apps/web/src/features/auth/AuthButtonView.tsx:36-40 — in the unavailable state (a build with no `VITE_*` keys) real users see "Sign-in is not available right now." with no next step. This is acceptable for the spec's out-of-scope CI config, but make sure the dev deploy gets real config before this ships to members.
