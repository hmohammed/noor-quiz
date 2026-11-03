VERDICT: PASS
# UI design review — T011 round 2

Scope read: `git diff main...factory/T011-edit-profile -- apps/web` at b30b82d in the worktree. I focused on the round 2 changes (`ProfileFormView.tsx`, `ProfilePage.tsx`, `en.json`) and re-checked `styles.css` and `AppLayout.tsx`.

## Findings
None. No must-fix items.

What I checked and verified in the code:
- **Components**: the new `error`, `unavailable` and `signed-out` views reuse the existing `<main class="page">`, `.profile__title`, `.profile__status`, `.profile__error` and `.auth__button` classes. No new component or CSS rule was added in round 2, so there is nothing new to check for tokens or logical properties. `styles.css` is unchanged since round 1.
- **Tokens**: the diff has no hex values outside the `:root` variables, no inline `style=` and no new `px` units. The only matches for `left`/`right` in the diff are the words "right now" in two `en.json` strings, not CSS.
- **Logical CSS**: the diff has no `left`, `right` or physical `text-align`. All new rules use `margin-block`, `padding-inline`, `min-block-size`, `max-inline-size` and `border-block-end`.
- **Contrast**: unchanged from round 1. Muted text, error text, the accent button and the disabled state still pass AA. The new "load failed" message uses `--color-error` on `--color-bg` (about 6:1), and the new "unavailable" message uses `--color-muted` (about 5.7:1).
- **Legibility and i18n**: the new strings go through `t()`, with no raw keys. The `error` view uses `role="alert"` and the `unavailable` view is plain text, which matches its non-urgent meaning. The Arabic and Ethiopic font stack is unchanged.
- **Responsive at 360px**: the new views are a title, a paragraph and at most one button in the normal block flow. They have no fixed widths, so there is no cause of horizontal scroll. The header wraps as before.
- **Consistency**: the retry and sign-in buttons look like the header button, and the load error and the save error share the same `.profile__error` style. The `unavailable` view has no action, as the spec intends. The signed-out view now shows a second "Sign in with Google" button below the header's own. It is the same style and label, so it reads as one pattern.
- **Keyed editor**: `ProfileEditor` is keyed by `me.userId`. It remounts on a user change and shows no stale values, so there is no visual state carry-over.

## Nits (non-blocking)
- apps/web/src/features/profile/ProfileFormView.tsx:149 — The three buttons (`save`, `retry`, `sign in`) all use `.auth__button`, a class named for the auth feature. Extract a shared `.button` class when the next button is added. (Carried over from round 1.)
- apps/web/src/features/profile/ProfileFormView.tsx:101 — The `error` and `signed-out` views put the button right after the paragraph with no spacing rule. The `<main>` is block flow, so the button sits tight under the text. Wrap the text and button in a flex column with `gap: var(--space-4)`, or reuse a spacing class. I did not render the page, so I could not judge how tight it looks.
- apps/web/src/features/layout/AppLayout.tsx:7-19 — `Link`, not `NavLink`, so the current page has no `aria-current="page"` state. (Carried over.)
- apps/web/src/styles.css:60 — At 360px, when the header wraps, `.auth` sits at the start edge. Add `margin-inline-start: auto` on `.auth` for an end-aligned look. (Carried over.)
- apps/web/src/styles.css — `0.375rem` and `2.75rem` are repeated in several rules. Fold them into `--radius` and `--target-size` variables when the tokens are next touched. (Carried over.)
- apps/web/src/features/profile/ProfilePage.tsx — Submitting an unchanged form still shows "Profile saved." (Carried over.)
