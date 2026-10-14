// Bundles src/function.ts -> build/index.js and writes build/package.json. build/ is the
// Functions source for both the emulator and deploys (firebase/firebase.json).
// Workspaces are source-first (.ts), so contracts, core, zod and hono are bundled in;
// firebase-functions and firebase-admin stay external. Locally they load from node_modules;
// on deploy Cloud Build installs them from the generated package.json.
// No side effects on import: the build only runs when this file is executed directly.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_DEPS = ['firebase-functions', 'firebase-admin'];

/**
 * The package.json deployed next to the bundle. Only the external runtime deps: the
 * `@noor/*` workspaces do not exist on npm and everything else is already bundled.
 * @param {{ dependencies?: Record<string, string> }} pkg apps/api/package.json
 */
export function deployManifest(pkg) {
  /** @type {Record<string, string>} */
  const dependencies = {};
  for (const dep of RUNTIME_DEPS) {
    const range = pkg.dependencies?.[dep];
    if (!range) throw new Error(`deployManifest: ${dep} is missing from apps/api dependencies`);
    dependencies[dep] = range;
  }
  return {
    name: '@noor/api-function',
    private: true,
    type: 'module',
    main: 'index.js',
    dependencies,
  };
}

/**
 * @param {{ outdir?: string, watch?: boolean, logLevel?: import('esbuild').LogLevel }} [opts]
 */
export async function buildFunction({
  outdir = join(apiRoot, 'build'),
  watch = false,
  logLevel = 'info',
} = {}) {
  const pkg = JSON.parse(await readFile(join(apiRoot, 'package.json'), 'utf8'));

  /** @type {import('esbuild').BuildOptions} */
  const options = {
    absWorkingDir: apiRoot,
    entryPoints: ['src/function.ts'],
    outfile: join(outdir, 'index.js'),
    platform: 'node',
    format: 'esm',
    target: 'node20',
    bundle: true,
    sourcemap: true,
    external: RUNTIME_DEPS,
    define: { __NOOR_VERSION__: JSON.stringify(pkg.version) },
    logLevel,
  };

  const writeManifest = async () => {
    await mkdir(outdir, { recursive: true });
    await writeFile(
      join(outdir, 'package.json'),
      `${JSON.stringify(deployManifest(pkg), null, 2)}\n`,
    );
  };

  if (watch) {
    await writeManifest();
    const ctx = await esbuild.context(options);
    await ctx.watch();
    return ctx;
  }
  await esbuild.build(options);
  await writeManifest();
  return undefined;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const watch = process.argv.includes('--watch');
  await buildFunction({ watch });
  if (watch) console.log('[build-function] watching for changes');
}
