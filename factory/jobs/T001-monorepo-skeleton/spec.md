# Spec — T001 Monorepo skeleton with lint, typecheck and unit tests

Size check: one day or less. No ports, no screens, no pages, no migration. Not split.

The repo has no code yet (only `docs/`, `.claude/`, `factory/`, `AGENT.md`, `README.md`, `.gitignore`). This task creates the workspace layout, the shared tooling and one CI workflow. It adds no product behaviour, no routes, no Firestore data and no UI framework.

## Acceptance tests
1. `packages/core` trivial test passes. Layer: core. File: `packages/core/src/index.test.ts`
2. `packages/contracts` trivial test passes. Layer: core (contracts). File: `packages/contracts/src/index.test.ts`
3. `packages/testkit` trivial test passes and imports a symbol from `@noor/core`, which proves workspace resolution across packages for both Vitest and `tsc -b`. Layer: core (testkit). File: `packages/testkit/src/index.test.ts`
4. `apps/api` trivial test passes. Layer: api. File: `apps/api/src/index.test.ts`
5. `apps/web` trivial test passes. Layer: web (no UI yet). File: `apps/web/src/index.test.ts`
6. `apps/workers` trivial test passes. Layer: workers. File: `apps/workers/src/index.test.ts`
7. `npm test` at the root runs every project above plus `tooling`, and exits 0. `npm test -w <pkg>` also works for each of the six workspaces. Verified by command; the builder records the output in build.md.
8. Lint fixture: `import 'firebase-admin';` in a file under `packages/core/src/` produces a `no-restricted-imports` error. Layer: lint (root tooling). File: `tooling/src/eslint-core-boundary.test.ts`
9. Lint fixture, `it.each`: each of these specifiers is an error in `packages/core`: `firebase`, `firebase/app`, `firebase-admin`, `firebase-admin/firestore`, `firebase-functions`, `firebase-functions/v2/https`, `@firebase/app`, `stripe`, `openai`, `hono`, `hono/cors`, `node:http`, `http`. Check both `import x from '...'` and `import type { X } from '...'`. File: same as 8.
10. Lint fixture, scoping: the same `import 'firebase-admin';` linted as `apps/api/src/x.ts` raises **no** `no-restricted-imports` message, so the ban applies to core only. File: same as 8.
11. Lint fixture, negative: `import { z } from 'zod';` and a relative import (`./other`) linted as `packages/core/src/x.ts` raise no `no-restricted-imports` message. File: same as 8.
12. `npm run lint` and `npm run typecheck` pass on the finished tree, with zero ESLint warnings (`--max-warnings 0`). Verified by command.
13. Manual check, recorded in build.md (backs up AC 2): temporarily add `import 'firebase-admin';` to `packages/core/src/index.ts`, run `npm run lint`, confirm it exits non-zero with the rule message, then revert. Do not commit the change.
14. CI workflow, local check. On a clean install (`rm -rf node_modules && npm ci`), the builder runs the exact steps the workflow runs, in order: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. All must pass, and the results go into build.md. The builder also reads `.github/workflows/ci.yml` to confirm it triggers on `pull_request` and runs those same four commands. If `actionlint` happens to be installed, run it, but do **not** add it as a dependency. **The "green on GitHub" part of AC 3 cannot be checked locally. It is left to a human after the first push or PR. The builder says so in build.md under "Notes for reviewers".**

There are no new routes, so no unauthorised or wrong-tenant tests are needed.

How the acceptance criteria map to tests:
- AC 1 "`npm test` runs and passes in every package" → tests 1–7
- AC 2 "firebase-admin import in core fails lint" → tests 8–11 (automated fixture), 13 (manual)
- AC 3 "CI runs on PRs and is green" → test 14 (local check; GitHub green is left to a human)

## Files and modules to touch
Root:
- `package.json`: `"private": true`, `"type": "module"`, `"workspaces": ["apps/*", "packages/*", "tooling"]`, `"engines": { "node": ">=20.18" }` (see Node note below). Scripts:
  - `lint`: `eslint . --max-warnings 0 && prettier --check .`
  - `format`: `prettier --write .`
  - `typecheck`: `tsc -b`
  - `test`: `vitest run`
  - DevDependencies (pinned with `^`, lockfile committed): `typescript` ^5, `eslint` ^9, `@eslint/js` ^9, `typescript-eslint` ^8, `eslint-config-prettier`, `prettier` ^3, `vitest` ~3.2, `vite` ^6, `@types/node` ^22.
- `package-lock.json`: committed. `npm ci` in CI needs it.
- `.nvmrc`: `22`.
- `tsconfig.base.json`: shared strict options (see Contracts below).
- `tsconfig.json`: solution file. `"files": []` plus `references` to all six workspaces and `tooling`.
- `eslint.config.js`: flat config (see below).
- `.prettierrc.json`, `.prettierignore`.
- `vitest.config.ts`: `test.projects: ['packages/*', 'apps/*', 'tooling']`.
- `.github/workflows/ci.yml`: install, lint, typecheck, test.
- `.gitignore`: already ignores `node_modules/`, `dist/`, `coverage/`. Add `*.tsbuildinfo`.

Each workspace (`packages/core`, `packages/contracts`, `packages/testkit`, `apps/api`, `apps/web`, `apps/workers`):
- `package.json`: `"name": "@noor/<dir>"`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }` (source-first, no build step needed for tests), `"scripts": { "test": "vitest run", "typecheck": "tsc -b" }`. `@noor/testkit` lists `"@noor/core": "*"` in `dependencies`.
- `tsconfig.json`: extends `../../tsconfig.base.json` and sets `rootDir: "src"`, `outDir: "dist"`, `include: ["src"]`, plus the per-package `lib`/`types` below. `testkit` has `references: [{ "path": "../core" }]`.
- `vitest.config.ts`: `defineProject({ test: { name: '<dir>', include: ['src/**/*.test.ts'] } })`.
- `src/index.ts`: one tiny named export, e.g. `export const PACKAGE_NAME = '@noor/core' as const;`. No real domain code. `testkit/src/index.ts` re-exports or uses the core symbol.
- `src/index.test.ts`: one test that imports the export and asserts it. Import `describe/it/expect` from `vitest` explicitly. Do not use globals.

Tooling:
- `tooling/package.json`: `@noor/tooling`, private, `"type": "module"`, test script.
- `tooling/tsconfig.json`: extends base, `types: ["node"]`, `include: ["src"]`.
- `tooling/vitest.config.ts`: project name `tooling`.
- `tooling/src/eslint-core-boundary.test.ts`: uses the ESLint Node API: `new ESLint({ cwd: <repo root> })` and `eslint.lintText(code, { filePath: '<repo root>/packages/core/src/__lint_fixture__.ts' })`. Assert on `messages[].ruleId === 'no-restricted-imports'`. Find the repo root from `import.meta.url`. The fixture file **must not** exist on disk, because then `npm run lint` would fail. That is why `lintText` with a virtual path is used.

`apps/web` stays a plain TS package in this task. Vite, React and React Router arrive in T002.

## Contracts and data shapes
No zod schemas, no Firestore docs, no error codes, no HTTP. The "shapes" here are the config files.

`tsconfig.base.json` compilerOptions:
```jsonc
{
  "target": "ES2022",
  "lib": ["ES2023"],
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true,
  "skipLibCheck": true,
  "composite": true,
  "declaration": true,
  "declarationMap": true,
  "forceConsistentCasingInFileNames": true
}
```
Do not set `outDir`/`rootDir` in the base. Relative paths resolve against the file that declares them, so each package sets its own.

Per-package `lib` / `types`:
| package | lib | types |
| --- | --- | --- |
| core, contracts, testkit | `["ES2023"]` | `[]`. No Node or DOM globals, so `fetch`, `process` and so on do not typecheck in core. |
| api, workers, tooling | `["ES2023"]` | `["node"]` |
| web | `["ES2023", "DOM", "DOM.Iterable"]` | `[]` |

`eslint.config.js` (flat config, ESM):
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const coreBanned = {
  paths: [
    { name: 'node:http', message: 'core has no I/O (AGENT.md rule 1)' },
    { name: 'http', message: 'core has no I/O (AGENT.md rule 1)' },
  ],
  patterns: [
    { group: ['firebase', 'firebase/*', 'firebase-*', 'firebase-*/*', '@firebase/*'],
      message: 'No vendor imports in packages/core (AGENT.md rule 1). Add a port.' },
    { group: ['stripe', 'stripe/*', 'openai', 'openai/*', 'hono', 'hono/*'],
      message: 'No vendor imports in packages/core (AGENT.md rule 1). Add a port.' },
  ],
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'docs/**', 'factory/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['packages/core/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', coreBanned] } },
  prettier,
);
```
- Use the non-type-aware `tseslint.configs.recommended`. Type-aware presets would break `lintText` on a virtual fixture path that is not in any tsconfig. Type-aware linting can come in a later task.
- The builder may tune the pattern syntax. Tests 9–11 are the contract.

`.prettierignore`: `node_modules`, `dist`, `coverage`, `package-lock.json`, `docs`, `factory`, `.claude`, `*.md`. The existing hand-written docs must not fail `prettier --check`.

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```
Name the job `unit`, because T004 adds separate `emulator` and `e2e` checks next to it. No secrets, no deploy steps.

### Node version handling
- The target is Node 22. `.nvmrc` = `22`, and CI uses `.nvmrc`, so CI runs on 22.
- `engines.node` is `>=20.18` so that the local machine (v20.18) can still install and run everything. Do **not** set `engine-strict`. Do not add an `.npmrc` that enforces engines.
- Vite 7 and later Vitest majors require Node >= 20.19. That is why `vite` is pinned to `^6` as a root devDependency and `vitest` to `~3.2`, so npm does not hoist Vite 7. The builder checks with `npm ls vite` that only 6.x is installed. Any later upgrade must raise `engines` and needs Node >= 20.19 locally. Add this as a Note under T001 in the epic file for the next task.
- Write test and tooling code that runs on both 20.18 and 22. Avoid Node-22-only APIs (for example `import.meta.dirname` is fine on 20.11+, but `require(esm)` behaviour and `fs.glob` are not available).

## Hard rules that apply here
- **Rule 1 (core is vendor-free).** This task builds the enforcement for it: the scoped `no-restricted-imports` rule plus the fixture tests 8–11, and `types: []` in core so Node and DOM globals such as `fetch` do not typecheck there. The fixture test lives in `tooling/`, **not** in `packages/core`, because it imports `eslint` and core must not import vendor packages.
  - Known gap, to note in build.md and leave unfixed: `no-restricted-imports` does not catch dynamic `import('firebase-admin')`.
- **Rule 9 (secrets).** The workflow uses no secrets, and `permissions: contents: read` stays the minimum. No `.env*` files are created. `.env.example` arrives with T003, when the first config is added.
- **Dependencies.** Every devDependency above is tooling the task explicitly asks for: TS, ESLint + Prettier, Vitest. `vite` is pinned only to keep Node 20.18 working. `@types/node` is for api, workers and tooling. List each one with a one-line reason and exit path in build.md. Add no runtime dependencies (no zod, hono or react yet).
- **Conventions.** Files are kebab-case. ESM everywhere. No `Date.now()`/`new Date()` in any trivial code (rule 5 starts here).

## Out of scope
- Vite dev server, React, React Router, Hono app, health endpoint, Firebase emulators, `firebase/` folder, Playwright, and the `dev`, `test:emulator` and `test:e2e` scripts (all T002 / T004).
- Clock port, `DomainError`, config, `.env.example`, composition root (T003).
- zod or any schema in `packages/contracts`.
- Emulator, e2e, build or deploy CI jobs, GitHub environments, branch protection (T004 / T005).
- Type-aware ESLint rules, a custom ESLint plugin, `no-restricted-globals` for `fetch`, dynamic-import bans, an i18n lint, husky/lint-staged, changesets, turbo/nx, coverage thresholds.
- Editing `docs/tasks/BOARD.md`, `AGENT.md` or README command sections. The builder may only add a line to T001 **Notes** in `docs/tasks/E00-foundation.md`.
- Pushing, or opening a PR to get the GitHub check green. That is for a human.
