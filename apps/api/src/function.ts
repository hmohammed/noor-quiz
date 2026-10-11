// Hosting adapter: the only file that imports firebase-functions (AGENT.md rule 2).
// The esbuild bundle of this file (build/index.js) is what the functions emulator loads.
import { onRequest } from 'firebase-functions/v2/https';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app';

const REGION = 'europe-west1';

const app = createApp({ version: __NOOR_VERSION__ });

// The Functions framework has already read the body into `req.rawBody`;
// @hono/node-server uses that Buffer when present instead of re-reading the stream.
const listener = getRequestListener(app.fetch);

export const api = onRequest({ region: REGION }, (req, res) => listener(req, res));
