"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  Cloud,
  CloudOff,
  Download,
  Eraser,
  Eye,
  FileText,
  Gauge,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Store,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type { Block, ReportData, StoredReport } from "@/lib/types";
import { createBlock, createInitialData, maxBlocks, uid } from "@/lib/defaults";
import { computeCompletion } from "@/lib/completion";
import {
  computeMetrics,
  effectiveAOV,
  effectiveConversionRate,
  formatInt,
  formatMoney,
  formatPct,
  num,
} from "@/lib/calc";
import { computeHealth } from "@/lib/scoring";
import {
  addToCartVerdict,
  aovVerdict,
  conversionVerdict,
  fulfillmentVerdict,
  type Verdict,
} from "@/lib/benchmarks";
import { getReport, saveReport } from "@/lib/store";
import { BlockEditor } from "@/components/BlockEditor";
import {
  Field,
  Label,
  MetricPill,
  ScoreRing,
  SectionCard,
  TextArea,
  Toggle,
  cx,
} from "@/components/ui";

type Busy = "idle" | "preview" | "download";
type SaveState = "idle" | "saving" | "saved" | "error";
type BlockKind = "good" | "bad";

/* Resize an uploaded image so logos stay small in localStorage / the PDF. */
async function fileToLogo(file: File, max = 480): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  try {
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const im = new window.Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    if (scale >= 1) return dataUrl;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

/* ---------------------------------------------------------- Sortable block */
function SortableBlock({
  block,
  kind,
  index,
  onUpdate,
  onRemove,
}: {
  block: Block;
  kind: BlockKind;
  index: number;
  onUpdate: (p: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <BlockEditor
        block={block}
        kind={kind}
        index={index}
        onChange={onUpdate}
        onRemove={onRemove}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Block section */
function BlockSection({
  kind,
  title,
  description,
  icon,
  blocks,
  max,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  customLabel,
  customValue,
  onCustom,
  customPlaceholder,
}: {
  kind: BlockKind;
  title: string;
  description: string;
  icon: React.ReactNode;
  blocks: Block[];
  max: number;
  onAdd: () => void;
  onUpdate: (id: string, p: Partial<Block>) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  customLabel?: string;
  customValue?: string;
  onCustom?: (v: string) => void;
  customPlaceholder?: string;
}) {
  const full = blocks.length >= max;
  const ids = blocks.map((b) => b.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    }
  }

  return (
    <SectionCard
      title={title}
      description={description}
      icon={icon}
      aside={
        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-[12px] font-semibold",
            kind === "good" ? "bg-leaf-100 text-leaf-700" : "bg-red-100 text-danger",
          )}
        >
          {blocks.length}/{max}
        </span>
      }
    >
      <div className="space-y-3">
        {blocks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-[13px] text-ink-soft">
            No blocks yet — add up to {max}.
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((b, i) => (
                <SortableBlock
                  key={b.id}
                  block={b}
                  kind={kind}
                  index={i}
                  onUpdate={(p) => onUpdate(b.id, p)}
                  onRemove={() => onRemove(b.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={onAdd}
          disabled={full}
          className={cx(
            "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-[14px] font-semibold transition",
            full
              ? "cursor-not-allowed border-black/10 text-ink-soft/50"
              : kind === "good"
                ? "border-leaf-300 text-leaf-700 hover:bg-leaf-50"
                : "border-red-200 text-danger hover:bg-red-50",
          )}
        >
          <Plus size={17} />
          {full ? `Maximum ${max} blocks` : `Add ${title} block`}
        </button>

        {onCustom && (
          <div className="pt-1">
            <TextArea
              label={customLabel}
              value={customValue ?? ""}
              onChange={onCustom}
              placeholder={customPlaceholder}
              rows={4}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------- Verdict list row */
function VerdictRow({
  label,
  value,
  verdict,
}: {
  label: string;
  value: string;
  verdict: Verdict;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold tabular-nums text-ink">
          {value}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: verdict.color, backgroundColor: `${verdict.color}18` }}
        >
          {verdict.label}
        </span>
      </div>
    </div>
  );
}

/* ============================================================ EDITOR */
export function ReportEditor({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState<Busy>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  /* The load below sets `data`, which would otherwise trip a pointless
     round-trip to Supabase the moment a report is opened. */
  const skipNextSave = useRef(true);

  /* load */
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    skipNextSave.current = true;

    getReport(id).then((r) => {
      if (cancelled) return;
      if (r) {
        setReport(r);
        setData(r.data);
        setStatus("ready");
      } else {
        setStatus("missing");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* autosave */
  useEffect(() => {
    if (status !== "ready" || !report || !data) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    // Longer debounce than the old localStorage write — this is a network call
    // now, and typing a paragraph should not be one request per keystroke.
    const t = setTimeout(async () => {
      setSaveState("saving");
      const ok = await saveReport({ ...report, data });
      setSaveState(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveState("idle"), 1500);
    }, 800);

    return () => clearTimeout(t);
  }, [data, report, status]);

  /* -------- updaters -------- */
  const patch = (p: Partial<ReportData>) =>
    setData((d) => (d ? { ...d, ...p } : d));
  const patchAnalytics = (p: Partial<ReportData["analytics"]>) =>
    setData((d) => (d ? { ...d, analytics: { ...d.analytics, ...p } } : d));
  const patchSocials = (p: Partial<ReportData["socials"]>) =>
    setData((d) => (d ? { ...d, socials: { ...d.socials, ...p } } : d));
  const patchReferrers = (p: Partial<ReportData["referrers"]>) =>
    setData((d) => (d ? { ...d, referrers: { ...d.referrers, ...p } } : d));
  const patchPage3 = (p: Partial<ReportData["page3"]>) =>
    setData((d) => (d ? { ...d, page3: { ...d.page3, ...p } } : d));

  const listKey = (k: BlockKind): "goodBlocks" | "badBlocks" =>
    k === "good" ? "goodBlocks" : "badBlocks";

  const addBlock = (kind: BlockKind) =>
    setData((d) => {
      if (!d) return d;
      const key = listKey(kind);
      if (d[key].length >= maxBlocks(kind)) return d;
      return {
        ...d,
        [key]: [
          ...d[key],
          createBlock({ icon: kind === "good" ? "star" : "alert-triangle" }),
        ],
      };
    });
  const updateBlock = (kind: BlockKind, blockId: string, p: Partial<Block>) =>
    setData((d) =>
      d
        ? {
            ...d,
            [listKey(kind)]: d[listKey(kind)].map((b) =>
              b.id === blockId ? { ...b, ...p } : b,
            ),
          }
        : d,
    );
  const removeBlock = (kind: BlockKind, blockId: string) =>
    setData((d) =>
      d
        ? { ...d, [listKey(kind)]: d[listKey(kind)].filter((b) => b.id !== blockId) }
        : d,
    );
  const reorderBlock = (kind: BlockKind, from: number, to: number) =>
    setData((d) =>
      d ? { ...d, [listKey(kind)]: arrayMove(d[listKey(kind)], from, to) } : d,
    );

  /* logo */
  const onPickLogo = async (file: File | null) => {
    if (!file) return;
    const logo = await fileToLogo(file);
    patch({ logo });
  };

  /* custom socials */
  const addCustomSocial = () =>
    data &&
    patchSocials({
      custom: [...data.socials.custom, { id: uid(), label: "", value: "" }],
    });
  const updateCustomSocial = (
    cid: string,
    p: Partial<{ label: string; value: string }>,
  ) =>
    data &&
    patchSocials({
      custom: data.socials.custom.map((c) => (c.id === cid ? { ...c, ...p } : c)),
    });
  const removeCustomSocial = (cid: string) =>
    data && patchSocials({ custom: data.socials.custom.filter((c) => c.id !== cid) });

  const clearFields = () => {
    if (confirm("Clear every field in this report? This cannot be undone.")) {
      const fresh = createInitialData();
      fresh.goodBlocks = [];
      fresh.badBlocks = [];
      setData(fresh);
    }
  };

  /* PDF */
  const buildBlob = async () => {
    const [{ pdf }, { ReportDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/ReportDocument"),
    ]);
    return pdf(<ReportDocument data={data as ReportData} />).toBlob();
  };
  const slug = (data?.storeName || "store")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const handleDownload = async () => {
    setBusy("download");
    try {
      const blob = await buildBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug || "store"}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      console.error(e);
      alert("Something went wrong generating the PDF. Check the console.");
    } finally {
      setBusy("idle");
    }
  };
  const handlePreview = async () => {
    setBusy("preview");
    try {
      const blob = await buildBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error(e);
      alert("Something went wrong generating the PDF. Check the console.");
    } finally {
      setBusy("idle");
    }
  };

  /* derived */
  const metrics = useMemo(() => (data ? computeMetrics(data) : null), [data]);
  const health = useMemo(() => (data ? computeHealth(data) : null), [data]);
  const completion = useMemo(
    () => (data ? computeCompletion(data) : null),
    [data],
  );

  if (status === "loading") {
    return (
      <div className="app-bg grid min-h-screen place-items-center">
        <Loader2 className="animate-spin text-ink-soft" size={22} />
      </div>
    );
  }
  if (status === "missing" || !data || !metrics || !health || !completion) {
    return (
      <div className="app-bg grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-[15px] font-semibold text-ink">Report not found</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            It may have been deleted by someone on your team.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white"
          >
            <ArrowLeft size={15} /> Back to reports
          </button>
        </div>
      </div>
    );
  }

  const cur = data.currency;
  const conv = effectiveConversionRate(data);
  const aov = effectiveAOV(data);
  const convV = conversionVerdict(conv);
  const cartV = addToCartVerdict(metrics.addToCartConversion);
  const aovV = aovVerdict(aov, num(data.analytics.aovBenchmark) || null);
  const fulV = fulfillmentVerdict(metrics.fulfillmentRate);
  const genDisabled = busy !== "idle";

  return (
    <div className="app-bg min-h-screen pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white text-ink-soft transition hover:bg-black/[0.03]"
              aria-label="Back to reports"
              title="Back to reports"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
                  {data.storeName || "Untitled report"}
                </span>
                <span className="hidden rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-leaf-700 sm:inline">
                  AskMario
                </span>
              </div>
              <span className="flex items-center gap-2 text-[12px] text-ink-soft">
                <span
                  className={cx(
                    "flex items-center gap-1",
                    saveState === "error" && "font-semibold text-danger",
                  )}
                >
                  {saveState === "error" ? (
                    <CloudOff size={12} />
                  ) : (
                    <Cloud size={12} />
                  )}
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Not saved — retrying on next edit"
                        : "Autosaves"}
                </span>
                <span className="text-black/20">·</span>
                <span className="font-semibold text-brand-600">
                  {completion.percent}% complete
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearFields}
              className="hidden items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-black/[0.03] sm:flex"
            >
              <Eraser size={15} /> Clear
            </button>
            <button
              onClick={handlePreview}
              disabled={genDisabled}
              className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
            >
              {busy === "preview" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Eye size={15} />
              )}
              Preview
            </button>
            <button
              onClick={handleDownload}
              disabled={genDisabled}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-60"
            >
              {busy === "download" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              Generate PDF
            </button>
          </div>
        </div>
        {/* completion progress bar */}
        <div className="h-1 w-full bg-black/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-leaf-500 transition-all duration-500"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Store basics */}
          <SectionCard
            title="Store Basics"
            description="The essentials that headline the report."
            icon={<Store size={18} />}
          >
            <div className="grid gap-4">
              <div>
                <Label>Store logo</Label>
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-black/15 bg-black/[0.02]">
                    {data.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.logo}
                        alt="logo preview"
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <ImageIcon size={22} className="text-ink-soft/50" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-black/[0.03]"
                      >
                        <Upload size={15} /> Upload
                      </button>
                      {data.logo && (
                        <button
                          onClick={() => patch({ logo: null })}
                          className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink-soft transition hover:text-danger"
                        >
                          <X size={15} /> Remove
                        </button>
                      )}
                    </div>
                    <span className="text-[12px] text-ink-soft">
                      PNG or JPG, transparent background works best.
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Store name"
                  value={data.storeName}
                  onChange={(v) => patch({ storeName: v })}
                  placeholder="e.g. Peak Cycles"
                />
                <Field
                  label="Store URL"
                  value={data.storeUrl}
                  onChange={(v) => patch({ storeUrl: v })}
                  placeholder="www.peakcycles.co.za"
                  prefix="🔗"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Start date"
                  hint="store opened"
                  type="date"
                  value={data.startDate}
                  onChange={(v) => patch({ startDate: v })}
                />
                <Field
                  label="Report date"
                  hint="today"
                  type="date"
                  value={data.reportDate}
                  onChange={(v) => patch({ reportDate: v })}
                />
                <Field
                  label="Currency"
                  hint="symbol"
                  value={data.currency}
                  onChange={(v) => patch({ currency: v })}
                  placeholder="R"
                />
              </div>
              {metrics.daysLive != null && (
                <p className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                  <Calendar size={13} />
                  Measuring performance across{" "}
                  <strong className="text-brand-700">
                    {formatInt(metrics.daysLive)} days
                  </strong>{" "}
                  since launch.
                </p>
              )}
            </div>
          </SectionCard>

          {/* Analytics */}
          <SectionCard
            title="Analytics"
            description="Enter what Shopify reports — ratios and verdicts are calculated for you."
            icon={<BarChart3 size={18} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Conversion rate"
                hint="blank = auto-calc"
                value={data.analytics.conversionRate}
                onChange={(v) => patchAnalytics({ conversionRate: v })}
                placeholder="1.20"
                suffix="%"
                inputMode="decimal"
              />
              <Field
                label="Gross sales"
                value={data.analytics.grossSales}
                onChange={(v) => patchAnalytics({ grossSales: v })}
                placeholder="125000"
                prefix={cur}
                inputMode="decimal"
              />
              <Field
                label="Orders made"
                value={data.analytics.ordersMade}
                onChange={(v) => patchAnalytics({ ordersMade: v })}
                placeholder="240"
                inputMode="numeric"
              />
              <Field
                label="Orders fulfilled"
                value={data.analytics.ordersFulfilled}
                onChange={(v) => patchAnalytics({ ordersFulfilled: v })}
                placeholder="230"
                inputMode="numeric"
              />
              <Field
                label="Average order value"
                hint="blank = gross ÷ orders"
                value={data.analytics.averageOrderValue}
                onChange={(v) => patchAnalytics({ averageOrderValue: v })}
                placeholder="2900"
                prefix={cur}
                inputMode="decimal"
              />
              <Field
                label="AOV benchmark"
                hint="typical online spend"
                value={data.analytics.aovBenchmark}
                onChange={(v) => patchAnalytics({ aovBenchmark: v })}
                placeholder="1000"
                prefix={cur}
                inputMode="decimal"
              />
              <Field
                label="Added to cart"
                hint="for cart→purchase %"
                value={data.analytics.addedToCart}
                onChange={(v) => patchAnalytics({ addedToCart: v })}
                placeholder="5040"
                inputMode="numeric"
              />
              <Field
                label="Best selling product"
                value={data.analytics.bestSellingProduct}
                onChange={(v) => patchAnalytics({ bestSellingProduct: v })}
                placeholder="Carbon Trail Pro 29"
              />
              <Field
                label="Mobile sessions"
                value={data.analytics.mobileSessions}
                onChange={(v) => patchAnalytics({ mobileSessions: v })}
                placeholder="8200"
                inputMode="numeric"
              />
              <Field
                label="Desktop sessions"
                value={data.analytics.desktopSessions}
                onChange={(v) => patchAnalytics({ desktopSessions: v })}
                placeholder="3100"
                inputMode="numeric"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricPill
                label="Cart → Purchase"
                value={
                  metrics.addToCartConversion != null
                    ? formatPct(metrics.addToCartConversion)
                    : "—"
                }
                color={cartV.level === "none" ? undefined : cartV.color}
                caption={cartV.level === "none" ? undefined : cartV.label}
              />
              <MetricPill
                label="Conversion"
                value={conv != null ? formatPct(conv) : "—"}
                color={convV.level === "none" ? undefined : convV.color}
                caption={convV.level === "none" ? undefined : convV.label}
              />
              <MetricPill
                label="AOV"
                value={aov != null ? formatMoney(aov, cur) : "—"}
                color={aovV.level === "none" ? undefined : aovV.color}
                caption={aovV.level === "none" ? undefined : aovV.label}
              />
              <MetricPill
                label="Fulfilled"
                value={
                  metrics.fulfillmentRate != null
                    ? formatPct(metrics.fulfillmentRate, 0)
                    : "—"
                }
                color={fulV.level === "none" ? undefined : fulV.color}
                caption={fulV.level === "none" ? undefined : fulV.label}
              />
            </div>
          </SectionCard>

          {/* Socials & referrers */}
          <SectionCard
            title="Socials & Referrers"
            description="Optional traffic and referral-sales breakdown."
            icon={<Share2 size={18} />}
            aside={
              <Toggle
                checked={data.socials.enabled}
                onChange={(v) => patchSocials({ enabled: v })}
                label={data.socials.enabled ? "On" : "Off"}
              />
            }
          >
            {data.socials.enabled ? (
              <div className="animate-pop space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Facebook sessions"
                    value={data.socials.facebook}
                    onChange={(v) => patchSocials({ facebook: v })}
                    placeholder="640"
                    inputMode="numeric"
                  />
                  <Field
                    label="Instagram sessions"
                    value={data.socials.instagram}
                    onChange={(v) => patchSocials({ instagram: v })}
                    placeholder="980"
                    inputMode="numeric"
                  />
                  <Field
                    label="TikTok sessions"
                    value={data.socials.tiktok}
                    onChange={(v) => patchSocials({ tiktok: v })}
                    placeholder="410"
                    inputMode="numeric"
                  />
                </div>

                {data.socials.custom.length > 0 && (
                  <div className="space-y-2">
                    {data.socials.custom.map((c) => (
                      <div key={c.id} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field
                            label="Custom label"
                            value={c.label}
                            onChange={(v) => updateCustomSocial(c.id, { label: v })}
                            placeholder="e.g. Pinterest sessions"
                          />
                        </div>
                        <div className="w-32">
                          <Field
                            label="Value"
                            value={c.value}
                            onChange={(v) => updateCustomSocial(c.id, { value: v })}
                            placeholder="120"
                          />
                        </div>
                        <button
                          onClick={() => removeCustomSocial(c.id)}
                          className="mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 text-ink-soft transition hover:text-danger"
                          aria-label="Remove custom social"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={addCustomSocial}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-black/15 px-3 py-2 text-[13px] font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
                >
                  <Plus size={15} /> Add custom input
                </button>

                <div className="rounded-xl border border-black/5 bg-black/[0.015] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">
                      Total sales by referrer
                    </span>
                    <Toggle
                      checked={data.referrers.enabled}
                      onChange={(v) => patchReferrers({ enabled: v })}
                      label={data.referrers.enabled ? "On" : "Off"}
                    />
                  </div>
                  {data.referrers.enabled && (
                    <div className="grid animate-pop gap-4 sm:grid-cols-3">
                      <Field
                        label="Facebook"
                        value={data.referrers.facebook}
                        onChange={(v) => patchReferrers({ facebook: v })}
                        placeholder="18400"
                        prefix={cur}
                        inputMode="decimal"
                      />
                      <Field
                        label="Instagram"
                        value={data.referrers.instagram}
                        onChange={(v) => patchReferrers({ instagram: v })}
                        placeholder="24600"
                        prefix={cur}
                        inputMode="decimal"
                      />
                      <Field
                        label="TikTok"
                        value={data.referrers.tiktok}
                        onChange={(v) => patchReferrers({ tiktok: v })}
                        placeholder="9200"
                        prefix={cur}
                        inputMode="decimal"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft">
                Toggle on if the store drives traffic through social channels.
              </p>
            )}
          </SectionCard>

          {/* Good */}
          <BlockSection
            kind="good"
            title="The Good"
            description="Rate each strength with stars, and tick a block to mark it a purple standout. Drag the handle to reorder."
            icon={<ThumbsUp size={18} />}
            blocks={data.goodBlocks}
            max={maxBlocks("good")}
            onAdd={() => addBlock("good")}
            onUpdate={(bid, p) => updateBlock("good", bid, p)}
            onRemove={(bid) => removeBlock("good", bid)}
            onReorder={(from, to) => reorderBlock("good", from, to)}
            customLabel="Custom paragraph — “Success is Multi-Faceted” (Page 1)"
            customValue={data.goodCustom}
            onCustom={(v) => patch({ goodCustom: v })}
            customPlaceholder="A short closing note celebrating what's working across the store…"
          />

          {/* Bad */}
          <BlockSection
            kind="bad"
            title="The Bad"
            description="Rate each issue's severity with stars, and tick a block to soften it to 'improvable' (orange). Drag to reorder."
            icon={<ThumbsDown size={18} />}
            blocks={data.badBlocks}
            max={maxBlocks("bad")}
            onAdd={() => addBlock("bad")}
            onUpdate={(bid, p) => updateBlock("bad", bid, p)}
            onRemove={(bid) => removeBlock("bad", bid)}
            onReorder={(from, to) => reorderBlock("bad", from, to)}
          />

          {/* Narrative */}
          <SectionCard
            title="Report Narrative"
            description="Editable copy for the fixed insight sections."
            icon={<Sparkles size={18} />}
          >
            <div className="space-y-4">
              <TextArea
                label="Food for Thought — psychological-game passage (Page 1)"
                value={data.foodForThought}
                onChange={(v) => patch({ foodForThought: v })}
                rows={6}
              />
              <TextArea
                label="Conversion Rate note (Page 3)"
                value={data.page3.conversionNote}
                onChange={(v) => patchPage3({ conversionNote: v })}
                rows={3}
              />
              <TextArea
                label="Average Order Value note (Page 3)"
                value={data.page3.aovNote}
                onChange={(v) => patchPage3({ aovNote: v })}
                rows={3}
              />
              <TextArea
                label="Add to Cart vs Conversion note (Page 3)"
                value={data.page3.addToCartNote}
                onChange={(v) => patchPage3({ addToCartNote: v })}
                rows={3}
              />
            </div>
          </SectionCard>

          {/* Action plan */}
          <SectionCard
            title="Action Plan"
            description="The main passage to your client. One action per paragraph — start each with a bold lead-in and a colon."
            icon={<FileText size={18} />}
          >
            <TextArea
              value={data.actionPlan}
              onChange={(v) => patch({ actionPlan: v })}
              rows={12}
              placeholder={
                "Ditch the Cookie Pop-up: The site currently features a cookie consent banner...\n\nFooter Wasteland: There is excessive, empty white space down in your footer..."
              }
            />
            <p className="mt-2 text-[12px] text-ink-soft">
              Tip: separate each action with a blank line. Text before the first
              “:” becomes a bold lead-in in the PDF.
            </p>
          </SectionCard>

          {/* mobile generate */}
          <div className="flex gap-2 xl:hidden">
            <button
              onClick={handlePreview}
              disabled={genDisabled}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[14px] font-semibold text-brand-700 disabled:opacity-60"
            >
              {busy === "preview" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Eye size={16} />
              )}
              Preview
            </button>
            <button
              onClick={handleDownload}
              disabled={genDisabled}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-3 text-[14px] font-semibold text-white shadow-md disabled:opacity-60"
            >
              {busy === "download" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Generate PDF
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden xl:block">
          <div className="sticky top-[84px] space-y-4">
            {/* Completion */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <ListChecks size={15} /> Report Completion
                </div>
                <span className="text-[15px] font-bold text-brand-600">
                  {completion.percent}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500 transition-all duration-500"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              <div className="mb-2 mt-1.5 text-[11px] text-ink-soft">
                {completion.done} of {completion.total} steps done
                {completion.percent === 100 && " — ready to send! 🎉"}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {completion.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    {it.done ? (
                      <CheckCircle2 size={14} className="shrink-0 text-leaf-600" />
                    ) : (
                      <Circle size={14} className="shrink-0 text-ink-soft/30" />
                    )}
                    <span className={cx(it.done ? "text-ink-soft" : "font-medium text-ink")}>
                      {it.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health score */}
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-4 text-[13px] font-semibold text-white">
                <Gauge size={16} /> Store Health Score
              </div>
              <div className="flex flex-col items-center gap-3 p-4">
                <ScoreRing score={health.score} color={health.color} grade={health.grade} />
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{ color: health.color, backgroundColor: `${health.color}18` }}
                >
                  {health.label}
                </span>
                <div className="grid w-full grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-leaf-50 py-2">
                    <div className="text-[16px] font-bold text-leaf-700">
                      {health.strengths}
                    </div>
                    <div className="text-[11px] text-ink-soft">Strengths</div>
                  </div>
                  <div className="rounded-xl bg-red-50 py-2">
                    <div className="text-[16px] font-bold text-danger">
                      {health.issues}
                    </div>
                    <div className="text-[11px] text-ink-soft">Issues</div>
                  </div>
                </div>
                {health.score == null && (
                  <p className="text-center text-[11px] text-ink-soft">
                    Add star ratings to your blocks to generate a score.
                  </p>
                )}
              </div>
            </div>

            {/* Benchmarks */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-ink">
                <BarChart3 size={15} /> Benchmarks
              </div>
              <div className="divide-y divide-black/5">
                <VerdictRow
                  label="Conversion"
                  value={conv != null ? formatPct(conv) : "—"}
                  verdict={convV}
                />
                <VerdictRow
                  label="Cart → Purchase"
                  value={
                    metrics.addToCartConversion != null
                      ? formatPct(metrics.addToCartConversion)
                      : "—"
                  }
                  verdict={cartV}
                />
                <VerdictRow
                  label="Avg Order Value"
                  value={aov != null ? formatMoney(aov, cur) : "—"}
                  verdict={aovV}
                />
                <VerdictRow
                  label="Fulfillment"
                  value={
                    metrics.fulfillmentRate != null
                      ? formatPct(metrics.fulfillmentRate, 0)
                      : "—"
                  }
                  verdict={fulV}
                />
              </div>
              {metrics.totalSessions > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-ink-soft">
                    <span>Mobile {metrics.mobilePct.toFixed(0)}%</span>
                    <span>Desktop {metrics.desktopPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-black/10">
                    <div className="bg-brand-500" style={{ width: `${metrics.mobilePct}%` }} />
                    <div className="bg-leaf-500" style={{ width: `${metrics.desktopPct}%` }} />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDownload}
              disabled={genDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-60"
            >
              {busy === "download" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Download size={17} />
              )}
              Generate PDF Report
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
