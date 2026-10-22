# Handoff: Generate-report fixes (PR #6)

Written 2026-10-19. Everything below is on branch `fix/generator-caps-and-unanswered`
(PR [#6](https://github.com/janco-askmario/store-report-generator/pull/6), four commits,
mergeable, based on `main`). It came out of running a real client report end to end
through the live "Generate report" flow and reading every block line by line.

## To accept it

1. Authorize the Vercel preview. The bot comment on the PR says a team member has to
   approve the deploy first (the check is red only for that reason; there is no CI).
2. Review and merge to `main`. The live app keeps the old behaviour until this is
   deployed.
3. There is no test suite and `next lint` is not configured. See "Verifying" below.

## What changed

**Commit 1: generation rules** (`lib/questionnaire.ts`, `lib/questionnaire-rules.ts`)
- Generated blocks are capped at `MAX_GOOD_BLOCKS` / `MAX_BAD_BLOCKS` (6 / 9). Before,
  every matching block was pushed and reports opened at e.g. 14/6.
- Which blocks survive the cap is decided by the `IMPACT` table (1 to 5, keyed by block
  title, default 3). Ties go to the earlier question; survivors keep questionnaire order.
  It is not stored on the block.
- An unanswered "posting regularly?" is no longer read as No ("Underused Social Presence").
- Store name and URL are now asked in step 1 (reports were "Untitled report").
- CLAUDE.md / README said "max 6 per section"; it is 6 Good, 9 Bad.

**Commit 2: UI** (`app/globals.css`, `app/loading.tsx`, `GenerateReportModal`, `ReportsLibrary`)
- Tailwind v4 preflight sets buttons to `cursor: default`, so nothing clickable looked
  clickable. Pointer restored in the base layer (utilities like `cursor-grab` still win).
- `app/loading.tsx` gives navigation immediate feedback. The New report modal keeps its
  spinner until the route changes instead of clearing it mid-transition.

**Commit 3: truthful, specific blocks** (rules + questionnaire)
- Dropped "High Fulfillment Rate" (a baseline, not a strength; fulfilled can exceed placed).
- "Slow Loading Speed" no longer blames app code. New optional `lcpCause` question names
  the real element.
- Cart/checkout drop-off blocks state the actual percentages instead of a list of guesses.
  New `shippingOverTwoRates` question raises "Too Many Shipping Options at Checkout".
- "Menus & Calls to Action" and "Bland Copy" were one finding raised twice: now one
  "Vague Menu & Button Labels" block, and the matching praise blocks are suppressed so a
  report can't praise navigation and fault its labels together.
- "Google Ads Doing the Heavy Lifting" and "Quality Traffic Sources" were the same finding:
  one title ("Traffic From the Right Sources"). `good()` / `badBlock()` skip a title that
  is already in the list.
- Removed the app-count "Dump Some Apps" rule and its question.

**Commit 4: apps, with evidence** (rules + questionnaire)
- New optional `slowingApps` question. Filled in: "Apps Slowing the Store" quotes the
  reviewer's measurement. Blank: no block. An app count or a hunch never raises one.

## The principle behind the copy changes

These reports are the product, so every block has to be true and specific:
- State what was observed, with numbers, not a menu of possible causes.
- Never say the same thing twice, and never praise and fault the same thing.
- Blame (apps, code, a channel) only with evidence the reviewer typed in.
- A high value of a baseline metric is not a strength.

## Decisions that are judgement calls

- The `IMPACT` weights. Skim the table at the top of `lib/questionnaire-rules.ts` and
  change any you disagree with. A script check that every emitted title has a weight is
  in "Verifying".
- Cutting by impact, then restoring questionnaire order, rather than showing the
  strongest first.
- "Returning Customer Rate Too High" (house rule: outside 20 to 35%) is still raised; its
  second sentence ("not winning enough new customers") is an inference, not a measurement.

## Known issues, not fixed (rough priority)

1. Cart-to-checkout and checkout-completion drop-off are an if/else, so only one block can
   appear even when both leaks exist. Decided 22 Oct: there is no house threshold for
   checkout completion. Higher is better, but it's relative to the store, so the reviewer
   judges it and no fixed cut-off is coded.
2. "Paid Social Ads Underperforming" fires for any store running social ads, with no
   performance check.
3. "Inconsistent Shipping Fees by Location" penalises calculated carrier rates (normal);
   "No Shopify POS" penalises stores that don't need POS; "Paying for Email Marketing You
   Don't Need" asserts Shopify Email is an equivalent.
4. ~~Star ratings are never set by generation.~~ Retired (22 Oct): star ratings and the
   Health Score were removed from the app. The `rating` field stays so saved reports load.
5. ~~Blocks dropped by the cap are dropped silently.~~ Fixed (22 Oct): cut Bad findings
   become action plan lines, cut Good findings are listed in the "Success is
   Multi-Faceted" note.
6. ~~The action plan is left blank by generation.~~ Fixed (22 Oct): it gets a one-line fix
   for each Bad block raised (the `FIX` table in `lib/questionnaire-rules.ts`, drafted for
   review), then cut findings, then settings fixes.
7. Social sessions and referrer sales are collected, but the PDF has no socials/referrers
   section (the README still describes one).
8. ~~Yes/No buttons have no `aria-pressed`.~~ Fixed (22 Oct).
9. Questions that would have caught real findings and don't exist yet (order ID format,
   email domain authentication, estimated delivery dates and return rules were added
   22 Oct as action-plan questions): delivery promises on the Help Center vs checkout, collection links in the menu that
   point somewhere unexpected, products with no reviews, restock forms on in-stock products.

## Verifying

- `npx tsc --noEmit` and `next build` (needs `NEXT_PUBLIC_SUPABASE_*`; dummy values are
  enough for a build) both pass.
- Replaying answers: import `buildReportFromAnswers` from `lib/questionnaire-rules.ts` in
  a `tsx` script and check (a) all-Yes and all-No never exceed 6 Good / 9 Bad, (b) no title
  appears twice, (c) every block title the rules can emit has an `IMPACT` entry.
- The cursor and loading changes were checked by build only. They have not been rendered
  in a browser, because running the app locally needs a Supabase project. Please open the
  Vercel preview and click around.
- To check a PDF layout without the UI, render `ReportDocument` with the same font setup
  as `scripts/render-sample.mts`. Page 3 gets tight above roughly 1,700 characters of
  action plan.

## Gotchas

- Run temporary scripts from inside the repo (or `tsx` can't resolve `@react-pdf/renderer`)
  and delete them afterwards.
- Shopify theme JSON starts with a `/* ... */` comment block, so strict `json.load` fails
  until it is stripped.
- Shopify's field LCP (Online Store speed card) and Lighthouse lab LCP can disagree
  badly. Say which one a block quotes.
