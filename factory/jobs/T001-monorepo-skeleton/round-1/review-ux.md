VERDICT: PASS
# UX review — T001 round 1

Scope: apps/web is a placeholder (package.json, tsconfig, vitest config, src/index.ts exporting PACKAGE_NAME, one test). Verified in the diff: no components, routes, strings, inputs, CSS or HTML, so flow, states, copy/i18n, accessibility, RTL and spoiler checks have nothing to apply to.

## Findings
- none

## Nits (non-blocking)
- apps/web/tsconfig.json — lib includes DOM, fine for T002. When T002 adds React/Vite, create apps/web/src/i18n/en.json, use t(key) for all strings, set dir/lang on the root, and use logical CSS properties.
