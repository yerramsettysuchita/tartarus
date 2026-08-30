/**
 * server/webhook.ts — GitHub webhook helpers (Sentinel Mode).
 *
 * Pure, testable functions for the two things a webhook endpoint must do safely:
 *   1. Verify the payload really came from GitHub (HMAC-SHA256 signature).
 *   2. Extract the pushed repository from a `push` event.
 *
 * Keeping these dependency-light and side-effect-free makes them unit-testable
 * without standing up a server.
 */
import crypto from 'node:crypto';

/**
 * Verify a GitHub `X-Hub-Signature-256` header against the raw request body.
 * Uses a constant-time comparison. If no secret is configured we return true
 * (unauthenticated mode) — but production should always set a secret.
 */
export function verifyGithubSignature(
  secret: string | undefined,
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!secret) return true; // no secret configured → accept (dev only)
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
  const expected = `sha256=${hmac.digest('hex')}`;

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface PushInfo {
  repo: string;        // "owner/name"
  ref?: string;        // e.g. "refs/heads/main"
  pusher?: string;
}

/**
 * If this is a GitHub `push` event, return the repo it targeted; otherwise null.
 * `event` is the value of the `X-GitHub-Event` header.
 */
export function parsePushEvent(event: string | undefined, payload: unknown): PushInfo | null {
  if (event !== 'push') return null;
  const p = payload as {
    repository?: { full_name?: string };
    ref?: string;
    pusher?: { name?: string };
  };
  const repo = p?.repository?.full_name;
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) return null;
  return { repo, ref: p.ref, pusher: p.pusher?.name };
}
