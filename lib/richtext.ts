/**
 * The little formatting language behind the **B** / *I* / __U__ buttons.
 *
 * Formatting is stored as markers inside the same plain string the field has
 * always held, rather than as a separate rich document. That is deliberate:
 * every prose field is a `Y.Text` (see lib/collab/doc.ts), which is what lets
 * two people type in one paragraph at once and what undo is built on. A real
 * rich-text model would mean `Y.XmlFragment`, a migration of every saved
 * report, and a rewrite of the editor binding — markers keep all of that
 * working and still reach the PDF as genuine bold / italic / underline.
 *
 *   **bold**   __underline__   *italic*   and "- " at the start of a line
 *
 * Unclosed or empty markers are left alone and render as the literal
 * characters, so a paragraph that happens to contain "2 * 3" is safe.
 */

export interface Marks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface Run extends Marks {
  text: string;
}

export const BOLD = "**";
export const ITALIC = "*";
export const UNDERLINE = "__";
export const BOLD_ITALIC = "***";
export const BULLET = "- ";

// Longest first: "***" must win over "**", which must win over "*".
const DELIMS: { open: string; marks: (keyof Marks)[] }[] = [
  { open: BOLD_ITALIC, marks: ["bold", "italic"] },
  { open: BOLD, marks: ["bold"] },
  { open: UNDERLINE, marks: ["underline"] },
  { open: ITALIC, marks: ["italic"] },
];

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/**
 * A marker only counts when it hugs its text — "**bold**" opens, "2 * 3" does
 * not. Without this an arithmetic asterisk would open a run that swallows the
 * rest of the sentence looking for a partner.
 */
function opensAt(text: string, i: number, open: string): number {
  if (!text.startsWith(open, i)) return -1;
  if (isSpace(text[i + open.length])) return -1;
  let from = i + open.length;
  while (from < text.length) {
    const close = text.indexOf(open, from);
    if (close < 0) return -1;
    if (!isSpace(text[close - 1])) return close;
    from = close + open.length;
  }
  return -1;
}

function walk(text: string, active: Marks): Run[] {
  for (let i = 0; i < text.length; i++) {
    for (const d of DELIMS) {
      if (d.marks.every((m) => active[m])) continue; // already inside — literal
      const close = opensAt(text, i, d.open);
      if (close < 0) continue;
      const inner = text.slice(i + d.open.length, close);
      if (!inner) continue; // "****" — literal
      const next = { ...active };
      for (const m of d.marks) next[m] = true;
      return [
        ...(i > 0 ? walk(text.slice(0, i), active) : []),
        ...walk(inner, next),
        ...walk(text.slice(close + d.open.length), active),
      ];
    }
  }
  return text ? [{ text, ...active }] : [];
}

/** Split a string into styled runs. Always returns at least one run for text. */
export function parseInline(text: string): Run[] {
  return walk(text, {});
}

/** "- item" → "•  item", line by line. */
export function bulletize(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith(BULLET)) return line;
      const indent = line.slice(0, line.length - trimmed.length);
      return `${indent}•  ${trimmed.slice(BULLET.length)}`;
    })
    .join("\n");
}

/**
 * The text as it will actually appear, markers removed. Height estimation in
 * the PDF counts characters, and counting the markers would make every
 * formatted paragraph look longer than it renders.
 */
export function toPlain(text: string): string {
  return parseInline(bulletize(text))
    .map((r) => r.text)
    .join("");
}

/* ------------------------------------------------------------- editing ops */

export interface Selection {
  value: string;
  start: number;
  end: number;
}

export interface EditResult {
  value: string;
  start: number;
  end: number;
}

/**
 * Wrap (or unwrap) the selection in a marker.
 *
 * With nothing selected it inserts the pair and puts the caret between them,
 * so clicking **B** and typing works the way it does in any other editor.
 */
export function toggleMark(sel: Selection, open: string): EditResult {
  const { value, end } = sel;
  const len = open.length;

  // Whitespace has to stay outside the markers — "**word **" does not open a
  // mark (see opensAt), so double-clicking a word and hitting B must not wrap
  // the space the browser included in the selection.
  const raw = value.slice(sel.start, end);
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  const start = sel.start + lead;
  const stop = end - trail;
  const selected = value.slice(start, stop);
  const before = value.slice(0, start);
  const after = value.slice(stop);

  // Already wrapped, either inside the selection or just outside it.
  if (selected.startsWith(open) && selected.endsWith(open) && selected.length > len * 2) {
    const inner = selected.slice(len, -len);
    return { value: before + inner + after, start, end: start + inner.length };
  }
  if (before.endsWith(open) && after.startsWith(open)) {
    return {
      value: before.slice(0, -len) + selected + after.slice(len),
      start: start - len,
      end: stop - len,
    };
  }

  if (!selected) {
    return { value: `${before}${open}${open}${after}`, start: start + len, end: start + len };
  }
  return {
    value: `${before}${open}${selected}${open}${after}`,
    start: start + len,
    end: stop + len,
  };
}

/** Prefix every line the selection touches with "- ", or strip it if all have it. */
export function toggleBullets(sel: Selection): EditResult {
  const { value, start, end } = sel;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const allBulleted = lines.every((l) => !l.trim() || l.trimStart().startsWith(BULLET));

  const next = lines
    .map((l) => {
      if (!l.trim()) return l;
      if (allBulleted) return l.replace(/^(\s*)- /, "$1");
      return `${BULLET}${l}`;
    })
    .join("\n");

  const value2 = value.slice(0, lineStart) + next + value.slice(lineEnd);
  const delta = next.length - block.length;
  return { value: value2, start: lineStart, end: end + delta };
}
