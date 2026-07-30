"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The roster: everyone signed up to the app, online or not.
 *
 * The other half of the Team panel — who is *currently* online — comes from
 * `usePresence`, which only ever knows about connected browsers. Somebody who
 * closed their laptop yesterday publishes nothing, so the list of people to show
 * as offline has to be read from `public.profiles` (one row per account, created
 * by the on_auth_user_created trigger).
 *
 * See 20260730000000_team_directory.sql, which opens that table up to approved
 * users and puts it on the realtime publication.
 */

export interface TeamMember {
  id: string;
  email: string;
  /** False while an admin has not let them in yet — signed up, but locked out. */
  approved: boolean;
  /** Epoch ms, matching the rest of the app's date handling. */
  createdAt: number;
}

export interface Roster {
  /** Null until the first fetch resolves, so the panel can tell empty from loading. */
  members: TeamMember[] | null;
  error: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  approved: boolean | null;
  created_at: string;
}

/** "jan.couys@…" → "Jan Couys". Falls back to the raw address if it has no local part. */
export function displayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(" ") : email;
}

export function useTeamRoster(): Roster {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, approved, created_at")
        .order("created_at", { ascending: true });

      if (!live) return;

      if (error) {
        console.error("useTeamRoster failed:", error.message);
        setError("Could not load the team list.");
        // Leave any previously loaded roster on screen rather than blanking it:
        // a dropped refetch should not empty a list that was correct a moment ago.
        setMembers((prev) => prev ?? []);
        return;
      }

      setError(null);
      setMembers(
        (data as ProfileRow[])
          // Rows are keyed on email throughout the panel — matching presence,
          // grouping tabs, colouring avatars. A profile without one (possible in
          // principle for non-email auth) has nothing to display.
          .filter((r): r is ProfileRow & { email: string } => Boolean(r.email))
          .map((r) => ({
            id: r.id,
            email: r.email,
            approved: Boolean(r.approved),
            createdAt: new Date(r.created_at).getTime(),
          })),
      );
    };

    void load();

    /*
     * Same "something changed, go and look" pattern as the reports library: the
     * event is a trigger to refetch, never the data itself. Debounced because an
     * admin approving a batch of accounts writes several rows in a row.
     */
    const channel = supabase
      .channel("team-roster")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void load(), 400);
        },
      )
      .subscribe();

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { members, error };
}
