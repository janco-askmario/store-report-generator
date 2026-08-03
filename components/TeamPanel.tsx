"use client";

import { useMemo, type ReactNode } from "react";
import { Info, Loader2, Users } from "lucide-react";
import type { Presence, PresentUser } from "@/lib/presence";
import { displayName, useTeamRoster, type TeamMember } from "@/lib/team";
import { Avatar } from "@/components/Avatar";
import { cx } from "@/components/ui";

/**
 * "Who is on the app right now" — the whole signed-up team, split into online
 * and offline, updating live.
 *
 * Two sources, because neither one can answer the question alone:
 *   • presence (websocket) knows exactly who is connected, and nothing about
 *     anyone who isn't;
 *   • profiles (table) knows everyone who ever signed up, and nothing about who
 *     is looking at the page.
 * Joined here on the email address.
 *
 * Presence is passed in rather than subscribed to. `usePresence` opens its own
 * channel and publishes its own tab under a fresh key, so calling it a second
 * time in this component would make the current user appear twice — once per
 * subscription — in everyone else's list.
 */

interface Row {
  key: string;
  email: string;
  name: string;
  online: boolean;
  isMe: boolean;
  /** Signed up but not approved yet: cannot sign in, so never online. */
  pending: boolean;
  /** Which report they have open, when online and in one. */
  reportId: string | null;
}

export function TeamPanel({
  presence,
  reportNames,
  className,
  variant = "card",
  action,
}: {
  presence: Presence;
  /** Report id → store name, for showing what an online teammate is editing. */
  reportNames: Map<string, string>;
  className?: string;
  /** "card" sits in a page's layout; "drawer" fills the height it is given. */
  variant?: "card" | "drawer";
  /** Extra header control — the drawer puts its close button here. */
  action?: ReactNode;
}) {
  const { members, error } = useTeamRoster();
  const { byEmail, me } = presence;

  const rows = useMemo(
    () => buildRows(members, byEmail, me),
    [members, byEmail, me],
  );

  const online = rows.filter((r) => r.online);
  const offline = rows.filter((r) => !r.online);
  const drawer = variant === "drawer";

  /*
   * The roster came back with nothing but this account.
   *
   * RLS filters rather than fails, so a missing read policy — or missing profile
   * rows — arrives as a perfectly successful query returning one row, and the
   * panel would quietly look like a one-person company. The tell is that
   * teammates then appear only while they are connected, via presence, and
   * vanish when they close the tab. Worth naming, because nothing else will.
   */
  const soloRoster = members !== null && members.length <= 1 && !error;

  return (
    <section
      className={cx(
        "overflow-hidden bg-white",
        drawer
          ? "flex flex-col"
          : "rounded-2xl border border-black/5 shadow-sm",
        className,
      )}
      aria-label="Team"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Users size={15} />
          </span>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Team
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {members !== null && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-leaf-50 px-2 py-1 text-[11px] font-semibold text-leaf-700"
              // aria-live so a screen reader hears people arrive and leave without
              // having to go looking for the list.
              aria-live="polite"
            >
              <span
                aria-hidden
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  online.length > 0 ? "animate-pulse bg-leaf-500" : "bg-black/20",
                )}
              />
              {online.length} of {rows.length} online
            </span>
          )}
          {action}
        </div>
      </header>

      {members === null ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="animate-spin text-ink-soft" size={18} />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] leading-snug text-ink-soft">
          {error ?? "Nobody has signed up yet."}
        </p>
      ) : (
        <div
          className={cx(
            "overflow-y-auto px-2 py-2",
            drawer ? "min-h-0 flex-1" : "max-h-72 lg:max-h-[calc(100vh-11rem)]",
          )}
        >
          {/* The list below may be stale (or presence-only) when this shows —
              say so rather than letting it pass for the current roster. */}
          {error && (
            <p className="mb-1 px-2 py-1 text-[11px] leading-snug text-ink-soft">
              {error}
            </p>
          )}
          <Group label="Online" count={online.length}>
            {online.map((r) => (
              <Person key={r.key} row={r} reportNames={reportNames} />
            ))}
          </Group>
          <Group label="Offline" count={offline.length}>
            {offline.map((r) => (
              <Person key={r.key} row={r} reportNames={reportNames} />
            ))}
          </Group>
        </div>
      )}

      {soloRoster && (
        <p className="shrink-0 border-t border-black/5 bg-warn/[0.06] px-4 py-3 text-[11px] leading-relaxed text-ink-soft">
          <Info size={12} className="mr-1 inline align-[-2px] text-warn" />
          Only your own profile is readable, so teammates show up here only while
          they are online. If they have accounts, their roster rows or the read
          policy are missing — run{" "}
          <code className="rounded bg-black/[0.05] px-1 py-px text-[10px]">
            20260803000000_team_directory_repair.sql
          </code>{" "}
          in the Supabase SQL editor.
        </p>
      )}
    </section>
  );
}

function Group({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <>
      <h3 className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70">
        {label} — {count}
      </h3>
      <ul>{children}</ul>
    </>
  );
}

function Person({
  row,
  reportNames,
}: {
  row: Row;
  reportNames: Map<string, string>;
}) {
  const { email, name, online, isMe, pending, reportId } = row;

  // What they are doing, in the one line under their name.
  let status: string;
  if (pending) status = "Awaiting approval";
  else if (!online) status = "Offline";
  else if (reportId) {
    const report = reportNames.get(reportId);
    // The report may be one this browser has not loaded (a fresh one, or a page
    // of the library we are not on) — say something true rather than nothing.
    status = report ? `Editing ${report}` : "Editing a report";
  } else status = "In the library";

  return (
    <li
      className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-black/[0.02]"
      title={email}
    >
      <span className="relative shrink-0">
        <Avatar email={email} size={32} dimmed={!online} />
        <span
          className={cx(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white",
            online ? "bg-leaf-500" : "bg-black/20",
          )}
          aria-hidden
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              "truncate text-[13px] font-medium",
              online ? "text-ink" : "text-ink-soft",
            )}
          >
            {name}
          </span>
          {isMe && (
            <span className="shrink-0 rounded-md bg-black/[0.05] px-1.5 py-px text-[10px] font-semibold text-ink-soft">
              You
            </span>
          )}
          {pending && (
            <span className="shrink-0 rounded-md bg-warn/15 px-1.5 py-px text-[10px] font-semibold text-warn">
              Pending
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-ink-soft/80">
          {/* The visible dot is aria-hidden, so carry the state in the text an
              assistive reader actually reaches. */}
          <span className="sr-only">{online ? "Online. " : "Offline. "}</span>
          {status}
        </div>
      </div>
    </li>
  );
}

/**
 * Join the roster against presence.
 *
 * Anyone online but missing from the roster is still listed: they are a real,
 * approved person (the realtime policies only admit approved accounts), so their
 * profile row simply hasn't been read — which is what a deployment running ahead
 * of the team-directory migration looks like. Dropping them would be the one
 * failure mode this panel must not have: showing a teammate as absent while they
 * are typing.
 */
function buildRows(
  members: TeamMember[] | null,
  byEmail: Map<string, PresentUser[]>,
  me: string | null,
): Row[] {
  if (members === null) return [];

  const mine = me?.toLowerCase() ?? null;
  const seen = new Set<string>();
  const rows: Row[] = [];

  const push = (email: string, id: string, approved: boolean) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const sessions = byEmail.get(key);
    rows.push({
      key: id,
      email,
      name: displayName(email),
      online: Boolean(sessions?.length),
      isMe: key === mine,
      pending: !approved,
      // Two tabs open on different things: prefer the one that is in a report,
      // since "editing X" says more than "in the library".
      reportId: sessions?.find((s) => s.reportId)?.reportId ?? null,
    });
  };

  for (const m of members) push(m.email, m.id, m.approved);
  for (const [key, sessions] of byEmail) {
    push(sessions[0]?.email ?? key, `presence:${key}`, true);
  }

  return rows.sort(compareRows);
}

/** Online first, yourself first within a group, then alphabetical. */
function compareRows(a: Row, b: Row): number {
  if (a.online !== b.online) return a.online ? -1 : 1;
  if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
  // Accounts still waiting on an admin sink below the rest of the offline list.
  if (a.pending !== b.pending) return a.pending ? 1 : -1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
