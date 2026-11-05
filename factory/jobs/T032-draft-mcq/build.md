# T032 build
branch: factory/T032-draft-mcq
worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T032-draft-mcq

## Summary
Implemented draft MCQ question vertical slice: contracts (`Question`, `MemberQuestionView`, create/update/list), core domain + use cases (`createQuestion`, `updateQuestion`, `listQuestions`), `QuestionRepo` port with in-memory fake + shared contract, Firestore adapter, and editor HTTP routes under `/v1/t/:tenantId/questions`. Creates always store `reviewStatus: draft` with required sources. No web UI (out of scope).

## Commits on branch
- T032: Add question contracts
- T032: Add the question repository
- T032: Add editor question routes

## Checks
- `npm test` workspaces contracts/core/testkit: PASS
- `npm test --workspace=apps/api`: PASS (incl. questions.test.ts 45 tests)
- `npm run typecheck`: PASS
- `npm run lint`: FAIL on repo-wide Prettier drift (250 files, pre-existing on main); T032-touched files are Prettier-clean
- Emulator / e2e: not required for this slice beyond rules seed (rules.test.ts updated); emulator contract test present and skips when emulator unset

## Needs human
- None for functionality. Repo-wide Prettier check is red on main as well for many files — not introduced by this branch's content.

## Notes
- `MemoryQuestionRepo` lives under `packages/core/src/usecases/` for use-case tests (mirrors `memory-season-repo` pattern; testkit depends on core). Shared fake + contract remain in testkit.
