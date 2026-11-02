VERDICT: PASS
# UI design review — T011 round 1

Scope read: `git diff main...factory/T011-edit-profile -- apps/web` (styles.css, AppLayout, SiteNav, ProfileFormView, ProfilePage, locales.ts, en.json, AuthButton, HomePage, router) in the worktree.

## Findings
None. No must-fix items.

What I checked and verified in the code:
- **Components**: the layout reuses the existing `.site-header`, `.auth`, `.page` and `.auth__button` styles. `AuthButtonView` is untouched, and the header moved into `AppLayout` without a duplicate. `ProfileFormView` is a pure view with classes scoped as `.profile-form*` and `.profile__*`. No generic component was duplicated.
- **Tokens**: all new colours come from `--color-*` variables and spacing from `--space-*`. The diff has no new hex values, no inline `style=` and no `px` units in the new CSS. The font stack is unchanged and already includes Noto Sans Arabic and Noto Sans Ethiopic.
- **Logical CSS**: the new rules use only `margin-block`, `padding-inline`, `min-block-size`, `max-inline-size` and `border-block-end`. There is no `left`, `right` or physical `text-align` in the diff. `justify-content: space-between` and `flex-end` are flow-relative, so they flip under RTL.
- **Contrast**: calculated from the CSS variables.
  - Muted text `#5b6660` on `#fbfaf7` is about 5.7:1, so hint and status text pass AA.
  - Error `#a8322d` on the page background is about 6:1, so it passes.
  - Nav link and button colour `#1f5f8b` is about 6.5:1 on the page, and white on it is about 7:1. Both pass.
  - The 1px control border uses `--color-muted`, so it passes the 3:1 non-text contrast rule.
  - The disabled button at 0.7 opacity is exempt.
- **Legibility and i18n**: the controls use `font: inherit`, so they get 1rem text and the inherited 1.5 line height, which suits Arabic. The name input has `dir="auto"`. Each locale `<option>` carries its own `lang` and `dir`, and the Arabic endonym is set as RTL. The timezone select is forced to `dir="ltr"`, which is right for IANA identifiers.
- **Focus and targets**: there are `:focus-visible` outlines (3px) on the nav links and form controls. The nav links and controls have `min-block-size: 2.75rem`, so touch targets are large enough.
- **Responsive at 360px**: the header uses `flex-wrap` with a gap, and the nav also wraps. The form is a single flex column. Controls have `max-inline-size: 100%` and stretch, and the select does not overflow on long zone names. `.page` is capped at `40rem` with inline padding, so I see no cause of horizontal scroll.
- **Consistency**: the profile page uses the same `<main class="page">` shell as the home page. Status and error text reuse the muted and error colour pair from `.api-status` and `.auth__*`. States are announced with `role="status"` (and `aria-busy` while loading) and `role="alert"`. The invalid-name error is linked to the input through `aria-describedby`, and the input gets `aria-invalid`.

## Nits (non-blocking)
- apps/web/src/features/profile/ProfileFormView.tsx:149 — The submit button borrows `.auth__button`, which is named for the auth feature. If a third button appears, extract a shared `.button` class and use it in both places.
- apps/web/src/features/layout/AppLayout.tsx:7-19 — The nav uses `Link`, not `NavLink`, so the current page has no visible state or `aria-current="page"`. Switch to `NavLink` when more pages exist.
- apps/web/src/styles.css:60 — At 360px, when the header wraps, the `.auth` block drops to its own line and sits at the start edge, because `justify-content: flex-end` only acts inside its own width. This is not broken. Add `margin-inline-start: auto` on `.auth` if the end-aligned look is wanted on narrow screens.
- apps/web/src/styles.css:80 — A 32-letter display name in `.auth__name` has no `overflow-wrap`. It was already like this before T011, but the header now has more content to share a row with.
- apps/web/src/features/profile/ProfilePage.tsx:67-72 — Submitting with no changes shows "Profile saved." even though nothing was sent. Consider a neutral message or leaving the button disabled until something changes.
- apps/web/src/styles.css — `0.375rem` (radius) and `2.75rem` (target size) are now repeated in several rules. Fold them into `--radius` and `--target-size` variables when the token set is next touched.
