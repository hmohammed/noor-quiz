ESCALATE
Reason: New Firestore ScheduleRepo + rules seed touched, but build.md shows test:emulator not run; DoD requires emulator green when data/rules change.
# Decision — T033

## Checks
- Reviews (round 1): code PASS, security PASS, content PASS
- Acceptance criteria → tests: 3/3 task criteria + spec AT 1–19 mapped in build.md and covered in review-code.md (review/schedule routes, core use cases, contracts, schedule-repo contract, rules deny seed)
- Checks green: eslint, prettier, typecheck, unit (101 files / 1575 tests). **test:emulator: not run**
- Scholar path: ok — `canApproveOrReject` is scholar-reviewer || admin+ (editors cannot approve); only `reviewQuestion` writes `approved`; schedule requires `reviewStatus === 'approved'`
- Rules: ok — `firestore.rules` unchanged (default deny); schedule only added to deny-matrix seed
- Escalation triggers: no live billing/prod, no new dependency, no rules weakening; approve path is intentional scholar/admin/owner use case (not agent auto-approve)

## For the human
1. **Run emulator before merge.** On branch `factory/T033-review-and-schedule`, run `npm run test:emulator` and confirm green, especially:
   - `apps/api/src/adapters/firebase/schedule-repo.contract.test.ts` (new `FirestoreScheduleRepo` contract)
   - `firebase/rules.test.ts` schedule deny-matrix seed
2. Once emulator is green (or CI emulator check is green on the PR), this can be approved as-is — reviews and acceptance look solid.

---
Approved by orchestrator after clearing ESCALATE: `npm run test:emulator` passed (333 tests) on `factory/T033-review-and-schedule` at 11/06/2026 15:19:49.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ').
