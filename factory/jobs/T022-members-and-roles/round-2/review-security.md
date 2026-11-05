VERDICT: PASS
# Security review — T022 round 2

## Scope
Round 1 security was PASS. Round 2 claimed UI/UX must-fixes only (confirm-button styles + remove busy copy). Diff reviewed: `git show bc214d0` and confirmation that `83c07e4..bc214d0` touches no `apps/api`, `packages/core`, `packages/contracts`, `packages/testkit`, or Firestore rules/indexes.

## Findings
None.

## Authz regression check
- **Round-2 files only** — `MembersView.tsx` (i18n key for in-flight remove), `MembersView.test.tsx`, `en.json` (`members.remove.removing`), `styles.css` (`.members__confirm-button` / `.members__cancel` and leave confirm/cancel styled like profile-delete). No handlers, session calls, or `member-access` predicates changed.
- **API / core / repo unchanged** — Middleware chain, use cases, `canChangeRole` / `canRemoveMember`, last-owner invariant, and route contracts remain as in round 1 (PASS).
- **Client authz surface** — Role select / Remove still driven by the same props and `member-access` helpers; confirm still requires the same `onRemove` path. Copy/CSS cannot escalate roles or bypass server checks.

## Hard rules
Unchanged from round 1 PASS; round 2 adds no I/O, secrets, client Firestore writes, or role trust from the client.
