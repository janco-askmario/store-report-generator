"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutTemplate, Loader2, Trash2 } from "lucide-react";
import type { BlockTemplate, BlockTemplateKind } from "@/lib/block-templates";
import { Icon } from "./Icon";
import { cx } from "./ui";

/**
 * Insert a prewritten Good/Bad block.
 *
 * Templates are copied, not linked — the inserted block is an ordinary block, so
 * tailoring it to the store afterwards affects only that report.
 */
export function BlockTemplatePicker({
  kind,
  templates,
  disabled,
  loading,
  onOpen,
  onInsert,
  onDelete,
}: {
  kind: BlockTemplateKind;
  templates: BlockTemplate[];
  disabled?: boolean;
  loading?: boolean;
  onOpen: () => void;
  onInsert: (template: BlockTemplate) => void;
  onDelete: (template: BlockTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const mine = templates.filter((t) => t.kind === kind);
  const builtin = mine.filter((t) => t.builtin);
  const saved = mine.filter((t) => !t.builtin);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = !open;
          setOpen(next);
          // Refresh on open rather than on a timer: a teammate may have saved
          // one since this report was opened.
          if (next) onOpen();
        }}
        className={cx(
          "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-[14px] font-semibold transition",
          disabled
            ? "cursor-not-allowed border-black/10 text-ink-soft/50"
            : "border-brand-200 text-brand-700 hover:bg-brand-50",
        )}
      >
        <LayoutTemplate size={17} />
        Insert from template
      </button>

      {open && !disabled && (
        <div className="animate-pop absolute left-0 right-0 top-[52px] z-30 rounded-2xl border border-black/10 bg-white p-2 shadow-xl shadow-black/10">
          <div className="max-h-80 overflow-y-auto">
            {loading && mine.length === 0 && (
              <div className="grid place-items-center py-6">
                <Loader2 size={18} className="animate-spin text-ink-soft" />
              </div>
            )}

            {!loading && mine.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-ink-soft">
                No templates for this section yet.
              </p>
            )}

            {builtin.length > 0 && (
              <Group label="Standard">
                {builtin.map((t) => (
                  <Row
                    key={t.id}
                    template={t}
                    onInsert={() => {
                      onInsert(t);
                      setOpen(false);
                    }}
                  />
                ))}
              </Group>
            )}

            {saved.length > 0 && (
              <Group label="Saved by your team">
                {saved.map((t) => (
                  <Row
                    key={t.id}
                    template={t}
                    onInsert={() => {
                      onInsert(t);
                      setOpen(false);
                    }}
                    onDelete={() => onDelete(t)}
                  />
                ))}
              </Group>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  template,
  onInsert,
  onDelete,
}: {
  template: BlockTemplate;
  onInsert: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group/row flex items-start gap-1">
      <button
        type="button"
        onClick={onInsert}
        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-brand-50"
      >
        <span className="mt-0.5 shrink-0 text-brand-600">
          <Icon name={template.icon} size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink">
            {template.title || "Untitled template"}
          </span>
          <span className="line-clamp-2 block text-[12px] leading-snug text-ink-soft">
            {template.paragraph}
          </span>
        </span>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete this template for everyone"
          aria-label={`Delete template ${template.title}`}
          className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-soft opacity-0 transition hover:bg-red-50 hover:text-danger focus:opacity-100 group-hover/row:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
