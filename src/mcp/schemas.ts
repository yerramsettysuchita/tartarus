/**
 * mcp/schemas.ts — the input schemas for all four Tartarus tools, in one place.
 *
 * Centralising the Zod shapes here keeps the tool files focused on behaviour and
 * gives us a single, testable source of truth for the tool contracts. Each shape
 * is the raw `{ field: zodType }` object the MCP SDK's `registerTool` expects;
 * tests wrap it with `z.object(shape)` to validate payloads.
 */
import { z } from 'zod';

const repoField = z.string().regex(/^[^/]+\/[^/]+$/)
  .describe('Target repo "owner/name". Defaults to the configured TARGET_REPO.');

export const scanRepoShape = {
  repo: repoField.optional(),
  maxFiles: z.number().int().positive().max(120).default(40)
    .describe('Cap on files scanned to keep the context focused.'),
};

export const runExploitShape = {
  language: z.enum(['javascript', 'typescript', 'python'])
    .describe('Runtime for target + exploit. Prefer "javascript" for Node targets (runs on a ' +
      'pinned node:22 image with node:sqlite available and needs no transpiler); "python" for ' +
      'Python targets; "typescript" only if the exploit truly needs TS syntax.'),
  targetFilename: z.string().min(1).describe('Filename to write the vulnerable code as, e.g. "app.js".'),
  targetCode: z.string().min(1).describe('The exact vulnerable source under test.'),
  exploitCode: z.string().min(1).describe('Self-contained exploit that imports/invokes the target.'),
  timeoutSec: z.number().int().positive().max(180).default(60),
};

export const requestApprovalShape = {
  vulnerability: z.string().min(1).describe('One-paragraph description of the confirmed bug and its impact.'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  exploitEvidence: z.string().min(1).describe('The sandbox stdout / proof that the exploit succeeded.'),
  proposedPatch: z.string().min(1).describe('Human-readable summary of the fix to be applied.'),
  affectedFiles: z.array(z.string()).min(1),
};

export const createPatchPrShape = {
  repo: repoField.optional(),
  title: z.string().min(1).describe('PR title, e.g. "fix(security): prevent SQL injection in login".'),
  summary: z.string().min(1).describe('PR body: the vulnerability, the exploit proof, and the fix rationale.'),
  files: z.array(z.object({
    path: z.string().min(1).describe('Repo-relative path of the file to overwrite.'),
    content: z.string().describe('Full new contents of the file.'),
  })).min(1),
};
