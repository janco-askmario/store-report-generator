"use client";

import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Bold, Italic, List, Underline } from "lucide-react";
import type * as Y from "yjs";
import { TEXT_ORIGIN, applyTextDiff, mapCaret } from "@/lib/collab/text";
import {
  BOLD,
  ITALIC,
  UNDERLINE,
  type EditResult as RichEdit,
  type Selection as RichSelection,
  toggleBullets,
  toggleMark,
} from "@/lib/richtext";
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

  /**
   * Where the caret should land once the next value has rendered. The toolbar
   * needs this: after wrapping a selection in markers the browser would
   * otherwise drop the caret at the end of the field.
   */
  const select = useCallback((start: number, end: number) => {
    caret.current = [start, end];
  }, []);

  return { value, onChange, ref, select };
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

/* ------------------------------------------------------------- rich text */

/**
 * A textarea with **B** / *I* / __U__ and bullets, for the fields that reach
 * the client as formatted copy.
 *
 * The formatting lives in the text itself as markers (see lib/richtext.ts), so
 * this stays an ordinary `<textarea>` bound to a `Y.Text`: two people can still
 * type in the same paragraph, undo still works, and nothing about how reports
 * are stored changes. What you type is what the PDF renders.
 */
export function RichTextArea({
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
  const { value, onChange, ref, select } = useYText<HTMLTextAreaElement>(text);

  // Named after mount, like the undo tooltips in the header: the server cannot
  // know the platform, and guessing would mismatch the markup it sent.
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/mac|iphone|ipad|ipod/i.test(navigator.userAgent)) setMod("⌘");
  }, []);

  const apply = (op: (sel: RichSelection) => RichEdit) => {
    const el = ref.current;
    if (!el) return;
    const next = op({
      value,
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    });
    select(next.start, next.end);
    onChange(next.value);
    el.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const mark = key === "b" ? BOLD : key === "i" ? ITALIC : key === "u" ? UNDERLINE : null;
    if (!mark) return;
    e.preventDefault();
    apply((sel) => toggleMark(sel, mark));
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-0.5">
        <FormatButton
          label="Bold"
          hint={`Bold (${mod}B)`}
          onClick={() => apply((sel) => toggleMark(sel, BOLD))}
        >
          <Bold size={14} />
        </FormatButton>
        <FormatButton
          label="Italic"
          hint={`Italic (${mod}I)`}
          onClick={() => apply((sel) => toggleMark(sel, ITALIC))}
        >
          <Italic size={14} />
        </FormatButton>
        <FormatButton
          label="Underline"
          hint={`Underline (${mod}U)`}
          onClick={() => apply((sel) => toggleMark(sel, UNDERLINE))}
        >
          <Underline size={14} />
        </FormatButton>
        <FormatButton
          label="Bullet list"
          hint="Bullet list"
          onClick={() => apply(toggleBullets)}
        >
          <List size={14} />
        </FormatButton>
      </div>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={className ?? cx(inputBase, "resize-y leading-relaxed")}
      />
    </div>
  );
}

function FormatButton({
  children,
  label,
  hint,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Keep the caret where it is: focus must not leave the textarea, or the
      // selection being formatted is gone by the time the click lands.
      onMouseDown={(e) => e.preventDefault()}
      title={hint}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded text-ink-soft/70 transition hover:bg-black/[0.05] hover:text-ink active:scale-95"
    >
      {children}
    </button>
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
