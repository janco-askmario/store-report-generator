/**
 * What's new, newest first — the list behind the ⓘ in the header.
 *
 * Hand-written on purpose: this is the release note a colleague reads, not a
 * commit log. Add an entry when something changes that a person using the app
 * would notice, and give it a fresh `id` — the ⓘ carries an unread dot until
 * someone has opened the panel on the newest id (see `components/WhatsNew.tsx`),
 * so reusing an id is what stops the dot from ever appearing again.
 */

export interface ChangelogEntry {
  /** Stable and unique; the read-marker is stored against the newest one. */
  id: string;
  /** ISO date, rendered for display. */
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-08-03-undo-links-team",
    date: "2026-08-03",
    title: "Undo, clickable store links, and a roomier dashboard",
    items: [
      "Undo and redo in the report editor — buttons in the top bar, plus ⌘Z / ⌘⇧Z on a Mac and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on Windows and Linux. Delete a block by accident and one press brings it back, text and all. It only ever takes back your own edits, never a colleague's.",
      "Store URLs on the dashboard cards are links now: click one to open the store in a new tab.",
      "The team list moved into a drawer behind the hamburger in the top-left corner, on every screen. The dashboard uses the space it freed for more reports, and the hamburger shows a green count while teammates are online.",
      "The dashboard, the editor and both headers now fill the whole screen instead of a centred column.",
      "This panel.",
    ],
  },
  {
    id: "2026-07-30-team-presence",
    date: "2026-07-30",
    title: "See who else is here",
    items: [
      "A live team list: who is signed up, who is online right now, and which report each person has open.",
      "Report cards badge themselves when somebody is inside them.",
    ],
  },
  {
    id: "2026-07-23-approved-accounts",
    date: "2026-07-23",
    title: "Sign-in and approvals",
    items: [
      "Email and password sign-in, replacing magic links.",
      "New accounts wait on an admin's approval before they can open the reports.",
    ],
  },
  {
    id: "2026-07-22-collaboration",
    date: "2026-07-22",
    title: "Reports became shared documents",
    items: [
      "Two people can work in the same report — the same paragraph, even — and both sets of changes survive. Nothing to save; it saves as you type.",
      "Save a Good or Bad block as a template and the whole team can drop it into their reports.",
      "An icon picker for blocks, with the same icons in the exported PDF.",
    ],
  },
];

/** The entry the unread marker is measured against. */
export const LATEST_CHANGE = CHANGELOG[0];

export function formatChangeDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
