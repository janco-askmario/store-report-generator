import type { Block, ReportData } from "./types";
import {
  DEFAULT_ADD_TO_CART_NOTE,
  DEFAULT_AOV_NOTE,
  DEFAULT_CONVERSION_NOTE,
  DEFAULT_FOOD_FOR_THOUGHT,
} from "./templates";

export const MAX_GOOD_BLOCKS = 6;
export const MAX_BAD_BLOCKS = 9;
/** Backwards-compatible default (Good section). */
export const MAX_BLOCKS = MAX_GOOD_BLOCKS;

export function maxBlocks(kind: "good" | "bad"): number {
  return kind === "bad" ? MAX_BAD_BLOCKS : MAX_GOOD_BLOCKS;
}

let counter = 0;
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `id-${Date.now()}-${counter}`;
}

export function createBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: uid(),
    icon: "diamond",
    title: "",
    paragraph: "",
    rating: 0,
    highlighted: false,
    ...overrides,
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialData(): ReportData {
  return {
    logo: null,
    storeName: "",
    storeUrl: "",
    startDate: "",
    reportDate: todayISO(),
    currency: "R",
    analytics: {
      conversionRate: "",
      grossSales: "",
      ordersMade: "",
      ordersFulfilled: "",
      averageOrderValue: "",
      bestSellingProduct: "",
      mobileSessions: "",
      desktopSessions: "",
      addedToCart: "",
      aovBenchmark: "1000",
    },
    socials: {
      enabled: false,
      facebook: "",
      instagram: "",
      tiktok: "",
      custom: [],
    },
    referrers: {
      enabled: false,
      facebook: "",
      instagram: "",
      tiktok: "",
    },
    goodBlocks: [
      createBlock({
        icon: "diamond",
        title: "Positive reviews visible on home page",
        paragraph:
          "It is clear that this store sells high-quality bicycles and related equipment, fortified by high-quality product images. Customers feel like they can buy quality products here!",
        rating: 5,
        highlighted: true,
      }),
    ],
    badBlocks: [
      createBlock({
        icon: "clock",
        title: "Slow loading speed (LCP)",
        paragraph:
          "Bloated app code is dragging your Largest Contentful Paint down. Visitors bounce before the page is usable — a direct hit to conversion.",
        rating: 4,
        highlighted: false,
      }),
    ],
    goodCustom: "",
    foodForThought: DEFAULT_FOOD_FOR_THOUGHT,
    page3: {
      conversionNote: DEFAULT_CONVERSION_NOTE,
      aovNote: DEFAULT_AOV_NOTE,
      addToCartNote: DEFAULT_ADD_TO_CART_NOTE,
    },
    actionPlan: "",
  };
}
