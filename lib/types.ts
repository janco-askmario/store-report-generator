export interface Block {
  id: string;
  icon: string;
  title: string;
  paragraph: string;
  /**
   * Retired star rating 0–5. Nothing shows or edits it any more (the stars and
   * the Health Score they fed were removed), but it stays in the shape so
   * reports saved with ratings, and the shared Yjs documents carrying them,
   * still load without a migration.
   */
  rating: number;
  highlighted: boolean; // good -> purple, bad -> orange
}

export interface CustomSocial {
  id: string;
  label: string;
  value: string;
}

export interface Analytics {
  conversionRate: string;
  grossSales: string;
  ordersMade: string;
  ordersFulfilled: string;
  averageOrderValue: string;
  bestSellingProduct: string;
  mobileSessions: string;
  desktopSessions: string;
  addedToCart: string; // for add-to-cart vs purchase %
  aovBenchmark: string; // typical online spend, used to grade AOV
}

export interface Socials {
  enabled: boolean;
  facebook: string;
  instagram: string;
  tiktok: string;
  custom: CustomSocial[];
}

export interface Referrers {
  enabled: boolean;
  facebook: string;
  instagram: string;
  tiktok: string;
}

export interface Page3Notes {
  conversionNote: string;
  aovNote: string;
  addToCartNote: string;
}

export interface ReportData {
  logo: string | null; // data URL
  storeName: string;
  storeUrl: string;
  startDate: string; // ISO yyyy-mm-dd
  reportDate: string; // ISO yyyy-mm-dd (defaults to today)
  currency: string; // symbol, e.g. "R"

  analytics: Analytics;
  socials: Socials;
  referrers: Referrers;

  goodBlocks: Block[];
  badBlocks: Block[];

  goodCustom: string; // "SUCCESS IS MULTI-FACETED" paragraph
  foodForThought: string; // page 1 psychological-game passage
  page3: Page3Notes;
  actionPlan: string; // big passage
}

/** A saved report in the library — wraps ReportData with id + timestamps. */
export interface StoredReport {
  id: string;
  createdAt: number;
  updatedAt: number;
  data: ReportData;
}
