/**
 * Generate `IconDef` entries for lib/icons.ts from the installed lucide-react.
 *
 * The block icons cannot be lucide-react components: the same icon has to render
 * in the editor as a DOM <svg> AND in the PDF through @react-pdf/renderer, which
 * only understands its own primitives. So the geometry is stored as plain data
 * and rendered twice.
 *
 * Copying that geometry by hand is how a wrong `d` string gets in — silently,
 * because a malformed path renders as *something*. This reads the exact arrays
 * out of the lucide-react build already in node_modules, so the icons match the
 * ones that were added the same way, at the same version.
 *
 * Usage:  npx tsx --tsconfig tsconfig.script.json scripts/gen-icons.mts
 * Output: TypeScript to paste into the ICONS array in lib/icons.ts.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

interface Wanted {
  /** kebab-case lucide file name, e.g. "shopping-bag" */
  lucide: string;
  /** stable key persisted in report data — never rename one of these */
  key: string;
  label: string;
  group: "good" | "bad" | "neutral";
}

/* The set to generate. Order here is the order in the picker. */
const WANTED: Wanted[] = [
  // ---- Good ---------------------------------------------------------------
  { lucide: "award", key: "award", label: "Award", group: "good" },
  { lucide: "medal", key: "medal", label: "Medal", group: "good" },
  { lucide: "crown", key: "crown", label: "Premium", group: "good" },
  { lucide: "circle-check-big", key: "check-circle", label: "Verified", group: "good" },
  { lucide: "handshake", key: "handshake", label: "Trust", group: "good" },
  { lucide: "quote", key: "quote", label: "Testimonial", group: "good" },
  { lucide: "star-half", key: "star-half", label: "Reviews", group: "good" },

  // ---- Neutral (the nouns of a storefront) --------------------------------
  { lucide: "shopping-bag", key: "shopping-bag", label: "Shopping bag", group: "neutral" },
  { lucide: "credit-card", key: "credit-card", label: "Checkout", group: "neutral" },
  { lucide: "truck", key: "truck", label: "Shipping", group: "neutral" },
  { lucide: "package", key: "package", label: "Product", group: "neutral" },
  { lucide: "receipt", key: "receipt", label: "Orders", group: "neutral" },
  { lucide: "tag", key: "tag", label: "Pricing", group: "neutral" },
  { lucide: "search", key: "search", label: "SEO / Search", group: "neutral" },
  { lucide: "smartphone", key: "smartphone", label: "Mobile", group: "neutral" },
  { lucide: "monitor", key: "monitor", label: "Desktop", group: "neutral" },
  { lucide: "gauge", key: "gauge", label: "Page speed", group: "neutral" },
  { lucide: "image", key: "image", label: "Imagery", group: "neutral" },
  { lucide: "mail", key: "mail", label: "Email", group: "neutral" },
  { lucide: "megaphone", key: "megaphone", label: "Ads", group: "neutral" },
  { lucide: "users", key: "users", label: "Audience", group: "neutral" },
  { lucide: "globe", key: "globe", label: "Traffic", group: "neutral" },
  { lucide: "chart-column", key: "chart-column", label: "Analytics", group: "neutral" },
  { lucide: "palette", key: "palette", label: "Branding", group: "neutral" },

  // ---- Bad ----------------------------------------------------------------
  { lucide: "hourglass", key: "hourglass", label: "Slow", group: "bad" },
  { lucide: "snail", key: "snail", label: "Very slow", group: "bad" },
  { lucide: "image-off", key: "image-off", label: "Missing images", group: "bad" },
  { lucide: "unlink", key: "unlink", label: "Broken link", group: "bad" },
  { lucide: "eye-off", key: "eye-off", label: "Hard to find", group: "bad" },
  { lucide: "circle-help", key: "circle-help", label: "Confusing", group: "bad" },
  { lucide: "shield-off", key: "shield-off", label: "Not secure", group: "bad" },
  { lucide: "bug", key: "bug", label: "Bug", group: "bad" },
];

/** Primitives lib/icons.ts can render in BOTH the browser and the PDF. */
const SUPPORTED = new Set([
  "path",
  "circle",
  "line",
  "polyline",
  "polygon",
  "rect",
]);

type Node = [string, Record<string, string | number>];

function iconDir(): string {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("lucide-react");
  // .../lucide-react/dist/cjs/lucide-react.js → .../dist/esm/icons
  return join(dirname(entry), "..", "esm", "icons");
}

function readNodes(name: string): Node[] {
  const src = readFileSync(join(iconDir(), `${name}.js`), "utf8");

  // const X = createLucideIcon("Name", [ ...nodes... ]);
  const open = src.indexOf("createLucideIcon(");
  if (open === -1) throw new Error(`${name}: no createLucideIcon call`);
  const start = src.indexOf("[", open);
  if (start === -1) throw new Error(`${name}: no node array`);

  let depth = 0;
  let end = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`${name}: unbalanced node array`);

  // A JS array literal with unquoted keys, from a local package file.
  return Function(`return ${src.slice(start, end)}`)() as Node[];
}

function num(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v);
}

function toElement(name: string, [tag, attrs]: Node): string | null {
  switch (tag) {
    case "path":
      return `{ type: "path", d: ${JSON.stringify(attrs.d)} }`;
    case "circle":
      return `{ type: "circle", cx: ${num(attrs.cx)}, cy: ${num(attrs.cy)}, r: ${num(attrs.r)} }`;
    case "line":
      return `{ type: "line", x1: ${num(attrs.x1)}, y1: ${num(attrs.y1)}, x2: ${num(attrs.x2)}, y2: ${num(attrs.y2)} }`;
    case "polyline":
      return `{ type: "polyline", points: ${JSON.stringify(attrs.points)} }`;
    case "polygon":
      return `{ type: "polygon", points: ${JSON.stringify(attrs.points)} }`;
    case "rect": {
      // Lucide emits ry alongside rx and they are always equal here; IconElement
      // carries one radius and applies it to both axes.
      const rx = attrs.rx === undefined ? "" : `, rx: ${num(attrs.rx)}`;
      return `{ type: "rect", x: ${num(attrs.x)}, y: ${num(attrs.y)}, width: ${num(attrs.width)}, height: ${num(attrs.height)}${rx} }`;
    }
    default:
      console.error(
        `  ! ${name}: skipping unsupported <${tag}> — lib/icons.ts has no such primitive.`,
      );
      return null;
  }
}

let skipped = 0;
const out: string[] = [];

for (const want of WANTED) {
  const nodes = readNodes(want.lucide);
  const unsupported = nodes.filter(([tag]) => !SUPPORTED.has(tag));

  if (unsupported.length > 0) {
    console.error(
      `SKIP ${want.lucide} — uses ${unsupported
        .map(([t]) => `<${t}>`)
        .join(", ")}, which would render in the editor but not the PDF.`,
    );
    skipped++;
    continue;
  }

  const els = nodes
    .map((n) => toElement(want.lucide, n))
    .filter((e): e is string => e !== null);

  out.push(
    [
      `  {`,
      `    key: ${JSON.stringify(want.key)},`,
      `    label: ${JSON.stringify(want.label)},`,
      `    group: ${JSON.stringify(want.group)},`,
      `    elements: [`,
      ...els.map((e) => `      ${e},`),
      `    ],`,
      `  },`,
    ].join("\n"),
  );
}

console.error(
  `\nGenerated ${out.length} icon(s)${skipped > 0 ? `, skipped ${skipped}` : ""}.\n`,
);
console.log(out.join("\n"));
