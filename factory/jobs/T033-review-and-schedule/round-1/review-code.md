VERDICT: PASS
# Code review — T033 round 1

## Findings
(none)

## Acceptance tests
1. ok — `apps/api/src/routes/questions.test.ts` "lets an editor submit draft or rejected for review…"
2. ok — `questions.test.ts` "returns 403 FORBIDDEN when an editor requests %s and writes nothing"
3. ok — `questions.test.ts` "lets a scholar-reviewer approve… with audit fields from one clock read"
4. ok — `questions.test.ts` "lets a scholar-reviewer reject… with the same audit fields"
5. ok — `questions.test.ts` "returns 403 FORBIDDEN when a scholar-reviewer requests in_review"
6. ok — `questions.test.ts` "lets an %s approve like a scholar-reviewer" (admin/owner) + member 403
7. ok — `packages/core/src/usecases/review-question.test.ts` FORBIDDEN / CONFLICT paths; `updates()` stays 0
8. ok — `review-question.test.ts` clears audit on submit; sets actor + one `clock.now()` on approve/reject
9. ok — `questions.test.ts` "returns 401 without a token, 403 for another tenant editor, 404/400 for bad ids"
10. ok — `questions.test.ts` validation cases + `packages/contracts/src/question.test.ts` `ReviewQuestionRequest`
11. ok — `apps/api/src/routes/seasons.test.ts` "returns 200 for an editor scheduling… and overwrites the same day"
12. ok — `seasons.test.ts` "returns 409 CONFLICT when scheduling a %s question…" (draft/in_review/rejected)
13. ok — `seasons.test.ts` "returns 409 CONFLICT when the same question is scheduled on a second day"
14. ok — `packages/core/src/usecases/schedule-question.test.ts` CONFLICT / NOT_FOUND / VALIDATION / no `put`
15. ok — `seasons.test.ts` auth/role/tenant/id/dayIndex cases (0, negative, non-integer, lengthDays+1)
16. ok — `create-question.test.ts` null audit + `question.test.ts` parse null/non-null + `MemberQuestionView` strips them
17. ok — `packages/testkit/src/contracts/schedule-repo.contract.ts` via in-memory + `schedule-repo.contract.test.ts`
18. ok — `packages/testkit/src/contracts/question-repo.contract.ts` create nulls; update may set review fields
19. ok — `firebase/rules.test.ts` seeds `schedule` into the deny matrix (rules stay default deny)

## Hard rules
1. ok — `packages/core` use cases/ports have no vendor imports
2. ok — `ScheduleRepo` in `ports/repos.ts`; `InMemoryScheduleRepo` + `runScheduleRepoContract`; Firestore adapter
3. ok — no client write allow rules; schedule only added to rules deny seeds
4. ok — schedule/question methods take `tenantId`; routes use `membership.tenantId`; cross-tenant → NOT_FOUND/403
5. ok — `reviewedAt` / `updatedAt` / `scheduledAt` via `toIso(deps.clock.now())`; no `Date.now()` in core/routes
6. ok — roles from membership; approve uses `canApproveOrReject` (not `roleAtLeast('scholar-reviewer')`); clients cannot set audit/status on create/patch
7. ok — no plan-name or entitlement checks (none in scope)
8. ok — tenant/user/question/season ids are ULIDs
9. ok — no secrets added
10. ok — no AI surface
11. ok — only `reviewStatus === 'approved'` is scheduleable; agents cannot approve via this slice

## Nits (non-blocking)
- `tooling/src/docs-commands.test.ts` CRLF normalize is outside the T033 file list (harmless Windows fix).
- `update-question.test.ts` does not explicitly assert non-null `reviewedBy`/`reviewedAt` survive a patch (implementation preserves them).
- API review happy-path title mentions rejected→in_review but only exercises draft; core covers rejected.
