import type { ReportData, StoredReport } from "./types";
import { createBlock, createInitialData } from "./defaults";
import { BUILTIN_TEMPLATES } from "./block-templates";
import { createClient } from "./supabase/client";

/**
 * Dev test data — the dashboard logo easter egg.
 *
 * Ten clicks on the header logo fill the library with `DEV_SEED_COUNT`
 * throwaway reports; ten more delete them again. It exists to exercise the
 * parts of the dashboard that only misbehave at volume — pagination, the sort
 * orders, search, the health-score bands — without hand-building rows.
 *
 * The rows are ordinary reports: same `reports` table, same `data` jsonb shape
 * the editor writes. Nothing here is privileged, so it works against whatever
 * Supabase project the app is pointed at — including production. That is
 * deliberate (the volume bugs live on the deployed app), which is why the
 * clicks have to be a deliberate streak and why the seeds are labelled loudly.
 */

const TABLE = "reports";

export const DEV_SEED_COUNT = 200;
/** Clicks on the logo that trigger a seed / a clear. */
export const DEV_SEED_CLICKS = 10;

/**
 * How a seeded report is recognised later.
 *
 * The marker is a `storeName` prefix rather than an extra flag on `ReportData`
 * because the collab document round-trips a fixed set of fields
 * (`SCALARS`/`PROSE`/... in lib/collab/doc.ts). An unknown flag would be
 * dropped the first time someone opened a seeded report in the editor, and the
 * row would then be unfindable. `storeName` survives, and it also makes the
 * test data obvious on the cards.
 */
export const DEV_SEED_PREFIX = "[DEV TEST]";

export function isDevSeed(report: StoredReport): boolean {
  return report.data.storeName.startsWith(DEV_SEED_PREFIX);
}

/* --------------------------------------------------------------- generation */

/**
 * Seeded PRNG (mulberry32). Deterministic on purpose: two runs produce the same
 * 200 stores, so a layout or sorting bug spotted on one seed can be looked at
 * again on the next.
 */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIXES = [
  "Northside", "Urban", "Coastal", "Copper", "Wildflower", "Harbour", "Sable",
  "Golden", "Bright", "Little", "Wander", "Iron", "Velvet", "Summit", "Cedar",
  "Salt & Stone", "Kudu", "Protea", "Marula", "Baobab",
];

const SUFFIXES = [
  "Bikes", "Pantry", "Threads", "Coffee Co", "Outfitters", "Supply Co",
  "Ceramics", "Botanicals", "Optics", "Denim", "Toys", "Hardware", "Books",
  "Skincare", "Cycles", "Pet Co", "Bakery", "Audio", "Sneakers", "Home",
];

const TLDS = [".co.za", ".com", ".store", ".shop"];
const CURRENCIES = ["R", "R", "R", "$", "£", "€"];

const PRODUCTS = [
  "Trail Runner 29er", "Cold Brew Concentrate 1L", "Merino Crew Neck",
  "Stoneware Mug Set", "Blue Light Frames", "Slim Fit Raw Denim",
  "Wooden Train Set", "Cordless Impact Driver", "Vitamin C Serum",
  "Studio Monitor Pair", "Canvas Weekender", "Rechargeable Head Torch",
];

const GOOD_TEMPLATES = BUILTIN_TEMPLATES.filter((t) => t.kind === "good");
const BAD_TEMPLATES = BUILTIN_TEMPLATES.filter((t) => t.kind === "bad");

const DAY = 86_400_000;

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)];
}

/** Integer in [min, max]. */
function int(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** `n` distinct entries from `list`, order shuffled. */
function sample<T>(rnd: () => number, list: readonly T[], n: number): T[] {
  const pool = list.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

function money(rnd: () => number, min: number, max: number): string {
  return (min + rnd() * (max - min)).toFixed(2);
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * One throwaway report.
 *
 * `index` is only used to keep the names unique and stably ordered — the rest
 * is drawn from `rnd`, so scores spread across every health band and the sort
 * orders have something to actually sort. Every 13th report is left unrated so
 * the "—" score chip and the unrated-sinks-to-the-bottom sort both get covered.
 */
function buildDevReport(rnd: () => number, index: number, reportAt: number): ReportData {
  const base = createInitialData();
  const label = `${pick(rnd, PREFIXES)} ${pick(rnd, SUFFIXES)}`;
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const unrated = index % 13 === 0;

  const ordersMade = int(rnd, 12, 900);
  const addedToCart = ordersMade * int(rnd, 3, 12);
  const mobileSessions = int(rnd, 400, 40_000);

  /*
   * Star draws are pulled toward the store's `quality`, not uniform: good
   * ratings rise with it and bad severities fall with it. Uniform draws average
   * out to ~50 on every report and the library ends up entirely C/D — this way
   * a seed spans the whole A–F range of the health bands.
   */
  const quality = rnd();
  const rate = (skew: number) =>
    unrated
      ? 0
      : Math.max(1, Math.min(5, Math.round(1 + skew * 4 + (rnd() * 1.4 - 0.7))));

  return {
    ...base,
    logo: null, // 200 base64 logos would be megabytes of jsonb for no gain
    storeName: `${DEV_SEED_PREFIX} ${label} ${String(index + 1).padStart(3, "0")}`,
    storeUrl: rnd() < 0.9 ? `www.${slug}${pick(rnd, TLDS)}` : "",
    startDate: isoDate(reportAt - 30 * DAY),
    reportDate: isoDate(reportAt),
    currency: pick(rnd, CURRENCIES),
    analytics: {
      ...base.analytics,
      conversionRate: (0.1 + rnd() * 4.4).toFixed(2),
      grossSales: money(rnd, 8_000, 4_000_000),
      ordersMade: String(ordersMade),
      ordersFulfilled: String(ordersMade - int(rnd, 0, Math.min(20, ordersMade))),
      averageOrderValue: money(rnd, 180, 12_000),
      bestSellingProduct: pick(rnd, PRODUCTS),
      mobileSessions: String(mobileSessions),
      desktopSessions: String(Math.round(mobileSessions * (0.15 + rnd() * 2))),
      addedToCart: String(addedToCart),
    },
    goodBlocks: sample(rnd, GOOD_TEMPLATES, int(rnd, 1, GOOD_TEMPLATES.length)).map((t) =>
      createBlock({
        icon: t.icon,
        title: t.title,
        paragraph: t.paragraph,
        rating: rate(quality),
        highlighted: rnd() < 0.25,
      }),
    ),
    badBlocks: sample(rnd, BAD_TEMPLATES, int(rnd, 1, BAD_TEMPLATES.length)).map((t) =>
      createBlock({
        icon: t.icon,
        title: t.title,
        paragraph: t.paragraph,
        rating: rate(1 - quality),
        highlighted: rnd() < 0.3,
      }),
    ),
  };
}

interface DevRow {
  data: ReportData;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Timestamps are written explicitly rather than left to the column defaults, so
 * the reports spread over the last few months and "Recently updated" /
 * "Recently created" differ from each other. Safe to set: the `updated_at`
 * trigger on `public.reports` fires on UPDATE only.
 */
function buildDevRows(count: number, userId: string): DevRow[] {
  const rnd = rng(0x9e3779b9); // fixed seed — see rng()
  const now = Date.now();
  const rows: DevRow[] = [];

  for (let i = 0; i < count; i++) {
    const createdAt = now - int(rnd, 1, 120) * DAY - int(rnd, 0, DAY);
    const updatedAt = createdAt + Math.floor(rnd() * (now - createdAt));
    rows.push({
      data: buildDevReport(rnd, i, createdAt),
      created_by: userId,
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date(updatedAt).toISOString(),
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ seed/clear */

/** Rows per request. Keeps each insert well clear of any body-size limit. */
const INSERT_CHUNK = 25;
/** Ids per delete request, so the filter never builds an absurd URL. */
const DELETE_CHUNK = 50;

/**
 * Insert `DEV_SEED_COUNT` test reports. Returns how many landed — a partial
 * count means a chunk failed, and `deleteDevReports` will still find the rest.
 */
export async function seedDevReports(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  // The insert policy checks `auth.uid() = created_by`, so there is nothing to
  // do without a session.
  if (!userId) {
    console.error("seedDevReports failed: no signed-in user");
    return 0;
  }

  const rows = buildDevRows(DEV_SEED_COUNT, userId);
  let done = 0;

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { data, error } = await supabase.from(TABLE).insert(chunk).select("id");
    if (error) {
      console.error("seedDevReports failed:", error.message);
      break;
    }
    done += data?.length ?? chunk.length;
    onProgress?.(done, rows.length);
  }
  return done;
}

/**
 * Delete every seeded report.
 *
 * Seeds are looked up by their `storeName` prefix rather than from client state,
 * so this also clears seeds made in another tab or by a teammate. `knownIds` —
 * the seeds the caller can already see — is folded in as a floor: whatever the
 * server-side lookup returns, everything on screen goes.
 */
export async function deleteDevReports(
  knownIds: string[] = [],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const supabase = createClient();

  const found = new Set(knownIds);
  const { data, error } = await supabase
    .from(TABLE)
    .select("id")
    .like("data->>storeName", `${DEV_SEED_PREFIX}%`);

  if (error) console.error("deleteDevReports lookup failed:", error.message);
  for (const row of (data ?? []) as { id: string }[]) found.add(row.id);

  const ids = [...found];
  let done = 0;

  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    // report_updates cascades on delete, so the CRDT history of any seed
    // someone happened to open goes with it.
    const { error: delError } = await supabase.from(TABLE).delete().in("id", chunk);
    if (delError) {
      console.error("deleteDevReports failed:", delError.message);
      break;
    }
    done += chunk.length;
    onProgress?.(done, ids.length);
  }
  return done;
}
