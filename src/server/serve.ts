/**
 * server/serve.ts — public, view-only static server for hosting (Fly.io, Render, etc.).
 *
 * This serves the built Command Center UI and an empty event stream. It reads NO
 * secrets and runs NO hunts, so it is safe to expose publicly. Visitors get the
 * landing page and the dashboard in its idle state (connected, showing recent
 * hunts). Live hunts happen locally with the full keyed stack, never here.
 *
 * Run with:  node dist/server/serve.js   (PORT from the environment, default 8799)
 */
import { startHub } from './hub.js';

const port = Number(process.env.PORT ?? 8799);

startHub(port)
  .then((hub) => {
    console.log(`Tartarus Command Center (view-only) listening on :${hub.port}`);
  })
  .catch((err) => {
    console.error('Failed to start static server:', err);
    process.exit(1);
  });
