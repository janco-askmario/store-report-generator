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
  ExternalLink,
  FileText,
  FilePlus2,
  Loader2,
  LogOut,
  Pencil,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import type { ReportData, StoredReport } from "@/lib/types";
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
import {
  DEV_SEED_CLICKS,
  DEV_SEED_COUNT,
  deleteDevReports,
  isDevSeed,
  seedDevReports,
} from "@/lib/dev-seed";
import { computeHealth } from "@/lib/scoring";
import { storeHref } from "@/lib/url";
import { type PresentUser, usePresence } from "@/lib/presence";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { TeamSidebar, TeamSidebarToggle } from "@/components/TeamSidebar";
import { WhatsNew } from "@/components/WhatsNew";
import { GenerateReportModal } from "@/components/GenerateReportModal";
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
  const [devClicks, setDevClicks] = useState(0);
  const [devBusy, setDevBusy] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);
  const devClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // One subscription for the whole dashboard: the cards badge themselves from
  // `byReport`, the team panel reads the same state rather than opening a second
  // channel (which would publish this tab twice).
  const presence = usePresence(null);
  const { byReport } = presence;

  // Lets the team panel name the report a teammate is in.
  const reportNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports ?? []) {
      map.set(r.id, r.data.storeName || "Untitled report");
    }
    return map;
  }, [reports]);

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

  const [newModalOpen, setNewModalOpen] = useState(false);
  const onNew = () => setNewModalOpen(true);

  const onScratch = async () => {
    const r = await createReport();
    if (r) router.push(`/report/${r.id}`);
    else alert("Could not create the report. Check your connection and retry.");
  };
  const onGenerate = async (data: ReportData) => {
    const r = await createReport(data);
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

  /*
   * Dev test data (see lib/dev-seed.ts).
   *
   * Ten clicks on the logo seed the library with 200 throwaway reports; ten more
   * clear them. Which of the two happens is decided by whether any seeds are
   * currently in the library, so the same gesture toggles.
   */
  const devSeedIds = useMemo(
    () => (reports ?? []).filter(isDevSeed).map((r) => r.id),
    [reports],
  );

  const runDevSeed = async (clearing: boolean) => {
    setDevBusy(true);
    if (clearing) {
      const n = await deleteDevReports(devSeedIds, (done, total) =>
        setDevStatus(`Removing dev test reports… ${done}/${total}`),
      );
      setDevStatus(
        n > 0 ? `Removed ${n} dev test reports` : "Nothing to remove",
      );
    } else {
      setDevStatus(`Generating ${DEV_SEED_COUNT} dev test reports…`);
      const n = await seedDevReports((done, total) =>
        setDevStatus(`Generating dev test reports… ${done}/${total}`),
      );
      setDevStatus(
        n > 0
          ? `Generated ${n} dev test reports`
          : "Could not generate — see the console",
      );
    }
    await refresh();
    setDevBusy(false);
  };

  const onLogoClick = () => {
    if (devBusy) return;
    if (devClickTimer.current) clearTimeout(devClickTimer.current);

    const n = devClicks + 1;
    if (n < DEV_SEED_CLICKS) {
      setDevClicks(n);
      // The streak has to be deliberate: a pause resets it, so stray clicks on
      // the logo never add up to 200 reports. The countdown only shows once
      // someone is clearly mid-gesture.
      if (n >= DEV_SEED_CLICKS - 5) {
        setDevStatus(
          devSeedIds.length > 0
            ? `${DEV_SEED_CLICKS - n} more to remove dev test reports`
            : `${DEV_SEED_CLICKS - n} more to generate dev test reports`,
        );
      }
      devClickTimer.current = setTimeout(() => setDevClicks(0), 1200);
      return;
    }

    setDevClicks(0);
    void runDevSeed(devSeedIds.length > 0);
  };

  useEffect(
    () => () => {
      if (devClickTimer.current) clearTimeout(devClickTimer.current);
    },
    [],
  );

  // Progress messages replace each other while the seed runs; the final one
  // clears itself shortly after.
  useEffect(() => {
    if (!devStatus || devBusy) return;
    const t = setTimeout(() => setDevStatus(null), 3500);
    return () => clearTimeout(t);
  }, [devStatus, devBusy]);

  return (
    <TeamSidebar presence={presence} reportNames={reportNames}>
      <div className="app-bg min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-xl">
          {/* Full-bleed: the hamburger belongs in the corner of the screen, not
              in the corner of a centred column. */}
          <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <TeamSidebarToggle />
              {/* Sized by height, width auto — a 2.8:1 wordmark in a fixed square
                  would squash it. The divider keeps it from reading as one phrase
                  with the page title. The button around it is the dev-test-data
                  trigger — see onLogoClick; the image alt is empty because the
                  button already carries the name. */}
              <button
                type="button"
                onClick={onLogoClick}
                aria-label="AskMario"
                className="shrink-0 rounded-lg outline-none transition active:scale-95"
              >
                <Image
                  src="/AskMario-logo.png"
                  alt=""
                  width={1400}
                  height={500}
                  priority
                  className="h-8 w-auto"
                />
              </button>
              {/* The hamburger costs the row 40px, which a phone cannot spare
                  alongside the wordmark — the page title gives way first. */}
              <span aria-hidden className="hidden h-6 w-px bg-black/10 sm:block" />
              <div className="hidden leading-tight sm:block">
                <span className="text-[19px] font-semibold tracking-tight text-ink">
                  Store Reports
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Icon-only on a phone — the hamburger and the ⓘ took the width the
                  label used to have, and the grid below ends in a New report tile
                  anyway. */}
              <button
                onClick={onNew}
                title="New report"
                className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 text-[13px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 sm:px-4"
              >
                <FilePlus2 size={16} />
                <span className="hidden sm:inline">New report</span>
              </button>
              <WhatsNew />
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

        {/* The full width belongs to the reports — the team roster lives in the
            drawer behind the hamburger above. */}
        <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
          <main className="min-w-0">
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
                    {/* Columns are fitted to the space rather than declared per
                        breakpoint, because the space is no longer the viewport:
                        opening the team panel takes 256px off this container, and
                        auto-fill re-wraps the cards to suit without every width
                        needing its own rule. `min()` keeps the track from
                        overflowing a container narrower than a card. */}
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(19rem,100%),1fr))]">
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

        {devStatus && (
          <div
            role="status"
            className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-xl bg-ink/90 px-3.5 py-2 text-[13px] font-medium text-white shadow-lg backdrop-blur">
              {devBusy && <Loader2 size={14} className="animate-spin" />}
              {devStatus}
            </div>
          </div>
        )}
      </div>

      <GenerateReportModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onScratch={onScratch}
        onGenerate={onGenerate}
      />
    </TeamSidebar>
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
  const href = storeHref(data.storeUrl);
  const name = data.storeName || "Untitled report";
  /*
   * The whole card body opens the report, but the store URL inside it has to be
   * a link to the store — and an <a> cannot live inside a <button>. So the
   * "open" control is a button stretched behind the content instead of wrapped
   * around it, the content ignores pointer events, and the pieces that are
   * themselves interactive opt back in.
   */
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative flex flex-1 flex-col p-4">
        <button
          onClick={onOpen}
          aria-label={`Open ${name}`}
          className="absolute inset-0 rounded-t-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        />
        <div className="pointer-events-none relative flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/5 bg-black/[0.02]">
            {data.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <Store size={20} className="text-ink-soft/40" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-ink">{name}</div>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${data.storeUrl} in a new tab`}
                className="pointer-events-auto inline-flex max-w-full items-center gap-1 text-[12px] text-ink-soft underline-offset-2 transition hover:text-brand-600 hover:underline"
              >
                {/* min-w-0 so the URL truncates instead of stretching the card */}
                <span className="min-w-0 truncate">{data.storeUrl}</span>
                <ExternalLink size={11} className="shrink-0 opacity-70" />
              </a>
            ) : (
              <div className="truncate text-[12px] text-ink-soft">
                {data.storeUrl || "No URL yet"}
              </div>
            )}
            <div className="mt-1 text-[11px] text-ink-soft">
              Updated {fmtDate(report.updatedAt)}
            </div>
          </div>
          {/* score chip — pointer events back on so its tooltip still appears */}
          <div
            className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold"
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
            className="pointer-events-auto relative mt-3 flex w-fit items-center gap-1.5"
            title={`In this report now:\n${viewers.map((v) => v.email).join("\n")}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-leaf-500" />
            <PresenceAvatars users={viewers} size={20} max={3} />
          </div>
        )}
      </div>

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
