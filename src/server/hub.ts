/**
 * server/hub.ts — the Command Center backend.
 *
 * A small Express server that bridges the running hunt to the web dashboard:
 *
 *   GET  /api/events         Server-Sent Events stream (backlog + live).
 *   GET  /api/state          Snapshot: last seq + pending approvals (for a fresh load).
 *   POST /api/approvals/:id  { decision: "allow" | "deny" } — the gold gate, from the UI.
 *   GET  /api/health         Liveness.
 *   /*                       Serves the built Vite UI from ui/dist (if present).
 *
 * SSE (not WebSocket) is intentional: the log stream is one-directional and SSE
 * auto-reconnects; the single approval round-trip is a plain POST.
 */
import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EventBus } from './eventBus.js';
import { ApprovalRegistry, type ApprovalDecision } from './approvals.js';
import { verifyGithubSignature, parsePushEvent, type PushInfo } from './webhook.js';

/** Optional GitHub webhook wiring (Sentinel Mode). */
export interface WebhookConfig {
  secret?: string;
  /** Called when a valid `push` event arrives. */
  onPush: (info: PushInfo) => void;
}

export interface Hub {
  bus: EventBus;
  approvals: ApprovalRegistry;
  server: Server;
  port: number;
  close: () => Promise<void>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/server/hub.js → ../../ui/dist ; src/server/hub.ts (tsx) → ../../ui/dist
const UI_DIST = path.resolve(__dirname, '..', '..', 'ui', 'dist');

/** Build the Express app around a bus + approval registry (exported for tests). */
export function createHubApp(
  bus: EventBus,
  approvals: ApprovalRegistry,
  webhook?: WebhookConfig,
): express.Express {
  const app = express();
  // Capture the raw body so the webhook route can verify GitHub's HMAC signature.
  app.use(express.json({
    verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; },
  }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, seq: bus.lastSeq }));

  // Sentinel Mode: GitHub push webhook → trigger a hunt (zero-click).
  if (webhook) {
    app.post('/api/webhook/github', (req: Request, res: Response) => {
      const raw = (req as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
      const sig = req.header('x-hub-signature-256');
      if (!verifyGithubSignature(webhook.secret, raw, sig)) {
        res.status(401).json({ error: 'invalid signature' });
        return;
      }
      const event = req.header('x-github-event');
      if (event === 'ping') { res.json({ ok: true, pong: true }); return; }

      const push = parsePushEvent(event, req.body);
      if (!push) { res.status(202).json({ ok: true, ignored: `event ${event}` }); return; }

      // Acknowledge immediately; the hunt runs asynchronously.
      res.status(202).json({ ok: true, triggered: push.repo });
      webhook.onPush(push);
    });
  }

  app.get('/api/state', (_req, res) => {
    res.json({ lastSeq: bus.lastSeq, pending: approvals.list() });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    // Replay backlog after the client's last-seen seq (Last-Event-ID or query).
    const lastId = req.headers['last-event-id'];
    const raw = (Array.isArray(lastId) ? lastId[0] : lastId) ?? req.query.after;
    const after = Number(typeof raw === 'string' ? raw : 0) || 0;
    for (const e of bus.backlog(after)) {
      res.write(`id: ${e.seq}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
    }

    const unsubscribe = bus.subscribe((e) => {
      res.write(`id: ${e.seq}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
    });
    // Heartbeat keeps proxies from closing an idle connection.
    const beat = setInterval(() => res.write(': ping\n\n'), 15000);

    req.on('close', () => { clearInterval(beat); unsubscribe(); });
  });

  app.post('/api/approvals/:id', (req: Request, res: Response) => {
    const decision = (req.body?.decision) as ApprovalDecision | undefined;
    if (decision !== 'allow' && decision !== 'deny') {
      res.status(400).json({ error: 'decision must be "allow" or "deny"' });
      return;
    }
    const id = String(req.params.id);
    const ok = approvals.resolve(id, decision);
    if (!ok) {
      res.status(404).json({ error: 'no pending approval with that id' });
      return;
    }
    res.json({ ok: true, id, decision });
  });

  // Serve the built UI (production) if it has been built.
  if (existsSync(UI_DIST)) {
    app.use(express.static(UI_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(UI_DIST, 'index.html')));
  }

  return app;
}

/** Start the hub on `port`. */
export function startHub(
  port: number,
  bus = new EventBus(),
  approvals = new ApprovalRegistry(),
  webhook?: WebhookConfig,
): Promise<Hub> {
  const app = createHubApp(bus, approvals, webhook);
  return new Promise<Hub>((resolve) => {
    const server = app.listen(port, () => {
      // When port 0 is passed (tests), report the actual bound port.
      const actual = (server.address() as AddressInfo | null)?.port ?? port;
      resolve({
        bus,
        approvals,
        server,
        port: actual,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
