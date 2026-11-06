# T033 build
branch: factory/T033-review-and-schedule
worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T033-review-and-schedule

## Changes
- `packages/contracts` — `ReviewQuestionRequest`; `Question.reviewedBy`/`reviewedAt`; new `schedule.ts` (`ScheduleQuestionRequest`, `ScheduleEntry`)
- `packages/core` — role helpers `canSubmitForReview` / `canApproveOrReject`; `ScheduleEntry` + `ScheduleRepo`; `reviewQuestion` and `scheduleQuestion` use cases; create/update question preserve audit nulls
- `packages/testkit` — `InMemoryScheduleRepo` + shared contract; wire `schedules` in `makeTestDeps`; question fixtures include null audit fields
- `apps/api` — `FirestoreScheduleRepo`; review POST and schedule PUT routes; composition wiring; route tests
- `firebase/rules.test.ts` — seed `schedule` into deny matrix (rules stay default deny)
- `tooling/src/docs-commands.test.ts` — normalize CRLF so AGENT.md Commands block parses on Windows

## Acceptance tests → test files
1–6, 9–10 → `apps/api/src/routes/questions.test.ts`
7–8 → `packages/core/src/usecases/review-question.test.ts`
10 (contract) → `packages/contracts/src/question.test.ts`
11–13, 15 → `apps/api/src/routes/seasons.test.ts`
14 → `packages/core/src/usecases/schedule-question.test.ts`
16 → `packages/contracts/src/question.test.ts` + create path
17 → `packages/testkit/src/contracts/schedule-repo.contract.ts` (+ in-memory / emulator runners)
18 → `packages/testkit/src/contracts/question-repo.contract.ts`
19 → `firebase/rules.test.ts`

## How I tested
| command | result |
| --- | --- |
| eslint `--max-warnings 0` | pass |
| prettier `--check --end-of-line auto` | pass |
| `tsc -b` (typecheck) | pass |
| `vitest run` (unit) | pass (101 files, 1575 tests) |
| `test:emulator` | pass (333 tests, incl. schedule-repo.contract + rules schedule seed) — run after approver ESCALATE |

## Commits
- b33b159 T033: review status and schedule questions to season days

## Notes for reviewers
- Review route floor is `requireMember('scholar-reviewer')`; use case enforces editor+ for `in_review` and scholar/admin/owner for approve/reject (editors cannot approve via `roleAtLeast('scholar-reviewer')`).
- Schedule doc id is `{seasonId}_{dayIndex}`; `listBySeason` queries `seasonId` and filters `tenantId` in the adapter (no composite index).
- No web UI, entitlements, or rate-limit middleware (none in app).
