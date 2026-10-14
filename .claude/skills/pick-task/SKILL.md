---
name: pick-task
description: Pick, claim and close a task from docs/tasks/BOARD.md. Use when starting work ("what's next", "pick a task", "work on T0xx") or when finishing one.
---

# Pick a task

Running under `/factory`? The orchestrator does Choose, Claim and Close (see `.claude/skills/factory/SKILL.md`). This skill is for working by hand.

## Choose
1. Open `docs/tasks/BOARD.md`.
2. If the user named a task, use it. Otherwise take the **first row with status `todo` whose every `Depends` task is `done`**. Rows are already in build order.
3. Skip tasks marked `human` in the Owner column (they need a person: accounts, legal, scholar review).
4. Read the task section in its epic file (`docs/tasks/E##-*.md`).

## Claim
- Set the row to `in-progress` and the Owner to your session/agent name.
- Create branch `t###-short-slug` (e.g. `t040-submit-mcq`).
- Commit the BOARD.md change first, so parallel agents see the claim.

## Size check
If the acceptance criteria will clearly take more than about a day, or touch more than one new port and one new screen, stop and ask the `architect` agent to split it (T040 → T040a, T040b). Do not silently grow scope.

## Build
Follow the `vertical-slice` skill and any skills the task lists.

## Close
- All acceptance criteria covered by tests; `npm run lint && npm run typecheck && npm test` green (plus emulator/e2e if relevant).
- Run `code-reviewer` (and `security-reviewer` if the task is tagged `sec`).
- Open a PR to `main` (that is the Definition of Done). In that PR, set the row to `done` (or `review` if a human must check), and add a one-line note in the task's "Notes" with anything the next task should know.
- If you discovered extra work, add a new task at the right place in the board with status `todo` instead of doing it now.

## Status values
`todo` · `in-progress` · `review` · `done` · `blocked` (write the reason in Notes)
