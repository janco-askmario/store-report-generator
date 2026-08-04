"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * The rendered report, page after page, in a scroll container we own.
 *
 * The obvious implementation — point an `<iframe>` at a blob URL and let the
 * browser's PDF viewer do the work — cannot be made live. Every re-render is a
 * new blob, a new `src`, and a viewer that reloads to the top of page one. You
 * would be editing a paragraph on page three and watching the preview jump
 * back to the cover on every pause in typing.
 *
 * So the pages are drawn onto canvases here instead. That buys the two things
 * a live preview actually needs: the scroll position survives an update, and
 * the previous pages stay on screen until the new ones are ready to replace
 * them in a single swap, so there is no flash of empty panel.
 *
 * pdf.js is a large dependency and its worker has to survive the bundler, so
 * there is a fallback: if anything in that path fails, the panel quietly
 * reverts to the iframe viewer. Live updates get worse — the reload-to-top is
 * back — but the preview still works, which beats an empty panel.
 */

type Mode = "canvas" | "iframe";

/**
 * Rendering wider than this wastes memory: three pages at 900px × 2× device
 * pixels is already ~55MB of bitmap, and the canvases are stretched to the
 * panel width by CSS anyway.
 */
const MAX_RENDER_WIDTH = 900;
/** Width changes smaller than this don't justify re-rendering three pages. */
const WIDTH_STEP = 24;
/** Let a drag-resize settle before re-rendering at the new width. */
const RESIZE_QUIET_MS = 220;

let pdfjs: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfjs() {
  pdfjs ??= import("pdfjs-dist").then((lib) => {
    /* Resolved through the bundler rather than hard-coded: webpack emits the
       worker as an asset and rewrites this to its hashed URL. Without a worker
       pdf.js parses on the main thread, which would freeze the editor for the
       length of every render — the one thing this panel must not do. */
    lib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return lib;
  });
  return pdfjs;
}

/** Cancelling a page render rejects its promise; that is not a failure. */
function isCancellation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: string }).name === "RenderingCancelledException"
  );
}

export function PdfPreview({ blob }: { blob: Blob | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("canvas");
  /** Something is on screen — until then the spinner covers the panel. */
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [url, setUrl] = useState<string | null>(null);

  /* ---------------------------------------------------------------- width */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      // The pages host, not the scroller: it is the content box, so the
      // padding and any scrollbar are already out of the number.
      const inner = pagesRef.current?.clientWidth ?? 0;
      const next = Math.round(inner / WIDTH_STEP) * WIDTH_STEP;
      setWidth((current) => (next > 0 ? next : current));
    };

    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_QUIET_MS);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  /* ----------------------------------------------------------------- swap */
  const swap = useCallback((canvases: HTMLCanvasElement[]) => {
    const host = pagesRef.current;
    const scroller = scrollRef.current;
    if (!host || !scroller) return;

    /* Where we were, as a fraction of the scrollable run. The report is always
       three pages of the same size, so the fraction lands within a few pixels
       of the same paragraph — which is the whole point of drawing the pages
       ourselves. */
    const room = scroller.scrollHeight - scroller.clientHeight;
    const ratio = room > 0 ? scroller.scrollTop / room : 0;

    host.replaceChildren(...canvases);
    setReady(true);

    requestAnimationFrame(() => {
      const next = scroller.scrollHeight - scroller.clientHeight;
      if (next > 0) scroller.scrollTop = ratio * next;
    });
  }, []);

  /* --------------------------------------------------------------- render */
  useEffect(() => {
    if (mode !== "canvas" || !blob || width === 0) return;

    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    void (async () => {
      try {
        const lib = await loadPdfjs();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;

        const doc = await lib.getDocument({ data: bytes }).promise;
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const target = Math.min(width, MAX_RENDER_WIDTH) * dpr;
          const canvases: HTMLCanvasElement[] = [];

          for (let n = 1; n <= doc.numPages; n++) {
            if (cancelled) return;
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: target / base.width });

            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            canvas.className =
              "block h-auto w-full rounded-lg bg-white shadow-sm ring-1 ring-black/5";
            canvas.setAttribute("role", "img");
            canvas.setAttribute("aria-label", `Page ${n} of ${doc.numPages}`);

            const render = page.render({ canvas, viewport });
            task = render;
            await render.promise;
            task = null;
            canvases.push(canvas);
          }

          if (!cancelled) swap(canvases);
        } finally {
          void doc.destroy();
        }
      } catch (e) {
        if (cancelled || isCancellation(e)) return;
        console.error("PDF preview fell back to the browser viewer", e);
        setMode("iframe");
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [blob, width, mode, swap]);

  /* ------------------------------------------------------------- fallback */
  useEffect(() => {
    if (mode !== "iframe" || !blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    /* Revoked once the next document has replaced it. An iframe that already
       painted this one keeps its content; only a reload would need the URL. */
    return () => URL.revokeObjectURL(next);
  }, [blob, mode]);

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-y-auto bg-[#ecebf2] p-3"
    >
      {mode === "iframe" ? (
        url && (
          <iframe
            key={url}
            src={url}
            title="Report preview"
            onLoad={() => setReady(true)}
            className="h-full min-h-[60vh] w-full rounded-lg border-0 bg-white"
          />
        )
      ) : (
        <div ref={pagesRef} className="flex flex-col gap-3" />
      )}

      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-ink-soft shadow-sm">
            <Loader2 size={14} className="animate-spin" />
            Building the first page…
          </span>
        </div>
      )}
    </div>
  );
}
