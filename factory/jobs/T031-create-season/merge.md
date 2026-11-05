# Merge — T031

## Rebase conflict

`git fetch origin` then `git rebase origin/main` in the T031 worktree stopped on the first commit, `0ab46ee` (season use cases and contracts). Rebase was aborted. `origin/main` now contains T021 (invite link and join, including Playwright 1.61.0).

Conflicted files:

- `packages/contracts/src/index.ts`
- `packages/core/src/deps.ts`
- `packages/core/src/index.test.ts`
- `packages/core/src/index.ts`
- `packages/core/src/ports/repos.ts`

Keep both the invite exports from T021 and the season exports from this branch. Later commits in this branch may conflict in `apps/api/src/app.ts`, `composition.ts`, `apps/web/src/router.tsx`, `en.json`, `styles.css`, `session-context.tsx`, and `CommunitiesView`. Keep both features. Do not drop invites.
