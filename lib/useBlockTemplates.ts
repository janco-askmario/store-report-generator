"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BUILTIN_TEMPLATES,
  type BlockTemplate,
  deleteTemplate,
  listSavedTemplates,
  saveTemplate,
} from "./block-templates";

export interface BlockTemplates {
  /** Built-ins first, then the team's saved ones. */
  all: BlockTemplate[];
  loading: boolean;
  /** Re-read the saved set — called when the picker opens. */
  refresh: () => Promise<void>;
  save: (input: Omit<BlockTemplate, "id" | "builtin">) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

/**
 * The template list for the editor.
 *
 * Saved templates are not on a realtime channel: they change rarely, and a
 * refresh when the picker opens is both simpler and fresher than a subscription
 * that would sit idle for an entire audit.
 */
export function useBlockTemplates(): BlockTemplates {
  const [saved, setSaved] = useState<BlockTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listSavedTemplates();
    setSaved(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    let live = true;
    void listSavedTemplates().then((rows) => {
      if (!live) return;
      setSaved(rows);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const save = useCallback(
    async (input: Omit<BlockTemplate, "id" | "builtin">) => {
      const created = await saveTemplate(input);
      if (!created) return false;
      setSaved((s) => [created, ...s]);
      return true;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    // Optimistic: put it back if the delete is rejected.
    const previous = saved;
    setSaved((s) => s.filter((t) => t.id !== id));
    const ok = await deleteTemplate(id);
    if (!ok) setSaved(previous);
  }, [saved]);

  return { all: [...BUILTIN_TEMPLATES, ...saved], loading, refresh, save, remove };
}
