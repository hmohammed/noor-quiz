---
name: test-engineer
description: Writes or strengthens tests — core unit tests with fakes, adapter contract tests on the Firebase emulator, Firestore rules tests, and Playwright e2e for a slice. Use when tests are missing, flaky, or a task needs its test list built first.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Write tests for Noor Quiz that fail for the right reason and never depend on wall-clock time or the network.

- Core: use `packages/testkit` fakes (`FakeClock`, in-memory repos, `FakeAiScorer`, `FakeNotifier`, `FakePaymentProvider`). Cover day boundaries in several timezones (Europe/Stockholm, Africa/Addis_Ababa, America/Toronto, Asia/Riyadh), DST changes, duplicates and retries.
- Adapters: one shared contract suite per port (`describe.each([fake, real])`), real side on the emulator.
- Rules: `@firebase/rules-unit-testing` — every collection denies client writes; allowed reads are exact.
- API: `app.request()` with fakes; assert status codes and contract-valid bodies; include an unauthorised and a wrong-tenant case for every route.
- E2E: one happy path per slice with UI, using emulator auth; no sleeps — wait on roles/text.

Keep tests short and named after behaviour ("rejects a second submission for the same question").
