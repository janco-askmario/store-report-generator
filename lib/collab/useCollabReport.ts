"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type * as Y from "yjs";
import type { Block, ReportData } from "@/lib/types";
import { createBlock, maxBlocks, uid } from "@/lib/defaults";
import { applyTextDiff } from "./text";
import {
  type BlockKind,
  analyticsMap,
  blockText,
  blocksArray,
  createBlockMap,
  createCustomSocial,
  customSocials,
  docToReportData,
  findBlock,
  moveBlock,
  nextOrder,
  page3Text,
  proseText,
  referrersMap,
  reportMap,
  resetDoc,
  socialsMap,
} from "./doc";
import { type CollabStatus, ReportCollabProvider } from "./provider";

const PROSE_FIELDS = ["goodCustom", "foodForThought", "actionPlan"] as const;
type ProseField = (typeof PROSE_FIELDS)[number];

function isProse(key: string): key is ProseField {
  return (PROSE_FIELDS as readonly string[]).includes(key);
}

export interface CollabReport {
  status: CollabStatus;
  /** Plain snapshot for rendering; null until the document has loaded. */
  data: ReportData | null;
  /** Needed to hand `Y.Text` handles to the collaborative inputs. */
  doc: Y.Doc | null;

  patch: (p: Partial<ReportData>) => void;
  patchAnalytics: (p: Partial<ReportData["analytics"]>) => void;
  patchSocials: (p: Partial<ReportData["socials"]>) => void;
  patchReferrers: (p: Partial<ReportData["referrers"]>) => void;
  patchPage3: (p: Partial<ReportData["page3"]>) => void;

  /** `preset` prefills the new block — used when inserting a template. */
  addBlock: (kind: BlockKind, preset?: Partial<Block>) => void;
  updateBlock: (kind: BlockKind, id: string, p: Partial<Block>) => void;
  removeBlock: (kind: BlockKind, id: string) => void;
  reorderBlock: (kind: BlockKind, from: number, to: number) => void;

  addCustomSocial: () => void;
  updateCustomSocial: (
    id: string,
    p: Partial<{ label: string; value: string }>,
  ) => void;
  removeCustomSocial: (id: string) => void;

  resetAll: (data: ReportData) => void;
}

/**
 * Connects the editor to the shared document.
 *
 * The mutator names and signatures deliberately mirror the local-state helpers
 * this replaced, so the editor's markup did not have to be rewritten around a
 * new data-flow — only the prose inputs changed, because those are the ones that
 * have to bind to a `Y.Text` to merge properly.
 */
export function useCollabReport(id: string): CollabReport {
  const [provider, setProvider] = useState<ReportCollabProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");
  // Documents mutate in place, so a counter is what tells React to re-snapshot.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;

    const p = new ReportCollabProvider({
      reportId: id,
      onStatus: (s) => live && setStatus(s),
      onChange: () => live && setRevision((r) => r + 1),
    });

    setStatus("connecting");
    setProvider(p);
    void p.connect();

    return () => {
      live = false;
      // Cleared before destroy so nothing re-renders against a destroyed doc.
      setProvider(null);
      p.destroy();
    };
  }, [id]);

  const doc = provider?.doc ?? null;

  const data = useMemo(
    () => (doc && status === "ready" ? docToReportData(doc) : null),
    // `revision` is the dependency that matters: the doc identity is stable
    // while its contents change underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, status, revision],
  );

  /* ------------------------------------------------------------- mutators */

  const patch = useCallback(
    (p: Partial<ReportData>) => {
      if (!doc) return;
      doc.transact(() => {
        const root = reportMap(doc);
        for (const [key, value] of Object.entries(p)) {
          if (isProse(key)) {
            applyTextDiff(proseText(doc, key), String(value ?? ""));
          } else {
            root.set(key, value);
          }
        }
      });
    },
    [doc],
  );

  const patchAnalytics = useCallback(
    (p: Partial<ReportData["analytics"]>) => {
      if (!doc) return;
      const m = analyticsMap(doc);
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) m.set(key, value);
      });
    },
    [doc],
  );

  const patchSocials = useCallback(
    (p: Partial<ReportData["socials"]>) => {
      if (!doc) return;
      const m = socialsMap(doc);
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) {
          // The custom list has its own mutators; assigning a plain array here
          // would replace the shared Y.Array with a dead copy.
          if (key === "custom") continue;
          m.set(key, value);
        }
      });
    },
    [doc],
  );

  const patchReferrers = useCallback(
    (p: Partial<ReportData["referrers"]>) => {
      if (!doc) return;
      const m = referrersMap(doc);
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) m.set(key, value);
      });
    },
    [doc],
  );

  const patchPage3 = useCallback(
    (p: Partial<ReportData["page3"]>) => {
      if (!doc) return;
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) {
          applyTextDiff(
            page3Text(doc, key as keyof ReportData["page3"]),
            String(value ?? ""),
          );
        }
      });
    },
    [doc],
  );

  const addBlock = useCallback(
    (kind: BlockKind, preset?: Partial<Block>) => {
      if (!doc) return;
      const arr = blocksArray(doc, kind);
      if (arr.length >= maxBlocks(kind)) return;
      const block = createBlock({
        icon: kind === "good" ? "star" : "alert-triangle",
        ...preset,
      });
      // Goes through createBlockMap like any other block, so the template's text
      // lands in Y.Text and is immediately co-editable.
      arr.push([createBlockMap(block, nextOrder(arr))]);
    },
    [doc],
  );

  const updateBlock = useCallback(
    (kind: BlockKind, id: string, p: Partial<Block>) => {
      if (!doc) return;
      const m = findBlock(doc, kind, id);
      if (!m) return;
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) {
          if (key === "title" || key === "paragraph") {
            applyTextDiff(blockText(m, key), String(value ?? ""));
          } else {
            m.set(key, value);
          }
        }
      });
    },
    [doc],
  );

  const removeBlock = useCallback(
    (kind: BlockKind, id: string) => {
      if (!doc) return;
      const arr = blocksArray(doc, kind);
      const index = arr.toArray().findIndex((m) => m.get("id") === id);
      if (index >= 0) arr.delete(index, 1);
    },
    [doc],
  );

  const reorderBlock = useCallback(
    (kind: BlockKind, from: number, to: number) => {
      if (!doc) return;
      moveBlock(blocksArray(doc, kind), from, to);
    },
    [doc],
  );

  const addCustomSocial = useCallback(() => {
    if (!doc) return;
    customSocials(doc).push([createCustomSocial(uid())]);
  }, [doc]);

  const updateCustomSocial = useCallback(
    (id: string, p: Partial<{ label: string; value: string }>) => {
      if (!doc) return;
      const arr = customSocials(doc);
      const m = arr.toArray().find((c) => c.get("id") === id);
      if (!m) return;
      doc.transact(() => {
        for (const [key, value] of Object.entries(p)) m.set(key, value);
      });
    },
    [doc],
  );

  const removeCustomSocial = useCallback(
    (id: string) => {
      if (!doc) return;
      const arr = customSocials(doc);
      const index = arr.toArray().findIndex((c) => c.get("id") === id);
      if (index >= 0) arr.delete(index, 1);
    },
    [doc],
  );

  const resetAll = useCallback(
    (next: ReportData) => {
      if (!doc) return;
      resetDoc(doc, next);
    },
    [doc],
  );

  return {
    status,
    data,
    doc,
    patch,
    patchAnalytics,
    patchSocials,
    patchReferrers,
    patchPage3,
    addBlock,
    updateBlock,
    removeBlock,
    reorderBlock,
    addCustomSocial,
    updateCustomSocial,
    removeCustomSocial,
    resetAll,
  };
}
