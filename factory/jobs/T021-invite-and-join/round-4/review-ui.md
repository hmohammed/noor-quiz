VERDICT: PASS
# UI design review — T021 round 4

## Findings
None. Since the round-3 pass (`eb9e2aa`), `factory/T021-invite-and-join` changes one web file: `apps/web/package.json` pins `@playwright/test` from `1.51.1` to `1.61.0` (`6e8bd7c`). `package-lock.json` moves `@playwright/test`, `playwright`, and `playwright-core` to `1.61.0`. No component, stylesheet, copy, or route file changed. Playwright stays a devDependency, so the invite dialog and join page are the same UI round 3 passed.

## Nits (non-blocking)
None. Round-3 nits (invite link colour, duplicated joining label, join name margin) are unchanged and stay closed.
