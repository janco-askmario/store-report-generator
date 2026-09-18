/**
 * The "Generate Report" questionnaire.
 *
 * A fixed, hand-written checklist that mirrors how an audit is actually done —
 * walking the same screens a reviewer checks in Shopify Admin (Analytics >
 * Reports, Growth, Settings) plus the front-end and app checks that don't come
 * from a report. Answers are turned into blocks by `lib/questionnaire-rules.ts`
 * through fixed thresholds and copy, never a model — "generate" means
 * "apply the house rules", not "make something up".
 *
 * Most questions are booleans: a fact about the store that maps straight to a
 * pre-written Good or Bad block. A handful need a real value instead — a
 * number that gets graded against a benchmark (Returning Customer Rate, AOV)
 * or that also populates the report's own analytics fields (Gross Sales,
 * Orders), a couple of free-text fields (best-selling product, theme name),
 * and the two dates that set the report's own reporting period.
 *
 * Some numeric answers (Reached Checkout, social follower count, Returning
 * Customer Rate) have nowhere to live in `ReportData` — the app doesn't track
 * them as fields — so they only steer which block gets picked and are
 * otherwise discarded. Their hints say so.
 */

export type QuestionType = "boolean" | "text" | "number" | "date";

export type Answers = Record<string, string | boolean | undefined>;

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  hint?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  yesLabel?: string;
  noLabel?: string;
  /** Only asked when this returns true for the answers gathered so far. */
  showIf?: (answers: Answers) => boolean;
}

export interface QuestionnaireStep {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

function bool(
  id: string,
  label: string,
  extra: Partial<Question> = {},
): Question {
  return { id, type: "boolean", label, ...extra };
}

function num(id: string, label: string, extra: Partial<Question> = {}): Question {
  return { id, type: "number", label, ...extra };
}

function text(id: string, label: string, extra: Partial<Question> = {}): Question {
  return { id, type: "text", label, ...extra };
}

function date(id: string, label: string, extra: Partial<Question> = {}): Question {
  return { id, type: "date", label, ...extra };
}

export const QUESTIONNAIRE: QuestionnaireStep[] = [
  {
    id: "overview",
    title: "Overview",
    description: "The big picture before we get into the numbers.",
    questions: [
      date("startDate", "Start date", {
        hint: "Beginning of the reporting period.",
      }),
      date("reportDate", "Report date", {
        hint: "End of the reporting period — defaults to today if left blank.",
      }),
      bool("fastSite", "Does the store load quickly (LCP under ~2.5s)?", {
        hint: "Website Speed report / PageSpeed Insights.",
      }),
    ],
  },
  {
    id: "sales",
    title: "Sales & Orders",
    description: "Straight from Analytics → Reports. These fill in the report's own numbers.",
    questions: [
      num("grossSales", "Gross sales for this period", { prefix: "R" }),
      num("ordersMade", "Orders placed"),
      num("ordersFulfilled", "Orders fulfilled"),
      num("aov", "Average order value", {
        prefix: "R",
        hint: "R1000 is the rough SA benchmark — depends on the product.",
      }),
      text("bestSellingProduct", "Best-selling product", {
        placeholder: "e.g. Classic Tote Bag",
      }),
    ],
  },
  {
    id: "traffic",
    title: "Traffic & Conversion",
    description: "Sessions, conversion and where visitors are coming from.",
    questions: [
      num("conversionRate", "Conversion rate", {
        suffix: "%",
        hint: "1% and higher is healthy.",
      }),
      num("addedToCart", "Sessions that added to cart"),
      num("reachedCheckout", "Sessions that reached checkout", {
        hint: "Used to tailor the checkout block — not stored elsewhere in the report.",
      }),
      num("desktopSessions", "Desktop sessions"),
      num("mobileSessions", "Mobile sessions"),
      num("tabletSessions", "Tablet sessions", {
        hint: "Used to tailor the device block — not stored elsewhere in the report.",
      }),
      bool(
        "locationConcentrated",
        "Is traffic concentrated in the store's target market?",
        { hint: "Sessions by Location." },
      ),
    ],
  },
  {
    id: "referrers",
    title: "Referrers & Returning Customers",
    description: "Total Sales by Referrer, Sessions by Social Referrer, returning customers, POS.",
    questions: [
      bool(
        "channelHealthy",
        "Is Sales by Channel concentrated in one healthy primary channel?",
      ),
      num("socialSessionsFacebook", "Facebook sessions"),
      num("socialSessionsInstagram", "Instagram sessions"),
      num("socialSessionsTiktok", "TikTok sessions"),
      num("referrerSalesFacebook", "Facebook referral sales", { prefix: "R" }),
      num("referrerSalesInstagram", "Instagram referral sales", { prefix: "R" }),
      num("referrerSalesTiktok", "TikTok referral sales", { prefix: "R" }),
      num("returningCustomerRate", "Returning customer rate", {
        suffix: "%",
        hint: "20–35% is healthy. Below or above both point to a different problem — not stored elsewhere in the report.",
      }),
      bool("hasPOS", "Does the store use Shopify POS?"),
    ],
  },
  {
    id: "growth",
    title: "Growth — Paid Traffic",
    description: "The Growth tab's Sessions Highest to Lowest view.",
    questions: [
      bool("runsGoogleAds", "Are Google Ads running?"),
      bool("googleAdsEffective", "Are they performing well, or is there room to improve?", {
        showIf: (a) => a.runsGoogleAds === true,
      }),
      bool("runsSocialAds", "Are paid social media ads running?"),
    ],
  },
  {
    id: "shipping",
    title: "Shipping & Policies",
    description: "Settings → Shipping and legal pages.",
    questions: [
      bool("freeShipping", "Do they offer free shipping?"),
      bool(
        "shippingMatchesAOV",
        "Does the free shipping threshold roughly match (or sit below) the AOV?",
        { showIf: (a) => a.freeShipping === true },
      ),
      bool(
        "universalShipping",
        "Is the shipping fee the same regardless of customer location?",
      ),
      bool(
        "policyPages",
        "Are Privacy Policy, Terms and Refund policy pages present?",
      ),
    ],
  },
  {
    id: "payments",
    title: "Payment Gateways",
    description: "Settings → Payments.",
    questions: [
      bool("paystack", "Is Paystack available as a payment method?"),
      bool(
        "bnpl",
        "Is a Buy-Now-Pay-Later service active (PayJustNow, Happy Pay, Mobicred)?",
      ),
    ],
  },
  {
    id: "navigation",
    title: "Navigation & Trust",
    description: "Nav bar checks.",
    questions: [
      bool("goodNav", "Is the main navigation clear and well-structured?"),
      bool(
        "aboutUsPage",
        "Is there an About Us page, easy to find (main nav)?",
        { hint: "It's typically the second most-visited page on the site." },
      ),
      bool("contactPage", "Is there a Contact page?"),
      bool(
        "redundantHomeLink",
        "Does the main nav include a redundant 'Home' link?",
        { hint: "The logo already does that job." },
      ),
      bool("hasFAQ", "Is there an FAQ page?"),
    ],
  },
  {
    id: "frontend",
    title: "Design & Checkout",
    description: "Footer, copy, imagery, homepage layout and checkout.",
    questions: [
      bool(
        "goodFooter",
        "Is the footer complete and well-used (contact info, useful links, no big empty gaps)?",
      ),
      bool(
        "goodCopy",
        "Is on-site copy specific and persuasive, not generic like 'Shop Now'?",
      ),
      bool(
        "goodImagery",
        "Is image content strong, and does it hold up well on mobile?",
      ),
      bool(
        "abPattern",
        "Does the homepage alternate content and product sections (an ABAB pattern)?",
      ),
      bool("hasFavicon", "Is there a fav-icon set?"),
      text("theme", "What theme is the store built on?", {
        placeholder: "e.g. Horizon",
      }),
      bool(
        "checkoutCustomised",
        "Has the checkout page been customised (Cart Drawer, Quick Shop, branding)?",
      ),
    ],
  },
  {
    id: "social",
    title: "Social Media",
    description: "Do they have an audience, and are they using it?",
    questions: [
      bool("hasSocial", "Does the store have active social media accounts?"),
      num("socialFollowers", "Roughly how many total followers across platforms?", {
        showIf: (a) => a.hasSocial === true,
        hint: "Not stored elsewhere in the report — just steers which block is picked.",
      }),
      bool("socialActive", "Are they posting regularly?", {
        showIf: (a) => a.hasSocial === true,
      }),
    ],
  },
  {
    id: "apps",
    title: "Apps",
    description: "What's installed, and is it earning its keep?",
    questions: [
      bool(
        "usesPageBuilder",
        "Are they using a page-builder app (PageFly, GemPages, Shogun)?",
      ),
      bool(
        "usesEmailApp",
        "Are they using a separate email marketing app instead of Shopify Email?",
        { hint: "Klaviyo, Omnisend, etc." },
      ),
      num("appCount", "Roughly how many apps are installed?"),
    ],
  },
];

export const TOTAL_STEPS = QUESTIONNAIRE.length;

/** Questions actually visible for this step, given the answers so far. */
export function visibleQuestions(
  step: QuestionnaireStep,
  answers: Answers,
): Question[] {
  return step.questions.filter((q) => !q.showIf || q.showIf(answers));
}
