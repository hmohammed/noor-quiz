# Merge — T010c

## Fetch and rebase
- `git fetch origin`, then `git rebase origin/main` on `factory/T010c-web-google-sign-in`.
- The first rebase stopped because the worktree had line-ending-only edits (`core.autocrlf=true`, blobs are LF). `git diff --ignore-cr-at-eol` was empty. Those edits were restored and not committed.
- After that, rebase reported the branch already up to date with `origin/main`. No conflicts.
