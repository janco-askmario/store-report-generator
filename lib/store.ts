import type { Block, ReportData, StoredReport } from "./types";
import { createInitialData, uid } from "./defaults";
import { createClient } from "./supabase/client";

const TABLE = "reports";

/* --------------------------------------------------------- normalisation */

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/\d+(\.\d+)?/); // pull a number out of "10/10" etc.
    if (m) {
      const n = parseFloat(m[0]);
      // legacy "x/10" → 0..5 stars
      return Math.max(0, Math.min(5, Math.round((n > 5 ? n / 2 : n) * 2) / 2));
    }
  }
  return 0;
}

function normalizeBlock(b: Partial<Block>): Block {
  return {
    id: b.id || uid(),
    icon: b.icon || "diamond",
    title: b.title || "",
    paragraph: b.paragraph || "",
    rating: toNumber(b.rating),
    highlighted: Boolean(b.highlighted),
  };
}

/** Merge stored data onto fresh defaults so older/partial records stay valid. */
export function normalizeData(raw: Partial<ReportData> | undefined): ReportData {
  const base = createInitialData();
  const d = { ...base, ...(raw || {}) } as ReportData;
  d.analytics = { ...base.analytics, ...(raw?.analytics || {}) };
  d.socials = { ...base.socials, ...(raw?.socials || {}) };
  d.referrers = { ...base.referrers, ...(raw?.referrers || {}) };
  d.page3 = { ...base.page3, ...(raw?.page3 || {}) };
  d.goodBlocks = (raw?.goodBlocks || []).map(normalizeBlock);
  d.badBlocks = (raw?.badBlocks || []).map(normalizeBlock);
  return d;
}

/* --------------------------------------------------------------- mapping */

interface ReportRow {
  id: string;
  created_at: string;
  updated_at: string;
  data: Partial<ReportData> | null;
}

/** Postgres timestamptz → epoch ms, which is what `StoredReport` carries. */
function fromRow(row: ReportRow): StoredReport {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    data: normalizeData(row.data ?? undefined),
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}

/* ------------------------------------------------------------------- API */

export async function listReports(): Promise<StoredReport[]> {
  const { data, error } = await createClient()
    .from(TABLE)
    .select("id, created_at, updated_at, data")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listReports failed:", error.message);
    return [];
  }
  return (data as ReportRow[]).map(fromRow);
}

export async function getReport(id: string): Promise<StoredReport | undefined> {
  const { data, error } = await createClient()
    .from(TABLE)
    .select("id, created_at, updated_at, data")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getReport failed:", error.message);
    return undefined;
  }
  return data ? fromRow(data as ReportRow) : undefined;
}

export async function createReport(
  data?: ReportData,
): Promise<StoredReport | undefined> {
  const { data: row, error } = await createClient()
    .from(TABLE)
    .insert({
      data: data ? normalizeData(data) : createInitialData(),
      created_by: await currentUserId(),
    })
    .select("id, created_at, updated_at, data")
    .single();

  if (error) {
    console.error("createReport failed:", error.message);
    return undefined;
  }
  return fromRow(row as ReportRow);
}

/** Update a report's body; returns false if the write failed. */
export async function saveReportData(
  id: string,
  data: ReportData,
): Promise<boolean> {
  const { error } = await createClient().from(TABLE).update({ data }).eq("id", id);

  if (error) {
    console.error("saveReport failed:", error.message);
    return false;
  }
  return true;
}

export async function saveReport(report: StoredReport): Promise<boolean> {
  return saveReportData(report.id, report.data);
}

export async function duplicateReport(
  id: string,
): Promise<StoredReport | undefined> {
  const source = await getReport(id);
  if (!source) return undefined;

  return createReport({
    ...structuredClone(source.data),
    storeName: source.data.storeName
      ? `${source.data.storeName} (copy)`
      : "Untitled (copy)",
  });
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await createClient().from(TABLE).delete().eq("id", id);
  if (error) console.error("deleteReport failed:", error.message);
}

/* ------------------------------------------------- legacy localStorage import */

const LEGACY_KEY = "askmario-reports-v2";
const LEGACY_KEY_V1 = "askmario-store-report-v1"; // single draft, first version

/**
 * Reports still sitting in this browser from before the Supabase move.
 * Read-only — nothing writes to localStorage any more.
 */
export function readLegacyReports(): StoredReport[] {
  if (typeof window === "undefined") return [];
  const out: StoredReport[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const r of list as StoredReport[]) {
          out.push({ ...r, data: normalizeData(r.data) });
        }
      }
    }
    if (out.length === 0) {
      const old = localStorage.getItem(LEGACY_KEY_V1);
      if (old) {
        const now = Date.now();
        out.push({
          id: uid(),
          createdAt: now,
          updatedAt: now,
          data: normalizeData(JSON.parse(old)),
        });
      }
    }
  } catch {
    /* ignore malformed leftovers */
  }
  return out;
}

/** Upload leftover local reports to Supabase. Returns how many landed. */
export async function importLegacyReports(): Promise<number> {
  const legacy = readLegacyReports();
  if (legacy.length === 0) return 0;

  const userId = await currentUserId();
  const { data, error } = await createClient()
    .from(TABLE)
    .insert(
      legacy.map((r) => ({ data: r.data, created_by: userId })),
    )
    .select("id");

  if (error) {
    console.error("importLegacyReports failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/** Drop the local copies once they are safely in Supabase. */
export function clearLegacyReports(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(LEGACY_KEY_V1);
}
