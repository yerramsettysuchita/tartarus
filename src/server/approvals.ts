/**
 * server/approvals.ts — the gold-gate approval registry.
 *
 * When the hunt reaches a `create_patch_pr` approval pause, the runner registers
 * a pending approval and awaits its resolution. The decision can arrive from the
 * Command Center UI (a POST) or, in CLI mode, from the terminal. This class is
 * the synchronisation primitive that lets an async web POST unblock the runner.
 *
 * Dependency-free and unit-testable.
 */
export type ApprovalDecision = 'allow' | 'deny';

interface Pending {
  id: string;
  toolName: string;
  summary: string;
  createdAt: string;
  resolve: (decision: ApprovalDecision) => void;
}

export class ApprovalRegistry {
  private readonly pending = new Map<string, Pending>();

  /**
   * Register a pending approval and return a promise that resolves when someone
   * calls `resolve(id, …)`. `id` should be unique per approval (e.g. the tool
   * call id).
   */
  await(id: string, toolName: string, summary: string): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve) => {
      this.pending.set(id, { id, toolName, summary, createdAt: new Date().toISOString(), resolve });
    });
  }

  /** Resolve a pending approval. Returns false if the id is unknown/already resolved. */
  resolve(id: string, decision: ApprovalDecision): boolean {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id);
    p.resolve(decision);
    return true;
  }

  /** Public view of what's awaiting a decision (for the UI's initial state). */
  list(): Array<Pick<Pending, 'id' | 'toolName' | 'summary' | 'createdAt'>> {
    return [...this.pending.values()].map(({ id, toolName, summary, createdAt }) =>
      ({ id, toolName, summary, createdAt }));
  }

  has(id: string): boolean {
    return this.pending.has(id);
  }

  get size(): number {
    return this.pending.size;
  }
}
