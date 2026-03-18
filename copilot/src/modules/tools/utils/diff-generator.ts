/**
 * Pure-function unified diff generator.
 *
 * Produces standard unified diff output (same format as `diff -u`).
 * No external dependencies.
 *
 * Complexity: O(m * n) time and space for LCS where m = |original| and
 * n = |modified|. Files exceeding MAX_LINES_PER_SIDE are handled with
 * a fast-path that skips LCS and emits a full replace diff.
 */

type DiffOp =
  | { type: 'eq'; origLine: number; modLine: number; text: string }
  | { type: 'del'; origLine: number; text: string }
  | { type: 'add'; modLine: number; text: string };

/** Maximum lines per side before switching to the fast-path. */
const MAX_LINES_PER_SIDE = 2500;

export interface DiffResult {
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  isEmpty: boolean;
}

export function generateUnifiedDiff(
  originalContent: string,
  modifiedContent: string,
  filePath = 'file',
  contextLines = 3,
): DiffResult {
  if (originalContent === modifiedContent) {
    return { diff: '', linesAdded: 0, linesRemoved: 0, isEmpty: true };
  }

  const a = splitLines(originalContent);
  const b = splitLines(modifiedContent);

  const ops = a.length <= MAX_LINES_PER_SIDE && b.length <= MAX_LINES_PER_SIDE
    ? computeLcsDiff(a, b)
    : fastPathDiff(a, b);

  const linesAdded = ops.filter((o) => o.type === 'add').length;
  const linesRemoved = ops.filter((o) => o.type === 'del').length;

  const hunks = buildHunks(ops, contextLines);

  if (hunks.length === 0) {
    return { diff: '', linesAdded: 0, linesRemoved: 0, isEmpty: true };
  }

  const header = `--- a/${filePath}\n+++ b/${filePath}`;
  const body = hunks.map(formatHunk).join('\n');
  const diff = `${header}\n${body}\n`;

  return { diff, linesAdded, linesRemoved, isEmpty: false };
}

// ─── LCS-based diff ───────────────────────────────────────────────────────────

function computeLcsDiff(a: string[], b: string[]): DiffOp[] {
  const m = a.length;
  const n = b.length;

  // Build DP table.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff ops.
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'eq', origLine: i, modLine: j, text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', modLine: j, text: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'del', origLine: i, text: a[i - 1] });
      i--;
    }
  }

  return ops;
}

/** Fast-path for large files: all original lines removed, all modified lines added. */
function fastPathDiff(a: string[], b: string[]): DiffOp[] {
  return [
    ...a.map((text, i) => ({ type: 'del' as const, origLine: i + 1, text })),
    ...b.map((text, j) => ({ type: 'add' as const, modLine: j + 1, text })),
  ];
}

// ─── Hunk builder ─────────────────────────────────────────────────────────────

interface Hunk {
  origStart: number;
  origCount: number;
  modStart: number;
  modCount: number;
  lines: string[];
}

function buildHunks(ops: DiffOp[], contextLines: number): Hunk[] {
  if (ops.length === 0) return [];

  // Find indices of changed ops.
  const changedIndices = ops
    .map((op, i) => ({ op, i }))
    .filter(({ op }) => op.type !== 'eq')
    .map(({ i }) => i);

  if (changedIndices.length === 0) return [];

  const hunks: Hunk[] = [];

  // Group changed indices into ranges with context.
  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = Math.max(0, changedIndices[0] - contextLines);
  let rangeEnd = Math.min(ops.length - 1, changedIndices[0] + contextLines);

  for (let k = 1; k < changedIndices.length; k++) {
    const nextStart = Math.max(0, changedIndices[k] - contextLines);
    if (nextStart <= rangeEnd + 1) {
      rangeEnd = Math.min(ops.length - 1, changedIndices[k] + contextLines);
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = nextStart;
      rangeEnd = Math.min(ops.length - 1, changedIndices[k] + contextLines);
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });

  for (const range of ranges) {
    const slicedOps = ops.slice(range.start, range.end + 1);

    // Determine orig and mod start/count.
    const origLines: number[] = [];
    const modLines: number[] = [];

    for (const op of slicedOps) {
      if (op.type === 'eq') {
        origLines.push(op.origLine);
        modLines.push(op.modLine);
      } else if (op.type === 'del') {
        origLines.push(op.origLine);
      } else {
        modLines.push(op.modLine);
      }
    }

    const origStart = origLines.length > 0 ? Math.min(...origLines) : 1;
    const modStart = modLines.length > 0 ? Math.min(...modLines) : 1;

    const lines: string[] = [];
    for (const op of slicedOps) {
      if (op.type === 'eq') lines.push(` ${op.text}`);
      else if (op.type === 'del') lines.push(`-${op.text}`);
      else lines.push(`+${op.text}`);
    }

    hunks.push({
      origStart,
      origCount: origLines.length,
      modStart,
      modCount: modLines.length,
      lines,
    });
  }

  return hunks;
}

function formatHunk(hunk: Hunk): string {
  const header = `@@ -${hunk.origStart},${hunk.origCount} +${hunk.modStart},${hunk.modCount} @@`;
  return [header, ...hunk.lines].join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split content into lines, preserving empty trailing lines.
 * Strips the trailing newline added by most editors to avoid a spurious
 * empty "add" at the end of the diff.
 */
function splitLines(content: string): string[] {
  const normalised = content.endsWith('\n') ? content.slice(0, -1) : content;
  return normalised.split('\n');
}
