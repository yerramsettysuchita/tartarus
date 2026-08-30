/**
 * agent/register.ts — register the Tartarus tools server with TrueForge.
 *
 * TrueForge stores MCP connectors in its own settings database. We register our
 * tools server once (idempotently) via the settings REST API, using header auth
 * so the harness sends our shared secret on every tool call. After this, the
 * agent can attach the server by name.
 *
 * Run with:  npm run register
 */
import { loadConfig } from '../config.js';
import { paint } from '../theme.js';

const MCP_SERVER_NAME = 'tartarus-tools';

async function main(): Promise<void> {
  const cfg = loadConfig();

  const manifest = {
    manifest: {
      type: 'remote' as const,
      name: MCP_SERVER_NAME,
      url: cfg.TARTARUS_MCP_URL,
      description: 'Tartarus SecOps tools: scan, sandbox-detonate, approve, patch-PR.',
      auth: {
        type: 'header' as const,
        headers: { authorization: `Bearer ${cfg.TARTARUS_MCP_TOKEN}` },
      },
    },
  };

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.TRUEFORGE_TOKEN) headers.authorization = `Bearer ${cfg.TRUEFORGE_TOKEN}`;

  const res = await fetch(`${cfg.TRUEFORGE_BASE_URL}/api/v1/settings/mcp-servers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(manifest),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to register MCP server (${res.status}): ${await res.text()}`);
  }
  console.log(paint.ok(`Registered MCP connector "${MCP_SERVER_NAME}" → ${cfg.TARTARUS_MCP_URL}`));
  console.log(paint.muted('   (Existing connectors are replaced; a 409 means it was already present.)'));
}

main().catch((err) => {
  console.error(paint.fail(String(err instanceof Error ? err.message : err)));
  process.exit(1);
});

export { MCP_SERVER_NAME };
