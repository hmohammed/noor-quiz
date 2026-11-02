VERDICT: PASS
# UI design review — T010c round 2

Scope: the round-2 commit changes only `.auth__button` in `apps/web/src/styles.css` (`min-block-size: 2.75rem`, `min-inline-size: 6rem`). I re-checked the full `.auth*` / `.site-header` CSS in `git diff main...factory/T010c-web-google-sign-in -- apps/web`.

## Findings
None. No must-fix items.

- Tap target: `min-block-size: 2.75rem` is 44px at the default font size. This meets the usual touch-target guidance and the 360px-first approach. `min-inline-size: 6rem` stops a short label such as "Sign out" from shrinking to a sliver.
- Logical CSS: both new properties are logical (`block-size` / `inline-size`). The rest of the diff uses `padding-inline`, `padding-block`, `border-block-end`, `margin-block`. There is no `left`, `right`, or physical `margin`/`padding` in the new CSS.
- Responsive: `.auth` has `flex-wrap: wrap`, so the name plus the button wrap at 360px instead of causing horizontal scroll. The minimums are `rem`-based and small enough to fit.
- Contrast: white on `--color-accent` (#1f5f8b) is well above WCAG AA (about 7:1). The 3px focus ring uses `--color-text`.
- Consistency: the button has the same state styling as before (focus-visible outline) and still comes from one shared `.auth__button` class, used for both sign-in and sign-out.

## Nits (non-blocking)
- `apps/web/src/styles.css` `.auth__button`: `color: #fff` and `border-radius: 0.375rem` are literal values, not variables (a `--color-on-accent` and a `--radius` token would be neater). Unchanged from round 1, which passed.
- There is no `:hover` or `:active` state on `.auth__button`. Not required by the spec.
