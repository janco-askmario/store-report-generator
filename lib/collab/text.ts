import type * as Y from "yjs";

/**
 * Marks a text edit as originating from this browser's own keystrokes, so the
 * binding knows not to fight the browser over caret position.
 */
export const TEXT_ORIGIN = "local-text";

type DeltaOp = { insert?: unknown; delete?: number; retain?: number };

/**
 * Write `next` into `text` as the smallest edit that gets there.
 *
 * A textarea hands back the entire new string on every keystroke. Replacing the
 * `Y.Text` wholesale would encode that as "delete everything, insert
 * everything", which is a valid CRDT edit and a catastrophic one: a colleague's
 * concurrent insert would land inside a range this client just deleted, and
 * their sentence would vanish. Typing one character has to be recorded as
 * inserting one character.
 */
export function applyTextDiff(
  text: Y.Text,
  next: string,
  origin: unknown = TEXT_ORIGIN,
): void {
  const prev = text.toString();
  if (prev === next) return;

  const max = Math.min(prev.length, next.length);

  let start = 0;
  while (start < max && prev[start] === next[start]) start++;

  let end = 0;
  while (
    end < max - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++;
  }

  const removed = prev.length - start - end;
  const inserted = next.slice(start, next.length - end);

  const run = () => {
    if (removed > 0) text.delete(start, removed);
    if (inserted.length > 0) text.insert(start, inserted);
  };

  // Both halves must land in one transaction, or peers briefly observe the
  // deletion without the replacement.
  if (text.doc) text.doc.transact(run, origin);
  else run();
}

/**
 * Move a caret offset across a remote edit.
 *
 * Without this, a colleague typing earlier in the same paragraph would shunt
 * your cursor backwards mid-sentence: React re-renders with the longer string
 * and the browser leaves the caret at its old numeric offset, which is now
 * pointing at different characters.
 *
 * Edits at or after the caret leave it alone; edits before it shift it by the
 * length they added or removed.
 */
export function mapCaret(pos: number, delta: DeltaOp[]): number {
  let index = 0;
  let out = pos;

  for (const op of delta) {
    if (op.retain != null) {
      index += op.retain;
    } else if (op.insert != null) {
      const len = typeof op.insert === "string" ? op.insert.length : 1;
      if (index < out) out += len;
      index += len;
    } else if (op.delete != null) {
      if (index < out) out -= Math.min(op.delete, out - index);
    }
  }

  return Math.max(0, out);
}
