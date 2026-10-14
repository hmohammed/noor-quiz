# ADR 0004 — The factory ends every task in a GitHub pull request

Date: 2026-10-14 · Status: accepted

## Decision
The Definition of Done is an open pull request to `main` on GitHub. The `/factory` orchestrator no longer squash-merges into local `main`. After approval it rebases the task branch on `origin/main` and adds the job records and the task's BOARD.md `done` row to the branch. It then runs the full suite, pushes the `factory/<id>-<slug>` branch and opens the PR. A human reviews and merges every PR. The job sits in stage `pr-open` until the merge, and dependent tasks wait for it. Factory running state (`factory/board.json`, new job folders) is local and gitignored. Splits also go through a PR.

## Consequences
Nothing reaches `main` without a PR, CI and a human merge, which matches the branch protection on `main`. Throughput is bounded by how fast PRs are merged. Local `main` only fast-forwards from `origin/main`, so it must never hold unpushed commits when the factory runs.
