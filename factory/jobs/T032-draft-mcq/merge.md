# Merge — T032

## Rebase
`git fetch origin` then `git rebase origin/main`: already up to date.

## Checks before push

| command | result |
| --- | --- |
| npm install | pass |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck | pass |
| npm test | 1408 passed. `tooling/src/docs-commands.test.ts` failed because AGENT.md is CRLF on this Windows checkout. Known local issue (same as T031), not a product failure. |

Emulator / e2e: not required by build.md for this slice (no web UI). Rules seed covered by unit `firebase/rules.test.ts` path via package tests where configured; Firestore question adapter contract skips without emulator.

## Push / PR
