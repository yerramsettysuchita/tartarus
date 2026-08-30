/**
 * services/github.ts — thin, purpose-built wrapper over the GitHub REST API.
 *
 * Tartarus needs exactly three things from GitHub:
 *   1. Read a repository's source (to scan it).
 *   2. Read individual file contents (to build a patch).
 *   3. Open a branch + pull request (the remediation).
 *
 * We keep this wrapper deliberately small so the tool layer stays readable.
 */
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

export interface RepoFile {
  path: string;
  content: string;
}

// Octokit extended with automatic retry (transient 5xx / network) and throttling
// (respects primary + secondary rate limits with backoff) — so a rate-limited
// scan self-heals instead of erroring on the first 403.
const HardenedOctokit = Octokit.plugin(retry, throttling);

export class GitHubService {
  private readonly gh: InstanceType<typeof HardenedOctokit>;

  constructor(token: string) {
    this.gh = new HardenedOctokit({
      auth: token,
      userAgent: 'tartarus-secops-agent',
      retry: { doNotRetry: [400, 401, 403, 404, 422] },
      throttling: {
        // Retry rate-limited requests a bounded number of times, then give up
        // and let the guard classifier return an actionable message.
        onRateLimit: (_retryAfter: number, _options: unknown, _octokit: unknown, retryCount: number) =>
          retryCount < 2,
        onSecondaryRateLimit: (_retryAfter: number, _options: unknown, _octokit: unknown, retryCount: number) =>
          retryCount < 2,
      },
    });
  }

  private static split(repo: string): { owner: string; name: string } {
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new Error(`Bad repo "${repo}", expected "owner/name"`);
    return { owner, name };
  }

  /** The repo's default branch name (e.g. "main"). */
  async defaultBranch(repo: string): Promise<string> {
    const { owner, name } = GitHubService.split(repo);
    const { data } = await this.gh.repos.get({ owner, repo: name });
    return data.default_branch;
  }

  /**
   * List candidate source files worth scanning. We pull the full tree once and
   * filter to text-y source extensions, skipping vendored / build output.
   */
  async listSourceFiles(repo: string, maxFiles = 60): Promise<string[]> {
    const { owner, name } = GitHubService.split(repo);
    const branch = await this.defaultBranch(repo);
    const { data: ref } = await this.gh.git.getRef({ owner, repo: name, ref: `heads/${branch}` });
    const { data: tree } = await this.gh.git.getTree({
      owner, repo: name, tree_sha: ref.object.sha, recursive: 'true',
    });

    const SOURCE = /\.(ts|tsx|js|jsx|py|go|rb|php|java|cs|sh)$/i;
    const SKIP = /(^|\/)(node_modules|dist|build|vendor|\.git|__pycache__)\//i;

    return tree.tree
      .filter((n) => n.type === 'blob' && n.path && SOURCE.test(n.path) && !SKIP.test(n.path))
      .map((n) => n.path as string)
      .slice(0, maxFiles);
  }

  /** Fetch a single file's decoded UTF-8 contents. */
  async readFile(repo: string, path: string): Promise<RepoFile> {
    const { owner, name } = GitHubService.split(repo);
    const { data } = await this.gh.repos.getContent({ owner, repo: name, path });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      throw new Error(`"${path}" is not a readable file`);
    }
    return { path, content: Buffer.from(data.content, 'base64').toString('utf8') };
  }

  /**
   * Create a remediation PR: branch off default, commit the patched file(s),
   * and open a pull request. Returns the PR html_url.
   */
  async openPatchPr(args: {
    repo: string;
    branch: string;
    title: string;
    body: string;
    files: RepoFile[];
  }): Promise<{ url: string; number: number }> {
    const { owner, name } = GitHubService.split(args.repo);
    const base = await this.defaultBranch(args.repo);

    // Point the new branch at the current tip of the base branch.
    const { data: baseRef } = await this.gh.git.getRef({ owner, repo: name, ref: `heads/${base}` });
    await this.gh.git.createRef({
      owner, repo: name, ref: `refs/heads/${args.branch}`, sha: baseRef.object.sha,
    });

    // Commit each patched file onto the new branch (one commit per file keeps
    // the PR history legible and lets Qodo review discrete changes).
    for (const f of args.files) {
      let existingSha: string | undefined;
      try {
        const { data } = await this.gh.repos.getContent({ owner, repo: name, path: f.path, ref: args.branch });
        if (!Array.isArray(data) && 'sha' in data) existingSha = data.sha;
      } catch {
        /* new file — no prior sha */
      }
      await this.gh.repos.createOrUpdateFileContents({
        owner, repo: name, path: f.path, branch: args.branch,
        message: `fix(security): patch ${f.path}`,
        content: Buffer.from(f.content, 'utf8').toString('base64'),
        ...(existingSha ? { sha: existingSha } : {}),
      });
    }

    const { data: pr } = await this.gh.pulls.create({
      owner, repo: name, head: args.branch, base, title: args.title, body: args.body,
    });
    return { url: pr.html_url, number: pr.number };
  }

  // ── Self-Healing Loop support ──────────────────────────────────────────────

  /** The head branch of a PR (where follow-up commits must go). */
  async prHeadBranch(repo: string, prNumber: number): Promise<string> {
    const { owner, name } = GitHubService.split(repo);
    const { data } = await this.gh.pulls.get({ owner, repo: name, pull_number: prNumber });
    return data.head.ref;
  }

  /** All reviews on a PR (Qodo posts a review with a state + body). */
  async listReviews(repo: string, prNumber: number): Promise<Review[]> {
    const { owner, name } = GitHubService.split(repo);
    const { data } = await this.gh.pulls.listReviews({ owner, repo: name, pull_number: prNumber });
    return data.map((r) => ({
      author: r.user?.login ?? 'unknown',
      state: (r.state ?? '') as Review['state'],
      body: r.body ?? '',
      submittedAt: r.submitted_at ?? '',
    }));
  }

  /** Inline review comments on a PR (the specific, actionable ones). */
  async listReviewComments(repo: string, prNumber: number): Promise<ReviewComment[]> {
    const { owner, name } = GitHubService.split(repo);
    const { data } = await this.gh.pulls.listReviewComments({ owner, repo: name, pull_number: prNumber });
    return data.map((c) => ({
      author: c.user?.login ?? 'unknown',
      path: c.path,
      line: c.line ?? c.original_line ?? null,
      body: c.body ?? '',
    }));
  }

  /** Commit refined file(s) onto an EXISTING branch (the PR's head) — the auto-fix. */
  async commitToBranch(args: { repo: string; branch: string; message: string; files: RepoFile[] }): Promise<void> {
    const { owner, name } = GitHubService.split(args.repo);
    for (const f of args.files) {
      let existingSha: string | undefined;
      try {
        const { data } = await this.gh.repos.getContent({ owner, repo: name, path: f.path, ref: args.branch });
        if (!Array.isArray(data) && 'sha' in data) existingSha = data.sha;
      } catch { /* new file */ }
      await this.gh.repos.createOrUpdateFileContents({
        owner, repo: name, path: f.path, branch: args.branch, message: args.message,
        content: Buffer.from(f.content, 'utf8').toString('base64'),
        ...(existingSha ? { sha: existingSha } : {}),
      });
    }
  }

  /** Post a comment on the PR (e.g. "Tartarus pushed an auto-fix addressing Qodo's review"). */
  async commentOnPr(repo: string, prNumber: number, body: string): Promise<void> {
    const { owner, name } = GitHubService.split(repo);
    await this.gh.issues.createComment({ owner, repo: name, issue_number: prNumber, body });
  }

  /**
   * Idempotently register (or update) a `push` webhook pointing at `url`.
   * If a hook with the same URL already exists it is updated in place, so this
   * is safe to run repeatedly (e.g. each time the ngrok URL changes).
   */
  async ensureWebhook(repo: string, opts: { url: string; secret?: string }): Promise<{ created: boolean; id: number }> {
    const { owner, name } = GitHubService.split(repo);
    const config = {
      url: opts.url,
      content_type: 'json' as const,
      ...(opts.secret ? { secret: opts.secret } : {}),
    };

    const { data: hooks } = await this.gh.repos.listWebhooks({ owner, repo: name });
    const existing = hooks.find((h) => (h.config as { url?: string })?.url === opts.url);

    if (existing) {
      await this.gh.repos.updateWebhook({
        owner, repo: name, hook_id: existing.id, config, events: ['push'], active: true,
      });
      return { created: false, id: existing.id };
    }
    const { data: hook } = await this.gh.repos.createWebhook({
      owner, repo: name, config, events: ['push'], active: true,
    });
    return { created: true, id: hook.id };
  }
}

export interface Review {
  author: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING' | string;
  body: string;
  submittedAt: string;
}

export interface ReviewComment {
  author: string;
  path: string;
  line: number | null;
  body: string;
}
