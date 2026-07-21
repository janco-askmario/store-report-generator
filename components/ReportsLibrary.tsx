"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  CloudUpload,
  FileText,
  FilePlus2,
  Loader2,
  LogOut,
  Pencil,
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
import { cx } from "@/components/ui";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportsLibrary() {
  const router = useRouter();
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const refresh = async () => setReports(await listReports());

  useEffect(() => {
    refresh();
    setLegacyCount(readLegacyReports().length);
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
              <FileText size={20} />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-ink">
                  Store Reports
                </span>
                <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-leaf-700">
                  AskMario
                </span>
              </div>
              <span className="text-[12px] text-ink-soft">
                Your Shopify store audit reports
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
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                {reports.length} report{reports.length > 1 ? "s" : ""}
              </h1>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onOpen={() => router.push(`/report/${r.id}`)}
                  onDuplicate={() => onDuplicate(r.id)}
                  onDelete={() => onDelete(r.id, r.data.storeName)}
                />
              ))}
              <button
                onClick={onNew}
                className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-white/40 text-brand-600 transition hover:border-brand-400 hover:bg-brand-50"
              >
                <FilePlus2 size={24} />
                <span className="text-[14px] font-semibold">New report</span>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ReportCard({
  report,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  report: StoredReport;
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

        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-700">
            {data.goodBlocks.length} good
          </span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-danger">
            {data.badBlocks.length} to fix
          </span>
        </div>
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
