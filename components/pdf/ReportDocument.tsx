import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Block, ReportData } from "@/lib/types";
import { registerFonts } from "@/lib/pdf-fonts";
import {
  computeMetrics,
  effectiveAOV,
  effectiveConversionRate,
  formatDateLong,
  formatMoney,
  formatPct,
  num,
} from "@/lib/calc";
import {
  addToCartVerdict,
  aovVerdict,
  conversionVerdict,
  type Verdict,
} from "@/lib/benchmarks";
import {
  FOOD_FOR_THOUGHT_HEADING,
  FOOD_FOR_THOUGHT_SUBHEADING,
  GOLDEN_RULES,
  GOLDEN_RULES_CLOSER_1,
  GOLDEN_RULES_CLOSER_2,
  GOLDEN_RULES_HEADING,
  LABELS,
} from "@/lib/templates";
import { getIcon } from "@/lib/icons";
import { bulletize, parseInline, toPlain } from "@/lib/richtext";
import { type RatingShape, ratingGlyph, shapeForKind } from "@/lib/rating-glyphs";
import { PdfIcon } from "./PdfIcon";

// Register fonts at module load (before any render). In the browser this uses
// the `/fonts/*` URLs; the Node sample renderer injects data-URI overrides
// before importing this module.
registerFonts();

/* ---------------------------------------------------------- page size */
// Width stays A4; each page's HEIGHT is estimated from its content so the page
// is a tall single canvas that fits exactly (no A4 cutoff, no empty tail).
const PAGE_WIDTH = 595.28;

/* ------------------------------------------------------------- block chrome */
/**
 * Outline weight of every framed container: the good/bad blocks, the page-3
 * metrics, and the green panels (Notes, Food for Thought, Golden Rules, Action
 * Plan). All of them draw the outline as a filled layer rather than a border —
 * see `blockFrame`.
 */
const BLOCK_BORDER = 4.3;
/** Star strip under a rated block: glyph height plus the gap above it. */
const STAR_SIZE = 11.5;
const STAR_GAP = 5;
const STAR_ROW_H = STAR_SIZE + STAR_GAP;

/**
 * Space below the last element on a page. Sized to match the gaps *between*
 * elements (8–16pt) rather than the wider margin a paper page would want —
 * these pages are cut to their content, so a deep foot just reads as a mistake.
 * The estimator adds the same number, so the two can never drift apart.
 */
const PAGE_BOTTOM = 10;

/**
 * Insurance on top of the estimate. Text height is counted from characters, so
 * a page can render a little taller than predicted; if the page is shorter than
 * its content, the last element is pushed onto a page of its own — much worse
 * than a few points of tail. Sized generously (a few lines of body copy) since
 * a bit of empty tail is far cheaper than a block silently spilling onto an
 * orphan page.
 */
const SAFETY = 26;

/* --------------------------------------------------------------- palette */
const C = {
  beige: "#e8e5d6",
  green: "#93c13f",
  greenDk: "#5f7f28",
  red: "#ee4b44",
  orange: "#f5a52e",
  purple: "#7948bf",
  ink: "#1c1c1c",
  inkSoft: "#4a4a44",
  white: "#ffffff",
  muted: "#a49f8c",
};

function goodColor(b: Block) {
  return b.highlighted ? C.purple : C.green;
}
function badColor(b: Block) {
  return b.highlighted ? C.orange : C.red;
}
function metricColor(v: Verdict) {
  switch (v.level) {
    case "poor":
      return C.red;
    case "ok":
      return C.orange;
    case "good":
      return C.green;
    case "great":
      return C.purple;
    default:
      return C.muted;
  }
}

/* ---------------------------------------------------------------- styles */
const s = StyleSheet.create({
  page: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: 8.5,
    color: C.ink,
    backgroundColor: C.beige,
    paddingBottom: PAGE_BOTTOM,
  },

  /* page-1 green header band */
  band: {
    backgroundColor: C.green,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  logoChip: {
    backgroundColor: C.white,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  logoImg: { height: 30 },
  storeReport: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 25,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: C.ink,
    textAlign: "center",
  },
  storeNameH: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 14,
    color: C.ink,
    marginTop: 1,
    textAlign: "center",
  },
  dateRange: {
    fontFamily: "Montserrat",
    fontWeight: 500,
    fontSize: 10,
    color: "#33420f",
    marginTop: 4,
    textAlign: "center",
  },

  content: { paddingHorizontal: 26 },
  contentTop: { paddingHorizontal: 26, paddingTop: 26 },

  /* centred section header on beige */
  sectionHeader: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 15.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: C.ink,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
  },

  /* blocks grid */
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
  },

  blockWrap: { position: "relative", paddingTop: 22, width: "100%" },
  /**
   * The outline is a filled rectangle with the content inset on top of it, not
   * a `borderWidth`. react-pdf draws a border as four mitered polygons, and at
   * anything heavier than a hairline the diagonal seam where two edges meet
   * leaves the page showing through at each corner.
   */
  blockFrame: {
    borderRadius: 2,
    padding: BLOCK_BORDER,
  },
  blockInner: {
    backgroundColor: C.beige, // the page colour, so the frame reads as an outline
    paddingTop: 26,
    paddingBottom: 0,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: STAR_GAP,
  },
  blockTitle: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: C.ink,
    textAlign: "center",
    marginBottom: 6,
    paddingHorizontal: 5,
  },
  blockFill: {
    // Bleeds back out over the frame it sits on. Same colour, so the join is
    // invisible — and two abutting shapes can't leave a seam if they overlap.
    // Its outer edge now *is* the block's edge, so it carries the frame radius.
    marginHorizontal: -BLOCK_BORDER,
    marginBottom: -BLOCK_BORDER,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  blockFillText: {
    fontFamily: "Montserrat",
    fontWeight: 500,
    fontSize: 6.8,
    color: C.white,
    textAlign: "center",
    lineHeight: 1.35,
  },
  circleOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  /* metric circles (page 3) */
  metricCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 11,
    color: C.white,
    textAlign: "center",
  },

  /* green bordered boxes — framed the same way as the blocks */
  greenFrame: {
    backgroundColor: C.green,
    borderRadius: 3,
    padding: BLOCK_BORDER,
    marginTop: 8,
  },
  greenInner: {
    backgroundColor: C.beige,
    borderRadius: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  boxHeading: {
    fontFamily: "Montserrat",
    fontWeight: 800,
    fontSize: 12.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.ink,
    textAlign: "center",
    marginBottom: 5,
  },
  boxSub: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 10,
    color: C.ink,
    textAlign: "center",
    marginBottom: 6,
  },
  body: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: 8.5,
    color: C.ink,
    textAlign: "center",
    lineHeight: 1.45,
    marginBottom: 5,
  },
  greenBar: {
    backgroundColor: C.green,
    borderRadius: 3,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  greenBarText: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 10,
    color: C.ink,
    textAlign: "center",
  },

  /* action tagline */
  tagline: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 10.5,
    color: C.ink,
    textAlign: "center",
    marginBottom: 2,
  },

  /* action items */
  actionItem: {
    fontFamily: "Montserrat",
    fontSize: 8.5,
    color: C.ink,
    textAlign: "left",
    lineHeight: 1.45,
    marginBottom: 7,
  },
  actionLead: { fontWeight: 700 },
  actionBody: { fontWeight: 400 },

  /* golden rules list */
  ruleRow: { flexDirection: "row", marginBottom: 5 },
  ruleNum: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 8.5,
    width: 14,
    color: C.ink,
  },
  ruleText: {
    flex: 1,
    fontFamily: "Montserrat",
    fontSize: 8.5,
    lineHeight: 1.4,
    color: C.ink,
  },

  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 12,
  },
});

/* --------------------------------------------------------- font fitting */
/**
 * react-pdf has no auto-fit, so we shrink the font as text gets longer. This
 * keeps long block paragraphs and custom passages inside their box / page
 * instead of overflowing.
 */
function fitStep(len: number, steps: [number, number][], min: number): number {
  for (const [max, size] of steps) if (len <= max) return size;
  return min;
}
function fitFill(text: string): number {
  return fitStep(
    text.length,
    [
      [160, 8],
      [240, 7.4],
      [340, 6.9],
      [460, 6.5],
      [620, 6.1],
    ],
    5.8,
  );
}
function fitTitle(text: string): number {
  return fitStep(
    text.length,
    [
      [30, 9],
      [44, 8.4],
      [60, 7.8],
    ],
    7.2,
  );
}
function fitBody(text: string): number {
  return fitStep(
    text.length,
    [
      [320, 9.5],
      [640, 9],
      [1000, 8.4],
      [1500, 7.8],
      [2200, 7.3],
    ],
    6.9,
  );
}
function fitMetricValue(v: string): number {
  return fitStep(
    v.length,
    [
      [6, 13],
      [9, 11.5],
      [12, 10],
    ],
    9,
  );
}
function fitActions(text: string): number {
  return fitStep(
    text.length,
    [
      [700, 9.5],
      [1100, 9],
      [1600, 8.4],
      [2200, 7.8],
      [3000, 7.3],
    ],
    6.9,
  );
}

/* ------------------------------------------------------ page auto-height */
// Estimate rendered height (pt) so each Page can size to its content. We lean
// slightly generous (a touch of bottom slack) so content never overflows onto
// an extra page.
const CONTENT_W = PAGE_WIDTH - 52;
const COL_W = CONTENT_W * 0.318;
// The frame insets the content, so a heavier outline leaves less room for the
// title. The fill bleeds back over the frame, so it keeps the full width.
const BLOCK_INNER_W = COL_W - BLOCK_BORDER * 2;
const FILL_W = COL_W - 12; // blockFill paddingHorizontal
const TITLE_W = BLOCK_INNER_W - 10; // blockTitle paddingHorizontal
// Green panel text width: frame on both sides plus greenInner's 14pt padding.
const BOX_W = CONTENT_W - BLOCK_BORDER * 2 - 28;
/** marginTop + frame top/bottom + greenInner's vertical padding. */
const BOX_CHROME_H = 8 + BLOCK_BORDER * 2 + 22;
const SECTION_H = 20 + 12; // header line + marginBottom (marginTop added by caller)

/**
 * Average character width as a fraction of font size, for body copy in the
 * green panels. Calibrated against rendered output, biased conservative (a
 * little dead space at the page tail) rather than tight: undercounting here
 * is what pushes the last element onto an orphan page of its own.
 */
const BOX_CF = 0.56;

/**
 * Rendered lines a string will take at `font` in `width`.
 *
 * `hardBreaks` is not a detail: a bulleted list is one paragraph containing
 * single newlines, and where those newlines survive to the page (block fills
 * and action items) each one starts a line. The green panels are the exception
 * — `Paragraphs` collapses single newlines to spaces before rendering, so
 * counting them there would invent lines that never appear.
 */
/**
 * Capitals are roughly a third wider than lowercase in Montserrat, so a line of
 * SHOUTED COPY fits far fewer characters than the same count of prose. Without
 * this, an all-caps passage is under-measured and its last line is pushed onto
 * a page of its own.
 */
function charFactor(text: string, base: number): number {
  const letters = text.replace(/[^A-Za-z]/g, "");
  const caps = letters
    ? (letters.match(/[A-Z]/g) ?? []).length / letters.length
    : 0;
  // Anything outside ASCII is assumed wider than a Latin letter rather than
  // narrower — accented copy is close, CJK is roughly double, and guessing low
  // here is the expensive direction.
  const wide = text
    ? (text.match(/[^\x00-\x7F]/g) ?? []).length / text.length
    : 0;
  return base * (1 + 0.38 * caps + 0.8 * wide);
}

function lineCount(
  text: string,
  font: number,
  width: number,
  cf = 0.55,
  hardBreaks = false,
): number {
  const cpl = Math.max(6, Math.floor(width / (font * charFactor(text, cf))));
  const wrapped = (segment: string) =>
    Math.max(1, Math.ceil(segment.trim().length / cpl));
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return 0;
  return paras.reduce(
    (n, p) =>
      n +
      (hardBreaks
        ? p.split("\n").reduce((m, line) => m + wrapped(line), 0)
        : wrapped(p)),
    0,
  );
}
/** Anything drawn as a bordered block: the good/bad blocks and the metrics. */
interface BlockLike {
  title: string;
  paragraph: string;
  rating?: number;
}

// Deliberately runs a little wide (0.62 vs the 0.55-ish elsewhere): this drives
// the shared block height, which must land *above* the tallest block — see
// uniformBlockHeight.
function estBlock(b: BlockLike, topPad: number, reserveStars: boolean): number {
  const tf = fitTitle(b.title || "X");
  const titleH =
    Math.max(1, lineCount((b.title || "X").toUpperCase(), tf, TITLE_W, 0.5)) *
      tf *
      1.25 +
    6;
  // Markers are formatting, not characters on the page.
  const plain = toPlain(b.paragraph);
  const ff = fitFill(plain);
  const fillH = plain
    ? lineCount(plain, ff, FILL_W, 0.62, true) * ff * 1.35 + 12
    : 0;
  const starsH = reserveStars ? STAR_ROW_H : 0;
  return 22 + BLOCK_BORDER * 2 + topPad + titleH + fillH + starsH;
}

/**
 * Whether a section shows the star strip at all. It is all or nothing per
 * section: reserving the strip for an unrated block keeps every outline the
 * same height, but reserving it when nobody rated anything would just leave a
 * gap under every block.
 */
function showsStars(blocks: BlockLike[]): boolean {
  return blocks.some((b) => (b.rating ?? 0) > 0);
}
/**
 * One height for every block in a section, taken from its wordiest block, so a
 * grid never looks ragged. react-pdf can't measure text before layout, so the
 * height is estimated generously — if it lands under the tallest block, that
 * block's row grows and only that row is out of step (never clipped). Slack is
 * absorbed by the coloured fill, which stretches to the bottom of the box.
 */
function uniformBlockHeight(blocks: BlockLike[], topPad = 26): number {
  if (!blocks.length) return 0;
  const stars = showsStars(blocks);
  return Math.ceil(
    Math.max(...blocks.map((b) => estBlock(b, topPad, stars))) + 4,
  );
}
/** The metric circle is bigger than a block icon, so it needs more head room. */
const METRIC_TOP_PAD = 46;

/** The three page-3 metrics measured as blocks, so they can share a height. */
function metricBlockLikes(data: ReportData): BlockLike[] {
  return [
    { title: LABELS.conversionRate, paragraph: data.page3.conversionNote },
    { title: LABELS.averageOrderValue, paragraph: data.page3.aovNote },
    { title: LABELS.addToCart, paragraph: data.page3.addToCartNote },
  ];
}

function estGrid(blocks: BlockLike[], topPad: number): number {
  if (!blocks.length) return 0;
  const rows = Math.ceil(blocks.length / 3);
  return rows * (uniformBlockHeight(blocks, topPad) + 10);
}
/** Height of a green panel: chrome, whichever headings it has, then the body. */
function estBox(
  body: string,
  bodyFont: number,
  { heading = true, sub = false }: { heading?: boolean; sub?: boolean } = {},
): number {
  return (
    BOX_CHROME_H +
    (heading ? 12.5 * 1.25 + 5 : 0) +
    (sub ? 10 * 1.25 + 6 : 0) +
    lineCount(body, bodyFont, BOX_W, BOX_CF) * bodyFont * 1.45 +
    paragraphCount(body) * 5 // s.body marginBottom, one per paragraph
  );
}

/** Paragraphs are split on blank lines — see the Paragraphs component. */
function paragraphCount(text: string): number {
  return Math.max(
    1,
    text.split(/\n{2,}/).filter((p) => p.trim()).length,
  );
}

/** A full-width green bar: marginTop + paddingVertical + one 10pt line. */
const BAR_H = 8 + 18 + 10 * 1.25;

function estimateHeights(data: ReportData): [number, number, number] {
  const good = data.goodBlocks.filter(
    (b) => b.title.trim() || b.paragraph.trim(),
  );
  const bad = data.badBlocks.filter(
    (b) => b.title.trim() || b.paragraph.trim(),
  );

  // ---- Page 1
  const band = 18 + (data.logo ? 52 : 0) + 30 + 18 + 16 + 18;
  let h1 = band;
  h1 += 16 + SECTION_H + estGrid(good, 26);
  if (data.goodCustom.trim())
    h1 +=
      16 + SECTION_H + estBox(data.goodCustom, fitBody(data.goodCustom));
  h1 += 50 + estBox(data.foodForThought, fitBody(data.foodForThought), { sub: true });
  h1 += PAGE_BOTTOM;

  // ---- Page 2
  let h2 = 26 + SECTION_H + estGrid(bad, 26);
  const rulesH = GOLDEN_RULES.reduce(
    (n, r) =>
      n +
      Math.max(1, lineCount(`${r.title}: ${r.body}`, 8.5, BOX_W - 16, BOX_CF)) *
        8.5 *
        1.4 +
      5,
    0,
  );
  h2 += BOX_CHROME_H + (12.5 * 1.25 + 5) + rulesH; // golden rules box
  h2 += BAR_H; // "directly affect the bottom line" bar
  h2 += estBox(GOLDEN_RULES_CLOSER_2, 8.5, { heading: false }); // body only
  h2 += PAGE_BOTTOM;

  // ---- Page 3
  const actions = parseActionItems(data.actionPlan);
  const asz = fitActions(toPlain(data.actionPlan));
  const metricRow =
    uniformBlockHeight(metricBlockLikes(data), METRIC_TOP_PAD) + 10;
  let h3 = 26 + SECTION_H + metricRow;
  h3 += 16 + SECTION_H; // ACTION PLAN SUMMARY
  h3 += 10.5 * 1.25 + 2; // tagline
  const actionsH = actions.reduce(
    (n, a) =>
      n +
      Math.max(
        1,
        lineCount(
          `${a.title ? `${a.title}: ` : ""}${toPlain(a.body)}`,
          asz,
          BOX_W,
          BOX_CF,
          true,
        ),
      ) *
        asz *
        1.45 +
      7,
    0,
  );
  h3 += BOX_CHROME_H + (12.5 * 1.25 + 5) + (10 * 1.25 + 6) + actionsH; // action box
  h3 += BAR_H; // closing bar
  h3 += PAGE_BOTTOM;

  /*
   * Each h already carries the page's own 24pt bottom padding, so a perfect
   * estimate would leave exactly that much below the last element — the same
   * breathing room the elements have between them.
   *
   * What is left is insurance. Text height is estimated from character counts,
   * so a page can come out a little taller than predicted; if the page is
   * shorter than its content, the last element is pushed onto a page of its
   * own, which is far worse than a few points of tail. The margin below covers
   * the worst under-prediction measured across the fixture set (short, long,
   * formatted, and deliberately wide-glyph reports) with room to spare.
   */
  const clamp = (h: number) => Math.round(Math.max(420, h + SAFETY));
  return [clamp(h1), clamp(h2), clamp(h3)];
}

/* ------------------------------------------------------------- rich text */
/**
 * Renders `**bold**`, `*italic*` and `__underline__` as real styled runs.
 *
 * Italic runs pin their own weight rather than inheriting it: only 400 and 700
 * italics are registered, and asking react-pdf for an italic at the 500 the
 * block fill uses would fail to resolve.
 */
function RichRuns({ text }: { text: string }) {
  return (
    <>
      {parseInline(bulletize(text)).map((run, i) => (
        <Text
          key={i}
          style={{
            ...(run.bold ? { fontWeight: 700 } : {}),
            ...(run.italic
              ? {
                  fontStyle: "italic" as const,
                  fontWeight: run.bold ? 700 : 400,
                }
              : {}),
            ...(run.underline ? { textDecoration: "underline" as const } : {}),
          }}
        >
          {run.text}
        </Text>
      ))}
    </>
  );
}

/* ---------------------------------------------------------- block rating */
/**
 * The rating the block was given in the editor, in the same glyph the editor
 * shows: stars for a strength, thumbs-down for a problem's severity.
 */
function RatingRow({
  rating,
  color,
  shape,
}: {
  rating: number;
  color: string;
  shape: RatingShape;
}) {
  // An unrated block in a rated section keeps the space, so the outlines below
  // it still line up with its neighbours'.
  if (!rating) return <View style={[s.starRow, { height: STAR_SIZE }]} />;
  const d = ratingGlyph(shape);
  return (
    <View style={s.starRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{ marginHorizontal: 1 }}>
          <Svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 24 24">
            <Path d={d} fill={i < rating ? color : C.muted} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------- helpers */
/** A green-outlined panel: Notes, Food for Thought, Golden Rules, Action Plan. */
function GreenBox({ children }: { children: ReactNode }) {
  return (
    <View style={s.greenFrame}>
      <View style={s.greenInner}>{children}</View>
    </View>
  );
}

function Paragraphs({ text, fontSize }: { text: string; fontSize?: number }) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <Text key={i} style={[s.body, fontSize ? { fontSize } : {}]}>
          {p.replace(/\n/g, " ")}
        </Text>
      ))}
    </>
  );
}

function parseActionItems(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [] as { title?: string; body: string }[];
  let chunks = trimmed
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (chunks.length <= 1) {
    chunks = trimmed
      .split(/\n/)
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return chunks.map((chunk) => {
    const idx = chunk.indexOf(":");
    // The lead-in is only split out when the colon comes before any formatting
    // marker. Someone who bolds their own lead-in has said what they want, and
    // splitting mid-marker would strand a "**" in the middle of the sentence.
    const marker = chunk.search(/\*\*|__|\*/);
    if (idx > 0 && idx <= 64 && (marker === -1 || idx < marker)) {
      return {
        title: chunk.slice(0, idx).trim(),
        body: chunk.slice(idx + 1).trim(),
      };
    }
    return { body: chunk };
  });
}

function ContentBlock({
  block,
  color,
  showStars,
  shape,
}: {
  block: Block;
  color: string;
  showStars: boolean;
  shape: RatingShape;
}) {
  return (
    <View style={[s.blockWrap, { flexGrow: 1 }]} wrap={false}>
      <View style={[s.blockFrame, { backgroundColor: color, flexGrow: 1 }]}>
        <View style={[s.blockInner, { flexGrow: 1 }]}>
          {block.title ? (
            <Text style={[s.blockTitle, { fontSize: fitTitle(block.title) }]}>
              {block.title}
            </Text>
          ) : (
            <Text style={s.blockTitle}> </Text>
          )}
          {block.paragraph ? (
            // flexShrink 0: if the estimate ever falls short the box grows rather
            // than squeezing (and clipping) the paragraph.
            <View
              style={[
                s.blockFill,
                { backgroundColor: color, flexGrow: 1, flexShrink: 0 },
              ]}
            >
              <Text
                style={[
                  s.blockFillText,
                  { fontSize: fitFill(toPlain(block.paragraph)) },
                ]}
              >
                <RichRuns text={block.paragraph} />
              </Text>
            </View>
          ) : (
            <View style={{ flexGrow: 1 }} />
          )}
        </View>
      </View>
      {showStars ? (
        <RatingRow rating={block.rating} color={color} shape={shape} />
      ) : null}
      <View style={s.circleOverlay}>
        <View style={[s.circle, { backgroundColor: color }]}>
          <PdfIcon
            name={block.icon}
            size={21}
            color={C.ink}
            strokeWidth={1.8}
          />
        </View>
      </View>
    </View>
  );
}

function BlockGrid({
  blocks,
  kind,
}: {
  blocks: Block[];
  kind: "good" | "bad";
}) {
  // One height for the whole section: rows stretch their columns to match each
  // other, and the shared minHeight lifts every row up to the wordiest block.
  const rowHeight = uniformBlockHeight(blocks);
  const stars = showsStars(blocks);
  const rows: Block[][] = [];
  for (let i = 0; i < blocks.length; i += 3) rows.push(blocks.slice(i, i + 3));

  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={[s.gridRow, { minHeight: rowHeight }]}>
          {row.map((b, i) => (
            <View
              key={b.id}
              style={{ width: "31.8%", marginRight: i === 2 ? 0 : "2.3%" }}
            >
              <ContentBlock
                block={b}
                color={kind === "good" ? goodColor(b) : badColor(b)}
                showStars={stars}
                shape={shapeForKind(kind)}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MetricBlock({
  value,
  label,
  note,
  color,
}: {
  value: string;
  label: string;
  note: string;
  color: string;
}) {
  return (
    <View style={[s.blockWrap, { flexGrow: 1 }]} wrap={false}>
      <View style={[s.blockFrame, { backgroundColor: color, flexGrow: 1 }]}>
        <View style={[s.blockInner, { paddingTop: 46, flexGrow: 1 }]}>
          <Text style={[s.blockTitle, { fontSize: fitTitle(label) }]}>
            {label}
          </Text>
          {note ? (
            <View
              style={[
                s.blockFill,
                { backgroundColor: color, flexGrow: 1, flexShrink: 0 },
              ]}
            >
              <Text style={[s.blockFillText, { fontSize: fitFill(note) }]}>
                {note}
              </Text>
            </View>
          ) : (
            <View style={{ flexGrow: 1 }} />
          )}
        </View>
      </View>
      <View style={s.circleOverlay}>
        <View style={[s.metricCircle, { backgroundColor: color }]}>
          <Text style={[s.metricValue, { fontSize: fitMetricValue(value) }]}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ============================================================ DOCUMENT */
export function ReportDocument({ data }: { data: ReportData }) {
  const m = computeMetrics(data);
  const conv = effectiveConversionRate(data);
  const aov = effectiveAOV(data);
  const cur = data.currency;
  const convV = conversionVerdict(conv);
  const aovV = aovVerdict(aov, num(data.analytics.aovBenchmark) || null);
  const cartV = addToCartVerdict(m.addToCartConversion);

  const dateRange =
    data.startDate && data.reportDate
      ? `${formatDateLong(data.startDate)} to ${formatDateLong(data.reportDate)}`
      : formatDateLong(data.reportDate || data.startDate);

  const good = data.goodBlocks.filter(
    (b) => b.title.trim() || b.paragraph.trim(),
  );
  const bad = data.badBlocks.filter(
    (b) => b.title.trim() || b.paragraph.trim(),
  );
  const actions = parseActionItems(data.actionPlan);
  const actionSize = fitActions(toPlain(data.actionPlan));
  const bulb = getIcon("bulb");
  const metricHeight = uniformBlockHeight(
    metricBlockLikes(data),
    METRIC_TOP_PAD,
  );
  const [pageH1, pageH2, pageH3] = estimateHeights(data);

  return (
    <Document
      title={`Store Report — ${data.storeName || "Untitled"}`}
      author="AskMario"
    >
      {/* ============================================= PAGE 1 */}
      <Page size={[PAGE_WIDTH, pageH1]} style={s.page}>
        <View style={s.band}>
          {data.logo ? (
            <View style={s.logoChip}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={data.logo} style={s.logoImg} />
            </View>
          ) : null}
          <Text style={s.storeReport}>{LABELS.storeReport}</Text>
          {data.storeName ? (
            <Text style={s.storeNameH}>{data.storeName}</Text>
          ) : null}
          {dateRange ? <Text style={s.dateRange}>{dateRange}</Text> : null}
        </View>

        <View style={s.content}>
          <Text style={s.sectionHeader}>Things You&apos;re Doing Well</Text>
          <BlockGrid blocks={good} kind="good" />

          {data.goodCustom.trim() ? (
            <>
              <Text style={s.sectionHeader}>{LABELS.notes}</Text>
              <GreenBox>
                <Text style={s.boxHeading}>{LABELS.successMultiFaceted}</Text>
                <Paragraphs
                  text={data.goodCustom}
                  fontSize={fitBody(data.goodCustom)}
                />
              </GreenBox>
            </>
          ) : null}

          <View style={s.foodRow}>
            <Text style={[s.sectionHeader, { marginTop: 0, marginBottom: 0 }]}>
              Food For{"  "}
            </Text>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              {bulb.elements.map((el, i) =>
                el.type === "path" ? (
                  <Path
                    key={i}
                    d={el.d}
                    stroke={C.ink}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null,
              )}
            </Svg>
            <Text style={[s.sectionHeader, { marginTop: 0, marginBottom: 0 }]}>
              {"  "}Thought
            </Text>
          </View>
          <GreenBox>
            <Text style={s.boxHeading}>{FOOD_FOR_THOUGHT_HEADING}</Text>
            <Text style={s.boxSub}>{FOOD_FOR_THOUGHT_SUBHEADING}</Text>
            <Paragraphs
              text={data.foodForThought}
              fontSize={fitBody(data.foodForThought)}
            />
          </GreenBox>
        </View>
      </Page>

      {/* ============================================= PAGE 2 */}
      <Page size={[PAGE_WIDTH, pageH2]} style={s.page}>
        <View style={s.contentTop}>
          <Text style={[s.sectionHeader, { marginTop: 0 }]}>
            {LABELS.improveThese}
          </Text>
          <BlockGrid blocks={bad} kind="bad" />

          <GreenBox>
            <Text style={s.boxHeading}>{GOLDEN_RULES_HEADING}</Text>
            {GOLDEN_RULES.map((r, i) => (
              <View key={i} style={s.ruleRow}>
                <Text style={s.ruleNum}>{i + 1}.</Text>
                <Text style={s.ruleText}>
                  <Text style={{ fontWeight: 700 }}>{r.title}: </Text>
                  <Text style={{ fontWeight: 400 }}>{r.body}</Text>
                </Text>
              </View>
            ))}
          </GreenBox>

          <View style={s.greenBar}>
            <Text style={s.greenBarText}>{GOLDEN_RULES_CLOSER_1}</Text>
          </View>

          <GreenBox>
            <Text style={s.body}>{GOLDEN_RULES_CLOSER_2}</Text>
          </GreenBox>
        </View>
      </Page>

      {/* ============================================= PAGE 3 */}
      <Page size={[PAGE_WIDTH, pageH3]} style={s.page}>
        <View style={s.contentTop}>
          <Text style={[s.sectionHeader, { marginTop: 0 }]}>
            Key Metrics To Remember
          </Text>
          {/* Same stretch-to-the-wordiest treatment as the block grids. */}
          <View style={[s.gridRow, { minHeight: metricHeight }]}>
            {[
              {
                value: conv != null ? formatPct(conv, conv < 1 ? 1 : 2) : "—",
                label: LABELS.conversionRate,
                note: data.page3.conversionNote,
                v: convV,
              },
              {
                value: aov != null ? formatMoney(aov, cur) : "—",
                label: LABELS.averageOrderValue,
                note: data.page3.aovNote,
                v: aovV,
              },
              {
                value:
                  m.addToCartConversion != null
                    ? formatPct(m.addToCartConversion)
                    : "—",
                label: LABELS.addToCart,
                note: data.page3.addToCartNote,
                v: cartV,
              },
            ].map((h, i) => (
              <View
                key={i}
                style={{ width: "31.8%", marginRight: i < 2 ? "2.3%" : 0 }}
              >
                <MetricBlock
                  value={h.value}
                  label={h.label}
                  note={h.note}
                  color={metricColor(h.v)}
                />
              </View>
            ))}
          </View>

          <Text style={s.sectionHeader}>{LABELS.actionPlanSummary}</Text>
          <Text style={s.tagline}>{LABELS.actionTagline}</Text>

          <GreenBox>
            <Text style={s.boxHeading}>{LABELS.actionSubtitle}</Text>
            <Text style={s.boxSub}>{LABELS.actionSubtitle2}</Text>
            {actions.map((a, i) => (
              <Text
                key={i}
                style={[s.actionItem, { fontSize: actionSize }]}
                wrap={false}
              >
                {a.title ? <Text style={s.actionLead}>{a.title}: </Text> : null}
                <Text style={s.actionBody}>
                  <RichRuns text={a.body} />
                </Text>
              </Text>
            ))}
          </GreenBox>

          <View style={s.greenBar}>
            <Text style={s.greenBarText}>{LABELS.closing}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
