/**
 * config.ts — single, validated source of truth for runtime configuration.
 *
 * We fail fast: if a required secret is missing we throw at startup with a
 * clear message rather than deep inside a tool call. Zod gives us both the
 * validation and the exported TypeScript types for free.
 */
import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  // TrueForge harness
  TRUEFORGE_BASE_URL: z.string().url().default('http://localhost:8790'),
  TRUEFORGE_TOKEN: z.string().optional(),
  TARTARUS_MODEL: z.string().default('anthropic/claude-sonnet-4-6'),

  // Tartarus MCP tool server
  TARTARUS_MCP_PORT: z.coerce.number().int().positive().default(8123),
  TARTARUS_MCP_URL: z.string().url().default('http://localhost:8123/mcp'),
  TARTARUS_MCP_TOKEN: z.string().min(8, 'Set a long random TARTARUS_MCP_TOKEN'),

  // GitHub
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  TARGET_REPO: z.string().regex(/^[^/]+\/[^/]+$/, 'TARGET_REPO must be "owner/name"'),
  // Shared secret for GitHub webhook signature verification (Sentinel Mode).
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Daytona sandbox
  DAYTONA_API_KEY: z.string().min(1, 'DAYTONA_API_KEY is required'),
  DAYTONA_API_URL: z.string().url().default('https://app.daytona.io/api'),
  DAYTONA_TARGET: z.string().default('us'),
  // Node 22+ image is REQUIRED for `node:sqlite` (used by Patient-Zero). Do not
  // drop below 22 or exploit detonation crashes with "module not found".
  DAYTONA_NODE_IMAGE: z.string().default('node:22'),
  DAYTONA_PYTHON_IMAGE: z.string().default('python:3.12'),

  // Verbose logging of MCP tool payloads (also toggled by `--debug` on the CLI).
  TARTARUS_DEBUG: z.coerce.boolean().default(false),

  // Command Center web dashboard (started with `npm run hunt -- --ui`).
  TARTARUS_UI_PORT: z.coerce.number().int().positive().default(8799),
});

/**
 * Parse once and cache. Import { config } anywhere.
 * The MCP server needs GitHub/Daytona secrets; the agent runner only needs
 * the TrueForge + MCP coordinates — so we validate lazily per entrypoint.
 */
export type Config = z.infer<typeof Env>;

export function loadConfig(): Config {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example → .env and fill it in.`);
  }
  return parsed.data;
}
