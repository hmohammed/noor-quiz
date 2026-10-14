# Merge log — T003

## git -C <worktree> rebase main
Rebasing (1/10)Rebasing (2/10)Rebasing (3/10)Rebasing (4/10)Rebasing (5/10)Rebasing (6/10)Rebasing (7/10)Rebasing (8/10)Rebasing (9/10)Rebasing (10/10)[KSuccessfully rebased and updated refs/heads/factory/T003-clock-config-errors.
exit=0
## npm install

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
exit=0
## npm run lint
> lint
> eslint . --max-warnings 0 && prettier --check .

Checking formatting...
All matched files use Prettier code style!
exit=0
## npm run typecheck

> typecheck
> tsc -b
exit=0
## npm test

 Test Files  24 passed (24)
      Tests  171 passed (171)
   Start at  11:43:00
   Duration  12.41s (transform 36.36s, setup 0ms, collect 71.12s, tests 11.49s, environment 4ms, prepare 34.99s)
exit=0
## npm run test:e2e
NOT RUN by the factory: it runs dev:emulators, which creates apps/api/.env.local; agents may not create .env files. No UI touched.
## git merge --squash factory/T003-clock-config-errors
 create mode 100644 packages/testkit/src/make-test-deps.test.ts
 create mode 100644 packages/testkit/src/make-test-deps.ts
 create mode 100644 tooling/src/eslint-clock-rule.test.ts
exit=0
## commit + done
2bf37d9 T003: Clock port, typed config and domain errors
