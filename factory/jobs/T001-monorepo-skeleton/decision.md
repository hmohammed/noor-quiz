ESCALATE
Reason: AC 3 ("CI runs on PRs and is green") can only be confirmed by a human after the first push, 2 critical dev-only npm audit advisories were knowingly accepted, and an unknown process edited the worktree during the build.
# Decision — T001

## Checks
- Reviews (round 1): ux PASS, ui PASS, code PASS (all three files start with `VERDICT: PASS`)
- Acceptance criteria → tests: 2/3 automated and in the diff. AC 1 → the 7 `src/index.test.ts` / tooling tests. AC 2 → `tooling/src/eslint-core-boundary.test.ts` (29 cases) plus a manual check. AC 3 → only a local re-run of the CI steps (build.md test 14). Whether it is green on GitHub is unverified, and spec.md says a human must confirm it.
- Checks green: lint (`--max-warnings 0` + prettier), typecheck, test (7 files, 36 tests), clean `npm ci`. test:emulator / e2e not relevant (no adapters, rules or UI).
- Definition of Done: no user-facing strings or screens, so i18n/RTL do not apply. No config added, so no `.env.example` change is needed. No ADR needed (the stack is already fixed in AGENT.md). Every devDependency has a one-line justification and exit path in build.md. No runtime deps.
- Hard rules: no violations found. The diff has no `firebase/firestore.rules`, billing, prod config, secrets, `.env*` or `reviewStatus`. CI has `permissions: contents: read` and uses no secrets. Every lockfile entry resolves to registry.npmjs.org or a local workspace.
- Escalation triggers: no hard trigger fired (task tags `—`, not owned by `human`). Escalating under "you are unsure" for the three items below.

## For the human
1. **CI green on GitHub (AC 3).** Push the branch or open a PR, then confirm the `ci / unit` check passes on Node 22. The workflow is `.github/workflows/ci.yml:1-23`. Local runs used Node 20.18.3, not 22.
2. **Accept or reject the npm audit risk.** There are 1 moderate and 2 critical advisories in dev-only test tooling: `@vitest/mocker` (GHSA-82fw-gwwq-j7x9) and `tinypool` (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr). They come from the `vitest ~3.2` / `vite ^6` pin in `package.json:27-28`, which keeps local Node 20.18 working. The fix is Vitest 4 / Vite 7 plus Node >= 20.19. This is recorded as a follow-up in `docs/tasks/E00-foundation.md:34`. Decide whether to accept it for now or upgrade local Node first.
3. **Unexplained edits in the worktree.** build.md ("Notes for reviewers") says a process other than the builder changed files during the build. The changes were committed. They are the `beforeAll` warm-up in `tooling/src/eslint-core-boundary.test.ts:39-43` and `testTimeout: 30_000` in `tooling/vitest.config.ts:7-8`. The code reviewer judged them benign and so do I (no network calls, no file writes, no weakened assertions). Still, confirm where those edits came from before treating the pipeline as trustworthy.
4. Minor: `eslint@9.39.5` prints an npm deprecation notice (still `^9`, as the spec asks). The dynamic `import('firebase-admin')` gap in core is known and out of scope.

If items 1–3 are fine, this is ready to merge. The diff matches spec.md, with one justified deviation (`tsBuildInfoFile` in each package's `tsconfig.json`).

---

**Approved by human** (2026-10-11T17:42:41Z) via `/factory approve T001`. The human accepts: CI green on GitHub to be confirmed after first push; dev-only npm audit advisories from the vitest 3.2 pin; the two unexplained tooling test edits (reviewed by code-reviewer as harmless).
