# Merge — T022

## Rebase
`git fetch origin` then `git rebase origin/main`: already up to date.

## Checks before push

| command | result |
| --- | --- |
| npm install | pass |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck | pass |
| npm test | 1423 passed. `docs-commands.test.ts` failed (AGENT.md CRLF on Windows). Known local issue. |
| npm run test:emulator | pass (277). First attempt failed: ports 9099/8180 held by leftover emulator processes; killed and re-ran. |
| e2e | Covered in build round 1 (`members.spec.ts` pass). Round 2 is CSS + i18n only; not re-run at merge. |

## Push / PR
