// Bundles src/function.ts -> build/index.js for the Functions runtime/emulator.
// Workspaces are source-first (.ts), so contracts, zod and hono are bundled in;
// firebase-functions and firebase-admin stay external and load from node_modules.
import { readFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: apiRoot,
  entryPoints: ['src/function.ts'],
  outfile: 'build/index.js',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  bundle: true,
  sourcemap: true,
  external: ['firebase-functions', 'firebase-admin'],
  define: { __NOOR_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build-function] watching for changes');
} else {
  await esbuild.build(options);
}
