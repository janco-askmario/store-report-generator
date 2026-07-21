import type { ReportData } from "./types";

/** Parse a loosely-formatted numeric string ("R 12,500.50", "4.76%") to a number. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function hasValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== "";
}

/** Format an integer with thousands separators. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Format money using the report currency symbol. */
export function formatMoney(n: number, currency: string): string {
  const symbol = currency?.trim() || "";
  const body = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${symbol && !symbol.endsWith(" ") ? " " : ""}${body}`.trim();
}

export function formatPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export interface DerivedMetrics {
  totalSessions: number;
  socialSessions: number;
  mobilePct: number;
  desktopPct: number;
  fulfillmentRate: number | null;
  aovComputed: number | null; // gross / orders
  addToCartConversion: number | null; // orders / addedToCart * 100
  conversionRateComputed: number | null; // orders / totalSessions * 100
  daysLive: number | null;
}

export function computeMetrics(data: ReportData): DerivedMetrics {
  const a = data.analytics;
  const mobile = num(a.mobileSessions);
  const desktop = num(a.desktopSessions);

  let social = 0;
  if (data.socials.enabled) {
    social += num(data.socials.facebook);
    social += num(data.socials.instagram);
    social += num(data.socials.tiktok);
    for (const c of data.socials.custom) social += num(c.value);
  }

  const totalSessions = mobile + desktop + social;
  const orders = num(a.ordersMade);
  const fulfilled = num(a.ordersFulfilled);
  const gross = num(a.grossSales);
  const cart = num(a.addedToCart);

  const mobilePct = totalSessions ? (mobile / totalSessions) * 100 : 0;
  const desktopPct = totalSessions ? (desktop / totalSessions) * 100 : 0;

  const fulfillmentRate = orders ? (fulfilled / orders) * 100 : null;
  const aovComputed = orders ? gross / orders : null;
  const addToCartConversion = cart ? (orders / cart) * 100 : null;
  const conversionRateComputed = totalSessions
    ? (orders / totalSessions) * 100
    : null;

  let daysLive: number | null = null;
  if (data.startDate) {
    const start = new Date(data.startDate);
    const end = data.reportDate ? new Date(data.reportDate) : new Date();
    const ms = end.getTime() - start.getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      daysLive = Math.round(ms / (1000 * 60 * 60 * 24));
    }
  }

  return {
    totalSessions,
    socialSessions: social,
    mobilePct,
    desktopPct,
    fulfillmentRate,
    aovComputed,
    addToCartConversion,
    conversionRateComputed,
    daysLive,
  };
}

/** The effective conversion rate to display: manual entry wins, else computed. */
export function effectiveConversionRate(data: ReportData): number | null {
  if (hasValue(data.analytics.conversionRate)) {
    return num(data.analytics.conversionRate);
  }
  return computeMetrics(data).conversionRateComputed;
}

/** The effective AOV to display: manual entry wins, else gross/orders. */
export function effectiveAOV(data: ReportData): number | null {
  if (hasValue(data.analytics.averageOrderValue)) {
    return num(data.analytics.averageOrderValue);
  }
  return computeMetrics(data).aovComputed;
}

export function formatDateLong(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
