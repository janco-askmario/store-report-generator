import type { ReportData } from "@/lib/types";

/**
 * Build the report PDF in the browser.
 *
 * `@react-pdf/renderer` and the document that drives it are the two largest
 * things this app can load, so they are pulled in on demand rather than
 * bundled into the editor: a session that never opens the preview or presses
 * Generate never pays for them. Both imports are cached after the first call,
 * which matters here — the live preview calls this on every pause in typing.
 */
export async function renderReportPdf(data: ReportData): Promise<Blob> {
  const [{ pdf }, { ReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/ReportDocument"),
  ]);
  return pdf(<ReportDocument data={data} />).toBlob();
}

/** `my-store-report.pdf`, from whatever the store is called. */
export function reportFileName(storeName: string): string {
  const slug = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "store"}-report.pdf`;
}
