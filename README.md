# Noor Quiz

Community learning seasons: a daily question for Ramadan and beyond, run by mosques, schools, families and workplaces.

- Vision, architecture and subscription model: [docs/vision.md](docs/vision.md)
- Agent / contributor guide: [AGENT.md](AGENT.md)
- Work queue: [docs/tasks/BOARD.md](docs/tasks/BOARD.md)

## Local development

### Prerequisites

- Node 22 (see `.nvmrc`; Node 20.18 also works)
- Java 21 or newer, for the Firestore emulator
- No Firebase account and no `firebase login`: the local stack uses the demo project `demo-noor`, which needs no credentials and cannot reach real Google services. The Firebase CLI comes from the repo's dev dependencies.

### Run it

```
npm install
npm run dev
```

`npm run dev` builds the API function bundle, then starts the Firebase emulators (auth, Firestore, functions), an esbuild watcher for the API and the Vite dev server. Ctrl-C stops all of them.

| What | URL |
| --- | --- |
| Web app | http://127.0.0.1:5173 |
| Emulator UI | http://127.0.0.1:4000 |
| API function | http://127.0.0.1:5001/demo-noor/europe-west1/api/v1/health |

The web app calls the API on its own origin: Vite proxies `/v1/*` to the function. The home page shows "API ok" when that works.

On Node 20 the functions emulator warns that the requested `nodejs22` runtime does not match the host. That is expected and harmless.

If the repo lives on a Windows drive under WSL (`/mnt/c/...`), each new function worker takes about 25 seconds to start, because the emulator loads from the slow Windows filesystem (the `dev:emulators` script raises `FUNCTIONS_DISCOVERY_TIMEOUT` to 60 s for the same reason). Clone the repo inside the WSL filesystem (for example `~/code`) for a fast loop.

### Check it

```
npm test             # unit tests, all workspaces
npm run test:e2e     # Playwright; starts the emulators and Vite itself if they are not running
npm run lint
npm run typecheck
npm run build        # API function bundle (apps/api/build) + web (apps/web/dist)
```

If Playwright reports a missing browser, install it once with `npx playwright install chromium`.
