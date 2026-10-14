// Hosting adapter: the only file that imports firebase-functions (AGENT.md rule 2).
// The esbuild bundle of this file (build/index.js) is what the functions emulator loads.
import { onRequest } from 'firebase-functions/v2/https';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app';
import { createComposition } from './composition';
import { REGION } from './region';

// Runs at module load: an invalid environment throws ConfigError here, so the
// function fails fast at cold start instead of on the first request.
const root = createComposition(process.env, { version: __NOOR_VERSION__ });
const app = createApp(root);

// The Functions framework has already read the body into `req.rawBody`;
// @hono/node-server uses that Buffer when present instead of re-reading the stream.
const listener = getRequestListener(app.fetch);

export const api = onRequest({ region: REGION }, (req, res) => listener(req, res));
