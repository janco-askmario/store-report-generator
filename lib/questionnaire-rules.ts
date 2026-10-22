import type { ReportData } from "./types";
import {
  createBlock,
  createInitialData,
  MAX_BAD_BLOCKS,
  MAX_GOOD_BLOCKS,
} from "./defaults";
import { num } from "./calc";
import { body, BUILTIN_BY_ID } from "./block-templates";
import type { Answers } from "./questionnaire";

/**
 * Turns questionnaire answers into a populated `ReportData`.
 *
 * Deliberately dumb: every block below is picked by a fixed threshold against
 * a fixed piece of copy, the same way `lib/block-templates.ts` works. Nothing
 * here calls a model or invents text — "generate" means "run the house rules",
 * so the output is exactly as predictable as picking the blocks by hand.
 *
 * A few reuse a house template verbatim (`BUILTIN_BY_ID`) rather than
 * duplicating its copy, so the two stay in sync automatically.
 *
 * Blocks are collected uncapped and cut to `MAX_GOOD_BLOCKS` /
 * `MAX_BAD_BLOCKS` at the very end (highest `IMPACT` wins, ties go to the
 * earlier question), so a generated report never opens over the limit.
 */

function s(answers: Answers, id: string): string {
  const v = answers[id];
  return typeof v === "string" ? v.trim() : "";
}

function n(answers: Answers, id: string): number | undefined {
  const raw = s(answers, id);
  return raw ? num(raw) : undefined;
}

function yes(answers: Answers, id: string): boolean {
  return answers[id] === true;
}

function no(answers: Answers, id: string): boolean {
  return answers[id] === false;
}

type Block = ReturnType<typeof createBlock>;

interface Candidate {
  block: Block;
  impact: number;
}

interface BlockList {
  good: Candidate[];
  bad: Candidate[];
}

/**
 * How much a finding moves the store's revenue or the client's trust, 1–5.
 * Only used to decide which blocks survive the `MAX_*_BLOCKS` cap — it is not
 * stored on the block.
 *
 * 5: speed, checkout, fulfillment, basket size — direct revenue levers.
 * 4: acquisition, shipping/payment friction, navigation, policies.
 * 3: content and polish that matters but rarely decides a sale (the default
 *    for any title not listed, so a new block is never silently ranked last).
 * 2: informational or cosmetic.
 */
const IMPACT: Record<string, number> = {
  // Good
  "Lightning Fast Store": 5,
  "Great Average Order Value": 5,
  "Healthy Checkout Flow": 5,
  "Healthy Returning Customer Rate": 5,
  "Traffic From the Right Sources": 5,
  "Focused Sales Channel": 4,
  "Free Shipping Threshold Matches Basket Size": 4,
  "Universal Shipping Fee": 4,
  "Paystack Available": 4,
  "Buy Now, Pay Later Active": 4,
  "Great Navigation": 4,
  "Checkout Page Customised": 4,
  "Policies Clearly Published": 4,
  "Traffic From Your Target Market": 3,
  "You're Offering Free Shipping!": 3,
  "Contact Page Available": 3,
  "About Us Surfaced in Navigation": 3,
  "FAQ Answers Questions Before They're Asked": 3,
  "Footer Pulling Its Weight": 3,
  "Sharp, Specific Copy": 3,
  "Product Imagery": 3,
  "Alternating Content & Product Layout": 3,
  "You're a Social Brand": 3,
  "You're Practising Omnichannel!": 3,
  "Majority Mobile Users": 3,
  "Majority Desktop Users": 3,
  "Clean, Focused Navigation": 2,
  "Fav-Icon Set": 2,
  "Built on Horizon": 2,

  // Bad
  "Slow Loading Speed (LCP)": 5,
  "Drop-Off From Cart to Checkout": 5,
  "Checkout Drop-Off": 5,
  "Low Fulfillment Rate": 5,
  "Below-Benchmark Average Order Value": 5,
  "Default, Un-Customised Checkout": 4,
  "Low Returning Customer Rate": 4,
  "Scattered Sales Channels": 4,
  "Social Traffic Pitfall": 4,
  "No Google Ads Investment": 4,
  "Google Ads Room to Improve": 4,
  "No Free Shipping Offered": 4,
  "Free Shipping Threshold Too High": 4,
  "No Buy-Now-Pay-Later Option": 4,
  "Missing Policy Pages": 4,
  "Vague Menu & Button Labels": 4,
  "Too Many Shipping Options at Checkout": 5,
  "Traffic Outside Target Market": 4,
  "Page Builder App Slowing You Down": 4,
  "Apps Slowing the Store": 4,
  "Footer Needs Work": 3,
  "Reinforce the Purchase Decision": 3,
  "Image Content Needs Work": 3,
  "About Us Hidden": 3,
  "No Contact Page": 3,
  "No FAQ Page": 3,
  "Returning Customer Rate Too High": 3,
  "Paying for Email Marketing You Don't Need": 3,
  "No Social Media Presence": 3,
  "Underused Social Presence": 3,
  "Paid Social Ads Underperforming": 3,
  "Redundant 'Home' Link in Navigation": 2,
  "Inconsistent Shipping Fees by Location": 2,
  "No Shopify POS": 2,
  "Missing Fav-Icon": 2,
};
const DEFAULT_IMPACT = 3;

/**
 * The action plan line for each Bad block that makes it into the report: what
 * to do about it, in one line. The block says what is wrong; this says what to
 * change, so the plan never repeats the block. Like the blocks, a fix only
 * claims what the answers support: no blaming apps or channels it can't name.
 */
const FIX: Record<string, string> = {
  "Slow Loading Speed (LCP)":
    "Compress, resize or replace the largest element on the homepage so the page looks ready in under 2.5 seconds.",
  "Low Fulfillment Rate":
    "Find out why paid orders aren't being fulfilled (stock, courier or process) and fix that before spending more on traffic.",
  "Below-Benchmark Average Order Value":
    "Add bundles, cross-sells in the cart and a free shipping threshold just above the current AOV to lift basket size.",
  "Drop-Off From Cart to Checkout":
    "Walk through the cart as a customer and remove anything between Add to cart and Checkout: surprise costs, forced sign-ups, slow or cluttered cart pages.",
  "Checkout Drop-Off":
    "Go through checkout as a customer and cut what slows the decision: extra shipping choices, surprise fees and fields that aren't needed.",
  "Traffic Outside Target Market":
    "Tighten ad and audience targeting to the markets the store ships to, and exclude the rest.",
  "Social Traffic Pitfall":
    "Move part of the social budget into search, where shoppers already know what they want.",
  "Scattered Sales Channels":
    "Pick the channel that sells best, give it the attention first, and only add others once it is performing.",
  "Low Returning Customer Rate":
    "Set up post-purchase, win-back and abandoned-cart emails so first-time buyers come back.",
  "Returning Customer Rate Too High":
    "Put more effort into reaching new customers: search, prospecting ads and a first-order offer.",
  "Google Ads Room to Improve":
    "Review keywords, search terms and landing pages, and move spend from campaigns that don't convert to those that do.",
  "No Google Ads Investment":
    "Start a small Google Search or Shopping campaign on the best sellers and measure it against current ad spend.",
  "Paid Social Ads Underperforming":
    "Compare each social campaign's spend with the sales it brings, and pause or rework the ones that don't pay back.",
  "No Free Shipping Offered":
    "Offer free shipping above a threshold close to the AOV, priced into the products.",
  "Too Many Shipping Options at Checkout":
    "Cut checkout to 2 shipping rates: the cheapest and the fastest.",
  "Free Shipping Threshold Too High":
    "Bring the free shipping threshold down to around the AOV, with a small price adjustment to cover it.",
  "Inconsistent Shipping Fees by Location":
    "Consider a flat shipping rate so customers know the cost before checkout.",
  "Missing Policy Pages":
    "Publish the Privacy Policy, Terms and Refund policy in Settings → Policies and link them in the footer.",
  "No Buy-Now-Pay-Later Option":
    "Add a Buy-Now-Pay-Later option such as PayJustNow, Happy Pay or Mobicred at checkout and on product pages.",
  "Vague Menu & Button Labels":
    "Rename menu items and buttons after where they lead (\"Shop Dresses\", \"Our Story\") instead of \"Shop\" or \"Learn More\".",
  "About Us Hidden":
    "Write or update the About Us page and add it to the header menu.",
  "No Contact Page":
    "Add a Contact page with email, phone and a form, and link it in the header or footer.",
  "Redundant 'Home' Link in Navigation":
    "Remove the Home link from the menu and use the space for a key collection.",
  "No FAQ Page":
    "Add an FAQ page covering shipping, returns, sizing and payment, and link it in the footer.",
  "Footer Needs Work":
    "Fill the footer with contact details, policy links, quick links and a newsletter sign-up.",
  "Image Content Needs Work":
    "Check every banner on a phone and add mobile-specific images where they crop or become hard to read.",
  "Reinforce the Purchase Decision":
    "Alternate homepage sections: product, then content about it, then more product.",
  "Missing Fav-Icon":
    "Upload a favicon in the theme settings.",
  "Default, Un-Customised Checkout":
    "Brand the checkout with the logo, colours and fonts so it feels like the rest of the store.",
  "Underused Social Presence":
    "Set a regular posting schedule and link the store from every profile.",
  "No Social Media Presence":
    "Set up Instagram and Facebook profiles, link them to the store, and post regularly.",
  "Page Builder App Slowing You Down":
    "Rebuild the page-builder pages with the theme's own sections, then remove the app.",
  "Apps Slowing the Store":
    "Remove or defer the apps measured as slowing the store, and recheck the load time afterwards.",
  "Paying for Email Marketing You Don't Need":
    "Compare what the email app does with Shopify Email, and switch if Shopify Email covers what's used.",
  "No Shopify POS":
    "Set up Shopify POS in the physical store so stock, sales and customers stay in one place.",
};

function candidate(title: string, paragraph: string, icon: string): Candidate {
  return {
    block: createBlock({ title, paragraph, icon }),
    impact: IMPACT[title] ?? DEFAULT_IMPACT,
  };
}

// A title already in the list is skipped: two questions can legitimately lead
// to the same finding (e.g. search traffic seen from the referrer data and from
// the Google Ads answer), and the report must not say it twice.
function good(list: BlockList, title: string, paragraph: string, icon: string) {
  if (list.good.some((c) => c.block.title === title)) return;
  list.good.push(candidate(title, paragraph, icon));
}

function badBlock(list: BlockList, title: string, paragraph: string, icon: string) {
  if (list.bad.some((c) => c.block.title === title)) return;
  list.bad.push(candidate(title, paragraph, icon));
}

/**
 * Keeps the `max` highest-impact candidates. Ties go to whichever came first in
 * the questionnaire, and both halves keep that original order — the report
 * should still read in the order the audit was walked, not shuffled by score.
 *
 * The cut-off half is returned rather than thrown away: a finding that didn't
 * get a block is still a finding, and the caller gives it a place to live.
 */
function splitByImpact(
  candidates: Candidate[],
  max: number,
): { kept: Block[]; dropped: Block[] } {
  const ranked = candidates
    .map((c, order) => ({ ...c, order }))
    .sort((a, b) => b.impact - a.impact || a.order - b.order);
  const inOrder = (cs: typeof ranked) =>
    [...cs].sort((a, b) => a.order - b.order).map((c) => c.block);
  return {
    kept: inOrder(ranked.slice(0, max)),
    dropped: inOrder(ranked.slice(max)),
  };
}

/** The observation half of a `body()` paragraph, without the tagline. */
function observation(paragraph: string): string {
  return paragraph.split("\n\n")[0].trim();
}

function reuseGood(list: BlockList, templateId: string) {
  const t = BUILTIN_BY_ID[templateId];
  if (t) good(list, t.title, t.paragraph, t.icon);
}

function reuseBad(list: BlockList, templateId: string) {
  const t = BUILTIN_BY_ID[templateId];
  if (t) badBlock(list, t.title, t.paragraph, t.icon);
}

/* ------------------------------------------------------------- thresholds */

const RETURNING_MIN = 20;
const RETURNING_MAX = 35;
const AOV_GOOD_RATIO = 0.9;
const FULFILLMENT_BAD = 85;
const ATC_CONVERSION_GOOD = 25; // orders / addedToCart, %
const SOCIAL_SALES_SHARE_GOOD = 15; // % of gross sales
const SOCIAL_SALES_SHARE_BAD = 30;
const SOCIAL_FOLLOWERS_GOOD = 1000;

export function buildReportFromAnswers(answers: Answers): ReportData {
  const data = createInitialData();
  const list: BlockList = { good: [], bad: [] };
  /* Settings fixes that are worth doing but too small to earn a block. They go
     straight to the action plan, written as "Title: what and why" lines, the
     same shape the PDF parses into bold-led items. */
  const actions: string[] = [];

  /* ------------------------------------------------------------- Overview */
  // Both are optional — an empty answer keeps createInitialData()'s defaults
  // (blank start date, reportDate defaulted to today) rather than blanking
  // out a sensible default.
  data.storeName = s(answers, "storeName");
  data.storeUrl = s(answers, "storeUrl");
  const startDate = s(answers, "startDate");
  if (startDate) data.startDate = startDate;
  const reportDate = s(answers, "reportDate");
  if (reportDate) data.reportDate = reportDate;

  if (yes(answers, "fastSite")) {
    good(
      list,
      "Lightning Fast Store",
      body(
        "The store loads quickly, with a healthy Largest Contentful Paint. No customer needs to wait for something to load.",
        "Speed is the first impression — nailing it keeps visitors around long enough to see the rest.",
      ),
      "gauge",
    );
  } else if (no(answers, "fastSite")) {
    // Name the element when the reviewer knows it. The block deliberately does
    // not blame apps or code in general: the cause is a specific element, and
    // saying "bloated app code" when it is e.g. a hero video is simply untrue.
    const cause = s(answers, "lcpCause");
    badBlock(
      list,
      "Slow Loading Speed (LCP)",
      body(
        cause
          ? `Largest Contentful Paint is over the 2.5 second target. The largest element on the page is ${cause}, and visitors wait on it before the page looks ready.`
          : "Largest Contentful Paint is over the 2.5 second target. The largest element on the page is slow to load, and visitors wait on it before the page looks ready.",
        "If your site doesn't load and a visitor doesn't understand what it's about in 2 seconds, they're gone for good.",
      ),
      "hourglass",
    );
  }

  /* --------------------------------------------------------- Sales trend */
  data.analytics.grossSales = s(answers, "grossSales");
  data.analytics.ordersMade = s(answers, "ordersMade");
  data.analytics.ordersFulfilled = s(answers, "ordersFulfilled");
  data.analytics.averageOrderValue = s(answers, "aov");
  data.analytics.bestSellingProduct = s(answers, "bestSellingProduct");
  data.analytics.conversionRate = s(answers, "conversionRate");
  data.analytics.addedToCart = s(answers, "addedToCart");
  data.analytics.mobileSessions = s(answers, "mobileSessions");
  data.analytics.desktopSessions = s(answers, "desktopSessions");

  const orders = n(answers, "ordersMade");
  const fulfilled = n(answers, "ordersFulfilled");
  if (orders && fulfilled !== undefined) {
    const rate = (fulfilled / orders) * 100;
    // Only a low rate is worth a block. A high one is the baseline, not a
    // strength, and "fulfilled" can exceed "placed" in a period (older orders
    // shipping), which makes the percentage meaningless as praise.
    if (rate < FULFILLMENT_BAD) {
      badBlock(
        list,
        "Low Fulfillment Rate",
        body(
          "A meaningful share of orders placed aren't being fulfilled. Whether that's stock, logistics or a process gap, it's costing you both the sale and the customer's trust for next time.",
          "Chase this down before spending another cent on traffic.",
        ),
        "clock",
      );
    }
  }

  const aov = n(answers, "aov");
  const benchmark = num(data.analytics.aovBenchmark) || 1000;
  if (aov !== undefined) {
    if (aov >= benchmark * AOV_GOOD_RATIO) {
      good(
        list,
        "Great Average Order Value",
        body(
          `Your Average Order Value sits at or near the South African standard of around R${benchmark.toLocaleString("en-US")}.`,
          "Customers feel safe spending money on your store — basket confidence is there!",
        ),
        "dollar",
      );
    } else {
      badBlock(
        list,
        "Below-Benchmark Average Order Value",
        body(
          `Average Order Value is sitting below the rough R${benchmark.toLocaleString("en-US")} benchmark. Upsells, bundling and a nudge toward a free-shipping threshold are the fastest levers to close that gap.`,
          "Small basket-size wins compound fast.",
        ),
        "dollar",
      );
    }
  }

  /* --------------------------------------------------------------- Traffic */
  const addedToCart = n(answers, "addedToCart");
  const reachedCheckout = n(answers, "reachedCheckout");
  if (addedToCart && orders !== undefined) {
    const atcConversion = (orders / addedToCart) * 100;
    if (atcConversion >= ATC_CONVERSION_GOOD) {
      good(
        list,
        "Healthy Checkout Flow",
        body(
          "Of the shoppers who add to cart, a healthy share go on to complete checkout — the path from cart to purchase isn't leaking visitors.",
          "Nice one!",
        ),
        "cart",
      );
    } else if (reachedCheckout !== undefined && reachedCheckout < addedToCart * 0.6) {
      const reachedPct = Math.round((reachedCheckout / addedToCart) * 100);
      badBlock(
        list,
        "Drop-Off From Cart to Checkout",
        body(
          `Only ${reachedPct}% of shoppers who add to cart reach checkout (${reachedCheckout.toLocaleString("en-US")} of ${addedToCart.toLocaleString("en-US")}). The loss happens before the checkout page loads, in the cart step.`,
          "This needs to change yesterday.",
        ),
        "cart",
      );
    } else {
      const completedPct =
        reachedCheckout && orders !== undefined
          ? Math.round((orders / reachedCheckout) * 100)
          : undefined;
      badBlock(
        list,
        "Checkout Drop-Off",
        body(
          completedPct !== undefined
            ? `Only about ${completedPct}% of shoppers who reach checkout place an order (${orders?.toLocaleString("en-US")} orders from ${reachedCheckout?.toLocaleString("en-US")} checkout sessions). The loss happens on the checkout page itself.`
            : "Visitors are reaching checkout but not completing it. The loss happens on the checkout page itself.",
          "Put yourself in the customer's shoes and look through customer eyes.",
        ),
        "credit-card",
      );
    }
  }

  const desktopSessions = n(answers, "desktopSessions");
  const mobileSessions = n(answers, "mobileSessions");
  const tabletSessions = n(answers, "tabletSessions");
  if (
    desktopSessions !== undefined ||
    mobileSessions !== undefined ||
    tabletSessions !== undefined
  ) {
    const d = desktopSessions || 0;
    const m = mobileSessions || 0;
    const t = tabletSessions || 0;
    // Desktop vs. mobile is the only split with house copy either way — a
    // tablet-led split is unusual enough that we'd rather stay quiet than
    // force a weak block onto it.
    if (d > m && d > t) reuseGood(list, "builtin:desktop-majority");
    else if (m > d && m > t) reuseGood(list, "builtin:mobile-majority");
  }

  if (yes(answers, "locationConcentrated")) {
    good(
      list,
      "Traffic From Your Target Market",
      body(
        "Sessions by Location shows traffic concentrated in the store's actual target market rather than scattered globally — the audience matches the product.",
        "Marketing spend is landing where it should.",
      ),
      "globe",
    );
  } else if (no(answers, "locationConcentrated")) {
    badBlock(
      list,
      "Traffic Outside Target Market",
      body(
        "A meaningful share of sessions are coming from outside the store's target market. That traffic rarely converts and can quietly skew every other metric in this report.",
        "Tighten targeting before scaling spend further.",
      ),
      "globe",
    );
  }

  /* --------------------------------------------------------- Referrers */
  const fb = n(answers, "socialSessionsFacebook");
  const ig = n(answers, "socialSessionsInstagram");
  const tt = n(answers, "socialSessionsTiktok");
  if (fb !== undefined || ig !== undefined || tt !== undefined) {
    data.socials.enabled = true;
    data.socials.facebook = s(answers, "socialSessionsFacebook");
    data.socials.instagram = s(answers, "socialSessionsInstagram");
    data.socials.tiktok = s(answers, "socialSessionsTiktok");
  }

  const rfb = n(answers, "referrerSalesFacebook");
  const rig = n(answers, "referrerSalesInstagram");
  const rtt = n(answers, "referrerSalesTiktok");
  if (rfb !== undefined || rig !== undefined || rtt !== undefined) {
    data.referrers.enabled = true;
    data.referrers.facebook = s(answers, "referrerSalesFacebook");
    data.referrers.instagram = s(answers, "referrerSalesInstagram");
    data.referrers.tiktok = s(answers, "referrerSalesTiktok");

    const grossSales = n(answers, "grossSales");
    if (grossSales) {
      const socialSales = (rfb || 0) + (rig || 0) + (rtt || 0);
      const share = (socialSales / grossSales) * 100;
      if (share <= SOCIAL_SALES_SHARE_GOOD) {
        good(
          list,
          "Traffic From the Right Sources",
          body(
            "Total sales by referrer shows what we want to see: the bulk of sales are coming directly or via search, not social. That means the most sales are being made through the strongest-converting channels.",
            "Keep that budget where it's working.",
          ),
          "search",
        );
      } else if (share >= SOCIAL_SALES_SHARE_BAD) {
        badBlock(
          list,
          "Social Traffic Pitfall",
          body(
            "Social referrers make up a large share of sales by referrer — and social traffic is notorious for converting poorly compared to search and direct.",
            "Time to re-align and flip the budget to search. Pivot to stronger traffic sources and watch the metrics shift — massively.",
          ),
          "megaphone",
        );
      }
    }
  }

  if (yes(answers, "channelHealthy")) {
    good(
      list,
      "Focused Sales Channel",
      body(
        "Sales by Channel is concentrated in one healthy primary channel rather than scattered thin across many — a clean, easy-to-read revenue picture.",
        "Focus makes it obvious where to invest next.",
      ),
      "target",
    );
  } else if (no(answers, "channelHealthy")) {
    badBlock(
      list,
      "Scattered Sales Channels",
      body(
        "Sales are spread thin across several channels with no clear primary driver, making it harder to know where to double down.",
        "Pick the strongest channel and give it more attention before adding another.",
      ),
      "unlink",
    );
  }

  const returning = n(answers, "returningCustomerRate");
  if (returning !== undefined) {
    if (returning >= RETURNING_MIN && returning <= RETURNING_MAX) {
      good(
        list,
        "Healthy Returning Customer Rate",
        body(
          `A returning customer rate of around ${returning}% shows customers are having a good experience on your store and coming back for more.`,
          "Way to go!",
        ),
        "users",
      );
    } else if (returning < RETURNING_MIN) {
      badBlock(
        list,
        "Low Returning Customer Rate",
        body(
          `We typically target a range of ${RETURNING_MIN}% – ${RETURNING_MAX}% for a healthy returning customer rate. At ${returning}%, the store isn't hitting the full market yet. Email marketing, automations and ads will boost this.`,
          "Marketing, marketing, marketing!",
        ),
        "users",
      );
    } else {
      badBlock(
        list,
        "Returning Customer Rate Too High",
        body(
          `At ${returning}%, returning customers make up an unusually large share of orders — often a sign that too little new traffic is coming in to grow the customer base.`,
          "The store is retaining well; now it needs to acquire.",
        ),
        "users",
      );
    }
  }

  if (yes(answers, "hasPOS")) {
    good(
      list,
      "You're Practising Omnichannel!",
      body(
        "You're leveraging Shopify POS and the omnichannel experience — something few retail brands do, or do well. Plus you're gathering customer data from your in-store customers.",
        "Customer data is super valuable!",
      ),
      "receipt",
    );
  } else if (no(answers, "hasPOS")) {
    reuseBad(list, "builtin:no-shopify-pos");
  }

  /* ------------------------------------------------------------- Growth */
  if (yes(answers, "runsGoogleAds") && yes(answers, "googleAdsEffective")) {
    good(
      list,
      "Traffic From the Right Sources",
      body(
        `"Social Media builds brands, Google Ads build bank balances." Search traffic is converting well here — it's more valuable per visitor than social, and it shows in the numbers.`,
        "Keep feeding the channel that's actually paying you back.",
      ),
      "search",
    );
  } else if (yes(answers, "runsGoogleAds") && no(answers, "googleAdsEffective")) {
    badBlock(
      list,
      "Google Ads Room to Improve",
      body(
        "Google Ads are running but aren't pulling their weight yet. Revisit targeting, keywords and landing pages before assuming the channel itself is the problem — search traffic is usually the highest-quality traffic available.",
        "Small campaign fixes here tend to pay for themselves fast.",
      ),
      "search",
    );
  } else if (no(answers, "runsGoogleAds")) {
    badBlock(
      list,
      "No Google Ads Investment",
      body(
        `"Social Media builds brands, Google Ads build bank balances." Right now there's no paid search presence at all — reallocating even a portion of ad spend toward Google Ads should lift conversion and help build the bank balance.`,
        "Pivot to more targeted traffic to see the results.",
      ),
      "search",
    );
  }

  if (yes(answers, "runsSocialAds")) {
    badBlock(
      list,
      "Paid Social Ads Underperforming",
      body(
        "Paid social campaigns are running, but social traffic is notorious for converting poorly compared to search — high traffic numbers with low checkout numbers is the usual pattern.",
        "Get more search traffic yesterday.",
      ),
      "megaphone",
    );
  }

  /* ------------------------------------------------------------ Shipping */
  if (yes(answers, "freeShipping")) {
    good(
      list,
      "You're Offering Free Shipping!",
      body("Free Shipping offers an incentive for shoppers to buy more products."),
      "truck",
    );
  } else if (no(answers, "freeShipping")) {
    badBlock(
      list,
      "No Free Shipping Offered",
      body(
        "There's no free shipping incentive on the store. Shipping cost is one of the most common reasons potential customers abandon their carts — even a threshold-based offer, priced into the products, tends to lift conversion.",
        "Test it and watch checkout completions rise.",
      ),
      "truck",
    );
  }

  if (yes(answers, "shippingOverTwoRates")) {
    badBlock(
      list,
      "Too Many Shipping Options at Checkout",
      body(
        "Checkout shows more than 2 shipping rates. Past 2, choice becomes a reason to stall at the moment of payment.",
        "Cut it to 2: the fastest option and the cheapest.",
      ),
      "truck",
    );
  }

  // Gated on freeShipping — the question is only shown in the wizard when
  // free shipping is offered, but a stale answer can linger in state if the
  // user goes back and flips that toggle. Guarding here (not just in the UI)
  // stops a contradictory good+bad pair from both landing in the report.
  if (yes(answers, "freeShipping") && yes(answers, "shippingMatchesAOV")) {
    good(
      list,
      "Free Shipping Threshold Matches Basket Size",
      body(
        "The free shipping threshold sits close to the store's actual Average Order Value, so customers don't feel like they're being punished for a normal-sized basket.",
        "That alignment is exactly what keeps checkout friction low.",
      ),
      "truck",
    );
  } else if (yes(answers, "freeShipping") && no(answers, "shippingMatchesAOV")) {
    badBlock(
      list,
      "Free Shipping Threshold Too High",
      body(
        "There's a real gap between the free shipping threshold and the store's Average Order Value — customers notice it right before checkout, and it's a common reason for cart abandonment. Bring the threshold closer to AOV, paired with a small price adjustment to cover the difference.",
        "Close the gap and watch checkout completions rise.",
      ),
      "truck",
    );
  }

  if (yes(answers, "universalShipping")) {
    good(
      list,
      "Universal Shipping Fee",
      body(
        "Shipping is priced the same regardless of customer location — one less surprise for customers to hit at checkout, and one less reason to bail.",
        "Simple and predictable wins here.",
      ),
      "truck",
    );
  } else if (no(answers, "universalShipping")) {
    badBlock(
      list,
      "Inconsistent Shipping Fees by Location",
      body(
        "Shipping fees vary depending on where the customer is, which introduces a surprise right at the moment they're deciding whether to complete the purchase.",
        "A flat, universal rate removes that friction entirely.",
      ),
      "truck",
    );
  }

  if (yes(answers, "policyPages")) {
    good(
      list,
      "Policies Clearly Published",
      body(
        "Privacy Policy, Terms and Refund policy pages are all present and easy to find — answering trust questions before they're asked.",
        "That's one more reason customers feel safe checking out.",
      ),
      "shield-check",
    );
  } else if (no(answers, "policyPages")) {
    badBlock(
      list,
      "Missing Policy Pages",
      body(
        "One or more of Privacy Policy, Terms or Refund policy pages are missing. Beyond the legal exposure, their absence quietly erodes trust for a still-skeptical online shopper.",
        "Publish them — it's a quick, permanent fix.",
      ),
      "shield-off",
    );
  }

  if (no(answers, "deliveryDates")) {
    actions.push(
      "Delivery dates: Estimated delivery dates are switched off in Shipping settings. Turn them on so shoppers see an arrival date, not just a range of business days.",
    );
  }

  if (no(answers, "returnRules")) {
    actions.push(
      "Returns: No return or cancellation rules are set in Shopify, so customers can't request a return themselves. Add rules that match the published Return policy.",
    );
  }

  if (no(answers, "emailAuthenticated")) {
    actions.push(
      "Email: The sender email domain isn't authenticated (SPF, DKIM, DMARC). Until it is, Shopify sends from a Shopify address instead, which looks less trustworthy and is likelier to land in spam.",
    );
  }

  if (no(answers, "orderPrefix")) {
    actions.push(
      "Order numbers: Still Shopify's default #1001 format. Add a short brand prefix so orders are easy to recognise in emails and support.",
    );
  }

  /* ------------------------------------------------------------ Payments */
  if (yes(answers, "paystack")) {
    good(
      list,
      "Paystack Available",
      body(
        "Paystack is set up as a payment option — one more trusted, familiar way for customers to pay without friction at the finish line.",
        "Loads of payment methods is something merchants don't think about often enough. Kudos!",
      ),
      "credit-card",
    );
  }

  if (yes(answers, "bnpl")) {
    good(
      list,
      "Buy Now, Pay Later Active",
      body(
        "A Buy-Now-Pay-Later option is active on the store, giving customers more flexibility to complete the transaction on their own terms.",
        "More flexibility means more sales!",
      ),
      "credit-card",
    );
  } else if (no(answers, "bnpl")) {
    badBlock(
      list,
      "No Buy-Now-Pay-Later Option",
      body(
        "There's no BNPL option active. Services like PayJustNow, Happy Pay or Mobicred let customers commit to a bigger basket with more confidence — a fast way to lift AOV without discounting.",
        "Give customers the freedom to pay how they want.",
      ),
      "credit-card",
    );
  }

  /* ---------------------------------------------------------- Navigation */
  // Menu labels and on-page button copy are the same problem — a label that
  // doesn't say where it leads — so they raise one block, not two. The matching
  // "good" blocks are suppressed in the same case so the report can't praise the
  // navigation in one block and fault its labels in the next.
  const vagueLabels = no(answers, "goodNav") || no(answers, "goodCopy");
  if (yes(answers, "goodNav") && !vagueLabels) {
    good(
      list,
      "Great Navigation",
      body(
        "Between clear menu structure and an easy path to what customers are looking for, the navigation is helping funnel traffic towards what they want to see much faster.",
        "Brilliant!",
      ),
      "badge-check",
    );
  } else if (vagueLabels) {
    badBlock(
      list,
      "Vague Menu & Button Labels",
      body(
        "Generic labels such as 'Shop', 'View' or 'Learn More' lose customers who scan fast. Every menu item and button should say where it leads.",
        "Be explicit and eloquent — name the destination.",
      ),
      "circle-help",
    );
  }

  if (yes(answers, "aboutUsPage")) {
    good(
      list,
      "About Us Surfaced in Navigation",
      body(
        "The About Us link is clearly visible in the header menu — it's the second most-visited page on most store sites, and surfacing it builds trust before a customer even browses a product.",
        "Nice!",
      ),
      "eye",
    );
  } else if (no(answers, "aboutUsPage")) {
    badBlock(
      list,
      "About Us Hidden",
      body(
        "The brand story is currently tucked away, if it exists at all. Stores need an About Us page — it's the second most-visited page on store sites, and it builds trust with customers.",
        "Surface it in the main menu on your header. Tell your story for all the world to see.",
      ),
      "eye-off",
    );
  }

  if (yes(answers, "contactPage")) {
    good(
      list,
      "Contact Page Available",
      body(
        "A clear Contact page gives customers an easy way to reach out, and don't be scared to let them — it's one more small factor that builds trust.",
      ),
      "handshake",
    );
  } else if (no(answers, "contactPage")) {
    badBlock(
      list,
      "No Contact Page",
      body(
        "There's no clear way for a customer to get in touch. That's a trust gap at exactly the moment a skeptical shopper is deciding whether to buy.",
        "A simple contact page closes it.",
      ),
      "circle-help",
    );
  }

  if (yes(answers, "redundantHomeLink")) {
    badBlock(
      list,
      "Redundant 'Home' Link in Navigation",
      body(
        "The main navigation includes a 'Home' link — but the logo already does that job. It's wasted space in one of the most valuable rows on the page.",
        "Swap it for something that actually helps customers find products.",
      ),
      "circle-help",
    );
  } else if (no(answers, "redundantHomeLink") && !vagueLabels) {
    good(
      list,
      "Clean, Focused Navigation",
      body(
        "No redundant 'Home' link cluttering the main nav — every slot in that row is earning its place.",
      ),
      "badge-check",
    );
  }

  if (yes(answers, "hasFAQ")) {
    good(
      list,
      "FAQ Answers Questions Before They're Asked",
      body(
        "Answering questions before they're asked, like an FAQ page does, helps plug conversion holes and reduces friction when shopping.",
        "Surfacing it is a positive factor that pushes the needle even further.",
      ),
      "badge-check",
    );
  } else if (no(answers, "hasFAQ")) {
    badBlock(
      list,
      "No FAQ Page",
      body(
        "There's no FAQ page to answer common questions before they become a reason to bounce. A short, well-organised FAQ plugs conversion holes and takes pressure off support.",
        "Answer the questions before they're asked.",
      ),
      "circle-help",
    );
  }

  /* -------------------------------------------------------- Front-end */
  if (yes(answers, "goodFooter")) {
    good(
      list,
      "Footer Pulling Its Weight",
      body(
        "The footer carries trust badges, useful quick links and contact information rather than sitting empty — valuable page real estate that's actually being used.",
      ),
      "badge-check",
    );
  } else if (no(answers, "goodFooter")) {
    badBlock(
      list,
      "Footer Needs Work",
      body(
        "There's excessive empty space in the footer, or key information is missing. This is valuable page real estate — put it to work with trust badges, quick links, a newsletter sign-up or contact details.",
        "Use empty space to your advantage!",
      ),
      "wrench",
    );
  }

  if (yes(answers, "goodCopy") && !vagueLabels) {
    good(
      list,
      "Sharp, Specific Copy",
      body(
        "Buttons and links say exactly where they lead rather than defaulting to generic labels. Every button, section and colour is chosen with intent.",
        "Be explicit and eloquent — that's the standard here already.",
      ),
      "sparkles",
    );
  }

  if (yes(answers, "goodImagery")) {
    reuseGood(list, "builtin:product-imagery");
  } else if (no(answers, "goodImagery")) {
    badBlock(
      list,
      "Image Content Needs Work",
      body(
        "Images that work on desktop are cropping, cutting off or becoming illegible on mobile. Opt for a content treatment that accounts for mobile use — most visitors will see this version first.",
        "Always check the mobile version of the site.",
      ),
      "image-off",
    );
  }

  if (yes(answers, "abPattern")) {
    good(
      list,
      "Alternating Content & Product Layout",
      body(
        "The homepage follows the golden pattern: content with copy and images, then product. Alternating keeps the journey feeling fresh and helps customers find what they want.",
      ),
      "package",
    );
  } else if (no(answers, "abPattern")) {
    badBlock(
      list,
      "Reinforce the Purchase Decision",
      body(
        "The homepage doesn't yet alternate content and product sections. Keep the journey feeling fresh by reinforcing product features with content: product, then some content about it, then more product, then more content.",
        "That rhythm is what keeps customers scrolling toward checkout.",
      ),
      "image",
    );
  }

  if (yes(answers, "hasFavicon")) {
    good(
      list,
      "Fav-Icon Set",
      body(
        "A fav-icon is set, so the store looks intentional in a crowded browser tab bar — a small polish detail that adds up.",
      ),
      "badge-check",
    );
  } else if (no(answers, "hasFavicon")) {
    badBlock(
      list,
      "Missing Fav-Icon",
      body(
        "There's no fav-icon set, so the store shows a generic blank tab next to every other open tab. It's a two-minute fix that makes the brand feel finished.",
      ),
      "circle-help",
    );
  }

  const theme = s(answers, "theme");
  if (theme && /horizon/i.test(theme)) {
    good(
      list,
      "Built on Horizon",
      body(
        `Running on ${theme} — Horizon is a strong overall theme choice, giving a solid, modern foundation to build the rest of the store's UX on.`,
      ),
      "crown",
    );
  }

  if (yes(answers, "checkoutCustomised")) {
    good(
      list,
      "Checkout Page Customised",
      body(
        "The store features a Cart Drawer, Quick Shop and a customised checkout page — all leading to an elevated, clean and easy checkout experience.",
        "The number of clicks a visitor has to make count. Nice one!",
      ),
      "credit-card",
    );
  } else if (no(answers, "checkoutCustomised")) {
    badBlock(
      list,
      "Default, Un-Customised Checkout",
      body(
        "The checkout page is still running the default setup. Customising a storefront should always have the same goal: directing customers towards the checkout page, and the checkout itself needs the same care as the rest of the store.",
        "Every button, paragraph and colour must work in tandem to create flow.",
      ),
      "credit-card",
    );
  }

  /* -------------------------------------------------------------- Social */
  if (yes(answers, "hasSocial")) {
    const followers = n(answers, "socialFollowers");
    // "Underused" needs a reason to say so: an explicit "not posting" or a
    // small following. An unanswered socialActive says nothing either way, and
    // must not be read as a No.
    const active = yes(answers, "socialActive");
    const inactive = no(answers, "socialActive");
    const smallFollowing = followers !== undefined && followers < SOCIAL_FOLLOWERS_GOOD;
    if (active && !smallFollowing) {
      good(
        list,
        "You're a Social Brand",
        body(
          "Active social accounts with a healthy following mean free, natural traffic to the store every time there's a post.",
          "Keep the content flowing!",
        ),
        "crown",
      );
    } else if (inactive || smallFollowing) {
      badBlock(
        list,
        "Underused Social Presence",
        body(
          "There are social accounts, but they're either not active enough or not building an audience yet. A social presence only pays off with regular, consistent posting.",
          "Free traffic is on the table — it just needs feeding.",
        ),
        "frown",
      );
    }
  } else if (no(answers, "hasSocial")) {
    badBlock(
      list,
      "No Social Media Presence",
      body(
        "There's no active social media presence for the store. That's free, natural traffic left entirely on the table, and a missed trust signal for shoppers who check before they buy.",
        "Even a modest, consistent presence compounds over time.",
      ),
      "frown",
    );
  }

  /* ----------------------------------------------------------------- Apps */
  if (yes(answers, "usesPageBuilder")) {
    badBlock(
      list,
      "Page Builder App Slowing You Down",
      body(
        "A page-builder app is doing work the theme's own native sections could handle. These tend to inject heavy code that drags down load speed for a feature Shopify already offers natively.",
        "Use apps that truly add value, and bin the ones that don't.",
      ),
      "gauge",
    );
  }

  // Blaming apps is fair when it can be backed up, so this is driven by the
  // reviewer's own measurement and never by a count of installed apps or a
  // hunch. No evidence typed in, no block.
  const slowingApps = s(answers, "slowingApps");
  if (slowingApps) {
    badBlock(
      list,
      "Apps Slowing the Store",
      body(
        `${slowingApps.replace(/[.\s]+$/, "")}.`,
        "Remove or defer anything that doesn't earn its place — every app script is paid for on every page load.",
      ),
      "gauge",
    );
  }

  if (yes(answers, "usesEmailApp")) {
    badBlock(
      list,
      "Paying for Email Marketing You Don't Need",
      body(
        "A third-party email marketing app is handling email at its own added monthly cost, when Shopify's native email tools cover similar functionality with tighter integration into the store.",
        "Pay for what you actually need.",
      ),
      "mail",
    );
  }

  // Anything past the cap is cut here rather than left for the editor to
  // trim: the PDF lays out exactly MAX_GOOD_BLOCKS / MAX_BAD_BLOCKS slots, and a
  // report that opens already over the limit can't be edited back under it
  // without deleting blocks the user never chose to add.
  const strengths = splitByImpact(list.good, MAX_GOOD_BLOCKS);
  const weaknesses = splitByImpact(list.bad, MAX_BAD_BLOCKS);
  data.goodBlocks = strengths.kept;
  data.badBlocks = weaknesses.kept;

  // The action plan follows the shape of a hand-written one: a fix for each
  // weakness raised, then the findings that didn't get a block, then the small
  // settings fixes. A cut weakness gets its fix line too (the plan is a list of
  // things to do, so it doesn't need the observation), and only falls back to
  // the observation for a title with no fix written. A cut strength still
  // deserves its mention in the closing note.
  const fixLine = (b: Block) =>
    `${b.title}: ${FIX[b.title] ?? observation(b.paragraph)}`;
  const plan = [
    ...weaknesses.kept.filter((b) => FIX[b.title]).map(fixLine),
    ...weaknesses.dropped.map(fixLine),
    ...actions,
  ];
  data.actionPlan = plan.join("\n\n");
  if (strengths.dropped.length) {
    // Semicolons, not commas: several titles contain commas ("Buy Now, Pay
    // Later Active"), and this box renders plain text, so bold can't mark them.
    data.goodCustom = `Also working well: ${strengths.dropped.map((b) => b.title).join("; ")}.`;
  }
  return data;
}
