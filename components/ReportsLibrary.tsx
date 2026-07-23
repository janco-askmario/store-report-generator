"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CloudUpload,
  FileText,
  FilePlus2,
  Loader2,
  LogOut,
  Pencil,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import type { StoredReport } from "@/lib/types";
import {
  clearLegacyReports,
  createReport,
  deleteReport,
  duplicateReport,
  importLegacyReports,
  listReports,
  readLegacyReports,
} from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { computeHealth } from "@/lib/scoring";
import { type PresentUser, usePresence } from "@/lib/presence";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { cx } from "@/components/ui";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAGE_SIZE = 50;

type SortKey =
  | "updated"
  | "created"
  | "name-asc"
  | "name-desc"
  | "health-desc"
  | "health-asc";

const SORT_LABELS: Record<SortKey, string> = {
  updated: "Recently updated",
  created: "Recently created",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "health-desc": "Health (high–low)",
  "health-asc": "Health (low–high)",
};

export function ReportsLibrary() {
  const router = useRouter();
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(0);

  const q = query.trim().toLowerCase();

  // Search (name + URL) then sort. Memoised so unrelated re-renders — presence
  // pings, realtime refetches — don't re-run it on every keystroke.
  const visible = useMemo(() => {
    if (!reports) return null;
    const rows = q
      ? reports.filter(
          (r) =>
            r.data.storeName.toLowerCase().includes(q) ||
            r.data.storeUrl.toLowerCase().includes(q),
        )
      : reports.slice();

    const byName = (a: StoredReport, b: StoredReport) =>
      a.data.storeName.localeCompare(b.data.storeName, undefined, {
        sensitivity: "base",
      });

    switch (sort) {
      case "updated":
        rows.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case "created":
        rows.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "name-asc":
        rows.sort(byName);
        break;
      case "name-desc":
        rows.sort((a, b) => byName(b, a));
        break;
      case "health-desc":
      case "health-asc": {
        const dir = sort === "health-desc" ? -1 : 1;
        const scores = new Map(
          rows.map((r) => [r.id, computeHealth(r.data).score]),
        );
        rows.sort((a, b) => {
          const sa = scores.get(a.id) ?? null;
          const sb = scores.get(b.id) ?? null;
          // Unrated reports have no score — always sink them to the bottom.
          if (sa == null && sb == null) return 0;
          if (sa == null) return 1;
          if (sb == null) return -1;
          return dir * (sa - sb);
        });
        break;
      }
    }
    return rows;
  }, [reports, q, sort]);

  // Jump back to the first page whenever the result set changes under our feet.
  useEffect(() => setPage(0), [q, sort]);

  const total = visible?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visible
    ? visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
    : [];

  const { byReport } = usePresence(null);

  const refresh = async () => setReports(await listReports());
  // The realtime effect below must not re-subscribe every render just to reach
  // the latest closure.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    refresh();
    setLegacyCount(readLegacyReports().length);
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  /*
   * Keep the library live.
   *
   * Events are treated purely as "something changed, go and look" rather than
   * as data. A report's `data` blob carries a base64 logo, so an UPDATE payload
   * can exceed Realtime's ~1MB record limit and arrive truncated — refetching
   * sidesteps that entirely, and also means there is only one code path that
   * turns a row into a `StoredReport`.
   *
   * Debounced because a colleague typing produces a snapshot write every couple
   * of seconds, and each one would otherwise be its own round trip.
   */
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("reports-library")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void refreshRef.current(), 600);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const onNew = async () => {
    const r = await createReport();
    if (r) router.push(`/report/${r.id}`);
    else alert("Could not create the report. Check your connection and retry.");
  };
  const onDuplicate = async (id: string) => {
    await duplicateReport(id);
    await refresh();
  };
  const onDelete = async (id: string, name: string) => {
    if (confirm(`Delete "${name || "Untitled report"}"? This cannot be undone.`)) {
      await deleteReport(id);
      await refresh();
    }
  };
  const onImportLegacy = async () => {
    setImporting(true);
    const n = await importLegacyReports();
    if (n > 0) {
      clearLegacyReports();
      setLegacyCount(0);
      await refresh();
    } else {
      alert("Import failed — your local reports are untouched. Please retry.");
    }
    setImporting(false);
  };
  const onSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="app-bg min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Sized by height, width auto — a 2.8:1 wordmark in a fixed square
                would squash it. The divider keeps it from reading as one phrase
                with the page title. */}
            <Image
              src="/AskMario-logo.png"
              alt="AskMario"
              width={1400}
              height={500}
              priority
              className="h-8 w-auto"
            />
            <span aria-hidden className="h-6 w-px bg-black/10" />
            <div className="leading-tight">
              <span className="text-[19px] font-semibold tracking-tight text-ink">
                Store Reports
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110"
            >
              <FilePlus2 size={16} /> New report
            </button>
            <button
              onClick={onSignOut}
              title={email ? `Sign out of ${email}` : "Sign out"}
              aria-label="Sign out"
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft transition hover:bg-black/[0.04] hover:text-ink"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {legacyCount > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600">
                <CloudUpload size={16} />
              </div>
              <div className="text-[13px] leading-snug text-ink">
                <span className="font-semibold">
                  {legacyCount} report{legacyCount > 1 ? "s" : ""} saved in this browser
                </span>
                <span className="block text-ink-soft">
                  From before reports synced to the cloud. Upload to keep
                  {legacyCount > 1 ? " them" : " it"} on your account.
                </span>
              </div>
            </div>
            <button
              onClick={onImportLegacy}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {importing ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Uploading…
                </>
              ) : (
                "Upload to cloud"
              )}
            </button>
          </div>
        )}

        {reports === null ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="animate-spin text-ink-soft" size={22} />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState onNew={onNew} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                {q
                  ? `${total} of ${reports.length} report${reports.length > 1 ? "s" : ""}`
                  : `${reports.length} report${reports.length > 1 ? "s" : ""}`}
              </h1>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by store name or URL…"
                    aria-label="Search reports"
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-[13px] text-ink shadow-sm outline-none transition placeholder:text-ink-soft/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="relative">
                  <ArrowUpDown
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    aria-label="Sort reports"
                    className="appearance-none rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-9 text-[13px] font-medium text-ink shadow-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
                  />
                </div>
              </div>
            </div>
            {total === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-black/10 bg-white/40 py-16 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-black/[0.03] text-ink-soft">
                  <Search size={22} />
                </div>
                <p className="text-[14px] font-semibold text-ink">
                  No reports match “{query.trim()}”
                </p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Try a different store name or URL.
                </p>
                <button
                  onClick={() => setQuery("")}
                  className="mt-4 rounded-lg px-3 py-1.5 text-[13px] font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pageItems.map((r) => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      viewers={byReport.get(r.id) ?? []}
                      onOpen={() => router.push(`/report/${r.id}`)}
                      onDuplicate={() => onDuplicate(r.id)}
                      onDelete={() => onDelete(r.id, r.data.storeName)}
                    />
                  ))}
                  {!q && safePage === pageCount - 1 && (
                    <button
                      onClick={onNew}
                      className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-white/40 text-brand-600 transition hover:border-brand-400 hover:bg-brand-50"
                    >
                      <FilePlus2 size={24} />
                      <span className="text-[14px] font-semibold">New report</span>
                    </button>
                  )}
                </div>
                {pageCount > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage(safePage - 1)}
                      disabled={safePage === 0}
                      className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-sm transition hover:bg-black/[0.03] disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="px-2 text-[13px] text-ink-soft">
                      Page {safePage + 1} of {pageCount}
                    </span>
                    <button
                      onClick={() => setPage(safePage + 1)}
                      disabled={safePage >= pageCount - 1}
                      className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-sm transition hover:bg-black/[0.03] disabled:pointer-events-none disabled:opacity-40"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ReportCard({
  report,
  viewers,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  report: StoredReport;
  viewers: PresentUser[];
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { data } = report;
  const health = computeHealth(data);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md">
      <button onClick={onOpen} className="flex flex-1 flex-col p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/5 bg-black/[0.02]">
            {data.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <Store size={20} className="text-ink-soft/40" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-ink">
              {data.storeName || "Untitled report"}
            </div>
            <div className="truncate text-[12px] text-ink-soft">
              {data.storeUrl || "No URL yet"}
            </div>
            <div className="mt-1 text-[11px] text-ink-soft">
              Updated {fmtDate(report.updatedAt)}
            </div>
          </div>
          {/* score chip */}
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold"
            style={{
              color: health.color,
              backgroundColor: `${health.color}18`,
              border: `2px solid ${health.color}55`,
            }}
            title={`Health score — ${health.label}`}
          >
            {health.score ?? "—"}
          </div>
        </div>

        {viewers.length > 0 && (
          <div
            className="mt-3 flex items-center gap-1.5"
            title={`In this report now:\n${viewers.map((v) => v.email).join("\n")}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-leaf-500" />
            <PresenceAvatars users={viewers} size={20} max={3} />
          </div>
        )}
      </button>

      <div className="flex items-center gap-1 border-t border-black/5 px-3 py-2">
        <button
          onClick={onOpen}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50"
        >
          <Pencil size={14} /> Open
        </button>
        <button
          onClick={onDuplicate}
          className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition hover:bg-black/[0.03]"
          title="Duplicate"
        >
          <Copy size={14} /> Duplicate
        </button>
        <button
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-red-50 hover:text-danger"
          title="Delete"
          aria-label="Delete report"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <FileText size={30} />
      </div>
      <h2 className="text-[18px] font-semibold text-ink">No reports yet</h2>
      <p className="mt-1 max-w-sm text-[13px] text-ink-soft">
        Create your first Shopify Store Report — fill in the store's metrics, the
        good and the bad, then export a branded PDF for your client.
      </p>
      <button
        onClick={onNew}
        className={cx(
          "mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700",
          "px-5 py-3 text-[14px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110",
        )}
      >
        <FilePlus2 size={17} /> Create your first report
      </button>
    </div>
  );
}
