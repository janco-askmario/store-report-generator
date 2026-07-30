/**
 * One-off importer: turns the two supplied Store Report PDFs (Foto Discount
 * World and Wigs & Hair Lounge) into rows in the Supabase `reports` table, so
 * they show up on the dashboard exactly as if a teammate had built them in the
 * editor. The report bodies below are the `ReportData` shape from lib/types.ts.
 *
 * The dashboard reads straight from `public.reports`, so a row here == a report
 * in the library. Nothing about this data is special — it goes through the same
 * `data` jsonb column the editor writes to.
 *
 *   # Option A — service-role key (bypasses RLS, stamps any owner):
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   OWNER_EMAIL=someone@yourteam.com \
 *   npx tsx --tsconfig tsconfig.script.json scripts/import-store-reports.mts
 *
 *   # Option B — sign in as a real (approved) user, RLS-clean:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   IMPORT_EMAIL=you@yourteam.com IMPORT_PASSWORD=... \
 *   npx tsx --tsconfig tsconfig.script.json scripts/import-store-reports.mts
 *
 * Env is also read from .env.local / .env if present. Pass --dry-run to print
 * what would be inserted without writing anything.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBlock, createInitialData } from "../lib/defaults";
import type { ReportData } from "../lib/types";

/* ------------------------------------------------------------- tiny .env load */

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const DRY_RUN = process.argv.includes("--dry-run");

/* ---------------------------------------------------------------- report data */

/**
 * The PDFs only print the *derived* add-to-cart conversion (orders ÷ carts), not
 * the raw counts. The page-3 tile recomputes that ratio from `ordersMade` and
 * `addedToCart`, so we set two counts that reproduce the printed percentage
 * exactly. Conversion rate and AOV have manual-override fields, so those come
 * straight from the PDF numbers.
 */

const fotoDiscountWorld: ReportData = {
  ...createInitialData(),
  storeName: "Foto Discount World",
  storeUrl: "",
  startDate: "2026-05-01",
  reportDate: "2026-05-31",
  currency: "R",
  analytics: {
    ...createInitialData().analytics,
    conversionRate: "0.12", // page-3 tile: 0.12%
    averageOrderValue: "11324.28", // page-3 tile: R 11,324.28
    ordersMade: "125", // 125 / 1000 = 12.5% add-to-cart (page-3 tile)
    addedToCart: "1000",
    aovBenchmark: "1000",
  },
  goodBlocks: [
    createBlock({
      icon: "diamond",
      title: "Product Imagery and Overall Impressions",
      paragraph:
        "It is clear that this store sells high-quality photography products, further fortified by high-quality product images. Customers feel like they can buy quality products here!",
      rating: 5,
    }),
    createBlock({
      icon: "users",
      title: "Strong Traffic from the Right Sources",
      paragraph:
        "Your analytics show solid, high-quality traffic numbers and exactly what we want to see: first direct, then other marketing. Customers are coming in!",
      rating: 5,
    }),
    createBlock({
      icon: "monitor",
      title: "Majority Desktop Users",
      paragraph:
        "The vast majority of your traffic is coming from desktop users whom have higher conversion than mobile users. Higher intent users convert!",
      rating: 4,
    }),
    createBlock({
      icon: "eye",
      title: "All Eyes on You",
      paragraph:
        "Foto Discount World has over 14k subscribers on YouTube, meaning traffic to your store whenever you drop another video. You're generating traffic for free!",
      rating: 4,
    }),
    createBlock({
      icon: "shopping-bag",
      title: "Pickup from Store Available",
      paragraph:
        "Offering Pick-up from Store allows customers to fulfil how they want to purchase their products. Less friction means more sales!",
      rating: 4,
    }),
    createBlock({
      icon: "package",
      title: "Broad Catalogue",
      paragraph:
        "Customers are spoiled for choice when visiting your store in the best possible way. Rest assured, customers can find what they want!",
      rating: 4,
    }),
  ],
  badBlocks: [
    createBlock({
      icon: "credit-card",
      title: "Double Check Checkout",
      paragraph:
        "Customise Checkout Page with a logo and colours and allow customers to checkout without having to login. This is CRITICAL. Follow through with design-posture and reduce friction!",
      rating: 5,
    }),
    createBlock({
      icon: "star-half",
      title: "Use Reviews",
      paragraph:
        "An incredible trust-booster, reviews allow customers to express their satisfaction and attracts new customers. Install JudgeMe on your store. Let customers sell your products for you!",
      rating: 5,
    }),
    createBlock({
      icon: "credit-card",
      title: "More Payment Gateways",
      paragraph:
        "Incorporating as many payment gateways as you can muster allows customers to pay the way they want without impairing them at the most critical step. Make payments more accessible!",
      rating: 4,
    }),
    createBlock({
      icon: "ban",
      title: "Limit Pop-ups",
      paragraph:
        "Pop-ups MUST be used sparingly. Overlays disrupt the customer's flow. Check your settings and allow for a longer pop-up delay/remove all together. Don't interrupt the flow!",
      rating: 4,
    }),
    createBlock({
      icon: "search",
      title: "Streamline Navigation",
      paragraph:
        "Nest menus in the header for faster scanability and add more filters with an app called Search and Discovery on collection pages so customers can granularly find what they want. Faster navigation = Faster sales!",
      rating: 4,
    }),
    createBlock({
      icon: "quote",
      title: "Tell Your Story",
      paragraph:
        "Strip the copy from the footer to free some space and create a separate About-us page, allowing customers to connect with your brand emotionally. It's the second-most viewed page on any website/store!",
      rating: 3,
      highlighted: true,
    }),
    createBlock({
      icon: "bug",
      title: "Dump Some Apps",
      paragraph:
        "Apps can make/break a store. While your INP & LCP look good for now, Apps inject code into the store that can slow it down. Fine-comb the apps and bomb the ones that don't offer value to the store.",
      rating: 3,
      highlighted: true,
    }),
    createBlock({
      icon: "image",
      title: "Make It Easier to Shop",
      paragraph:
        "The store's product page features a ton of information and requires some streamlining: opt for thumbnails instead of grid images and let the customer see the product easier. Improve scanability!",
      rating: 3,
      highlighted: true,
    }),
    createBlock({
      icon: "circle-help",
      title: "Use of Metafields",
      paragraph:
        "Offering more information for the customer is always a win; making it sexy is the real challenge. Use metafields to surface informatics and accordions to selectively inform. Make the store not just clever but intuitive.",
      rating: 3,
      highlighted: true,
    }),
  ],
  goodCustom:
    "Foto Discount World is in a really strong position: it immediately builds customer trust with top-notch product imagery and offers a broad catalogue that leaves shoppers spoiled for choice.\n\n" +
    "The store pulls in solid, high-quality traffic from the right sources, massively boosted by an engaged YouTube following of over 14,000 subscribers that drives steady, free traffic with every new video.\n\n" +
    "On top of that, the browsing experience is incredibly smooth — customers have the freedom to choose from multiple payment methods and the convenience of an in-store pickup option, creating a frictionless experience that naturally drives up sales.",
  foodForThought:
    "Streamlining what your customers see drives them toward what you want them to see: the checkout page.\n\n" +
    "Currently the store features an untouched checkout page and breeds friction in the customer's mind. They can't connect the visual style and design-philosophies if they don't look similar.\n\n" +
    "Every link, button and paragraph must be intentional and work toward navigating your customer to checkout all while making sure your brand identity follows along.\n\n" +
    "Give all parts of the store equal amounts of love and cohesion will follow!",
  page3: {
    conversionNote:
      "A healthy conversion rate is at 1% and higher. The store is converting poorly.",
    aovNote:
      "The average customer spend between R950 - R1000 online, and your AOV is 10x that. That's excellent!",
    addToCartNote:
      "Your store converts 12.5% of the time that someone adds something to the cart. We typically target a 30 - 35% ratio and yours is not hitting the mark.",
  },
  actionPlan: [
    "User base: Large amounts of desktop traffic translate to higher conversions and your store is effectively frictionless for mobile users, which is vital since the vast majority of overall web traffic is mobile-based.",
    'Brand Humanisation: By prominently placing the "About Us" link in the header, you can humanise the brand, making customers feel like they\'re buying from a person rather than a faceless server.',
    'Organic Reach and its caveats: With over 14k YouTube subscribers, you have a massive engine for free organic traffic, but while great for the brand, social traffic is notoriously "low-value" for conversions. You are essentially throwing a party where everyone looks at the decor but nobody buys a drink.',
    "Customer Flexibility: Offering multiple payment methods and pick-up options widens your market reach and provides the flexibility modern shoppers crave.",
    'Nav Bar: Using generic links like "Shop" is a psychological dead end that doesn\'t tell the customer what they are shopping for and adds unnecessary clicks. Merge menu items and use Mega-Menu offered by Horizon more effectively.',
    "Visual Inconsistency: Inconsistency in colour-palettes ruins the visual cohesion of the store, causing you to lose the psychological game of e-commerce. Match all your pages' look & feel to create cohesion.",
    "Checkout Hurdles: Customising and decorating the checkout page with CI, as well as allowing customers to buy without logging in will boost conversion.",
    "Build Immediate Trust: Install 'JudgeMe' on your store so customers can express their satisfaction. This allows customers to essentially sell your products for you. Additionally, include delivery promises to dramatically reduce friction by answering questions before they're even asked.",
    "Optimise Copy and Navigation: Move away from aloof language toward intentional, high-converting copy. Strip the long copy from your footer to build a proper safety net, and aggregate menus in the header for faster navigation.",
    "Theme version update: Currently the store is running on Horizon version 3.5.1. It is highly recommended to update it to the latest version (4.1.1), which will be beneficial for store optimisation and longevity. However, updating the store may potentially break sections and pages, which may require extra effort to fix it up.",
  ].join("\n\n"),
};

const wigsAndHairLounge: ReportData = {
  ...createInitialData(),
  storeName: "Wigs and Hair Lounge",
  storeUrl: "",
  startDate: "2026-06-01",
  reportDate: "2026-07-20",
  currency: "R",
  analytics: {
    ...createInitialData().analytics,
    conversionRate: "0.12", // page-3 tile: 0.12%
    averageOrderValue: "1552.32", // page-3 tile: R 1,552.32
    ordersMade: "26", // 26 / 1000 = 2.6% add-to-cart (page-3 tile)
    addedToCart: "1000",
    aovBenchmark: "1000",
  },
  goodBlocks: [
    createBlock({
      icon: "star-half",
      title: "Fortified Trust",
      paragraph:
        "Surfacing reviews on the store strengthens the trust factor. When people see reviews they psychologically identify with your brand. This creates a community of returning customers!",
      rating: 5,
    }),
    createBlock({
      icon: "trending-up",
      title: "High Sales Acceleration",
      paragraph:
        "This shows that the products you are selling on the store are in demand and people want them! Having good purchase incentives will keep these sales consistent. Consistency is key!",
      rating: 5,
    }),
    createBlock({
      icon: "smartphone",
      title: "Majority Mobile Users",
      paragraph:
        "Majority of individuals that browse the web do so from their phone. The high amount of mobile traffic to your store shows that the store is mobile friendly. A for accessibility!",
      rating: 4,
    }),
    createBlock({
      icon: "users",
      title: "You're a Social Brand",
      paragraph:
        "You have a massive following on TikTok, meaning free traffic every time you drop a new bit of content. This creates a community of returning customers!",
      rating: 4,
    }),
    createBlock({
      icon: "chart-column",
      title: "High Average Order Value",
      paragraph:
        "Your analytics show high average order values, meaning that people are willing to spend on your store. Customers are coming in and you're making sales!",
      rating: 5,
    }),
    createBlock({
      icon: "credit-card",
      title: "BNPL Expanding Market",
      paragraph:
        "Having a Buy-now-pay-later payment method opens up your store to a lot more customers who might want premium products but can't afford it immediately. Better affordability for customers makes happy customers!",
      rating: 4,
    }),
  ],
  badBlocks: [
    createBlock({
      icon: "search",
      title: "Busy Nav Bar",
      paragraph:
        "Cutting down on the amount of content that's featured in the banner and removing duplicate nav links will ease the browsing and shopping experience for the customers. Easier navigation means easier purchases!",
      rating: 4,
    }),
    createBlock({
      icon: "bug",
      title: "Broken and Unsupported Theme",
      paragraph:
        "Currently the theme that the store uses is broken and unsupported by Shopify. If there are any new updates released by Shopify, this store will not reap from it's benefits. Shopify is our ally, best let them have our backs!",
      rating: 5,
    }),
    createBlock({
      icon: "credit-card",
      title: "Not Enough Payment Gateways",
      paragraph:
        "Your checkout is currently missing a trick by limiting how people can pay. Offering more payment methods gives customers the freedom to complete the transaction on their own terms. More flexibility means more sales!",
      rating: 4,
    }),
    createBlock({
      icon: "palette",
      title: "Bland Checkout Page",
      paragraph:
        "Customising your checkout page to follow your brand creates an extra level of trust and allows a more premium purchasing experience for your customers. They know they are shopping from the real deal!",
      rating: 4,
    }),
    createBlock({
      icon: "truck",
      title: "No Free Shipping",
      paragraph:
        "Having no free shipping after a certain spending threshold limits the purchasing value for your customers. It creates an incentive for your customers to spend more. More spending incentive means more money in your pocket!",
      rating: 4,
    }),
    createBlock({
      icon: "package",
      title: "No In-Store Pickup",
      paragraph:
        "Adding an option on the for customers to pick up their products from one of your in-store branches allows customers more freedom when purchasing their products. Let customers fulfil how they want to!",
      rating: 3,
    }),
    createBlock({
      icon: "image-off",
      title: "Low Quality Content",
      paragraph:
        "The store currently features product images and banners that are low quality. It is good practice to use product images that reflect the quality of your products. Customers trust products that look high quality!",
      rating: 3,
      highlighted: true,
    }),
    createBlock({
      icon: "shopping-bag",
      title: "No Shopify POS",
      paragraph:
        "Since you operate a physical storefront, implementing Shopify's native Point of Sale (POS) system is highly recommended. This will seamlessly unify your physical and online store inventory, sales, and customer data in real time. Complete the ecosystem!",
      rating: 3,
      highlighted: true,
    }),
    createBlock({
      icon: "megaphone",
      title: "Misguided Marketing",
      paragraph:
        "Your analytics show that Facebook is a high-driver of your sales. However, higher quality traffic sources such as Google Ads are far better at conversion. Opt for stronger marketing!",
      rating: 3,
      highlighted: true,
    }),
  ],
  goodCustom:
    "Hair and Wigs Lounge is in a remarkably strong position, immediately fortifying customer trust by showcasing real reviews on the store. When shoppers see authentic feedback, they psychologically connect with the brand, laying the foundation for a loyal community of returning customers. This trust translates directly into high sales acceleration, proving that your catalog is in high demand.\n\n" +
    "The store's traffic profile is equally impressive, powered by solid, high quality traffic with direct visits leading the charge. Exactly what you want to see for long-term brand health. On top of that, as a true social-first brand, your massive TikTok following acts as a powerful growth engine, driving steady, free traffic to store every time you drop fresh content and deepening your audience's connection to the store.\n\n" +
    "Finally, the browsing experience is perfectly aligned with modern shopping habits: the vast majority of your audience visits via mobile. This heavy mobile traffic proves your store is effortless to navigate on smartphone screens, removing friction where it matters most. An easy-to-use mobile experience directly drives effortless purchases.",
  foodForThought:
    "Streamlining what your customers see drives them toward what you want them to see: the checkout page.\n\n" +
    "Currently the store features a checkout page and breeds friction in the customer's mind: a checkout page needs to follow the same artistic direction as the rest of the store to create cohesion.\n\n" +
    "We can clearly see drop-off from add to cart to checkout: the Checkout Page as well as the App used there halt the progress of shoppers.\n\n" +
    "Put yourself in the customer's shoes for invaluable insights to your store!",
  page3: {
    conversionNote:
      "A healthy conversion rate is at 1% and higher. The store is converting poorly.",
    aovNote:
      "The average customer spend between R950 - R1000 online, and your AOV is above that. That's excellent!",
    addToCartNote:
      "Your store converts 2.6% of the time that someone adds something to the cart. We typically target a 30 - 35% ratio and yours is not hitting the mark at all.",
  },
  actionPlan: [
    "The trust factor is fully realised: An About Us page and store reviews make your store feel authentic, instead of buying from a lifeless server.",
    "Clear the Cluttered Navigation: Cutting down on the amount of content featured in the banner and removing duplicate nav links will ease the browsing and shopping experience for your customers.",
    "Ditch the Broken & Unsupported Theme: Currently, the theme your store uses is broken and unsupported by Shopify. If new updates or features are released, your store won't benefit from them.",
    "Expand Payment Gateway Options: Your checkout is currently missing a trick by limiting how people can pay. Offering more payment methods gives customers the freedom to complete the transaction on their own terms.",
    "Upgrade the Bland Checkout Page: Customizing your checkout page to match your Corporate Identity creates an extra level of trust and delivers a more premium purchasing experience.",
    "Incentivize with Free Shipping: Having no free shipping threshold limits the order value for your customers. Adding a threshold creates a strong incentive for them to add more to their cart.",
    "Add In-Store Pickup: Adding an option at checkout for customers to pick up products from one of your physical store branches gives buyers more freedom during checkout.",
    "Elevate Image Quality: The store currently features product images and banners that are low resolution. Using crisp, professional imagery builds instant credibility and reflects the true quality of your catalog.",
    "Connect the Dots with Shopify POS: Since you operate a physical storefront, implementing Shopify's native Point of Sale (POS) system will seamlessly unify your physical and online store inventory, sales, and customer data in real time.",
    "Focus Your Marketing Where It Matters: Your analytics show Facebook is driving traffic, but higher-quality channels like Google Ads consistently capture shoppers with much higher purchase intent. Shifting your focus toward stronger, high-converting marketing channels will squeeze far more value out of your ad spend and boost your bottom line.",
  ].join("\n\n"),
};

const REPORTS: ReportData[] = [fotoDiscountWorld, wigsAndHairLounge];

/* ------------------------------------------------------------------- insert */

async function resolveOwnerId(admin: SupabaseClient): Promise<string | null> {
  if (process.env.OWNER_USER_ID) return process.env.OWNER_USER_ID;
  const email = process.env.OWNER_EMAIL?.toLowerCase();
  if (!email) return null;
  // Service-role only: page through auth users to find the matching id.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`No auth user found for OWNER_EMAIL=${email}`);
}

async function main() {
  if (DRY_RUN) {
    for (const r of REPORTS) {
      console.log(`\n── ${r.storeName} ─────────────────────────────`);
      console.log(JSON.stringify(r, null, 2));
    }
    console.log(`\n(dry run) ${REPORTS.length} reports would be inserted.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  let client: SupabaseClient;
  let createdBy: string | null;

  if (serviceKey) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    createdBy = await resolveOwnerId(client);
    if (!createdBy) {
      throw new Error(
        "Service-role mode needs OWNER_USER_ID or OWNER_EMAIL so the reports have an owner.",
      );
    }
  } else {
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const email = process.env.IMPORT_EMAIL;
    const password = process.env.IMPORT_PASSWORD;
    if (!anon || !email || !password) {
      throw new Error(
        "Provide either SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY + IMPORT_EMAIL + IMPORT_PASSWORD.",
      );
    }
    client = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    createdBy = data.user?.id ?? null; // RLS: created_by must equal this.
  }

  const rows = REPORTS.map((data) => ({ data, created_by: createdBy }));
  const { data, error } = await client
    .from("reports")
    .insert(rows)
    .select("id, data->>storeName");

  if (error) throw new Error(`Insert failed: ${error.message}`);
  console.log(`✓ Inserted ${data?.length ?? 0} reports:`);
  for (const row of data ?? []) console.log("  •", row.id, row.storeName);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
