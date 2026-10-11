<!-- Copied from docs/tasks/E00-foundation.md · BOARD row: Phase P1 · Epic E00 · Depends — · Tags — -->

## T001

**Monorepo skeleton with lint, typecheck and unit tests**

Phase: P1 · Depends on: — · Tags: —
Skills: `deploy-release`

**Goal.** An empty but real monorepo where `npm install && npm run lint && npm run typecheck && npm test` pass.

**Scope**

- npm workspaces: `apps/api`, `apps/web`, `apps/workers`, `packages/core`, `packages/contracts`, `packages/testkit`
- TypeScript strict base config + per-package tsconfig with project references
- ESLint + Prettier; ESLint rule `no-restricted-imports` in `packages/core` banning firebase*, stripe, openai, hono, node:http
- Vitest workspace config; one trivial test per package
- GitHub Actions workflow: install, lint, typecheck, test

**Acceptance criteria**

- [ ] `npm test` runs and passes in every package
- [ ] Adding `import 'firebase-admin'` to a file in `packages/core` makes `npm run lint` fail (verified by a lint fixture test or documented manual check in the PR)
- [ ] CI workflow runs on pull requests and is green

**Notes**

_(implementer adds notes for the next task here)_

