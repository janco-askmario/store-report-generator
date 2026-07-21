# AskMario · Store Report Generator

A Next.js dashboard for building branded **Shopify Store Reports** (audits) and
exporting them as polished, 3-page PDFs for clients.

Brand colours: **#7948BF** (purple) and **#94C147** (green).

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Script                 | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dashboard in dev mode                         |
| `npm run build`        | Production build                                        |
| `npm run start`        | Serve the production build                              |
| `npm run render:sample`| Render a fully-populated sample PDF to `sample-report.pdf` (handy for tweaking the PDF layout without clicking through the UI) |

## How it works

- **Dashboard** (`app/page.tsx`) — one screen with every input: logo upload,
  store basics, analytics, socials & referrers, the **Good** and **Bad** block
  builders, editable narrative copy, and the action plan. A sticky "Live
  Analytics" panel shows the auto-calculated ratios. Everything autosaves to
  `localStorage`.
- **Auto-maths** (`lib/calc.ts`) — Conversion, AOV (gross ÷ orders),
  Add-to-Cart → Purchase %, fulfillment rate and device split are computed for
  you. Manual entries always win over the computed value.
- **Blocks** — up to 6 per section. Tick a **Good** block to give it a purple
  "standout" border (default green). Tick a **Bad** block to soften it to an
  orange "improvable" border (default red).
- **PDF** (`components/pdf/ReportDocument.tsx`) — built with
  `@react-pdf/renderer`. Generated in the browser on **Preview** / **Generate
  PDF**; the library is dynamically imported so it never bloats the initial
  page load.
- **Icons** (`lib/icons.ts`) — one shared definition set drives both the
  dashboard picker and the PDF, so a block's icon always matches.

## PDF structure

1. **Page 1** — Cover (STORE REPORT / store name / date range) + KPI strip →
   *Things You Are Doing Well* (2×3) → *Notes / Success is Multi-Faceted* →
   *Food for Thought*.
2. **Page 2** — *Improve These* (2×3) → notes → *4 Golden Rules of Ecommerce*.
3. **Page 3** — *The Numbers* (Conversion / AOV / Add-to-Cart vs Conversion) →
   performance snapshot (+ socials & referrers if enabled) → *Action Plan
   Summary* → closing.

## Notes

- Upload logos as **PNG or JPG** (react-pdf renders those reliably).
- Currency symbol is configurable (defaults to `R`).
- Data lives only in your browser (`localStorage`) — nothing is uploaded.
