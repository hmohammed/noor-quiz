---
name: vertical-slice
description: The standard order and checklist for implementing one feature slice end to end in Noor Quiz (contract, core, adapter, route, UI, tests). Use for every implementation task.
---

# Implement a vertical slice

A slice delivers one user-visible or test-verifiable behaviour through every layer it needs — and nothing more.

## Order
1. **Contract** — add/extend zod schemas in `packages/contracts/src/<area>.ts`. Export request, response and error types.
2. **Core** — use case in `packages/core/src/usecases/<verb-noun>.ts`:
   ```ts
   export async function submitAnswer(
     deps: { clock: Clock; answers: AnswerRepo; questions: QuestionRepo },
     input: { tenantId: TenantId; userId: UserId; questionId: QuestionId; choice: string },
   ): Promise<SubmitAnswerResult> { /* pure rules, ports only */ }
   ```
   Tests next to it using `packages/testkit` fakes. Write the failing tests from the acceptance criteria first.
3. **Port/adapter** (only if new I/O) — follow the `port-adapter` skill.
4. **Route** — follow the `api-endpoint` skill. The route parses with the contract, runs middleware (auth → tenant → role → entitlement), calls the use case, maps errors.
5. **UI** (only if in scope) — page/component in `apps/web/src/features/<area>/`, calls the API through `apps/web/src/api/client.ts` (typed from contracts). Strings via `t()`. Loading, empty and error states.
6. **E2E** — one Playwright happy path if the slice has UI.

## Checklist before done
- [ ] No vendor import in `packages/core`
- [ ] Every repository call passes `tenantId`
- [ ] Time from `Clock`
- [ ] Client input never trusted for role, tenant, score, day or time
- [ ] Unauthorised + wrong-tenant tests for each new route
- [ ] i18n keys added in `apps/web/src/i18n/en.json` (other locales may fall back)
- [ ] `.env.example` updated if config was added
- [ ] Board row updated

## Smells that mean "split the task"
- You are adding two ports at once.
- The UI needs more than one new page.
- You are writing migration + feature + admin screen together.
