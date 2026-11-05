VERDICT: PASS
# UX review — T021 round 4

Round 3 already passed the invite and join flow. Since `eb9e2aa`, the only `apps/web` change is commit `6e8bd7c`: `@playwright/test` moves from `1.51.1` to `1.61.0` in `apps/web/package.json`, and `package-lock.json` pins `@playwright/test`, `playwright`, and `playwright-core` to `1.61.0`. All three stay `dev` dependencies. `apps/web/src`, `apps/web/e2e`, and `playwright.config.ts` are unchanged.

That pin is for CI browser install on Ubuntu 26.04. It does not change the invite dialog, the join page, copy, focus, touch targets, `dir`, or what a member sees before a question closes. Round 3 nits stay as written there and are not reopened.

## Findings

None.

## Nits (non-blocking)

None.
