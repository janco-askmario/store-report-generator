"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import type { ReportData } from "@/lib/types";
import { reportFileName } from "@/components/pdf/render";
import { usePdfPreview } from "@/lib/usePdfPreview";
import { PdfPreview } from "@/components/PdfPreview";
import { cx } from "@/components/ui";

/**
 * The live PDF preview, as a column of the editor rather than a tab of its own.
 *
 * Built to the same shape as the team drawer (`components/TeamSidebar.tsx`) and
 * for the same reason: open, it takes real width and the editor moves over to
 * make room, so you can type in the form and watch the page it produces at the
 * same time. Below `xl` there is no width to give away and it goes back to
 * floating over the editor with a backdrop.
 *
 * Unlike the team drawer it is resizable, because how much of the screen a
 * preview deserves depends entirely on what you are doing — nudging a paragraph
 * wants a wide preview, filling in the analytics wants a narrow one. The width
 * is remembered per browser.
 *
 * It starts closed. The team panel is an ambient thing worth defaulting on; a
 * preview is something you ask for, and rendering the PDF on every pause in
 * typing is not work to do for someone who never opened the panel.
 */

const STORAGE_KEY = "preview-panel";
const WIDTH_KEY = "preview-panel-width";
/** Below this there is not enough screen to give a column away. */
const WIDE = "(min-width: 1280px)";

const DEFAULT_WIDTH = 460;
/** Narrower than this and the page renders too small to read anything on. */
const MIN_WIDTH = 340;
const MAX_WIDTH = 920;
/** Never squeeze the editor below this, however hard the handle is dragged. */
const MIN_EDITOR_WIDTH = 480;
const KEY_STEP = 24;

interface PreviewSidebarContext {
  open: boolean;
  toggle: () => void;
  /** Drives the spinner in the toggle while a render is in flight. */
  rendering: boolean;
}

const Ctx = createContext<PreviewSidebarContext | null>(null);

/**
 * Hand the keyboard back to the button that reopens the panel.
 *
 * There is more than one of them — the header carries one and the mobile action
 * row another — and which exists on screen is a media query away, so they are
 * found by attribute and the first one actually laid out wins. Focusing a
 * `hidden` button would drop the keyboard at the top of the document instead.
 */
function focusToggle() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "[data-preview-toggle]",
  );
  for (const button of buttons) {
    if (button.offsetParent !== null) {
      button.focus();
      return;
    }
  }
}

/* The stored width and open state are applied before the browser paints, so a
   returning user never watches the layout jump. `useLayoutEffect` warns on the
   server, where there is no layout to measure — hence the swap. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function clampWidth(px: number): number {
  const room =
    typeof window === "undefined"
      ? MAX_WIDTH
      : Math.max(MIN_WIDTH, window.innerWidth - MIN_EDITOR_WIDTH);
  return Math.round(Math.min(Math.max(px, MIN_WIDTH), Math.min(MAX_WIDTH, room)));
}

export function PreviewSidebar({
  data,
  children,
}: {
  data: ReportData | null;
  children: ReactNode;
}) {
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  /** Suppresses the slide animation while the stored state is applied. */
  const [ready, setReady] = useState(false);

  const closeRef = useRef<HTMLButtonElement | null>(null);
  const wideRef = useRef(false);
  wideRef.current = wide;

  const preview = usePdfPreview(data, open);

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(WIDE);
    setWide(mq.matches);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setOpen(mq.matches && stored === "open");
      const storedWidth = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setWidth(clampWidth(storedWidth));
      }
    } catch {
      // Private browsing with storage blocked: fall through to the defaults.
    }

    const onChange = (e: MediaQueryListEvent) => {
      setWide(e.matches);
      // Crossing down from a pushing panel to an overlay would turn a column of
      // the layout into a sheet over the form. Close it; reopening is one click.
      if (!e.matches) setOpen(false);
      else setWidth((w) => clampWidth(w));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const apply = useCallback((next: boolean) => {
    setOpen(next);
    // Closing takes the panel out of the tab order (`inert` below), so anything
    // focused inside it — the close button that was just clicked — would take
    // the keyboard nowhere. Hand it back to the control that reopens it.
    if (!next) focusToggle();
    /* Only the pushing layout is a preference worth remembering: dismissing the
       overlay on a phone is a one-off gesture, and letting it stick would greet
       the same person with a closed panel on their desktop tomorrow. */
    if (wideRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
      } catch {
        // Nothing to do — the panel still works, it just won't be remembered.
      }
    }
  }, []);

  const overlay = open && !wide;

  // Modal manners, but only while it is actually behaving like a modal.
  useEffect(() => {
    if (!overlay) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") apply(false);
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      focusToggle();
    };
  }, [overlay, apply]);

  /* --------------------------------------------------------------- resize */
  const commitWidth = useCallback((px: number) => {
    const next = clampWidth(px);
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // Same as above: the drag still works, it just won't be remembered.
    }
  }, []);

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wide) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    // Live during the drag; the canvases stretch with CSS and only re-render at
    // the new resolution once the pointer settles.
    setWidth(clampWidth(window.innerWidth - e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    commitWidth(width);
  };

  const onHandleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      commitWidth(width + KEY_STEP);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commitWidth(width - KEY_STEP);
    }
  };

  const context = useMemo<PreviewSidebarContext>(
    () => ({
      open,
      toggle: () => apply(!open),
      rendering: preview.rendering,
    }),
    [open, apply, preview.rendering],
  );

  const vars = { "--preview-w": `${width}px` } as CSSProperties;

  return (
    <Ctx.Provider value={context}>
      <div className="flex min-h-screen w-full" style={vars}>
        {/* min-w-0 is what lets this column actually shrink — without it the
            editor's grid sets a floor and the panel would push the page sideways
            into a horizontal scrollbar instead of re-wrapping. */}
        <div className="min-w-0 flex-1">{children}</div>

        {overlay && (
          <div
            onClick={() => apply(false)}
            className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]"
            aria-hidden
          />
        )}

        <aside
          aria-label="Report preview"
          // Only a sheet over the page is a dialog. As a column of the layout it
          // is just a region, and calling it a dialog would tell a screen reader
          // the rest of the page is inert when it is not.
          role={overlay ? "dialog" : "complementary"}
          aria-modal={overlay || undefined}
          /* A closed panel is 0px wide with its content clipped, which hides it
             from eyes but not from a screen reader or the Tab key. `inert` is
             what actually takes it out of the page while it is shut. */
          inert={!open}
          className={cx(
            "shrink-0 overflow-hidden bg-white",
            ready &&
              !dragging &&
              "transition-[width,transform] duration-200 ease-out",
            wide
              ? cx(
                  "sticky top-0 h-screen border-l border-black/5",
                  open ? "w-[var(--preview-w)]" : "w-0",
                )
              : cx(
                  "fixed inset-y-0 right-0 z-50 shadow-2xl",
                  "w-[min(calc(100vw_-_1.5rem),var(--preview-w))]",
                  open ? "translate-x-0" : "translate-x-full",
                ),
          )}
        >
          {/* Fixed inner width while pushing: without it the pages would
              re-layout on every frame of the slide, which reads as a shudder. */}
          <div
            className={cx(
              "relative flex h-full flex-col",
              wide ? "w-[var(--preview-w)]" : "w-full",
            )}
          >
            {wide && open && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize the preview panel"
                tabIndex={0}
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onHandleKey}
                className={cx(
                  "absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none transition",
                  "hover:bg-brand-300/60 focus-visible:bg-brand-400 focus-visible:outline-none",
                  dragging && "bg-brand-400",
                )}
              />
            )}

            <PreviewBody
              preview={preview}
              fileName={reportFileName(data?.storeName ?? "")}
              onClose={() => apply(false)}
              closeRef={closeRef}
            />
          </div>
        </aside>
      </div>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------- panel */
function PreviewBody({
  preview,
  fileName,
  onClose,
  closeRef,
}: {
  preview: ReturnType<typeof usePdfPreview>;
  fileName: string;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { blob, rendering, error, refresh } = preview;

  /* Both of these hand the file to something outside the app, so they get a
     throwaway URL rather than one the next render would revoke underneath a
     tab the reader is still looking at. */
  const withUrl = (use: (url: string) => void) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    use(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const openInTab = () => withUrl((url) => window.open(url, "_blank"));

  const download = () =>
    withUrl((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 px-3 py-3 pl-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Eye size={15} />
          </span>
          <div className="min-w-0 leading-tight">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              Preview
            </h2>
            <p className="truncate text-[11px] text-ink-soft/80">
              {/* Announced, because the visible change — three pages quietly
                  redrawing — is not something a screen reader can see. */}
              <span aria-live="polite">
                {rendering ? "Updating…" : "Updates as you type"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {rendering && (
            <Loader2
              size={14}
              className="mr-0.5 animate-spin text-brand-600"
              aria-hidden
            />
          )}
          <IconButton
            label="Open the PDF in a new tab"
            onClick={openInTab}
            disabled={!blob}
          >
            <ExternalLink size={15} />
          </IconButton>
          <IconButton
            label="Download the PDF"
            onClick={download}
            disabled={!blob}
          >
            <Download size={15} />
          </IconButton>
          <IconButton ref={closeRef} label="Close the preview" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-black/5 bg-warn/[0.08] px-4 py-2.5 text-[11px] leading-snug text-ink-soft">
          <AlertTriangle size={13} className="mt-px shrink-0 text-warn" />
          <span className="min-w-0">
            {error}{" "}
            {blob
              ? "You are looking at the last version that built."
              : "Nothing has been lost — the report itself is fine."}{" "}
            <button
              type="button"
              onClick={refresh}
              className="font-semibold text-brand-600 underline underline-offset-2"
            >
              Try again
            </button>
          </span>
        </div>
      )}

      <PdfPreview blob={blob} />
    </>
  );
}

function IconButton({
  ref,
  label,
  onClick,
  disabled,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/[0.04] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ toggle */

/** The Preview button. Lives in the editor's header and its mobile action row. */
export function PreviewSidebarToggle({
  variant = "compact",
}: {
  variant?: "compact" | "block";
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;

  const { open, toggle, rendering } = ctx;
  const block = variant === "block";

  return (
    <button
      data-preview-toggle
      type="button"
      onClick={toggle}
      aria-expanded={open}
      title={open ? "Hide the preview" : "Preview the PDF as you edit"}
      className={cx(
        "items-center gap-1.5 rounded-xl border font-semibold transition disabled:opacity-60",
        open
          ? "border-brand-300 bg-brand-100 text-brand-700"
          : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
        block
          ? "flex flex-1 justify-center px-4 py-3 text-[14px]"
          : "hidden h-10 px-3 text-[13px] sm:flex md:px-3.5",
      )}
    >
      {rendering ? (
        <Loader2 size={block ? 16 : 15} className="animate-spin" />
      ) : (
        <Eye size={block ? 16 : 15} />
      )}
      <span className={block ? undefined : "hidden md:inline"}>Preview</span>
    </button>
  );
}
