import { useEffect, useRef, useState } from 'react';
import type { HuntEvent, HuntKind, ApprovalData } from './types.ts';

const KINDS: HuntKind[] = [
  'boot', 'phase', 'scan', 'log', 'verdict', 'approval_required',
  'approval_resolved', 'pr_opened', 'done', 'error',
];

export interface StreamState {
  events: HuntEvent[];
  connected: boolean;
  pending: ApprovalData[];
}

/**
 * Subscribes to the hub's SSE stream (`/api/events`) and keeps the event list
 * plus the set of approvals awaiting a decision. The rich approval payload
 * arrives on the `approval_required` event (and is replayed from the backlog on
 * reconnect), so a dashboard opened mid-pause still renders the full gold gate.
 */
export function useHuntStream(): StreamState {
  const [events, setEvents] = useState<HuntEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState<ApprovalData[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const onEvent = (raw: MessageEvent) => {
      let evt: HuntEvent;
      try { evt = JSON.parse(raw.data); } catch { return; }
      setEvents((prev) => (prev.some((e) => e.seq === evt.seq) ? prev : [...prev, evt]));

      if (evt.kind === 'approval_required') {
        const d = evt.data as ApprovalData | undefined;
        if (d?.id) setPending((prev) => prev.some((p) => p.id === d.id) ? prev : [...prev, d]);
      }
      if (evt.kind === 'approval_resolved') {
        const d = (evt.data ?? {}) as { id?: string };
        if (d.id) setPending((prev) => prev.filter((p) => p.id !== d.id));
      }
    };

    for (const k of KINDS) es.addEventListener(k, onEvent as EventListener);
    return () => { es.close(); esRef.current = null; };
  }, []);

  return { events, connected, pending };
}

/** POST the gold-gate decision back to the hub. */
export async function sendApproval(id: string, decision: 'allow' | 'deny'): Promise<void> {
  await fetch(`/api/approvals/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}
