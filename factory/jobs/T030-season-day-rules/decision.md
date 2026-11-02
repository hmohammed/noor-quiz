APPROVE
Reason: Round 2 rebase cleanly keeps both T010a and T030 exports, code review PASS, all acceptance criteria covered by tests in the diff, checks green, no escalation triggers.
# Decision — T030

## Checks
- Reviews (round 2): code PASS (only reviewer selected; diff touches only `packages/core` and the E03 notes, with no `apps/web`, auth, rules, billing or AI). Round 1 code also PASS.
- Rebase: branch tip 186758c sits directly on main 63b61d9 (merge-base = main), 6 commits ahead. `packages/core/src/index.ts` diff against main is only the three T030 export lines; T010a's `users/user`, `usecases/get-or-create-user` and port type exports are kept. `index.test.ts` asserts both the T030 and T010a public names. The reviewer confirmed `season/*`, `time/*` and the E03 notes are identical to round 1.
- Acceptance criteria → tests: 3/3 task criteria (spec tests 1–32 all mapped in build.md and present in the diff)
  - Table tests in Stockholm, Addis Ababa, Toronto, Riyadh including a DST night → `season-rules.test.ts` "questionWindow …" (10–15), boundary rows (18–22), `zoned.test.ts` gap/overlap (5–6)
  - Close after midnight (01:00) → `season-rules.test.ts` Riyadh window (11) and boundary rows (19), Toronto DST (13, 21)
  - Day index never exceeds lengthDays; pre/post ±1 minute → `season-rules.test.ts` "day index never exceeds lengthDays" sweep (23), boundary rows (18–22, 24)
- Checks green (after rebase): lint, typecheck, test (35 files, 462 tests). The reviewer re-ran `npm test` at 186758c. test:emulator and e2e are not relevant because no adapter, rules or UI changed.
- Definition of Done: no user-facing strings (no i18n/RTL impact); no env vars; no new dependency (no package.json change); no ADR needed (the spec rules out any architectural choice); T031 notes added to `docs/tasks/E03-seasons-questions.md`.
- Hard rules spot-checked in diff: core imports only relative modules and vitest; no `Date.now()`, argless `new Date()` or local `Date` getters; `isOpen` never throws on a bad `dayIndex`; `season-rules.ts` does not import `hijri.ts`.
- Escalation triggers: none. The task tags are empty and it is not owned by `human`. Nothing touches firestore.rules, prod config or billing, no dependency is added, and nothing sets `reviewStatus: approved`.

## Follow-ups (non-blocking, from code review)
- `season-rules.ts` `windowOf`: when a same-day window opens inside a spring-forward gap but closes after it (e.g. 02:30–03:15), `closesAt < opensAt`. T031's validation or admin form could warn about this.
- `hijri.ts` `nextRamadanSuggestion`: the `invalid-hijri-year` reason is misleading near Hijri year 1500.
- Add a `.gitattributes` (`* text=auto eol=lf`) as a separate task, because CRLF checkouts on Windows break prettier and a docs test.
