VERDICT: PASS
# UI design review — T010c round 1

Reviewed `apps/web/src/styles.css`, `features/auth/AuthButtonView.tsx`, `features/home/HomePage.tsx` and `i18n/en.json` from `git diff main...factory/T010c-web-google-sign-in -- apps/web`. I read the code only and did not render it in a browser.

## Findings
None blocking.

Checked and fine:
- **Components**: there is no shared component set yet, so one small presentational `AuthButtonView` plus a container is reasonable. It is the only button style so far, so nothing could be reused. Class names follow BEM-ish `auth__*`, matching the existing `api-status--*` pattern.
- **Logical CSS**: the new CSS uses `padding-inline`, `padding-block`, `border-block-end` and `margin-block`. There is no `left`, `right`, `margin-left` or `text-align: left`. `justify-content: flex-end` is direction-aware, so the header control sits at the inline end in RTL too.
- **Tokens**: spacing, text, muted, error and accent colours come from variables. The one new variable `--color-accent: #1f5f8b` is within the spec's allowance.
- **Contrast** (computed from the hex values):
  - white on `--color-accent` is about 6.9:1, which passes AA.
  - `--color-error` on `--color-bg` is about 6:1.
  - `--color-muted` on `--color-bg` is about 5.5:1.
  - The focus ring uses `--color-text` at 3px with a 2px offset, so it is visible against the page background.
- **Fonts and line height**: the font stack inherited from `:root` already includes Noto Sans Arabic and Noto Sans Ethiopic, and `line-height: 1.5` suits Arabic script. The name uses `dir="auto"`, so Arabic and Ge'ez names keep their own direction.
- **Responsive at 360px**: `.auth` is `flex-wrap: wrap` with a gap, so the name, error text and button wrap onto separate lines instead of scrolling horizontally. The header has `--space-4` inline padding.
- **States and a11y**: loading uses `role="status"` with `aria-busy`, errors use `role="alert"`, and buttons are real `<button type="button">` elements. All strings come from `t()`.
- **Consistency**: the header uses the same spacing scale, text colours and muted/error semantics as `.api-status`.

## Nits (non-blocking)
- apps/web/src/styles.css:61 — `color: #fff` is a raw hex. Consider a `--color-on-accent` variable.
- apps/web/src/styles.css:65 — `border-radius: 0.375rem` is a magic value. Consider a `--radius-2` variable when a second component needs it.
- apps/web/src/styles.css:32 — the header border uses `color-mix(...)` with an inline 25%. A `--color-border` variable would let later screens reuse it.
- apps/web/src/styles.css:57 — `.auth__name` has no `overflow-wrap: anywhere` or `min-inline-size: 0`. A very long single-word display name could overflow at 360px, because `flex-wrap` only wraps between items.
- apps/web/src/styles.css:59 — `.auth__button` has no `:hover`/`:active` state. The button is about 40px tall (0.5rem padding plus a 24px line). That meets WCAG 2.2 AA's 24px minimum but is under the 44px touch guideline. Consider a `min-block-size: 2.75rem`.
