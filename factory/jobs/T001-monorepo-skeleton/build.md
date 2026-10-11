# Build — T001 (round 1)
Branch: factory/T001-monorepo-skeleton
Worktree: /mnt/c/Users/hassen.mohammed/Downloads/noor-quiz/.claude/worktrees/agent-a86b7040487255a46

## Changes
- package.json: private ESM root with workspaces `apps/*`, `packages/*` and `tooling`, plus `engines.node >=20.18` and the scripts `lint`, `format`, `typecheck` and `test`, as the spec says. Dev dependencies only.
- package-lock.json: committed so CI can run `npm ci`.
- .nvmrc: `22`. CI reads it.
- .gitignore: adds `*.tsbuildinfo`.
- tsconfig.base.json: shared strict options, exactly as the spec lists them.
- tsconfig.json: solution file with `files: []` and references to the six workspaces plus tooling.
- eslint.config.js: flat config with `@eslint/js` recommended, the non-type-aware `typescript-eslint` recommended preset, and `eslint-config-prettier`. A `no-restricted-imports` rule scoped to `packages/core/**` bans firebase*, @firebase/*, stripe, openai, hono (and their subpaths), `node:http` and `http`.
- .prettierrc.json, .prettierignore: Prettier ignores docs, factory, .claude, `*.md` and the lockfile, so the hand-written docs do not fail `prettier --check`.
- vitest.config.ts: `test.projects: ['packages/*', 'apps/*', 'tooling']`.
- .github/workflows/ci.yml: job `unit`. It runs on `pull_request` and on push to `main`, with `permissions: contents: read`, Node from `.nvmrc`, then `npm ci`, lint, typecheck, test. It uses no secrets.
- packages/{core,contracts,testkit}, apps/{api,web,workers}: each has a `package.json` (`@noor/<dir>`, source-first `exports`, `test`/`typecheck` scripts), a `tsconfig.json` (extends base, own `rootDir`/`outDir`/`tsBuildInfoFile`, `lib`/`types` per the spec table, so core has `types: []`), a `vitest.config.ts` (`defineProject`), `src/index.ts` exporting `PACKAGE_NAME`, and `src/index.test.ts`. `@noor/testkit` depends on `@noor/core` and references it in tsconfig.
- tooling/: `@noor/tooling` holds the ESLint core-boundary fixture test. It uses `ESLint#lintText` with virtual file paths, so no fixture file exists on disk. testTimeout is 30s, with a `beforeAll` warm-up for the first config/parser load.
- docs/tasks/E00-foundation.md: one Notes line under T001 for the next task (Vite/Vitest pin, Node 20.19 upgrade path, audit advisories, dynamic-import gap).
- Deviation from the spec: I added `"tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"` to every package tsconfig. Without it, tsbuildinfo is written next to tsconfig.json, and after `dist/` is deleted `tsc -b` treats core as up to date and fails with TS6305 in testkit. I hit this during the clean-install check. A fresh CI checkout would not hit it, but local clean-ups would.

## Acceptance tests → test files
1. core trivial test → packages/core/src/index.test.ts "exports its package name"
2. contracts trivial test → packages/contracts/src/index.test.ts "exports its package name"
3. testkit test imports from `@noor/core` → packages/testkit/src/index.test.ts "resolves @noor/core through the workspace" (`tsc -b` also resolves it through the testkit → core project reference)
4. api trivial test → apps/api/src/index.test.ts "exports its package name"
5. web trivial test → apps/web/src/index.test.ts "exports its package name"
6. workers trivial test → apps/workers/src/index.test.ts "exports its package name"
7. root `npm test` runs all 7 projects (7 files, 36 tests, exit 0), and `npm test -w <pkg>` exits 0 for all six workspaces → verified by command (see below)
8. `import 'firebase-admin'` in core is an error → tooling/src/eslint-core-boundary.test.ts "flags `import 'firebase-admin'` in packages/core"
9. it.each over the 13 specifiers, for both value and type imports → same file, "flags a value import of %s in packages/core" and "flags a type import of %s in packages/core" (26 cases)
10. scoping: the same import as `apps/api/src/x` gets no message → same file, "does not apply the ban outside packages/core"
11. negative: zod and `./other` in core get no message → same file, "allows zod and relative imports in packages/core"
12. `npm run lint` (with `--max-warnings 0`, plus `prettier --check`) and `npm run typecheck` pass → verified by command
13. Manual check: I temporarily added `import 'firebase-admin';` to packages/core/src/index.ts and ran `npm run lint`. It exited 1 with `1:1 error 'firebase-admin' import is restricted from being used by a pattern. No vendor imports in packages/core (AGENT.md rule 1). Add a port  no-restricted-imports`. I reverted the change and did not commit it.
14. CI local check: `rm -rf node_modules` (and all `dist/`), then `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. All exited 0. I read ci.yml to confirm it triggers on `pull_request` and runs exactly those four commands in that order. actionlint is not installed, so I did not run it.

## How I tested
| command | result |
| --- | --- |
| rm -rf node_modules dist && npm ci | pass (exit 0; EBADENGINE warning for eslint-visitor-keys@5.0.1 on Node 20.18, harmless) |
| npm run lint | pass (0 ESLint problems, Prettier clean) |
| npm run typecheck | pass (also passes after deleting `dist/`) |
| npm test | pass: 7 files, 36 tests (core 1, contracts 1, testkit 2, api 1, web 1, workers 1, tooling 29) |
| npm test -w @noor/core / contracts / testkit / api / web / workers | pass (exit 0 each) |
| npm ls vite | only vite@6.4.4 installed (vitest 3.2.7) |
| manual lint check (AC 13) | lint exits 1 with the no-restricted-imports message; reverted |
| npm run test:emulator | not relevant (no adapters or rules; T002/T004 create it) |
| npm run test:e2e | not relevant (no UI) |
| actionlint | unavailable (not installed; not added per spec) |

Tested locally on Node v20.18.3 and npm 10.8.2.

## Dependencies (all devDependencies, no runtime deps)
- typescript ^5: strict TS and `tsc -b` project references. Exit path: none needed (it is the language).
- eslint ^9 + @eslint/js ^9: linting and the core boundary rule. Exit path: Biome or oxlint, which would need an equivalent restricted-imports rule.
- typescript-eslint ^8: TS parser and recommended rules for ESLint. Exit path: goes with ESLint.
- eslint-config-prettier: turns off formatting rules that clash with Prettier. Exit path: delete it if formatting moves to Biome.
- prettier ^3: formatting check in lint. Exit path: Biome formatter.
- vitest ~3.2: unit test runner with projects. Exit path: `node:test`, at the cost of the TS transform and projects.
- vite ^6: pinned only so npm does not hoist Vite 7, which needs Node >= 20.19 and would break local Node 20.18. Exit path: drop the pin when the local Node is >= 20.19.
- @types/node ^22: Node types for api, workers and tooling. Exit path: none needed.

## Commits
- 63cb889 T001: root workspace, TypeScript, ESLint, Prettier and Vitest config
- 1e2afeb T001: six workspaces with strict tsconfig and one trivial test each
- b41e32d T001: ESLint core-boundary fixture tests in tooling
- 24c1c7c T001: GitHub Actions CI workflow (install, lint, typecheck, test)
- b896b4d T001: keep tsbuildinfo inside dist so tsc -b rebuilds after dist is removed
- f92ab49 T001: notes for next task in E00 epic

## Notes for reviewers
- **AC 3 "green on GitHub" cannot be checked locally.** A human needs to confirm the `ci / unit` check is green after the first push or PR. Locally, the same four steps pass on a clean `npm ci`.
- **`npm audit`: 3 advisories (1 moderate, 2 critical), all in dev-only test tooling.** They are in `vitest` 3.2 → `@vitest/mocker` (path traversal, GHSA-82fw-gwwq-j7x9) and `tinypool` (prototype pollution to RCE, GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr). The only fix is vitest 4.x, which needs Node >= 20.19 and conflicts with the spec's `~3.2` pin for local Node 20.18. They do not ship to production. Exposure is limited to running tests on attacker-controlled config or input. I left this unchanged. I recommend upgrading to Vitest 4 / Vite 7 and raising `engines` once the local Node is >= 20.19. This is also noted under T001 in the epic.
- Known gap (out of scope per spec): `no-restricted-imports` does not catch dynamic `import('firebase-admin')` in core. Core's `types: []` still stops `fetch`/`process` from typechecking there.
- `eslint@9.39.5` prints an npm "no longer supported" deprecation notice. It is still within the spec's `^9`. Moving to ESLint 10 is a later decision.
- Small spec deviation: `tsBuildInfoFile` set to `dist/` in each package tsconfig (reason under Changes).
- While I was working, some files in the worktree were changed by a process other than me. The tooling test gained a `beforeAll` warm-up and the tooling vitest config a `testTimeout: 30_000`. Those edits were sensible and are committed. A temporary edit I made for the AC 13 check was also reverted before lint ran, so I repeated that check in a single command. The result above comes from that repeated run.
- build.md location: worktree isolation blocked writing to the main-checkout path, so this file is in the worktree at factory/jobs/T001-monorepo-skeleton/build.md and is not committed.
