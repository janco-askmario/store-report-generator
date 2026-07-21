/**
 * Fixed report copy (the starred, "always there" template text) plus the
 * default values for the editable, client-specific narrative fields.
 */

// ---- Page 1: Food for thought --------------------------------------------
export const FOOD_FOR_THOUGHT_HEADING = "Cohesion & Customisation";
export const FOOD_FOR_THOUGHT_SUBHEADING =
  "A storefront is a psychological game";

export const DEFAULT_FOOD_FOR_THOUGHT = `Streamlining what your customers see drives them toward what you want them to see: the checkout page.

Currently the store features a checkout page that breeds friction in the customer's mind. Opt for switching to the drawer for a seamless checkout experience.

We can clearly see drop-off from add to cart to checkout: the Checkout Page as well as the App used there halt the progress of shoppers.

Put yourself in the customer's shoes for invaluable insights into your store!`;

// ---- Page 2: 4 golden rules of ecommerce ---------------------------------
export const GOLDEN_RULES_HEADING = "4 Golden Rules of Ecommerce";

export interface GoldenRule {
  title: string;
  body: string;
}

export const GOLDEN_RULES: GoldenRule[] = [
  {
    title: "2 Second Rule",
    body: "If your site doesn't load and a visitor doesn't understand what your site is about in 2 seconds or less — they're gone for good. Page speed and the top of your page are vital!",
  },
  {
    title: "Clicks Count",
    body: "The number of clicks a customer has to make on your site directly affects your revenue. Minimise clicks wherever possible.",
  },
  {
    title: "Clean, Easy Checkout",
    body: "Make checkout as quick and easy as possible with as few fields as possible, no more than 2 shipping rates and loads of payment methods.",
  },
  {
    title: "Trust",
    body: "Help people trust your site. Make sure trust is inspired in your customers at every turn.",
  },
];

export const GOLDEN_RULES_CLOSER_1 =
  "Improvements here directly affect the bottom line.";
export const GOLDEN_RULES_CLOSER_2 =
  "Your online store is not a static asset. It is always evolving and changing according to the data you get back from your visitors. Review your data regularly for valuable insights.";

// ---- Page 3: metric block notes ------------------------------------------
export const DEFAULT_CONVERSION_NOTE =
  "A healthy conversion rate is at 1% and higher. Track this figure as the north-star of every change you make to the storefront.";
export const DEFAULT_AOV_NOTE =
  "The average customer spends between R950 – R1000 online. Where your AOV lands against this benchmark tells us how much room there is to grow basket size.";
export const DEFAULT_ADD_TO_CART_NOTE =
  "This is the share of shoppers who add to cart and then actually check out. We typically target a 30 – 35% ratio — anything below that points to friction at checkout.";

// ---- Static section labels (always rendered) -----------------------------
export const LABELS = {
  storeReport: "STORE REPORT",
  doingWell: "Things You Are Doing Well",
  notes: "Notes",
  successMultiFaceted: "Success Is Multi-Faceted",
  foodForThought: "Food For Thought",
  improveThese: "Improve These",
  conversionRate: "Conversion Rate",
  averageOrderValue: "Average Order Value",
  addToCart: "Add To Cart vs Conversion",
  actionPlanSummary: "Action Plan Summary",
  actionTagline: "Quality traffic. Better shipping. Nicer layout.",
  actionSubtitle: "Stats are for nerds — let's talk ACTION",
  actionSubtitle2: "The Good, The Bad and The Fixable",
  closing: "We'll happily answer any questions you have on our call with you.",
};
