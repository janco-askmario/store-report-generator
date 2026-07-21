import type { Block, ReportData, StoredReport } from "./types";
import { createInitialData, uid } from "./defaults";

const KEY = "askmario-reports-v2";
const OLD_KEY = "askmario-store-report-v1"; // single-draft from the first version

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

/* --------------------------------------------------------------- storage */

function read(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as StoredReport[];
      if (Array.isArray(list)) {
        return list.map((r) => ({ ...r, data: normalizeData(r.data) }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function write(list: StoredReport[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** One-time migration of the original single autosaved draft into the library. */
function migrateOldDraft(list: StoredReport[]): StoredReport[] {
  if (typeof window === "undefined" || list.length > 0) return list;
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (raw) {
      const data = normalizeData(JSON.parse(raw));
      const now = Date.now();
      const migrated: StoredReport = { id: uid(), createdAt: now, updatedAt: now, data };
      const next = [migrated];
      write(next);
      localStorage.removeItem(OLD_KEY);
      return next;
    }
  } catch {
    /* ignore */
  }
  return list;
}

/* ------------------------------------------------------------------- API */

export function listReports(): StoredReport[] {
  const list = migrateOldDraft(read());
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getReport(id: string): StoredReport | undefined {
  return read().find((r) => r.id === id);
}

export function createReport(data?: ReportData): StoredReport {
  const now = Date.now();
  const report: StoredReport = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    data: data ? normalizeData(data) : createInitialData(),
  };
  write([report, ...read()]);
  return report;
}

/** Insert or update a report; returns false if storage failed (e.g. quota). */
export function saveReport(report: StoredReport): boolean {
  const list = read();
  const idx = list.findIndex((r) => r.id === report.id);
  const next = { ...report, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  return write(list);
}

export function duplicateReport(id: string): StoredReport | undefined {
  const source = getReport(id);
  if (!source) return undefined;
  const now = Date.now();
  const copy: StoredReport = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    data: {
      ...structuredClone(source.data),
      storeName: source.data.storeName
        ? `${source.data.storeName} (copy)`
        : "Untitled (copy)",
    },
  };
  write([copy, ...read()]);
  return copy;
}

export function deleteReport(id: string): void {
  write(read().filter((r) => r.id !== id));
}
