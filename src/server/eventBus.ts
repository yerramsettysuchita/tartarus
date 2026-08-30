/**
 * server/eventBus.ts — a tiny typed pub/sub with a replay buffer.
 *
 * The hunt runner publishes hunt events here; SSE clients (the Command Center
 * UI) subscribe. New subscribers get the recent backlog first (so a dashboard
 * opened mid-hunt still renders everything), then live events.
 *
 * Deliberately dependency-free and synchronous so it is trivial to unit-test.
 */

/** A single event on the hunt timeline, as the UI consumes it. */
export interface HuntEvent {
  /** Monotonic sequence number (1-based). */
  seq: number;
  /** ISO timestamp. */
  ts: string;
  /** Coarse kind the UI switches its styling on. */
  kind:
    | 'boot'
    | 'phase'          // scan / detonate / approval / patch banners
    | 'scan'           // scan result (file list for the context panel)
    | 'log'            // streamed model narration / tool notes
    | 'verdict'        // exploit confirmed / not
    | 'approval_required'
    | 'approval_resolved'
    | 'pr_opened'
    | 'done'
    | 'error';
  /** Human-readable line. */
  message: string;
  /** Optional structured payload (verdict json, approval details, …). */
  data?: unknown;
}

export type Listener = (event: HuntEvent) => void;

export class EventBus {
  private seq = 0;
  private readonly buffer: HuntEvent[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly bufferLimit = 500) {}

  /** Publish an event; assigns seq + ts, buffers it, and fans out to listeners. */
  publish(kind: HuntEvent['kind'], message: string, data?: unknown): HuntEvent {
    const event: HuntEvent = {
      seq: ++this.seq,
      ts: new Date().toISOString(),
      kind,
      message,
      ...(data !== undefined ? { data } : {}),
    };
    this.buffer.push(event);
    if (this.buffer.length > this.bufferLimit) this.buffer.shift();
    for (const l of this.listeners) {
      try { l(event); } catch { /* a broken listener must not break publishing */ }
    }
    return event;
  }

  /** Events buffered after `afterSeq` (0 = the whole backlog). */
  backlog(afterSeq = 0): HuntEvent[] {
    return this.buffer.filter((e) => e.seq > afterSeq);
  }

  /** Subscribe to live events; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  get lastSeq(): number {
    return this.seq;
  }
}
