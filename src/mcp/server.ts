/**
 * mcp/server.ts — the Tartarus MCP tool server.
 *
 * TrueForge attaches "remote" MCP servers by URL and calls their tools during
 * the agent loop. This file stands up one MCP server exposing our four tools
 * over Streamable HTTP, protected by a static bearer header so only our
 * TrueForge instance can invoke it.
 *
 *   scan_repo_for_vulns    → find candidate bugs (GitHub)
 *   run_exploit_in_sandbox → prove them (Daytona, isolated)
 *   request_human_approval → the gold gate
 *   create_patch_pr        → remediate (GitHub PR) — harness-gated on approval
 *
 * Run with:  npm run mcp
 */
import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from '../config.js';
import { paint } from '../theme.js';
import { GitHubService } from '../services/github.js';
import { SandboxService } from '../services/sandbox.js';
import { registerScanRepoForVulns } from './tools/scanRepoForVulns.js';
import { registerRunExploitInSandbox } from './tools/runExploitInSandbox.js';
import { registerRequestHumanApproval } from './tools/requestHumanApproval.js';
import { registerCreatePatchPr } from './tools/createPatchPr.js';

const cfg = loadConfig();
const gh = new GitHubService(cfg.GITHUB_TOKEN);
const sandbox = new SandboxService({
  apiKey: cfg.DAYTONA_API_KEY,
  apiUrl: cfg.DAYTONA_API_URL,
  target: cfg.DAYTONA_TARGET,
  nodeImage: cfg.DAYTONA_NODE_IMAGE,
  pythonImage: cfg.DAYTONA_PYTHON_IMAGE,
});

/** Build a fresh McpServer with all four tools registered. */
function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'tartarus-tools', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  registerScanRepoForVulns(server, gh, cfg.TARGET_REPO);
  registerRunExploitInSandbox(server, sandbox);
  registerRequestHumanApproval(server);
  registerCreatePatchPr(server, gh, cfg.TARGET_REPO);
  return server;
}

const app = express();
app.use(express.json({ limit: '8mb' }));

/** Reject any request that doesn't carry our shared secret. */
function authorised(req: Request): boolean {
  const header = req.header('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  return token === cfg.TARTARUS_MCP_TOKEN;
}

// One transport per MCP session, keyed by the session id the SDK assigns.
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req: Request, res: Response) => {
  if (!authorised(req)) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    return;
  }

  const sessionId = req.header('mcp-session-id');
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    // New MCP session — create a transport and wire it to a fresh server.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports.set(id, transport!); },
    });
    transport.onclose = () => {
      if (transport!.sessionId) transports.delete(transport!.sessionId);
    };
    await buildMcpServer().connect(transport);
  }

  if (!transport) {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session' }, id: null });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});

// GET/DELETE carry the server-sent-events stream and session teardown.
async function replay(req: Request, res: Response): Promise<void> {
  if (!authorised(req)) { res.status(401).end(); return; }
  const sessionId = req.header('mcp-session-id');
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) { res.status(400).send('No valid session'); return; }
  await transport.handleRequest(req, res);
}
app.get('/mcp', replay);
app.delete('/mcp', replay);

app.listen(cfg.TARTARUS_MCP_PORT, () => {
  console.log(paint.scan(`⚙  Tartarus MCP tools live on http://localhost:${cfg.TARTARUS_MCP_PORT}/mcp`));
  console.log(paint.muted('   tools: scan_repo_for_vulns · run_exploit_in_sandbox · request_human_approval · create_patch_pr'));
});
