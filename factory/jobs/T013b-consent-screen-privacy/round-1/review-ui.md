VERDICT: PASS
# UI design review — T013b round 1

Reviewed `git diff main...factory/T013b-consent-screen-privacy -- apps/web` (CSS, `ConsentGateView.tsx`, `PrivacyPage.tsx`, `AppLayout.tsx`, `en.json`) against the existing `apps/web/src/styles.css` in the worktree.

## Findings
None blocking.

Checked and fine:
- **Components**: no new component primitives. The "I agree" button reuses `.auth__button`. The gate's privacy link and the footer link reuse `.site-nav__link` (2.75rem target, focus ring). Page shells reuse `.page`. `ConsentGateView` is a small pure view, `PrivacyPage` is data-driven from `PRIVACY_SECTIONS`.
- **Tokens**: every new colour, spacing and gap in `styles.css:189-238` is a CSS variable (`--space-2`, `--space-4`, `--color-muted`, `--color-error`). No new hex values or magic pixel values. The only literal is the `1px` hairline, with the same `color-mix` border as `.site-header`.
- **Logical CSS**: only `margin-block`, `padding-inline`, `padding-block` and `border-block-start` are used. There is no `left`, `right`, `text-align: left` or physical margin/padding in the new CSS.
- **Contrast and legibility**: new text uses `--color-text` on `--color-bg`, `--color-muted` (#5b6660) for the placeholder and status, and `--color-error` (#a8322d) for alerts. These pairs are the same ones already used by `.profile__*` and `.auth__*`, and they are above AA on #fbfaf7. Links use `--color-accent` (#1f5f8b) with the browser's default underline. The font stack already covers Arabic and Ethiopic, and `line-height: 1.5` is inherited.
- **Responsive**: `.page` has `max-inline-size: 40rem` with `padding-inline`. `.consent` is a column. `.consent__actions` and `.site-footer` use `flex-wrap`. There is no fixed width, so there should be no horizontal scroll at 360px. I did not run it in a browser.
- **Consistency**: the gate follows the same pattern as the profile screen (`<main class="page …">`, an `h1` with `margin-block: 0`, a flex column with `--space-4` gap, and an actions row with status and error lines coloured like `.profile__status` and `.profile__error`). The footer matches the header's `padding-inline`, `padding-block` and border.

## Nits (non-blocking)
- apps/web/src/features/privacy/PrivacyPage.tsx:9 — `.privacy__title` has no CSS rule, so the `h1` keeps the browser's default margins. `.profile__title` and `.consent__title` set `margin-block` explicitly. Optionally add `.privacy__title { margin-block: 0 var(--space-4); }` so the three screens align at the top.
- apps/web/src/styles.css:225 — `.privacy__section` sets `margin-block` but its `h2` and `p` keep the default margins, so spacing between sections is uneven. Consider `.privacy__section > h2, .privacy__section > p { margin-block: 0 var(--space-2); }` once real policy text lands (T013c/T080 notes).
- apps/web/src/styles.css:232 — `.site-footer` sits directly under the content, so on short pages such as the gate it floats mid-screen. The shell has no `min-block-size` column layout. This is acceptable for now, and it is something to revisit with the real layout.
- apps/web/src/features/consent/ConsentGateView.tsx:30 — while accepting, the button label and the `role="status"` line both say `consent.agreeing`, so the text is duplicated on screen. It is required by spec test 15 and the builder already noted it. A visually hidden status class would fix it later.
- apps/web/src/features/consent/ConsentGateView.tsx:15-18 — the summary and the privacy link are two separate `<p>` elements. This is fine visually. If the summary grows, a link inside the paragraph or a row of its own would read better.
