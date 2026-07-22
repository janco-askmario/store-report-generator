import { createClient } from "@/lib/supabase/client";

/**
 * Reusable Good/Bad blocks.
 *
 * Most storefronts repeat the same handful of findings, so the copy for those is
 * written once here rather than retyped per audit. Inserting a template creates
 * an ordinary block — it is a starting point, not a link, so editing it afterwards
 * changes only that report.
 *
 * The house set below lives in code deliberately: the copy is versioned and
 * reviewable, and no teammate can delete it mid-audit. Templates the team saves
 * themselves go to `public.block_templates` instead, so they are shared.
 */

export type BlockTemplateKind = "good" | "bad";

export interface BlockTemplate {
  id: string;
  kind: BlockTemplateKind;
  title: string;
  paragraph: string;
  icon: string;
  /** Built-ins ship in code and cannot be deleted from the UI. */
  builtin: boolean;
}

/**
 * Join a block's body and its closing line.
 *
 * The blank line is load-bearing. `lineCount` in the PDF renderer splits on
 * /\n{2,}/ to measure how tall a block will be; a single newline still renders
 * as a line break but is not counted, so every block would under-measure by a
 * line and long sections would quietly overflow their box.
 */
function body(...parts: string[]): string {
  return parts.join("\n\n");
}

/**
 * The house set. `builtin: true` is applied once at the bottom rather than
 * repeated on each entry, so a new template cannot be added without it and
 * accidentally show up as team-deletable.
 */
const HOUSE_TEMPLATES: Omit<BlockTemplate, "builtin">[] = [
  /* ---------------------------------------------------------------- Good */
  {
    id: "builtin:product-imagery",
    kind: "good",
    title: "Product Imagery",
    icon: "image",
    paragraph: body(
      "It is clear that this store sells high-quality products, further fortified by high-quality product images.",
      "Customers feel like they can buy quality products here!",
    ),
  },
  {
    id: "builtin:desktop-majority",
    kind: "good",
    title: "Majority Desktop Users",
    icon: "monitor",
    paragraph: body(
      "The vast majority of your traffic is coming from desktop users, who have higher conversion than mobile users.",
      "Higher intent users convert!",
    ),
  },
  {
    id: "builtin:mobile-majority",
    kind: "good",
    title: "Majority Mobile Users",
    icon: "smartphone",
    paragraph: body(
      "The majority of individuals that browse the web do so from their phone. The high amount of mobile traffic to your store shows that the store is mobile friendly.",
      "A for accessibility!",
    ),
  },
  {
    id: "builtin:store-pickup",
    kind: "good",
    title: "Pick Up from Store Available",
    icon: "shopping-bag",
    paragraph: body(
      "Offering Pick-up from Store allows customers to fulfil how they want to purchase their products.",
      "Less friction means more sales!",
    ),
  },
  {
    id: "builtin:broad-catalogue",
    kind: "good",
    title: "Broad Catalogue",
    icon: "package",
    paragraph: body(
      "Customers are spoiled for choice when visiting your store, in the best possible way.",
      "Rest assured, customers can find what they want!",
    ),
  },

  /* ----------------------------------------------------------------- Bad */
  {
    id: "builtin:payment-gateways",
    kind: "bad",
    title: "More Payment Gateways",
    icon: "credit-card",
    paragraph: body(
      "Incorporating as many payment gateways as you can muster allows customers to pay the way they want, without impairing them at the most critical step.",
      "Make payments more accessible!",
    ),
  },
  {
    id: "builtin:use-reviews",
    kind: "bad",
    title: "Use Reviews",
    icon: "star-half",
    paragraph: body(
      "An incredible trust-booster, reviews allow customers to express their satisfaction and attract new customers. Install Judge.me on your store.",
      "Let customers sell your products for you!",
    ),
  },
  {
    id: "builtin:dump-apps",
    kind: "bad",
    title: "Dump Some Apps",
    icon: "gauge",
    paragraph: body(
      "Apps can make or break a store. While your INP & LCP look good for now, apps inject code into the store that can slow it down.",
      "Fine-comb the apps and bomb the ones that don't offer value to the store.",
    ),
  },
  {
    id: "builtin:metafields",
    kind: "bad",
    title: "Use of Metafields",
    icon: "tag",
    paragraph: body(
      "Offering more information for the customer is always a win; making it sexy is the real challenge. Use metafields to surface informatics, and accordions to selectively inform.",
      "Make the store not just clever but intuitive.",
    ),
  },
  {
    id: "builtin:no-instore-pickup",
    kind: "bad",
    title: "No In-Store Pickup",
    icon: "shopping-bag",
    paragraph: body(
      "Adding an option for customers to pick up their products from one of your in-store branches allows customers more freedom when purchasing their products.",
      "Let customers fulfil how they want to!",
    ),
  },
  {
    id: "builtin:no-shopify-pos",
    kind: "bad",
    title: "No Shopify POS",
    icon: "receipt",
    paragraph: body(
      "Since you operate a physical storefront, implementing Shopify's native Point of Sale (POS) system is highly recommended. This will seamlessly unify your physical and online store inventory, sales and customer data in real time.",
      "Complete the ecosystem!",
    ),
  },
];

export const BUILTIN_TEMPLATES: BlockTemplate[] = HOUSE_TEMPLATES.map((t) => ({
  ...t,
  builtin: true,
}));

/* ------------------------------------------------------ saved templates */

const TABLE = "block_templates";

interface TemplateRow {
  id: string;
  kind: BlockTemplateKind;
  title: string;
  paragraph: string;
  icon: string;
}

function fromRow(row: TemplateRow): BlockTemplate {
  return { ...row, builtin: false };
}

export async function listSavedTemplates(): Promise<BlockTemplate[]> {
  const { data, error } = await createClient()
    .from(TABLE)
    .select("id, kind, title, paragraph, icon")
    .order("created_at", { ascending: false });

  if (error) {
    // The picker still has the built-ins, so a failure here degrades rather
    // than blocking the report.
    console.error("listSavedTemplates failed:", error.message);
    return [];
  }
  return (data as TemplateRow[]).map(fromRow);
}

export async function saveTemplate(
  input: Omit<BlockTemplate, "id" | "builtin">,
): Promise<BlockTemplate | undefined> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, created_by: auth.user?.id ?? null })
    .select("id, kind, title, paragraph, icon")
    .single();

  if (error) {
    console.error("saveTemplate failed:", error.message);
    return undefined;
  }
  return fromRow(data as TemplateRow);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await createClient().from(TABLE).delete().eq("id", id);
  if (error) {
    console.error("deleteTemplate failed:", error.message);
    return false;
  }
  return true;
}
