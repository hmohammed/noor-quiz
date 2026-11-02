# Merge — T010a

## 1. fetch and rebase

```
git fetch origin
git -C .claude/worktrees/T010a-get-or-create-user rebase origin/main
```

Result: already up to date with origin/main (`436d494`). No conflict.

## 2. job records

Copy `factory/jobs/T010a-get-or-create-user/` into the worktree and set the T010a BOARD.md row to `done` / `factory`. T010 stays `split` (T010c is the last sub-task).
