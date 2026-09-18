import type { ReportData } from "./types";
import { createBlock, createInitialData } from "./defaults";
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
 * Blocks are pushed with no cap — `MAX_GOOD_BLOCKS` / `MAX_BAD_BLOCKS` only
 * gate the "Add block" button inside the live editor. A generated report can
 * legitimately land over the limit; the user trims it by hand afterwards.
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

interface BlockList {
  good: ReturnType<typeof createBlock>[];
  bad: ReturnType<typeof createBlock>[];
}

function good(list: BlockList, title: string, paragraph: string, icon: string) {
  list.good.push(createBlock({ title, paragraph, icon }));
}

function badBlock(list: BlockList, title: string, paragraph: string, icon: string) {
  list.bad.push(createBlock({ title, paragraph, icon }));
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
const FULFILLMENT_GOOD = 95;
const FULFILLMENT_BAD = 85;
const ATC_CONVERSION_GOOD = 25; // orders / addedToCart, %
const SOCIAL_SALES_SHARE_GOOD = 15; // % of gross sales
const SOCIAL_SALES_SHARE_BAD = 30;
const APP_COUNT_BAD = 15;
const SOCIAL_FOLLOWERS_GOOD = 1000;

export function buildReportFromAnswers(answers: Answers): ReportData {
  const data = createInitialData();
  const list: BlockList = { good: [], bad: [] };

  /* ------------------------------------------------------------- Overview */
  // Both are optional — an empty answer keeps createInitialData()'s defaults
  // (blank start date, reportDate defaulted to today) rather than blanking
  // out a sensible default.
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
    badBlock(
      list,
      "Slow Loading Speed (LCP)",
      body(
        "Bloated app code is dragging the Largest Contentful Paint down. Visitors bounce before the page is even usable — a direct hit to conversion.",
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
    if (rate >= FULFILLMENT_GOOD) {
      good(
        list,
        "High Fulfillment Rate",
        body(
          "Orders that are made are being fulfilled almost 100% of the time — customers are getting what they paid for, reliably.",
          "That reliability is exactly what a returning customer rate is built on.",
        ),
        "package",
      );
    } else if (rate < FULFILLMENT_BAD) {
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
      badBlock(
        list,
        "Drop-Off From Cart to Checkout",
        body(
          "There's a clear drop-off between add-to-cart and reaching checkout — more than the normal threshold. That points to friction before the customer even sees the checkout page: shipping cost surprises, a clunky cart drawer, or an unclear next step.",
          "This needs to change yesterday.",
        ),
        "cart",
      );
    } else {
      badBlock(
        list,
        "Checkout Drop-Off",
        body(
          "Visitors are reaching checkout but not completing it. Currently the checkout page needs a little more love and attention to create a full sense of cohesion between shopping and paying.",
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
          "Quality Traffic Sources",
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
      "Google Ads Doing the Heavy Lifting",
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
  if (yes(answers, "goodNav")) {
    good(
      list,
      "Great Navigation",
      body(
        "Between clear menu structure and an easy path to what customers are looking for, the navigation is helping funnel traffic towards what they want to see much faster.",
        "Brilliant!",
      ),
      "badge-check",
    );
  } else if (no(answers, "goodNav")) {
    badBlock(
      list,
      "Menus & Calls to Action Need Work",
      body(
        "Generic labels lose customers who scan fast. Menus and links need clearer, more enticing direction to help customers find what they want — every link should say where it leads.",
        "Use dropdowns and more specific calls to action.",
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
  } else if (no(answers, "redundantHomeLink")) {
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

  if (yes(answers, "goodCopy")) {
    good(
      list,
      "Sharp, Specific Copy",
      body(
        "Buttons and links say exactly where they lead rather than defaulting to generic labels. Every button, section and colour is chosen with intent.",
        "Be explicit and eloquent — that's the standard here already.",
      ),
      "sparkles",
    );
  } else if (no(answers, "goodCopy")) {
    badBlock(
      list,
      "Bland Copy",
      body(
        "Copy such as 'View' and 'Shop Now' doesn't explicitly tell the customer where they're going. Every button, section and colour must be chosen with intent.",
        "Be explicit and eloquent!",
      ),
      "eye-off",
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
    const active = yes(answers, "socialActive");
    if (active && (followers === undefined || followers >= SOCIAL_FOLLOWERS_GOOD)) {
      good(
        list,
        "You're a Social Brand",
        body(
          "Active social accounts with a healthy following mean free, natural traffic to the store every time there's a post.",
          "Keep the content flowing!",
        ),
        "crown",
      );
    } else {
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

  const appCount = n(answers, "appCount");
  if (appCount !== undefined && appCount >= APP_COUNT_BAD) {
    reuseBad(list, "builtin:dump-apps");
  }

  data.goodBlocks = list.good;
  data.badBlocks = list.bad;
  return data;
}
