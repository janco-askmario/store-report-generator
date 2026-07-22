"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type * as Y from "yjs";
import { TEXT_ORIGIN, applyTextDiff, mapCaret } from "@/lib/collab/text";
import { Label, cx, inputBase } from "./ui";

/**
 * Binds an `<input>` or `<textarea>` to a `Y.Text` so two people can type in it
 * at once.
 *
 * The whole point of the CRDT is undone by a naive controlled input, so this
 * does two things carefully:
 *
 *   - keystrokes become minimal edits (`applyTextDiff`), not whole-string
 *     replacements, so concurrent edits interleave instead of clobbering;
 *   - the caret is remapped across incoming remote edits, so a colleague typing
 *     above you does not drag your cursor out of position mid-word.
 */
function useYText<T extends HTMLInputElement | HTMLTextAreaElement>(
  text: Y.Text,
) {
  const ref = useRef<T | null>(null);
  const [value, setValue] = useState(() => text.toString());
  const caret = useRef<[number, number] | null>(null);

  useEffect(() => {
    const observer = (event: Y.YTextEvent, tx: Y.Transaction) => {
      const el = ref.current;
      // Only remote edits need caret repair — for local typing the browser has
      // already put the caret where the user expects it.
      if (el && tx.origin !== TEXT_ORIGIN && document.activeElement === el) {
        caret.current = [
          mapCaret(el.selectionStart ?? 0, event.delta),
          mapCaret(el.selectionEnd ?? 0, event.delta),
        ];
      }
      setValue(text.toString());
    };

    text.observe(observer);
    // The document may have loaded between the initial state and this effect.
    setValue(text.toString());
    return () => text.unobserve(observer);
  }, [text]);

  // Must run before paint, otherwise the caret visibly jumps.
  useLayoutEffect(() => {
    const next = caret.current;
    caret.current = null;
    if (next && ref.current) ref.current.setSelectionRange(next[0], next[1]);
  });

  const onChange = useCallback(
    (next: string) => applyTextDiff(text, next),
    [text],
  );

  return { value, onChange, ref };
}

/* --------------------------------------------------------------- primitives */

export function CollabInput({
  text,
  className,
  placeholder,
  id,
}: {
  text: Y.Text;
  className?: string;
  placeholder?: string;
  id?: string;
}) {
  const { value, onChange, ref } = useYText<HTMLInputElement>(text);
  return (
    <input
      id={id}
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? inputBase}
    />
  );
}

export function CollabTextArea({
  text,
  className,
  placeholder,
  rows = 4,
  id,
}: {
  text: Y.Text;
  className?: string;
  placeholder?: string;
  rows?: number;
  id?: string;
}) {
  const { value, onChange, ref } = useYText<HTMLTextAreaElement>(text);
  return (
    <textarea
      id={id}
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? cx(inputBase, "resize-y leading-relaxed")}
    />
  );
}

/* ------------------------------------------------- labelled field wrappers */

/** Collaborative counterpart to `TextArea` in ui.tsx. */
export function CollabTextAreaField({
  label,
  hint,
  id,
  text,
  placeholder,
  rows = 4,
}: {
  label?: string;
  hint?: string;
  id?: string;
  text: Y.Text;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <CollabTextArea id={id} text={text} placeholder={placeholder} rows={rows} />
    </div>
  );
}
