VERDICT: PASS
# UX review — T010c round 2

Checked `git diff main...factory/T010c-web-google-sign-in -- apps/web`, mainly `apps/web/src/styles.css`, plus `AuthButtonView.tsx` and `en.json`.

## Round 1 must-fix: confirmed fixed
- `.auth__button` in `apps/web/src/styles.css` now has `min-block-size: 2.75rem` (44px) and `min-inline-size: 6rem`, so "Sign in with Google" and "Sign out" both meet the 44px touch-target rule.
- The padding is `padding-inline: var(--space-4)` and `padding-block: var(--space-2)`. Everything in the `.auth*` and `.site-header` rules uses logical properties (`min-block-size`, `min-inline-size`, `padding-inline`, `padding-block`, `border-block-end`, `margin-block`), so the layout mirrors under `dir="rtl"`.
- The `:focus-visible` outline is still there, and the contrast of white on `#1f5f8b` is unchanged.
- Nothing else in the diff regresses the states, the `t('auth.*')` copy or the `dir="auto"` handling of the display name that round 1 verified.

## Findings
None.

## Nits (non-blocking)
The round 1 nits still stand and are not required for this task. In particular:
- the "Signing in…" text shows on page load, before any click;
- the error-with-session state offers no retry other than signing out;
- the live-region announcements and the focus handling when buttons swap;
- `overflow-wrap` on very long names.
