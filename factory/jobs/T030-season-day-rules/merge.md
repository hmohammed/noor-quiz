# Merge — T030

## 1. fetch and rebase

```
git fetch origin
git -C .claude/worktrees/T030-season-day-rules rebase origin/main
```

Result: rebase stopped. `origin/main` now includes merged T010a (`63b61d9`). Commits 1–4 of 6 applied. Commit `79db1e2` (T030: export season rules and time helpers from @noor/core) conflicted.

Conflict file: `packages/core/src/index.ts`

```
<<<<<<< HEAD
export * from './users/user';
export * from './usecases/get-or-create-user';
=======
export * from './time/local-date';
export * from './season/season-rules';
export * from './season/hijri';
>>>>>>> 79db1e2
```

`packages/core/src/index.test.ts` auto-merged. No other conflicted files.

`git rebase --abort` was run. The builder rebased again and kept both export groups.

## 2. rebase retry

Result: clean rebase onto `origin/main`. `packages/core/src/index.ts` exports both the T010a user modules and the T030 season/time modules. Lint, typecheck and unit tests passed in the worktree (462 tests) before this records commit. Round 2 code review: PASS. Approver: APPROVE.

New commits (`origin/main..HEAD` before the records commit):

- fbf1d28 T030: local date helpers
- 221899c T030: zonedInstant
- aa6bf6f T030: season rules
- 5d10f73 T030: Umm al-Qura Ramadan start suggestion
- 9d9722d T030: export season rules and time helpers from @noor/core
- 186758c T030: notes for T031 in E03
