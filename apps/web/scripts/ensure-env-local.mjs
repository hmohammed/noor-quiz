// Creates apps/web/.env.local from apps/web/.env.example when it does not exist yet, so
// `npm run dev:web` has the public Firebase web config and the Auth emulator host.
// An existing .env.local is never overwritten or read. Prints file names only.
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { ensureEnvLocal } from '../../api/scripts/ensure-env-local.mjs';

/** @returns {Promise<boolean>} true when apps/web/.env.local was created */
export async function ensureWebEnvLocal(webRoot = fileURLToPath(new URL('../', import.meta.url))) {
  return ensureEnvLocal(webRoot);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain && (await ensureWebEnvLocal())) {
  console.log('[ensure-env-local] created apps/web/.env.local from .env.example');
}
