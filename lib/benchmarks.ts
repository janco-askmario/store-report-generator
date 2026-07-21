/**
 * Rule-of-thumb benchmarks that grade the key ecommerce metrics and produce a
 * short verdict + colour. Used to colour-code the dashboard and to auto-draft
 * the Page-3 metric notes in the PDF.
 */

export type Level = "poor" | "ok" | "good" | "great" | "none";

export interface Verdict {
  level: Level;
  label: string; // short tag: Poor / Fair / Healthy / Excellent
  color: string; // hex
  blurb: string; // one-liner
}

const C = {
  red: "#e5484d",
  orange: "#f5a524",
  leaf: "#94c147",
  leafDk: "#5b7a2c",
  grey: "#9b93ad",
};

const NONE: Verdict = { level: "none", label: "—", color: C.grey, blurb: "Add data to grade this metric." };

const LABEL: Record<Exclude<Level, "none">, { label: string; color: string }> = {
  poor: { label: "Poor", color: C.red },
  ok: { label: "Fair", color: C.orange },
  good: { label: "Healthy", color: C.leaf },
  great: { label: "Excellent", color: C.leafDk },
};

function make(level: Exclude<Level, "none">, blurb: string): Verdict {
  return { level, ...LABEL[level], blurb };
}

/** Conversion rate (%). Healthy ≥ 1%. */
export function conversionVerdict(pct: number | null): Verdict {
  if (pct == null) return NONE;
  if (pct < 1) return make("poor", "Below the 1% healthy benchmark — converting poorly.");
  if (pct < 2) return make("ok", "Just above the 1% benchmark — room to grow.");
  if (pct < 3.5) return make("good", "A healthy conversion rate above 1%.");
  return make("great", "A standout conversion rate — well above average.");
}

/** Add-to-cart → purchase (%). Target 30–35%. */
export function addToCartVerdict(pct: number | null): Verdict {
  if (pct == null) return NONE;
  if (pct < 20) return make("poor", "Well below the 30–35% target — heavy checkout friction.");
  if (pct < 30) return make("ok", "Below the 30–35% target — checkout could be smoother.");
  if (pct <= 40) return make("good", "On target — cart-to-checkout is converting well.");
  return make("great", "Excellent — shoppers who add to cart reliably check out.");
}

/** AOV vs the typical online spend benchmark. */
export function aovVerdict(aov: number | null, benchmark: number | null): Verdict {
  if (aov == null || !benchmark) return NONE;
  const r = aov / benchmark;
  if (r < 0.8) return make("poor", "Below the typical online spend — basket size needs work.");
  if (r < 1) return make("ok", "Around the typical online spend.");
  if (r < 2) return make("good", "Above the typical online spend — solid basket size.");
  return make("great", `About ${r.toFixed(1)}× the typical online spend — excellent!`);
}

/** Fulfillment rate (%). */
export function fulfillmentVerdict(pct: number | null): Verdict {
  if (pct == null) return NONE;
  if (pct < 85) return make("poor", "A lot of orders are unfulfilled.");
  if (pct < 95) return make("ok", "Most orders fulfilled — a few outstanding.");
  return make("great", "Orders are being fulfilled reliably.");
}
