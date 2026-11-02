VERDICT: PASS
# Code review — T030 round 2 (rebase onto origin/main 63b61d9)

Scope of this round: the rebase after the conflict in `packages/core/src/index.ts`. Round 1 already PASSed the logic.

## Findings
None.

## Rebase checks
- Branch `factory/T030-season-day-rules` (186758c) sits directly on `main` (63b61d9): merge-base is 63b61d9, 6 commits ahead, no stray merge commits.
- `packages/core/src/index.ts` keeps both export groups, no conflict markers:
  - T010a: `./users/user`, `./usecases/get-or-create-user`, plus the type exports for `ports/id-generator` and `ports/repos`, all still present and unchanged versus main.
  - T030: `./time/local-date`, `./season/season-rules`, `./season/hijri` (the existing `./time/zoned` export is also unchanged).
  - The diff against main for `index.ts` is only the three added T030 lines.
- `packages/core/src/index.test.ts`: the T030 names and the T010a runtime exports (`isUlid`, `asUserId`, `identityId`, `normaliseDisplayName`, `getOrCreateUser`, `ULID_PATTERN`, `SUBJECT_PATTERN`, `USER_SCHEMA_VERSION`) are asserted. This is a small addition to the test only, and it is in scope for spec test 31.
- Season rules not altered to force the rebase: comparing the round-1 tip (a607819) with the current tip, `packages/core/src/season/*`, `packages/core/src/time/*` and `docs/tasks/E03-seasons-questions.md` are identical. The only difference between those two trees is T010a's own files plus `docs/tasks/BOARD.md` from main. No T030 logic changed.
- Branch diff against main touches only the 11 spec'd files (core `time/`, `season/`, `index.ts`/`index.test.ts`, E03 notes). Nothing in contracts, testkit, apps or firebase, and `docs/tasks/BOARD.md` is not touched.
- Re-ran `npm test` in the T030 worktree at 186758c: 35 files, 462 tests, all pass (matches build.md round 2). Worktree is clean.

## Acceptance tests
Unchanged from round 1 (tests 1–32, all present and passing in the run above); test 31 is covered by `index.test.ts`, now also covering the T010a exports.

## Hard rules
1. ok — no vendor imports in `packages/core` (season/time files import only `../errors` and sibling time modules)
2. ok — no Firestore access in this change
3. ok — no persisted data in this task, so no `tenantId` concern
4. ok — no `Date.now()` and no zero-argument `new Date()`; `now` is always a parameter
5. ok — no plan-name checks
6. ok — `isOpen` treats any bad `dayIndex` as closed; nothing is taken from the client
7. ok — no Firebase uid used as a key
8. ok — no secrets
9. ok — no AI output in this task
10. ok — no content scheduling
11. ok — `season-rules.ts` does not import `hijri.ts`

## Nits (non-blocking)
- The build.md note about adding a `.gitattributes` (`* text=auto eol=lf`) for the CRLF problem is worth turning into its own task.
