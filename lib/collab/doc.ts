import * as Y from "yjs";
import type { Block, Page3Notes, ReportData } from "@/lib/types";
import { normalizeData } from "@/lib/store";

/**
 * The Yjs shape of a report.
 *
 * The rule for what becomes a `Y.Text` and what stays a plain value: a field is
 * a `Y.Text` when it is worth merging two people's *characters*, and a plain
 * value when the only sane resolution is "one of these two wins".
 *
 *   Y.Text — the prose. Paragraphs, notes, the action plan, block titles and
 *            bodies. Two people typing in one of these interleave properly.
 *   plain  — dates, currency, the numeric analytics fields, the logo, toggles,
 *            star ratings. Character-merging "1000" and "1200" into "12000" is
 *            not a merge, it is corruption. Last write wins is correct here.
 *
 * Block lists are `Y.Array` of `Y.Map` rather than arrays of plain objects, so
 * that a block added by one person and a block added by another both survive,
 * and so that editing a block's text does not rewrite the whole list.
 *
 * Accessors come in two flavours and the distinction matters: `ensure*` creates
 * the node if it is missing and therefore *writes to the document*, while
 * `peek*` returns undefined. Read paths must use `peek*` — `docToReportData`
 * runs on every render, and if reading could write, every render would produce
 * an update to broadcast and persist.
 */

export type BlockKind = "good" | "bad";
export type ProseField = "goodCustom" | "foodForThought" | "actionPlan";

const ROOT = "report";

export const SEED_ORIGIN = "seed";

/** Plain (non-merged) scalar fields at the top level of a report. */
const SCALARS = [
  "logo",
  "storeName",
  "storeUrl",
  "startDate",
  "reportDate",
  "currency",
] as const;

const PROSE: readonly ProseField[] = [
  "goodCustom",
  "foodForThought",
  "actionPlan",
];

const PAGE3: readonly (keyof Page3Notes)[] = [
  "conversionNote",
  "aovNote",
  "addToCartNote",
];

const ANALYTICS_KEYS = [
  "conversionRate",
  "grossSales",
  "ordersMade",
  "ordersFulfilled",
  "averageOrderValue",
  "bestSellingProduct",
  "mobileSessions",
  "desktopSessions",
  "addedToCart",
  "aovBenchmark",
] as const;

const LINK_KEYS = ["facebook", "instagram", "tiktok"] as const;

/* ------------------------------------------------------- accessors (write) */

export function reportMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(ROOT);
}

function ensureMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) return existing;
  const m = new Y.Map<unknown>();
  parent.set(key, m);
  return m;
}

function ensureText(parent: Y.Map<unknown>, key: string): Y.Text {
  const existing = parent.get(key);
  if (existing instanceof Y.Text) return existing;
  const t = new Y.Text();
  parent.set(key, t);
  return t;
}

function ensureArray(
  parent: Y.Map<unknown>,
  key: string,
): Y.Array<Y.Map<unknown>> {
  const existing = parent.get(key);
  if (existing instanceof Y.Array) return existing as Y.Array<Y.Map<unknown>>;
  const a = new Y.Array<Y.Map<unknown>>();
  parent.set(key, a);
  return a;
}

/* -------------------------------------------------------- accessors (read) */

function peekMap(
  parent: Y.Map<unknown> | undefined,
  key: string,
): Y.Map<unknown> | undefined {
  const v = parent?.get(key);
  return v instanceof Y.Map ? v : undefined;
}

function peekArray(
  parent: Y.Map<unknown> | undefined,
  key: string,
): Y.Array<Y.Map<unknown>> | undefined {
  const v = parent?.get(key);
  return v instanceof Y.Array ? (v as Y.Array<Y.Map<unknown>>) : undefined;
}

/** Any node → its string value. Missing, wrong-typed and `Y.Text` all handled. */
function str(v: unknown): string {
  if (v instanceof Y.Text) return v.toString();
  return typeof v === "string" ? v : "";
}

/* ---------------------------------------------------------- named accessors */

export function listKey(kind: BlockKind): "goodBlocks" | "badBlocks" {
  return kind === "good" ? "goodBlocks" : "badBlocks";
}

export function blocksArray(
  doc: Y.Doc,
  kind: BlockKind,
): Y.Array<Y.Map<unknown>> {
  return ensureArray(reportMap(doc), listKey(kind));
}

export function findBlock(
  doc: Y.Doc,
  kind: BlockKind,
  id: string,
): Y.Map<unknown> | undefined {
  for (const b of blocksArray(doc, kind)) {
    if (b.get("id") === id) return b;
  }
  return undefined;
}

/** The `Y.Text` behind a block's title or paragraph. */
export function blockText(
  block: Y.Map<unknown>,
  field: "title" | "paragraph",
): Y.Text {
  return ensureText(block, field);
}

export function proseText(doc: Y.Doc, field: ProseField): Y.Text {
  return ensureText(reportMap(doc), field);
}

export function page3Text(doc: Y.Doc, field: keyof Page3Notes): Y.Text {
  return ensureText(ensureMap(reportMap(doc), "page3"), field);
}

export function analyticsMap(doc: Y.Doc): Y.Map<unknown> {
  return ensureMap(reportMap(doc), "analytics");
}

export function socialsMap(doc: Y.Doc): Y.Map<unknown> {
  return ensureMap(reportMap(doc), "socials");
}

export function referrersMap(doc: Y.Doc): Y.Map<unknown> {
  return ensureMap(reportMap(doc), "referrers");
}

export function customSocials(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return ensureArray(socialsMap(doc), "custom");
}

/* ---------------------------------------------------------------- ordering */

/**
 * Position is a sortable number on each block rather than the block's index in
 * the `Y.Array`.
 *
 * Yjs types cannot be moved — repositioning a block inside the array means
 * deleting it and inserting a copy, and any text a colleague typed into that
 * block in the meantime lands on the deleted copy and disappears. Dragging one
 * block should not be able to eat someone else's sentence.
 *
 * With an order field a drag writes a single number and touches nothing else.
 * Two people dragging at once resolve last-write-wins on that number, which is
 * the right outcome — one of the two arrangements, never a mangled list.
 */
function orderOf(m: Y.Map<unknown>, fallback: number): number {
  const v = m.get("order");
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export interface BlockEntry {
  map: Y.Map<unknown>;
  order: number;
}

/** Blocks in display order. Ties break on id so every client agrees. */
export function sortedBlocks(
  arr: Y.Array<Y.Map<unknown>> | undefined,
): BlockEntry[] {
  if (!arr) return [];
  const entries: BlockEntry[] = [];
  arr.forEach((m, i) => entries.push({ map: m, order: orderOf(m, i) }));
  return entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.map.get("id")).localeCompare(String(b.map.get("id")));
  });
}

export function nextOrder(arr: Y.Array<Y.Map<unknown>>): number {
  const entries = sortedBlocks(arr);
  return entries.length === 0 ? 0 : entries[entries.length - 1].order + 1;
}

/**
 * Repeated drops between the same two blocks halve the gap each time. Floats run
 * out of room after ~50 of those, so once neighbours get too close the whole
 * list is rewritten as 0, 1, 2… — rare, cheap, and itself a normal mergeable
 * edit.
 */
const MIN_GAP = 1e-6;

export function moveBlock(
  arr: Y.Array<Y.Map<unknown>>,
  from: number,
  to: number,
): void {
  const entries = sortedBlocks(arr);
  if (from === to || from < 0 || from >= entries.length) return;
  if (to < 0 || to >= entries.length) return;

  const moved = entries[from];
  const rest = entries.filter((_, i) => i !== from);
  const before = to > 0 ? rest[to - 1]?.order : undefined;
  const after = rest[to]?.order;

  let next: number;
  if (before === undefined && after === undefined) next = 0;
  else if (before === undefined) next = (after as number) - 1;
  else if (after === undefined) next = before + 1;
  else next = (before + after) / 2;

  moved.map.set("order", next);

  if (before !== undefined && after !== undefined && after - before < MIN_GAP) {
    sortedBlocks(arr).forEach((e, i) => e.map.set("order", i));
  }
}

/* ------------------------------------------------------------------- build */

function newBlock(block: Block, order: number): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("id", block.id);
  m.set("icon", block.icon);
  m.set("rating", block.rating);
  m.set("highlighted", block.highlighted);
  m.set("order", order);
  // Y.Text has to be created detached and then attached; assigning the string
  // directly would make it a plain value and silently lose character merging.
  const title = new Y.Text();
  title.insert(0, block.title);
  m.set("title", title);
  const paragraph = new Y.Text();
  paragraph.insert(0, block.paragraph);
  m.set("paragraph", paragraph);
  return m;
}

export function createBlockMap(block: Block, order: number): Y.Map<unknown> {
  return newBlock(block, order);
}

export function createCustomSocial(id: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("id", id);
  m.set("label", "");
  m.set("value", "");
  return m;
}

/**
 * Populate an empty doc from the plain `reports.data` blob.
 *
 * Only ever called once per report, guarded by a unique index in the database —
 * running it twice concurrently would give the report two of every block, since
 * Yjs merges concurrent inserts rather than deduplicating them.
 */
export function seedDoc(
  doc: Y.Doc,
  data: ReportData,
  origin: unknown = SEED_ORIGIN,
): void {
  doc.transact(() => {
    const root = reportMap(doc);

    for (const key of SCALARS) root.set(key, data[key]);
    for (const field of PROSE) ensureText(root, field).insert(0, data[field]);

    const analytics = ensureMap(root, "analytics");
    for (const key of ANALYTICS_KEYS) analytics.set(key, data.analytics[key]);

    const socials = ensureMap(root, "socials");
    socials.set("enabled", data.socials.enabled);
    for (const key of LINK_KEYS) socials.set(key, data.socials[key]);
    ensureArray(socials, "custom").push(
      data.socials.custom.map((c) => {
        const m = new Y.Map<unknown>();
        m.set("id", c.id);
        m.set("label", c.label);
        m.set("value", c.value);
        return m;
      }),
    );

    const referrers = ensureMap(root, "referrers");
    referrers.set("enabled", data.referrers.enabled);
    for (const key of LINK_KEYS) referrers.set(key, data.referrers[key]);

    const page3 = ensureMap(root, "page3");
    for (const field of PAGE3) {
      ensureText(page3, field).insert(0, data.page3[field]);
    }

    // Array position is the initial order.
    ensureArray(root, "goodBlocks").push(
      data.goodBlocks.map((b, i) => newBlock(b, i)),
    );
    ensureArray(root, "badBlocks").push(
      data.badBlocks.map((b, i) => newBlock(b, i)),
    );
  }, origin);
}

/**
 * Replace the entire document — what "Clear" in the editor does.
 *
 * Deliberately not `SEED_ORIGIN`: the provider treats seed transactions as
 * already-durable (bootstrap writes those itself), so clearing under that origin
 * would wipe the report on screen for everyone and never reach the database.
 */
export function resetDoc(doc: Y.Doc, data: ReportData): void {
  doc.transact(() => {
    const root = reportMap(doc);
    for (const key of Array.from(root.keys())) root.delete(key);
    // Nested transaction; Yjs folds it into this one, so peers never observe
    // the empty document in between.
    seedDoc(doc, data, null);
  }, null);
}

/* ---------------------------------------------------------------- snapshot */

function readBlocks(arr: Y.Array<Y.Map<unknown>> | undefined): Block[] {
  return sortedBlocks(arr).map(({ map: m }) => ({
    id: str(m.get("id")),
    icon: str(m.get("icon")),
    title: str(m.get("title")),
    paragraph: str(m.get("paragraph")),
    rating: typeof m.get("rating") === "number" ? (m.get("rating") as number) : 0,
    highlighted: Boolean(m.get("highlighted")),
  }));
}

/**
 * Flatten the document into the plain `ReportData` the editor renders and the
 * PDF renderer consumes. Strictly read-only (see the accessor note at the top),
 * and passed through `normalizeData` so a document missing a newer field still
 * produces a complete object.
 */
export function docToReportData(doc: Y.Doc): ReportData {
  const root = reportMap(doc);
  const analytics = peekMap(root, "analytics");
  const socials = peekMap(root, "socials");
  const referrers = peekMap(root, "referrers");
  const page3 = peekMap(root, "page3");

  const logo = root.get("logo");

  return normalizeData({
    logo: typeof logo === "string" ? logo : null,
    storeName: str(root.get("storeName")),
    storeUrl: str(root.get("storeUrl")),
    startDate: str(root.get("startDate")),
    reportDate: str(root.get("reportDate")),
    currency: str(root.get("currency")),

    analytics: Object.fromEntries(
      ANALYTICS_KEYS.map((k) => [k, str(analytics?.get(k))]),
    ) as ReportData["analytics"],

    socials: {
      enabled: Boolean(socials?.get("enabled")),
      ...(Object.fromEntries(
        LINK_KEYS.map((k) => [k, str(socials?.get(k))]),
      ) as Record<(typeof LINK_KEYS)[number], string>),
      // No ordering field here: custom socials are only ever appended and
      // removed, never dragged, so array order is the display order.
      custom: (peekArray(socials, "custom")?.toArray() ?? []).map((m) => ({
        id: str(m.get("id")),
        label: str(m.get("label")),
        value: str(m.get("value")),
      })),
    },

    referrers: {
      enabled: Boolean(referrers?.get("enabled")),
      ...(Object.fromEntries(
        LINK_KEYS.map((k) => [k, str(referrers?.get(k))]),
      ) as Record<(typeof LINK_KEYS)[number], string>),
    },

    goodBlocks: readBlocks(peekArray(root, "goodBlocks")),
    badBlocks: readBlocks(peekArray(root, "badBlocks")),

    goodCustom: str(root.get("goodCustom")),
    foodForThought: str(root.get("foodForThought")),
    actionPlan: str(root.get("actionPlan")),
    page3: Object.fromEntries(
      PAGE3.map((k) => [k, str(page3?.get(k))]),
    ) as Page3Notes,
  });
}

/** True when nothing has ever been written — i.e. the doc still needs seeding. */
export function isEmptyDoc(doc: Y.Doc): boolean {
  return reportMap(doc).size === 0;
}
