VERDICT: PASS
# Security review — T004 round 1

Scope: `git diff main...factory/T004-ci-deploy-dev` (CI workflow, Firebase deploy config, build scripts). Infra-only: no route, use case, contract, Firestore document or AI code changed. The WIF setup was checked against the T005a Notes in `docs/tasks/E00-foundation.md`.

## What I verified
- **Triggers / fork PRs:** `on: pull_request` + `push: [main]` only. No `pull_request_target` or `workflow_run`. Fork PRs run `unit`, `emulator`, `changes` and `e2e` with the top-level `contents: read` token, no secrets and no OIDC.
- **id-token scope:** `id-token: write` is set only at the job level on `deploy-dev`. Top-level permissions stay `contents: read`.
- **No deploy from a PR (three layers):** (1) `deploy-dev.if` requires `github.event_name == 'push' && github.ref == 'refs/heads/main'` and explicit `success` from `unit`, `emulator` and `e2e`. (2) `environment: dev` has a deployment branch policy that allows only `main`. (3) The WIF binding only accepts subject `repo:hmohammed/noor-quiz:environment:dev`, so a same-repo PR that edits `ci.yml` to drop the `if` still cannot get the environment or impersonate the SA.
- **Injection:** the only event field used in a script is `github.event.pull_request.base.sha`, passed through `env:` (`BASE_SHA`). No `head_ref`, PR title/body or commit message is used. `vars.*` appear only in `with:`/`env:`. `$FIREBASE_PROJECT_ID` is quoted and pinned by the guard step.
- **Secrets:** the workflow has no `secrets.*`, no SA key and nothing that prints env or credential files. `NOOR_ENV=dev` is non-secret and is written by the runner, never echoed. The only tracked `.env*` file is `apps/api/.env.example`. `build/` and `.env.*` are gitignored.
- **Credentials file placement:** `google-github-actions/auth@v2` writes `gha-creds-*.json` to the workspace root. That is outside the functions source (`apps/api/build`) and Hosting `public` (`apps/web/dist`). Hosting also ignores `**/.*`.
- **Target guard:** the deploy fails unless `FIREBASE_PROJECT_ID == noor-quiz-bec90`. Every `firebase deploy` passes `--project` explicitly, and `.firebaserc` has no `default` alias (a test covers this). Nothing touches staging or prod. There is no root `deploy:*` script.
- **Rules:** `firebase/firestore.rules` is unchanged (deny-all `allow read, write: if false`) and is deployed before functions and hosting.
- **Cache poisoning:** `actions/cache` and the `setup-node` npm cache written by PR runs are scoped to the PR ref, so they cannot be restored into a `main` deploy run.

## Findings
None at P0–P2.

## Nits (non-blocking)
- [P3] .github/workflows/ci.yml:131 — In the one job holding `id-token: write`, the third-party `google-github-actions/auth@v2` is pinned to a mutable tag. Pin it to a full commit SHA (with a `# v2.x.y` comment). Optionally pin the `actions/*` steps in `deploy-dev` the same way.
- [P3] .github/workflows/ci.yml:135 — `npm run build` (esbuild, Vite and their plugins) runs after the auth step, so build tooling runs while ADC is present. Moving `npm run build` and the `.env` write above the auth step shrinks that window. The OIDC request token is in the job env anyway, so this is defence in depth only.
- [P3] .github/workflows/ci.yml:117 — `actions/checkout` in `deploy-dev` keeps the default `persist-credentials: true`. Set `persist-credentials: false` because the job never pushes. The token is read-only and `.git` is outside both deploy sources, so the impact is minimal.
- [P3] .github/workflows/ci.yml:56 — `echo "$changed"` prints PR-controlled file names to the log, where a name such as `::stop-commands::x` or `::set-output…` is parsed as a workflow command. The impact is low, because the job has a read-only token and a PR author controls the workflow anyway. Drop the echo or wrap it in `::stop-commands::<random>`.

## Hard rules
1. core vendor-free — ok (`packages/core` untouched; `region.ts` has no imports)
2. ports + adapters + fakes — ok (`function.ts` is still the only `firebase-functions` importer; no new vendor call)
3. no client Firestore writes — ok (deny-all rules unchanged, deployed first)
4. tenant isolation — n/a (no data access changed)
5. time from Clock — n/a (no time logic; no test-mode or override added)
6. roles server-side — n/a (no auth code changed)
7. entitlements, no Stripe at request time — n/a
8. own IDs — n/a
9. secrets — ok (WIF only, no `secrets.*`, no key, no printed env, the runner-written dotenv is non-secret, no committed `.env*` besides `.env.example`)
10. AI output untrusted — n/a
11. religious content provenance — n/a
