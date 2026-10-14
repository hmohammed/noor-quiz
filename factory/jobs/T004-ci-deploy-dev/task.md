## T004

**CI: emulator tests, e2e and auto-deploy to dev**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T005a](E00-foundation.md#t005a) · Tags: —
Skills: `deploy-release`

**Goal.** Every PR runs the full test pyramid; merges to main deploy to the dev project (`noor-quiz-bec90`, alias `dev`).

**Scope**

- CI job running `npm run test:emulator` with the Firebase emulator
- CI job running Playwright e2e on the emulator stack for PRs touching apps/
- Deploy job to the dev project (`noor-quiz-bec90`) on push to main (rules, indexes, functions, hosting) using a deploy service account from GitHub secrets

**Acceptance criteria**

- [ ] A PR shows separate green checks for unit, emulator and e2e
- [ ] Merging to main deploys and `GET https://<dev-host>/v1/health` returns ok (link in PR)

**Notes**

_(implementer adds notes for the next task here)_

---
BOARD row: Tags: — · Phase: P1
