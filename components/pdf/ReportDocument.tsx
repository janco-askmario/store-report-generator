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
import { PdfIcon } from "./PdfIcon";

// Register fonts at module load (before any render). In the browser this uses
// the `/fonts/*` URLs; the Node sample renderer injects data-URI overrides
// before importing this module.
registerFonts();

/* ---------------------------------------------------------- page size */
// Width stays A4; each page's HEIGHT is estimated from its content so the page
// is a tall single canvas that fits exactly (no A4 cutoff, no empty tail).
const PAGE_WIDTH = 595.28;

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
    paddingBottom: 24,
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

  blockWrap: { position: "relative", paddingTop: 22, width: "100%" },
  blockBox: {
    borderWidth: 1.3,
    borderRadius: 2,
    paddingTop: 26,
    paddingBottom: 0,
    alignItems: "center",
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
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 6,
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

  /* green bordered boxes */
  greenBox: {
    borderWidth: 1.5,
    borderColor: C.green,
    borderRadius: 3,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 8,
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
    textAlign: "center",
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
      [160, 6.8],
      [240, 6.2],
      [340, 5.7],
      [460, 5.3],
      [620, 4.9],
    ],
    4.5,
  );
}
function fitTitle(text: string): number {
  return fitStep(text.length, [[30, 8], [44, 7.4], [60, 6.8]], 6.2);
}
function fitBody(text: string): number {
  return fitStep(
    text.length,
    [
      [320, 8.5],
      [640, 8],
      [1000, 7.4],
      [1500, 6.9],
      [2200, 6.4],
    ],
    5.8,
  );
}
function fitMetricValue(v: string): number {
  return fitStep(v.length, [[6, 12], [9, 10.5], [12, 9]], 8);
}
function fitActions(text: string): number {
  return fitStep(
    text.length,
    [
      [700, 8.5],
      [1100, 8],
      [1600, 7.4],
      [2200, 6.9],
      [3000, 6.4],
    ],
    5.8,
  );
}

/* ------------------------------------------------------ page auto-height */
// Estimate rendered height (pt) so each Page can size to its content. We lean
// slightly generous (a touch of bottom slack) so content never overflows onto
// an extra page.
const CONTENT_W = PAGE_WIDTH - 52;
const COL_W = CONTENT_W * 0.318;
const FILL_W = COL_W - 15;
const BOX_W = CONTENT_W - 32;
const SECTION_H = 20 + 12; // header line + marginBottom (marginTop added by caller)

function lineCount(text: string, font: number, width: number, cf = 0.55): number {
  const cpl = Math.max(6, Math.floor(width / (font * cf)));
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return 0;
  return paras.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / cpl)), 0);
}
function estBlock(b: Block, topPad: number): number {
  const tf = fitTitle(b.title || "X");
  const titleH =
    Math.max(1, lineCount(b.title || "X", tf, COL_W - 10, 0.58)) * tf * 1.25 + 6;
  const ff = fitFill(b.paragraph);
  const fillH = b.paragraph
    ? lineCount(b.paragraph, ff, FILL_W, 0.56) * ff * 1.35 + 12
    : 0;
  return 22 + topPad + titleH + fillH;
}
function estGrid(blocks: Block[], topPad: number): number {
  let h = 0;
  for (let i = 0; i < blocks.length; i += 3) {
    const row = blocks.slice(i, i + 3).map((b) => estBlock(b, topPad));
    h += Math.max(...row, 0) + 10;
  }
  return h;
}
function estBox(body: string, bodyFont: number, hasSub: boolean): number {
  return (
    8 +
    22 +
    (12.5 * 1.25 + 5) +
    (hasSub ? 10 * 1.25 + 6 : 0) +
    lineCount(body, bodyFont, BOX_W, 0.55) * bodyFont * 1.45
  );
}

function estimateHeights(data: ReportData): [number, number, number] {
  const good = data.goodBlocks.filter((b) => b.title.trim() || b.paragraph.trim());
  const bad = data.badBlocks.filter((b) => b.title.trim() || b.paragraph.trim());

  // ---- Page 1
  const band = 18 + (data.logo ? 52 : 0) + 30 + 18 + 16 + 18;
  let h1 = band;
  h1 += 16 + SECTION_H + estGrid(good, 26);
  if (data.goodCustom.trim())
    h1 += 16 + SECTION_H + estBox(data.goodCustom, fitBody(data.goodCustom), false);
  h1 += 50 + estBox(data.foodForThought, fitBody(data.foodForThought), true);
  h1 += 24;

  // ---- Page 2
  let h2 = 26 + SECTION_H + estGrid(bad, 26);
  const rulesH = GOLDEN_RULES.reduce(
    (n, r) =>
      n +
      Math.max(1, lineCount(`${r.title}: ${r.body}`, 8.5, BOX_W - 16, 0.55)) *
        8.5 *
        1.4 +
      5,
    0,
  );
  h2 += 8 + 22 + (12.5 * 1.25 + 5) + rulesH; // golden rules box
  h2 += 8 + 18 + 12.5 * 1.25; // "directly affect the bottom line" bar
  h2 += estBox(GOLDEN_RULES_CLOSER_2, 8.5, false); // closer box (heading est adds slack)
  h2 += 24;

  // ---- Page 3
  const actions = parseActionItems(data.actionPlan);
  const asz = fitActions(data.actionPlan);
  const metricNotes = [
    data.page3.conversionNote,
    data.page3.aovNote,
    data.page3.addToCartNote,
  ];
  const metricLabels = [
    LABELS.conversionRate,
    LABELS.averageOrderValue,
    LABELS.addToCart,
  ];
  const metricRow =
    Math.max(
      ...metricNotes.map((note, i) => {
        const tf = fitTitle(metricLabels[i]);
        const titleH =
          Math.max(1, lineCount(metricLabels[i], tf, COL_W - 10, 0.58)) *
            tf *
            1.25 +
          6;
        const ff = fitFill(note);
        const fillH = note
          ? lineCount(note, ff, FILL_W, 0.56) * ff * 1.35 + 12
          : 0;
        return 22 + 46 + titleH + fillH;
      }),
    ) + 10;
  let h3 = 26 + SECTION_H + metricRow;
  h3 += 16 + SECTION_H; // ACTION PLAN SUMMARY
  h3 += 10.5 * 1.25 + 2; // tagline
  const actionsH = actions.reduce(
    (n, a) =>
      n +
      Math.max(
        1,
        lineCount(`${a.title ? `${a.title}: ` : ""}${a.body}`, asz, BOX_W, 0.55),
      ) *
        asz *
        1.45 +
      7,
    0,
  );
  h3 += 8 + 22 + (12.5 * 1.25 + 5) + (10 * 1.25 + 6) + actionsH; // action box
  h3 += 8 + 18 + 12.5 * 1.25; // closing bar
  h3 += 24;

  // Proportional safety so estimation error never overflows onto an extra page.
  const clamp = (h: number) => Math.round(Math.max(420, h * 1.08 + 48));
  return [clamp(h1), clamp(h2), clamp(h3)];
}

/* -------------------------------------------------------------- helpers */
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
    if (idx > 0 && idx <= 64) {
      return { title: chunk.slice(0, idx).trim(), body: chunk.slice(idx + 1).trim() };
    }
    return { body: chunk };
  });
}

function ContentBlock({
  block,
  color,
}: {
  block: Block;
  color: string;
}) {
  return (
    <View style={s.blockWrap} wrap={false}>
      <View style={[s.blockBox, { borderColor: color }]}>
        {block.title ? (
          <Text style={[s.blockTitle, { fontSize: fitTitle(block.title) }]}>
            {block.title}
          </Text>
        ) : (
          <Text style={s.blockTitle}> </Text>
        )}
        {block.paragraph ? (
          <View style={[s.blockFill, { backgroundColor: color }]}>
            <Text style={[s.blockFillText, { fontSize: fitFill(block.paragraph) }]}>
              {block.paragraph}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={s.circleOverlay}>
        <View style={[s.circle, { backgroundColor: color }]}>
          <PdfIcon name={block.icon} size={21} color={C.ink} strokeWidth={1.8} />
        </View>
      </View>
    </View>
  );
}

function BlockGrid({ blocks, kind }: { blocks: Block[]; kind: "good" | "bad" }) {
  return (
    <View style={s.grid}>
      {blocks.map((b, i) => {
        const color = kind === "good" ? goodColor(b) : badColor(b);
        const endOfRow = i % 3 === 2;
        return (
          <View
            key={b.id}
            style={{
              width: "31.8%",
              marginRight: endOfRow ? 0 : "2.3%",
              marginBottom: 10,
            }}
          >
            <ContentBlock block={b} color={color} />
          </View>
        );
      })}
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
    <View style={s.blockWrap} wrap={false}>
      <View style={[s.blockBox, { borderColor: color, paddingTop: 46 }]}>
        <Text style={[s.blockTitle, { fontSize: fitTitle(label) }]}>{label}</Text>
        {note ? (
          <View style={[s.blockFill, { backgroundColor: color }]}>
            <Text style={[s.blockFillText, { fontSize: fitFill(note) }]}>
              {note}
            </Text>
          </View>
        ) : null}
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

  const good = data.goodBlocks.filter((b) => b.title.trim() || b.paragraph.trim());
  const bad = data.badBlocks.filter((b) => b.title.trim() || b.paragraph.trim());
  const actions = parseActionItems(data.actionPlan);
  const actionSize = fitActions(data.actionPlan);
  const bulb = getIcon("bulb");
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
              <View style={s.greenBox}>
                <Text style={s.boxHeading}>{LABELS.successMultiFaceted}</Text>
                <Paragraphs
                  text={data.goodCustom}
                  fontSize={fitBody(data.goodCustom)}
                />
              </View>
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
          <View style={s.greenBox}>
            <Text style={s.boxHeading}>{FOOD_FOR_THOUGHT_HEADING}</Text>
            <Text style={s.boxSub}>{FOOD_FOR_THOUGHT_SUBHEADING}</Text>
            <Paragraphs
              text={data.foodForThought}
              fontSize={fitBody(data.foodForThought)}
            />
          </View>
        </View>
      </Page>

      {/* ============================================= PAGE 2 */}
      <Page size={[PAGE_WIDTH, pageH2]} style={s.page}>
        <View style={s.contentTop}>
          <Text style={[s.sectionHeader, { marginTop: 0 }]}>
            {LABELS.improveThese}
          </Text>
          <BlockGrid blocks={bad} kind="bad" />

          <View style={s.greenBox}>
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
          </View>

          <View style={s.greenBar}>
            <Text style={s.greenBarText}>{GOLDEN_RULES_CLOSER_1}</Text>
          </View>

          <View style={s.greenBox}>
            <Text style={s.body}>{GOLDEN_RULES_CLOSER_2}</Text>
          </View>
        </View>
      </Page>

      {/* ============================================= PAGE 3 */}
      <Page size={[PAGE_WIDTH, pageH3]} style={s.page}>
        <View style={s.contentTop}>
          <Text style={[s.sectionHeader, { marginTop: 0 }]}>
            Key Metrics To Remember
          </Text>
          <View style={s.grid}>
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

          <View style={s.greenBox}>
            <Text style={s.boxHeading}>{LABELS.actionSubtitle}</Text>
            <Text style={s.boxSub}>{LABELS.actionSubtitle2}</Text>
            {actions.map((a, i) => (
              <Text
                key={i}
                style={[s.actionItem, { fontSize: actionSize }]}
                wrap={false}
              >
                {a.title ? (
                  <Text style={s.actionLead}>{a.title}: </Text>
                ) : null}
                <Text style={s.actionBody}>{a.body}</Text>
              </Text>
            ))}
          </View>

          <View style={s.greenBar}>
            <Text style={s.greenBarText}>{LABELS.closing}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
