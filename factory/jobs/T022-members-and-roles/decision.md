APPROVE

## Why

- **Latest reviews (round 2):** code, security, UI, and UX all `PASS`. Round-1 UI/UX must-fixes (confirm-button chrome + `members.remove.removing`) are done; only non-blocking nits remain.
- **Acceptance:** Spec tests 1–18 are mapped in `build.md` and confirmed covered by round-1/2 code review (core role tables, last-owner use cases, members routes, community-store contract, Members/Communities view tests, e2e).
- **Checks (`build.md`):** eslint, prettier (CRLF-aware), typecheck, product unit tests, emulator contract, and `e2e/members.spec.ts` green. Known Windows `docs-commands` / AGENT.md CRLF failure is tooling-only, same class as T021.
- **Safety:** Diff does not touch `firestore.rules`, indexes, Stripe/billing, prod config, or question `approved` writes. No new npm deps. Browser stays API-only; role authority stays server-side (`requireMember` + `canChangeRole` / repo last-owner).
- **DoD for this slice:** Acceptance automated; lint/typecheck/tests/emulator green; i18n + logical/RTL-friendly UI; hard rules intact. Job records / BOARD `done` are orchestrator PR steps after this gate.
