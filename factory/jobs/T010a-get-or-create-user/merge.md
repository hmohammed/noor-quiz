# Merge — T010a

## 1. fetch and rebase

```
git fetch origin
git -C .claude/worktrees/T010a-get-or-create-user rebase origin/main
```

Result: already up to date with origin/main (`436d494`). No conflict.

## 2. job records

Copied `factory/jobs/T010a-get-or-create-user/` into the worktree and set the T010a BOARD.md row to `done` / `factory`. T010 stays `split` (T010c is the last sub-task).

```
git commit -m "factory: T010a records"
```

Result: `b19ec85` on `factory/T010a-get-or-create-user`.

## 3. checks

Ran in the worktree:

| command | result |
| --- | --- |
| npm install | pass (up to date) |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass — 32 files, 267 tests |
| npm run test:emulator | pass — 86 tests (rules 67, api-emulator 19) |
| npm run test:e2e | not relevant (no UI) |
