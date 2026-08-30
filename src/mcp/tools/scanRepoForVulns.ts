/**
 * Tool: scan_repo_for_vulns
 *
 * Pulls a repository's source from GitHub and returns the raw material the
 * agent's LLM reasons over to identify vulnerabilities. We intentionally do the
 * *detection* in the model (Claude), not with brittle regexes here — this tool
 * is the "eyes": it fetches and lightly pre-screens the code, attaching cheap
 * heuristic hints (dangerous sinks) so the model knows where to look first.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GitHubService } from '../../services/github.js';
import { guard } from '../guard.js';
import { scanRepoShape } from '../schemas.js';

/** Cheap grep-style hints — NOT a verdict, just where to point Claude first. */
export const SINKS: Array<{ re: RegExp; note: string }> = [
  { re: /\beval\s*\(/, note: 'eval() — arbitrary code execution' },
  { re: /child_process|\bexec\w*\s*\(|\bspawn\w*\s*\(|subprocess|os\.system/, note: 'shell exec — command injection' },
  { re: /(SELECT|INSERT|UPDATE|DELETE)\b.*\+|f["'].*\{.*\}.*(FROM|WHERE)/i, note: 'string-built SQL — injection' },
  { re: /innerHTML|dangerouslySetInnerHTML|v-html/, note: 'raw HTML sink — XSS' },
  { re: /(md5|sha1)\(|createCipher\(|Math\.random\(\).*(token|secret|password)/i, note: 'weak crypto / predictable secret' },
  { re: /pickle\.loads|yaml\.load\s*\(|deserialize/, note: 'unsafe deserialization' },
  { re: /\b(readFile\w*|createReadStream|sendFile|open)\s*\(|res\.download\s*\(/, note: 'file read from input — path traversal' },
  { re: /\b(fetch|axios\.\w+|got|https?\.get|requests\.\w+|urllib)\s*\(/, note: 'server-side request — SSRF' },
];

/** Pure sink detector: returns the notes for every dangerous pattern present. */
export function detectSinks(content: string): string[] {
  return SINKS.filter((s) => s.re.test(content)).map((s) => s.note);
}

export function registerScanRepoForVulns(server: McpServer, gh: GitHubService, defaultRepo: string): void {
  server.registerTool(
    'scan_repo_for_vulns',
    {
      title: 'Scan repository for vulnerabilities',
      description:
        "Fetch a GitHub repository's source and return each source file with heuristic " +
        'hints marking suspicious sinks. Use this first to locate candidate vulnerabilities, ' +
        'then read the flagged files closely to confirm an exploitable bug.',
      inputSchema: scanRepoShape,
    },
    guard('scan_repo_for_vulns', async ({ repo, maxFiles }) => {
      const target = repo ?? defaultRepo;
      const paths = await gh.listSourceFiles(target, maxFiles);

      const findings: Array<{ path: string; hints: string[]; content: string }> = [];
      for (const path of paths) {
        const file = await gh.readFile(target, path);
        findings.push({ path, hints: detectSinks(file.content), content: file.content });
      }

      const flagged = findings.filter((f) => f.hints.length > 0);
      const summary =
        `Scanned ${findings.length} files in ${target}. ` +
        `${flagged.length} file(s) contain suspicious sinks.`;

      return {
        content: [{ type: 'text', text: JSON.stringify({ repo: target, summary, files: findings }, null, 2) }],
      };
    }),
  );
}
