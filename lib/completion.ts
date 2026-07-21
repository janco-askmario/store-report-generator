import type { ReportData } from "./types";
import { effectiveAOV, hasValue, num } from "./calc";

export interface CompletionItem {
  label: string;
  done: boolean;
}

export interface Completion {
  percent: number;
  done: number;
  total: number;
  items: CompletionItem[];
}

function blockHasContent(b: { title: string; paragraph: string }): boolean {
  return b.title.trim() !== "" || b.paragraph.trim() !== "";
}

/**
 * How complete the report is, as a checklist. Drives the progress bar so the
 * agency can see at a glance what's left before sending it to a client.
 */
export function computeCompletion(data: ReportData): Completion {
  const good = data.goodBlocks.filter(blockHasContent);
  const bad = data.badBlocks.filter(blockHasContent);
  const rated = [...good, ...bad];
  const allRated = rated.length > 0 && rated.every((b) => b.rating > 0);

  const a = data.analytics;
  const items: CompletionItem[] = [
    { label: "Store logo", done: !!data.logo },
    { label: "Store name", done: hasValue(data.storeName) },
    { label: "Store URL", done: hasValue(data.storeUrl) },
    { label: "Start date", done: hasValue(data.startDate) },
    { label: "Gross sales", done: hasValue(a.grossSales) },
    { label: "Orders made", done: hasValue(a.ordersMade) },
    { label: "Orders fulfilled", done: hasValue(a.ordersFulfilled) },
    { label: "Average order value", done: effectiveAOV(data) != null },
    { label: "Added to cart", done: hasValue(a.addedToCart) },
    {
      label: "Sessions (mobile / desktop)",
      done: num(a.mobileSessions) + num(a.desktopSessions) > 0,
    },
    { label: "Best selling product", done: hasValue(a.bestSellingProduct) },
    { label: "At least 3 strengths", done: good.length >= 3 },
    { label: "At least 3 issues", done: bad.length >= 3 },
    { label: "All blocks star-rated", done: allRated },
    { label: "“Success is multi-faceted” note", done: hasValue(data.goodCustom) },
    { label: "Action plan written", done: hasValue(data.actionPlan) },
  ];

  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  };
}
