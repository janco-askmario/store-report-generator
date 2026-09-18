# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router) dashboard for building branded **Shopify Store Reports** (audits) and exporting them as 3-page PDFs. Brand colours: `#7948BF` (purple), `#94C147` (green). Reports live in Supabase (Postgres + Auth + Realtime); editing a report is a live multi-user collaborative session backed by Yjs.

## Commands

```bash
npm run dev              # start dashboard (localhost:3000)
npm run build             # production build
npm run start              # serve production build
npm run lint                # next lint
npm run render:sample    # render a fully-populated sample PDF to sample-report.pdf (no UI needed)
npm run set-password      # tsx script, see scripts/set-password.mts
```

There is no automated test suite — verify PDF/layout changes with `render:sample` or by running the dev server and using the **Preview** panel.

Env vars (`.env.local`, from `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing either one fails the middleware closed (500) on every route, not just auth.

Supabase migrations live in `supabase/migrations/` and must be applied **in filename order**. The realtime-collab migration (`20260722000000_realtime_collab.sql`) is load-bearing: without `report_updates`, the editor cannot open a report at all (no single-user fallback).

## Architecture

### Auth gate (`middleware.ts`)
Runs on every non-static route. Three states: no user → redirect to `/login`; user but `is_approved` RPC false → redirect to `/pending` (holding page; RLS is the real gate, this is only UX); approved → normal access, kept out of `/login`/`/pending`. `/reset-password` and `/api/password-reset` are public because Supabase's recovery flow needs to work while signed out.

### Data model (`lib/types.ts`, `lib/store.ts`)
`ReportData` is the canonical report shape — store basics, analytics inputs, Good/Bad `Block[]` (max 6 per section), page-3 notes, action plan. `lib/calc.ts` derives conversion rate, AOV, add-to-cart %, fulfillment rate, and device split from the raw analytics fields — manual entries always override the computed value. `lib/scoring.ts` / `lib/benchmarks.ts` turn those numbers into the health-band scoring shown in the library.

### Realtime collaboration (`lib/collab/`)
This is the architectural core of the editor — read `lib/collab/doc.ts`'s module comment before touching it.

- **`doc.ts`** defines the Yjs shape of a report and the rule for what's shared: prose fields (block bodies/titles, narrative notes, action plan) are `Y.Text` so concurrent typing merges character-by-character; everything else (dates, numbers, toggles, logo) is a plain value where last-write-wins is correct — merging "1000" and "1200" into "12000" would be corruption, not a merge. Blocks are `Y.Array<Y.Map>`, not arrays of plain objects, so concurrent additions/edits don't clobber each other.
  - `ensure*` accessors create a missing node and therefore **write** to the doc; `peek*` accessors only read. Any read path that runs on every render (e.g. `docToReportData`) must use `peek*`, or every render broadcasts and persists a spurious update.
  - `LOCAL_ORIGIN` tags this browser's own deliberate edits — it's what lets `Y.UndoManager` (`createUndoManager`) undo only your own changes, never a colleague's incoming edit or an incidental write from an `ensure*` read.
- **`provider.ts`** wires the Yjs doc to Supabase Realtime (the `report_updates` log + channel auth).
- **`useCollabReport.ts`** is the hook components actually use to read/mutate a report.
- **`text.ts`** helpers for binding `Y.Text` to plain React inputs (`CollabField.tsx`).

Undo/redo is wired to ⌘Z/⌘⇧Z (Mac) and Ctrl+Z/Ctrl+⇧Z/Ctrl+Y (Windows/Linux), including inside text fields, because the browser's native undo would fight the shared document.

### PDF rendering
`components/pdf/ReportDocument.tsx` (built with `@react-pdf/renderer`) is the source of truth for the 3-page layout (Cover/KPIs/Good blocks/Food for Thought → Improve These/Golden Rules → Numbers/Performance/Action Plan). `components/pdf/render.tsx` dynamically imports the renderer and document so a session that never exports a PDF never loads either. `lib/icons.ts` is a single icon definition set shared by the in-app picker and the PDF, so a block's icon always matches between editor and export.

Live preview (`PreviewSidebar.tsx`, `PdfPreview.tsx`, `lib/usePdfPreview.ts`) re-renders 700ms after the last edit, only while the panel is open, and draws pages onto `<canvas>` via **pdf.js** rather than an `<iframe src=blob>` — a new blob URL would reload the iframe to page one on every keystroke pause. Falls back to the iframe viewer if pdf.js/its worker fails to load.

### Presence / Team panel
`lib/presence.ts` (Realtime presence channel — who's online and which report they have open) + `lib/team.ts` (full roster from `public.profiles`). `TeamSidebar.tsx` wraps the whole page (not an overlay) above the `lg` breakpoint because the panel pushes the layout rather than sitting over it; below `lg` it's an overlay. Open/closed state persists in `localStorage` under `team-panel`, defaulting open. `TeamSidebarToggle` (the hamburger) and the panel talk over a context since they're separate components in the tree.

### Avatars
`lib/avatars.ts` matches people to `public/avatars/*.png` by the local part of their email; addresses that don't carry the person's name go in `BY_ADDRESS`. No picture → coloured initials fallback. Source frames in `pixilart-frames/`.

### Dev-only tooling
`lib/dev-seed.ts` — 10 rapid clicks on the library header logo seeds 200 `[DEV TEST] …` reports (writes to whichever Supabase project is configured, production included); 10 more clicks removes exactly that prefix.

## Conventions worth preserving

- Comments in this codebase explain **why**, often at real length for non-obvious invariants (see `doc.ts`, `middleware.ts`) — match that style when the reasoning isn't obvious from the code, don't add narration comments otherwise.
- `Y.Text` vs. plain value is a deliberate, load-bearing distinction in `doc.ts` — don't casually convert a field from one to the other.
- Manual analytics entries always win over auto-computed values (`lib/calc.ts`) — preserve this when touching the analytics panel.
