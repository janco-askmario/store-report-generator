"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportData } from "@/lib/types";

/**
 * The report, rendered to a PDF and kept in step with the editor.
 *
 * Two rules make this usable rather than a heater:
 *
 *   • Nothing renders while the preview panel is shut. The panel is the only
 *     consumer, so a closed panel means no work at all — `enabled` is the
 *     switch, not a `hidden` class over a running render loop.
 *   • Renders wait for a pause in typing. A three-page document with embedded
 *     fonts takes a few hundred milliseconds; started per keystroke, the
 *     renders would queue up behind each other and the preview would fall
 *     further behind the longer you typed.
 *
 * The previous document is deliberately kept while the next one builds. The
 * alternative — clearing it and showing a spinner — makes the panel flash to
 * empty every time you stop typing, which is exactly when you are looking at it.
 */

/** How long typing has to stop before the preview re-renders. */
const QUIET_MS = 700;

export interface PdfPreviewState {
  /** The last document that rendered; stays on screen while the next builds. */
  blob: Blob | null;
  /** A render is in flight. */
  rendering: boolean;
  /** Set when the last render threw; the stale `blob` (if any) is still shown. */
  error: string | null;
  /** Re-render now, whatever the state — the retry behind a failed render. */
  refresh: () => void;
}

export function usePdfPreview(
  data: ReportData | null,
  enabled: boolean,
): PdfPreviewState {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Bumped after every render so the scheduling effect below re-runs and can
     notice that the document moved on while it was busy. */
  const [tick, setTick] = useState(0);

  /** The snapshot the in-flight (or last) render was started from. */
  const rendered = useRef<ReportData | null>(null);
  const busy = useRef(false);
  const hasBlob = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const run = useCallback(async (source: ReportData) => {
    // A render already running is not interrupted — react-pdf offers no way to
    // cancel one, and the `tick` below brings us straight back here with the
    // newer snapshot the moment it finishes.
    if (busy.current) return;
    busy.current = true;
    rendered.current = source;
    setRendering(true);
    try {
      const { renderReportPdf } = await import("@/components/pdf/render");
      const next = await renderReportPdf(source);
      if (!live.current) return;
      hasBlob.current = true;
      setBlob(next);
      setError(null);
    } catch (e) {
      console.error(e);
      if (live.current) {
        setError("Could not build the preview from the report as it stands.");
      }
    } finally {
      busy.current = false;
      if (live.current) {
        setRendering(false);
        setTick((t) => t + 1);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !data) return;
    // Identity is the whole comparison: the shared document hands out a fresh
    // snapshot object exactly when something in the report changed.
    if (rendered.current === data) return;

    // Opening the panel should show something immediately; only edits made
    // while it is already open wait for the typing to stop.
    const delay = hasBlob.current ? QUIET_MS : 0;
    const timer = setTimeout(() => void run(data), delay);
    return () => clearTimeout(timer);
  }, [data, enabled, run, tick]);

  const refresh = useCallback(() => {
    rendered.current = null;
    setTick((t) => t + 1);
  }, []);

  return { blob, rendering, error, refresh };
}
