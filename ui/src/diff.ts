/**
 * diff.ts: a small split-view diff engine for the approval modal.
 *
 * It runs an LCS diff at the line level, pairs each replaced line with its
 * counterpart, and then runs a second LCS pass at the word level so changed
 * tokens are highlighted inside the line, the way a GitHub pull request review
 * renders a split diff. No dependencies.
 */

export type CellKind = 'context' | 'del' | 'add' | 'empty';
export interface Cell { kind: CellKind; html: string }
export interface Row { left: Cell; right: Cell }
export interface SplitDiff { rows: Row[]; added: number; deleted: number }

const EMPTY: Cell = { kind: 'empty', html: '' };

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

/** LCS over arbitrary token arrays; returns edit ops in order. */
function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): Array<{ t: 'eq' | 'del' | 'add'; v: T }> {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = eq(a[i]!, b[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: Array<{ t: 'eq' | 'del' | 'add'; v: T }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i]!, b[j]!)) { ops.push({ t: 'eq', v: a[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { ops.push({ t: 'del', v: a[i]! }); i++; }
    else { ops.push({ t: 'add', v: b[j]! }); j++; }
  }
  while (i < n) ops.push({ t: 'del', v: a[i++]! });
  while (j < m) ops.push({ t: 'add', v: b[j++]! });
  return ops;
}

/** Split a line into words + separators so we can diff at the token level. */
function tokenize(line: string): string[] {
  return line.match(/(\s+|[A-Za-z0-9_$]+|[^\sA-Za-z0-9_$])/g) ?? [];
}

/** Word-level highlight of a changed line pair. Returns {left, right} inner HTML. */
function highlightPair(before: string, after: string): { left: string; right: string } {
  const ops = lcs(tokenize(before), tokenize(after), (x, y) => x === y);
  let left = '', right = '';
  for (const op of ops) {
    const t = escapeHtml(op.v);
    if (op.t === 'eq') { left += t; right += t; }
    else if (op.t === 'del') left += `<span class="tok-del">${t}</span>`;
    else right += `<span class="tok-add">${t}</span>`;
  }
  return { left, right };
}

/**
 * Build a split diff. Rows align context lines on both sides; a block of
 * replaced lines pairs del[k] with add[k] for intra-line highlighting, and any
 * surplus becomes single-sided rows.
 */
export function buildSplitDiff(before: string, after: string): SplitDiff {
  const a = before.split('\n');
  const b = after.split('\n');
  const ops = lcs(a, b, (x, y) => x === y);

  const rows: Row[] = [];
  let added = 0, deleted = 0;
  let delBuf: string[] = [];
  let addBuf: string[] = [];

  const flush = () => {
    const n = Math.max(delBuf.length, addBuf.length);
    for (let k = 0; k < n; k++) {
      const d = delBuf[k];
      const ad = addBuf[k];
      if (d !== undefined && ad !== undefined) {
        const { left, right } = highlightPair(d, ad);
        rows.push({ left: { kind: 'del', html: left }, right: { kind: 'add', html: right } });
        deleted++; added++;
      } else if (d !== undefined) {
        rows.push({ left: { kind: 'del', html: escapeHtml(d) }, right: EMPTY });
        deleted++;
      } else if (ad !== undefined) {
        rows.push({ left: EMPTY, right: { kind: 'add', html: escapeHtml(ad) } });
        added++;
      }
    }
    delBuf = []; addBuf = [];
  };

  for (const op of ops) {
    if (op.t === 'eq') {
      flush();
      const h = escapeHtml(op.v);
      rows.push({ left: { kind: 'context', html: h }, right: { kind: 'context', html: h } });
    } else if (op.t === 'del') delBuf.push(op.v);
    else addBuf.push(op.v);
  }
  flush();

  return { rows, added, deleted };
}
