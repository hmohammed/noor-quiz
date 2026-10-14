// Creates apps/api/.env.local from .env.example when it does not exist yet, so the
// Functions emulator has the required (non-secret) config. Idempotent: an existing
// .env.local is never overwritten or read. Prints file names only, never contents.
import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @param {string} dir directory holding .env.example
 * @returns {Promise<boolean>} true when .env.local was created, false when it already existed
 */
export async function ensureEnvLocal(dir) {
  try {
    // COPYFILE_EXCL fails atomically if the target exists, so there is no check-then-write race.
    await copyFile(join(dir, '.env.example'), join(dir, '.env.local'), constants.COPYFILE_EXCL);
    return true;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') return false;
    throw err;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const apiRoot = fileURLToPath(new URL('../', import.meta.url));
  if (await ensureEnvLocal(apiRoot)) {
    console.log('[ensure-env-local] created apps/api/.env.local from .env.example');
  }
}
