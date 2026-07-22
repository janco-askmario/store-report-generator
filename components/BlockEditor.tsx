"use client";

import type { HTMLAttributes } from "react";
import { BookmarkPlus, Check, GripVertical, Trash2 } from "lucide-react";
import type * as Y from "yjs";
import type { Block } from "@/lib/types";
import { CollabInput, CollabTextArea } from "./CollabField";
import { IconPicker } from "./IconPicker";
import { StarRating } from "./StarRating";
import { cx } from "./ui";

type Kind = "good" | "bad";

const TONE = {
  good: {
    base: "#94c147",
    baseSoft: "rgba(148,193,71,0.45)",
    highlight: "#7948bf",
    highlightSoft: "rgba(121,72,191,0.45)",
    star: "#f5a524",
    ratingLabel: "Rating",
    checkLabel: "Standout — highlight in purple",
    checkHint: "A genuinely excellent thing about the store.",
  },
  bad: {
    base: "#e5484d",
    baseSoft: "rgba(229,72,77,0.45)",
    highlight: "#f5a524",
    highlightSoft: "rgba(245,165,36,0.5)",
    star: "#e5484d",
    ratingLabel: "Severity",
    checkLabel: "Not critical — mark as improvable (orange)",
    checkHint: "Worth doing, but not an urgent problem.",
  },
} as const;

export function BlockEditor({
  block,
  kind,
  index,
  titleText,
  paragraphText,
  onChange,
  onRemove,
  onSaveTemplate,
  dragHandleProps,
  isDragging,
}: {
  block: Block;
  kind: Kind;
  index: number;
  /* Text binds to the shared document directly so two people can type in the
     same block; the rest of the block (icon, rating, highlight) is last-write-
     wins through `onChange`, which is the right resolution for a single choice. */
  titleText: Y.Text;
  paragraphText: Y.Text;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onSaveTemplate?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}) {
  const tone = TONE[kind];
  const accent = block.highlighted ? tone.highlight : tone.base;
  const glow = block.highlighted ? tone.highlightSoft : tone.baseSoft;

  return (
    <div
      className={cx(
        "relative rounded-2xl border-2 bg-white p-4 transition-shadow",
        isDragging ? "shadow-xl" : "animate-pop",
      )}
      style={{ borderColor: accent, boxShadow: `0 8px 24px -18px ${glow}` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <button
            type="button"
            aria-label="Drag to reorder"
            {...dragHandleProps}
            className="flex cursor-grab touch-none items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] font-semibold text-ink-soft transition hover:bg-black/5 active:cursor-grabbing"
          >
            <GripVertical size={14} className="opacity-50" />#{index + 1}
          </button>
          <IconPicker
            value={block.icon}
            onChange={(icon) => onChange({ icon })}
            accent={accent}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <CollabInput
            text={titleText}
            placeholder={
              kind === "good"
                ? "What's great? e.g. Positive reviews on home page"
                : "What's the issue? e.g. Slow loading speed"
            }
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-ink-soft/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <CollabTextArea
            text={paragraphText}
            rows={3}
            placeholder="Short paragraph explaining it to the client…"
            className="w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-soft/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <StarRating
            value={block.rating}
            onChange={(rating) => onChange({ rating })}
            color={tone.star}
            label={tone.ratingLabel}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          {onSaveTemplate && (
            <button
              type="button"
              onClick={onSaveTemplate}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50 hover:text-brand-600"
              title="Save as a reusable template"
              aria-label="Save block as template"
            >
              <BookmarkPlus size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-red-50 hover:text-danger"
            title="Remove block"
            aria-label="Remove block"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Highlight checkbox */}
      <button
        type="button"
        onClick={() => onChange({ highlighted: !block.highlighted })}
        className={cx(
          "mt-3 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
          block.highlighted
            ? "border-transparent"
            : "border-black/10 hover:bg-black/[0.02]",
        )}
        style={
          block.highlighted
            ? { backgroundColor: `${accent}14`, borderColor: accent }
            : undefined
        }
      >
        <span
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition",
            !block.highlighted && "border-black/20",
          )}
          style={
            block.highlighted
              ? { backgroundColor: accent, borderColor: accent }
              : undefined
          }
        >
          {block.highlighted && (
            <Check size={13} strokeWidth={3.5} className="text-white" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-ink">
            {tone.checkLabel}
          </span>
          <span className="block text-[12px] text-ink-soft">
            {tone.checkHint}
          </span>
        </span>
      </button>
    </div>
  );
}
