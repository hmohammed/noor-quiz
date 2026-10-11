VERDICT: CHANGES
# UX review — T002 round 1

Scope judged: one home page showing API reachability, loading/error states, minimal t(), dir/lang set. Verified in code at `git diff main...factory/T002-local-stack -- apps/web`.

## Findings
- [must-fix] apps/web/src/features/home/HomePage.tsx:28 — The status `<p data-testid="api-status">` changes text from "Checking API…" to "API ok" or "API unreachable" with no live-region semantics, so screen readers are never told the result. Colour is the only other cue. — Add `role="status"` (implies `aria-live="polite"`) to that same element. Keep it as the single status element and keep the `data-testid`, so the e2e test is unaffected.

## Nits (non-blocking)
- apps/web/src/features/home/HomePage.tsx:28 — The error state ("API unreachable") offers no next step, such as a retry button or a hint. This is acceptable for a dev health page. When a real screen replaces it, follow the states rule: say what to do next, and add a retry button of at least 44px that is disabled while loading to prevent double-submit.
- apps/web/src/features/home/HomePage.tsx:27 — The page has no heading (`<h1>`), and `index.html` has a hardcoded `<title>Noor Quiz</title>` outside `t()`. T080 should move both into i18n.
- apps/web/index.html:2 — `lang="en" dir="ltr"` is static. This is fine for T002, because `t()` is English-only. T080 must set both from the active locale, for example `dir="rtl" lang="ar"`.
- apps/web/src/i18n/en.json:2 — "API ok" and "API unreachable" are developer wording. They are fine for this scope, but real user copy should be kinder and plainer.
- apps/web/src/styles.css — RTL and scripts check passed. Only logical properties are used (`margin-inline`, `padding-inline`, `max-inline-size`) and there is no left/right. The font stack includes Noto Sans Arabic and Ethiopic. Text colours are legible on the background.
- Spoilers: not applicable here. The page shows no quiz content.
- Verified OK: StrictMode-safe abort in the effect (no state set after unmount). The `t()` fallback returns the key for unknown keys. All three states use `t()` keys that exist in `en.json`.
