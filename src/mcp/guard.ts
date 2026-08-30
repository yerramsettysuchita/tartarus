/**
 * mcp/guard.ts — resilience wrapper for tool handlers.
 *
 * A thrown exception inside a tool handler would surface as a transport error
 * and can take down the request. Instead we want failures to come back to the
 * agent as a *structured tool result* with `isError: true`, so Claude can read
 * the message, decide to retry, adjust its approach, or explain the failure to
 * the user. This wrapper:
 *
 *   • catches everything and converts it to an error tool-result,
 *   • classifies common, expected failures (rate limits, timeouts, auth) into a
 *     clear, actionable message,
 *   • never leaks secrets or raw stack traces to the model.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Verbose payload logging, toggled by TARTARUS_DEBUG (or the CLI --debug flag). */
const DEBUG = /^(1|true|yes)$/i.test(process.env.TARTARUS_DEBUG ?? '');

/** Redact obviously-secret-looking values before logging a payload. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (key, val) => {
      if (/token|secret|key|password|authorization/i.test(key) && typeof val === 'string') {
        return `«redacted:${val.length}»`;
      }
      // Trim very long code blobs so debug output stays readable.
      if (typeof val === 'string' && val.length > 2000) return val.slice(0, 2000) + `…(+${val.length - 2000})`;
      return val;
    }, 2);
  } catch {
    return String(value);
  }
}

/** Best-effort classification of an unknown error into an actionable message. */
export function classifyError(toolName: string, err: unknown): string {
  const anyErr = err as { status?: number; code?: string; message?: string; name?: string };
  const status = anyErr?.status;
  const code = anyErr?.code;
  const msg = anyErr?.message ?? String(err);

  // GitHub / HTTP rate limiting.
  if (status === 429 || status === 403 && /rate limit/i.test(msg)) {
    return `${toolName}: GitHub rate limit hit. Wait for the limit to reset, then retry — ` +
      `or reduce the number of files scanned (maxFiles).`;
  }
  // Auth / permission problems.
  if (status === 401 || status === 403) {
    return `${toolName}: authorization failed (HTTP ${status}). Check the GitHub token scopes ` +
      `(Contents + Pull requests: read/write).`;
  }
  if (status === 404) {
    return `${toolName}: not found (HTTP 404). Verify the repo "owner/name" and that the token can see it.`;
  }
  // Timeouts (our own timeout guard, or a network timeout).
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || /tim\w*out/i.test(msg)) {
    return `${toolName}: the operation timed out (likely the sandbox took too long to start or the ` +
      `network stalled). This is usually transient — retry once.`;
  }
  // Connection refused (e.g. Daytona / a service down).
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return `${toolName}: could not reach an upstream service (${code}). Confirm the service is up ` +
      `and its API URL/key are correct, then retry.`;
  }
  // Fallback — surface the message but never a stack trace.
  return `${toolName} failed: ${msg}`;
}

/** Build a structured error tool-result. */
export function errorResult(toolName: string, err: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: classifyError(toolName, err) }],
  };
}

/**
 * Wrap a tool handler so it never throws: any error becomes an `isError` result.
 * Usage:  server.registerTool(name, schema, guard(name, async (args) => {...}))
 */
export function guard<A>(
  toolName: string,
  fn: (args: A) => Promise<CallToolResult>,
): (args: A) => Promise<CallToolResult> {
  return async (args: A): Promise<CallToolResult> => {
    const startedAt = Date.now();
    if (DEBUG) console.error(`\n[debug ▶ ${toolName}] input:`, safeJson(args));
    try {
      const result = await fn(args);
      if (DEBUG) {
        console.error(`[debug ✓ ${toolName}] ${Date.now() - startedAt}ms output:`, safeJson(result));
      }
      return result;
    } catch (err) {
      // Log server-side for the operator; return a safe message to the model.
      console.error(`[tool:${toolName}]`, err);
      return errorResult(toolName, err);
    }
  };
}

/** Reject a promise if it doesn't settle within `ms`, with a labelled timeout. */
export function withTimeout<T>(label: string, ms: number, p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${ms}ms`);
      (e as { code?: string }).code = 'ETIMEDOUT';
      reject(e);
    }, ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
