VERDICT: PASS
# UX review — T002 round 2

## Findings
None. The round-1 must-fix is resolved.

- Verified: apps/web/src/features/home/HomePage.tsx renders `<p role="status" data-testid="api-status" className=...>` as one element, with its text coming from `t(statusKey[status])`. It is a live region, so checking -> ok / unreachable changes are announced.
- The element is rendered from the first paint (initial state "checking"), so the later text change is announced reliably.
- `data-testid="api-status"` is kept, so apps/web/e2e/home.spec.ts still matches. The status text is unchanged ("API ok").
- No regressions: the three strings are still in apps/web/src/i18n/en.json and go through `t()`. The stylesheet uses logical properties only. Nothing else in apps/web changed in the round-2 diff scope that I could see.

## Nits (non-blocking)
Round-1 nits are unchanged and stay out of T002 scope (T080 / real screens): retry or next step on "API unreachable", `<h1>` and `<title>` through i18n, static `lang`/`dir`, developer-style wording.
