<!-- Copied from docs/tasks/E00-foundation.md · BOARD row: Phase P1 · Epic E00 · Depends T001 · Tags — -->

## T002

**Local stack: emulators, Hono health endpoint, Vite home page**

Phase: P1 · Depends on: [T001](E00-foundation.md#t001) · Tags: —
Skills: `deploy-release`, `api-endpoint`

**Goal.** `npm run dev` brings up Firebase emulators, the API and the web app; the home page shows that the API is reachable.

**Scope**

- `firebase/firebase.json` with auth, firestore, functions emulators (project `demo-noor`)
- `apps/api`: Hono app exported as a 2nd-gen HTTPS function; `GET /v1/health` → `{ status: 'ok', version }`
- `packages/contracts`: `HealthResponse` schema
- `apps/web`: Vite + React + React Router; `api/client.ts` typed from contracts; home shows 'API ok'
- Playwright set up with one e2e test

**Acceptance criteria**

- [ ] `GET /v1/health` returns 200 and a contract-valid body (route test with `app.request()`)
- [ ] e2e: home page shows 'API ok' with the local stack running
- [ ] README/AGENT commands section matches the real scripts

**Notes**

_(implementer adds notes for the next task here)_

