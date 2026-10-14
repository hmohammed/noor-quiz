// Creates apps/api/build/.env.local from apps/api/.env.example when it does not exist yet,
// so the Functions emulator (whose source is apps/api/build) has the required non-secret
// config. Idempotent: an existing .env.local is never overwritten or read. Prints file
// names only, never contents.
import { constants } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @param {string} exampleDir directory holding .env.example
 * @param {string} [targetDir] directory that receives .env.local (created if missing)
 * @returns {Promise<boolean>} true when .env.local was created, false when it already existed
 */
export async function ensureEnvLocal(exampleDir, targetDir = exampleDir) {
  await mkdir(targetDir, { recursive: true });
  try {
    // COPYFILE_EXCL fails atomically if the target exists, so there is no check-then-write race.
    await copyFile(
      join(exampleDir, '.env.example'),
      join(targetDir, '.env.local'),
      constants.COPYFILE_EXCL,
    );
    return true;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') return false;
    throw err;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const apiRoot = fileURLToPath(new URL('../', import.meta.url));
  if (await ensureEnvLocal(apiRoot, join(apiRoot, 'build'))) {
    console.log('[ensure-env-local] created apps/api/build/.env.local from .env.example');
  }
}
