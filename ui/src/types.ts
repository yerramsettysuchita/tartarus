/** Mirrors the backend HuntEvent (src/server/eventBus.ts). */
export type HuntKind =
  | 'boot'
  | 'phase'
  | 'scan'
  | 'log'
  | 'verdict'
  | 'approval_required'
  | 'approval_resolved'
  | 'pr_opened'
  | 'done'
  | 'error';

export interface HuntEvent {
  seq: number;
  ts: string;
  kind: HuntKind;
  message: string;
  data?: unknown;
}

/** A single file's before/after for the approval diff. */
export interface DiffFile {
  path: string;
  before: string;
  after: string;
}

/** The rich payload behind the gold-gate approval modal. */
export interface ApprovalData {
  id: string;
  tool: string;
  title?: string;
  summary?: string;
  vulnerability?: string;
  severity?: string;
  evidence?: string;
  confidence?: number;
  exploitConfirmed?: boolean;
  diffs: DiffFile[];
}

/** Scan result payload (for the evidence panel). */
export interface ScanFile {
  path: string;
  hints: string[];
}
