## T003

**Clock port, typed config and domain errors**

Phase: P1 · Depends on: [T001](E00-foundation.md#t001) · Tags: —
Skills: `port-adapter`

**Goal.** The building blocks every use case needs: injectable time, validated config, consistent errors.

**Scope**

- `packages/core/src/ports/clock.ts` (`now(): Instant`, helpers for zoned dates via `Intl`)
- `SystemClock` adapter in api; `FakeClock` in testkit (set, advance, set timezone-agnostic instant)
- `DomainError(code, details)` in core; `apps/api/src/errors.ts` maps codes → HTTP status; error response schema in contracts
- `apps/api/src/config.ts` zod-validated env config; `.env.example`
- `apps/api/src/composition.ts` wiring deps, and a `makeTestDeps()` in testkit

**Acceptance criteria**

- [ ] FakeClock tests: advance across midnight in Europe/Stockholm and Africa/Addis_Ababa gives the expected local dates
- [ ] API returns `{ error: { code, message } }` with the mapped status for a thrown DomainError (route test)
- [ ] API fails fast at startup with a clear message when a required config var is missing (unit test)

**Notes**

_(implementer adds notes for the next task here)_

---
BOARD row: Tags: — · Phase: P1
