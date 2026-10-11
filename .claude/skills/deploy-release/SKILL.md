---
name: deploy-release
description: Run the local stack with Firebase emulators, manage environments (dev, staging, prod), secrets, and the release/deploy pipeline. Use for setup, emulator issues, CI changes, or preparing a release.
---

# Environments, emulators and releases

## Environments
| Env | Firebase project | Stripe | Who deploys |
| --- | --- | --- | --- |
| local | emulators (`demo-noor`) | fake provider | you |
| dev | `noor-dev` | test mode | CI on merge to `main` |
| staging | `noor-staging` | test mode | CI on tag `v*-rc*` |
| prod | `noor-prod` | live mode | human approval in CI on tag `v*` |

Agents never deploy to prod and never change prod config.

## Local
- `npm run dev` starts emulators (auth, firestore, functions, tasks via emulator shim), the API and Vite.
- Seed: `npm run seed:local` creates a demo tenant, season and approved questions.
- Emulator data export: `npm run emulators:export` → `.emulator-data/` (gitignored).

## Config and secrets
- Typed config in `apps/api/src/config.ts` reads env vars, validated with zod at startup; fails fast on missing values.
- Non-secret config: `.env.example` documents every variable.
- Secrets (`STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, `TELEGRAM_BOT_TOKEN`) via `firebase functions:secrets:set` per project. Never in files, logs or test output.

## CI (GitHub Actions)
1. install → lint → typecheck → unit tests
2. emulator tests (rules + adapters)
3. build web + api
4. e2e on emulators (on PRs touching apps/web or apps/api)
5. deploy per the table above

## Release checklist
- [ ] Board: all tasks in the release are `done`
- [ ] Rules and indexes deployed before functions
- [ ] Migrations run in dry-run, then for real, on staging first
- [ ] Smoke test on staging: sign in, join community, answer today's question, see leaderboard
- [ ] Changelog entry
