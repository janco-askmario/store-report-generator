/**
 * Renders a fully-populated sample report to a PDF file using the Node
 * renderer. This exercises the exact same <ReportDocument> the browser uses,
 * so it's a fast end-to-end check that the PDF pipeline works.
 *
 *   npm run render:sample
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { renderToFile, Font } from "@react-pdf/renderer";
import React from "react";
import { createBlock, createInitialData } from "../lib/defaults";
import { FONT_FILES, setFontOverrides } from "../lib/pdf-fonts";

// Node can't fetch the browser `/fonts/*` URLs — inline the TTFs as data URIs.
const WEIGHTS: Record<string, number> = {
  "Montserrat-Regular.ttf": 400,
  "Montserrat-Medium.ttf": 500,
  "Montserrat-SemiBold.ttf": 600,
  "Montserrat-Bold.ttf": 700,
  "Montserrat-ExtraBold.ttf": 800,
};
const fontMap = Object.fromEntries(
  FONT_FILES.map((f) => [
    f,
    `data:font/ttf;base64,${readFileSync(`${process.cwd()}/public/fonts/${f}`).toString("base64")}`,
  ]),
);
setFontOverrides(fontMap);
// tsx can dual-load @react-pdf/renderer, so also register on the exact Font
// instance that renderToFile uses.
Font.register({
  family: "Montserrat",
  fonts: FONT_FILES.map((f) => ({ src: fontMap[f], fontWeight: WEIGHTS[f] })),
});

const { ReportDocument } = await import("../components/pdf/ReportDocument");

const data = createInitialData();

// Optional: LOGO_PATH=/path/to/logo.png npm run render:sample
const logoPath = process.env.LOGO_PATH;
if (logoPath) {
  const ext = extname(logoPath).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext;
  data.logo = `data:image/${mime};base64,${readFileSync(logoPath).toString("base64")}`;
}

data.storeName = "Peak Cycles";
data.storeUrl = "www.peakcycles.co.za";
data.startDate = "2024-03-01";
data.reportDate = "2026-07-20";
data.currency = "R";

data.analytics = {
  conversionRate: "1.20",
  grossSales: "684250",
  ordersMade: "236",
  ordersFulfilled: "228",
  averageOrderValue: "2900",
  bestSellingProduct: "Carbon Trail Pro 29",
  mobileSessions: "13400",
  desktopSessions: "6260",
  addedToCart: "4956",
  aovBenchmark: "1000",
};

data.socials = {
  enabled: true,
  facebook: "820",
  instagram: "1640",
  tiktok: "560",
  custom: [{ id: "c1", label: "Pinterest Sessions", value: "240" }],
};

data.referrers = {
  enabled: true,
  facebook: "24600",
  instagram: "41800",
  tiktok: "9200",
};

data.goodBlocks = [
  createBlock({ icon: "diamond", title: "High-quality product imagery", paragraph: "Crisp, consistent photography signals a premium brand and builds instant trust.", rating: 5, highlighted: true }),
  createBlock({ icon: "star", title: "Reviews on the home page", paragraph: "Social proof is surfaced early — customers feel confident buying here.", rating: 4 }),
  createBlock({ icon: "shield-check", title: "Clear trust signals", paragraph: "Secure-checkout and returns badges are visible above the fold.", rating: 4 }),
  createBlock({ icon: "rocket", title: "Fast collection pages", paragraph: "Category browsing is snappy and keeps shoppers moving.", rating: 4 }),
  createBlock({ icon: "heart", title: "Strong brand voice", paragraph: "Copy feels human and on-brand throughout the storefront.", rating: 5, highlighted: true }),
  createBlock({ icon: "gem", title: "Thoughtful bundles", paragraph: "Curated kits nudge AOV upward without feeling pushy.", rating: 3 }),
];

data.badBlocks = [
  createBlock({ icon: "clock", title: "Slow LCP from app bloat", paragraph: "Bloated app code drags loading speed down; visitors bounce before it's usable.", rating: 4, highlighted: false }),
  createBlock({ icon: "ban", title: "Cookie pop-up friction", paragraph: "An unnecessary consent banner adds a speed-bump to the journey.", rating: 2, highlighted: true }),
  createBlock({ icon: "x-circle", title: "Empty footer", paragraph: "Valuable real estate wasted — no trust badges, quick links or newsletter.", rating: 3 }),
  createBlock({ icon: "wrench", title: "Checkout page, not drawer", paragraph: "A full checkout page breeds friction; a slide-out drawer is smoother.", rating: 3 }),
  createBlock({ icon: "trending-down", title: "Few payment gateways", paragraph: "Limited options scare off buyers at the finish line.", rating: 4, highlighted: true }),
  createBlock({ icon: "frown", title: "About Us hidden in footer", paragraph: "The brand story is buried — move it to the header to build trust.", rating: 3 }),
  createBlock({ icon: "octagon-alert", title: "No trust badges at checkout", paragraph: "Shoppers hesitate without visible security and returns reassurance.", rating: 3 }),
  createBlock({ icon: "flame", title: "Hero image too heavy", paragraph: "An oversized hero image slows first paint on mobile connections.", rating: 2, highlighted: true }),
  createBlock({ icon: "clock", title: "Slow product filtering", paragraph: "Collection filters lag on large catalogues, frustrating browsing.", rating: 3 }),
];

data.goodCustom =
  "Success here isn't one thing — it's the compounding effect of quality imagery, social proof and a clear brand voice all pulling in the same direction.";

data.actionPlan = `Ditch the Cookie Pop-up: The site currently features a cookie consent banner. Since South African regulations don't strictly demand this, it's just an annoying speed bump. Removing it immediately streamlines the user journey.

Footer Wasteland: There is excessive, empty white space in your footer. This is valuable digital real estate — reclaim it with trust badges, quick links or a newsletter sign-up.

Bland Copy: Generic copy like "View" and "Shop Now" are psychological dead ends. Be explicit and eloquent, and tell shoppers exactly where they're going.

App Spring-Cleaning: Your LCP is tanking because bloated app code is dragging it down. Fine-comb your installed apps and remove the ones that aren't bringing absolute value.`;

if (process.env.STRESS) {
  // Realistic "long" report: wordy blocks, a full success note, and a 9-item
  // action plan (~1,800 chars, matching the original spec example).
  const para =
    "This is a wordy paragraph a thorough auditor might write — enough detail to explain the point clearly to the client, covering imagery, trust signals, layout and checkout friction without padding it out artificially.";
  data.goodBlocks[0].paragraph = para;
  data.badBlocks[0].paragraph = para;
  data.goodCustom =
    "Success here is multi-faceted: strong imagery, visible social proof, a confident brand voice and a fast storefront all compound to build trust and keep returning customers coming back for more. " + para;
  data.foodForThought =
    para + "\n\n" + para + "\n\nPut yourself in the customer's shoes for invaluable insights into your store.";
  data.actionPlan = Array.from(
    { length: 9 },
    (_, i) =>
      `Action Point ${i + 1}: A concrete recommendation for the client explaining what to change and why it moves the needle on conversions.`,
  ).join("\n\n");
}

const out = process.argv[2] || "./sample-report.pdf";

await renderToFile(React.createElement(ReportDocument, { data }), out);
console.log("✓ Rendered sample report to", out);
