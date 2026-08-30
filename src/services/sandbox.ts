/**
 * services/sandbox.ts — isolated exploit detonation via Daytona.
 *
 * SECURITY MODEL
 * ──────────────
 * Exploit code is UNTRUSTED and potentially destructive. It must NEVER run on
 * the harness host. TrueForge's "sandbox as a tool" philosophy is exactly this:
 * the agent loop + credentials stay on the server, and only code/file/shell
 * operations are shipped into a throwaway, network-isolated Daytona sandbox.
 *
 * Each detonation gets a fresh sandbox that is always destroyed in `finally`,
 * so a crashing or hanging exploit cannot leak state between runs.
 *
 * IMAGE PINNING
 * ─────────────
 * Node targets run on a pinned `node:22` image because Patient-Zero (and any
 * modern Node target) uses the built-in `node:sqlite` module, which only exists
 * on Node 22+. TypeScript exploits run via Node's built-in type stripping
 * (`--experimental-strip-types`), so detonation needs NO network fetch of a
 * transpiler — it works even in a fully network-isolated sandbox.
 */
import { Daytona, type Sandbox } from '@daytona/sdk';
import { withTimeout } from '../mcp/guard.js';

/** Hard ceiling on how long we wait for a sandbox to provision before failing. */
const SANDBOX_START_TIMEOUT_MS = 120_000;

export type SandboxLanguage = 'javascript' | 'typescript' | 'python';

export interface DetonationResult {
  exitCode: number;
  stdout: string;
  /** true when the exploit script signalled a successful compromise. */
  exploited: boolean;
}

export class SandboxService {
  private readonly daytona: Daytona;
  private readonly nodeImage: string;
  private readonly pythonImage: string;

  constructor(cfg: {
    apiKey: string;
    apiUrl: string;
    target: string;
    nodeImage?: string;
    pythonImage?: string;
  }) {
    this.daytona = new Daytona({ apiKey: cfg.apiKey, apiUrl: cfg.apiUrl, target: cfg.target });
    this.nodeImage = cfg.nodeImage ?? 'node:22';
    this.pythonImage = cfg.pythonImage ?? 'python:3.12';
  }

  /** Resolve the image + exploit filename + run command for a language. */
  private plan(language: SandboxLanguage): { image: string; file: string; run: (f: string) => string } {
    switch (language) {
      case 'python':
        return { image: this.pythonImage, file: 'exploit.py', run: (f) => `python ${f}` };
      case 'typescript':
        // Node 22.6+ can execute .ts directly by stripping types — no npx/tsx,
        // so no network dependency inside the sandbox.
        return { image: this.nodeImage, file: 'exploit.ts', run: (f) => `node --experimental-strip-types ${f}` };
      case 'javascript':
      default:
        return { image: this.nodeImage, file: 'exploit.js', run: (f) => `node ${f}` };
    }
  }

  /**
   * Write `exploitCode` into a fresh sandbox and run it against `targetCode`,
   * both placed as files. The exploit signals success by printing the sentinel
   * `TARTARUS_EXPLOIT_OK` to stdout (checked here rather than trusting exit 0,
   * so a merely-crashing target isn't mistaken for a proven exploit).
   */
  async detonate(args: {
    language: SandboxLanguage;
    targetFilename: string;
    targetCode: string;
    exploitCode: string;
    timeoutSec?: number;
  }): Promise<DetonationResult> {
    const { image, file, run } = this.plan(args.language);

    // Provisioning can stall; bound it so a hung spin-up surfaces as a clean,
    // retryable timeout (via the guard classifier) instead of hanging the tool.
    const sandbox: Sandbox = await withTimeout(
      'daytona sandbox start',
      SANDBOX_START_TIMEOUT_MS,
      this.daytona.create(
        {
          image,
          language: args.language === 'javascript' ? 'typescript' : args.language,
        },
        { timeout: SANDBOX_START_TIMEOUT_MS / 1000 },
      ),
    );

    try {
      // Materialise the vulnerable target and the exploit inside the sandbox.
      await sandbox.fs.uploadFile(Buffer.from(args.targetCode, 'utf8'), args.targetFilename);
      await sandbox.fs.uploadFile(Buffer.from(args.exploitCode, 'utf8'), file);

      const res = await sandbox.process.executeCommand(
        run(file),
        undefined,                 // cwd (sandbox root)
        undefined,                 // env
        args.timeoutSec ?? 60,
      );

      const stdout = res.result ?? '';
      return {
        exitCode: res.exitCode ?? 0,
        stdout,
        exploited: stdout.includes('TARTARUS_EXPLOIT_OK'),
      };
    } finally {
      // Always shred the sandbox — success or failure.
      await this.daytona.delete(sandbox).catch(() => { /* best-effort cleanup */ });
    }
  }
}
