"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { uid } from "@/lib/defaults";

/**
 * "Who is in which report", over a single Realtime Presence channel.
 *
 * One channel for the whole workspace rather than one per report: the library
 * has to badge every card at once, and per-report channels would mean
 * subscribing to as many channels as there are reports on screen. Each client
 * publishes which report it is looking at, and both the library and the editor
 * read the same state.
 *
 * Presence is ephemeral by design — it lives on the websocket, so a closed
 * laptop clears itself. That is the reason not to keep this in a table, where
 * every crashed tab would leave a phantom editor behind forever.
 */

const CHANNEL = "store-reports-presence";

export interface PresentUser {
  /** Per-tab, so one person with two tabs open does not collide with themself. */
  key: string;
  email: string;
  reportId: string | null;
  joinedAt: number;
}

export interface Presence {
  /** Everyone currently connected, this browser included. */
  users: PresentUser[];
  /** Report id → the people in it, deduplicated by email. */
  byReport: Map<string, PresentUser[]>;
  /** This browser's email, once known. */
  me: string | null;
}

interface Identity {
  key: string;
  joinedAt: number;
  email: string | null;
}

function dedupeByEmail(users: PresentUser[]): PresentUser[] {
  const seen = new Map<string, PresentUser>();
  for (const u of users) {
    const existing = seen.get(u.email);
    // Keep the earliest session, so the list stays stable as tabs come and go.
    if (!existing || u.joinedAt < existing.joinedAt) seen.set(u.email, u);
  }
  return [...seen.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * @param reportId The report this client is currently in, or null on the
 *                 dashboard.
 */
export function usePresence(reportId: string | null): Presence {
  const [users, setUsers] = useState<PresentUser[]>([]);
  const [me, setMe] = useState<string | null>(null);

  const identityRef = useRef<Identity | null>(null);
  if (identityRef.current === null) {
    identityRef.current = { key: uid(), joinedAt: Date.now(), email: null };
  }

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const reportIdRef = useRef(reportId);
  reportIdRef.current = reportId;

  useEffect(() => {
    const supabase = createClient();
    const identity = identityRef.current as Identity;
    let live = true;

    const channel = supabase.channel(CHANNEL, {
      config: {
        // Anyone holding the anon key — which ships inside the browser bundle —
        // could otherwise subscribe and watch the team's email addresses. Gated
        // by the realtime.messages policies in the collab migration.
        private: true,
        presence: { key: identity.key },
      },
    });
    channelRef.current = channel;

    const sync = () => {
      if (!live) return;
      const state = channel.presenceState<Partial<PresentUser>>();
      const next: PresentUser[] = [];
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (!entry?.email) continue;
          next.push({
            key: entry.key ?? "",
            email: entry.email,
            reportId: entry.reportId ?? null,
            joinedAt: entry.joinedAt ?? 0,
          });
        }
      }
      setUsers(next);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync);

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!live) return;

      identity.email = data.user?.email ?? null;
      setMe(identity.email);
      // Signed out: publish nothing, observe nothing.
      if (!identity.email) return;

      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED" || !live) return;
        subscribedRef.current = true;
        void channel.track({
          key: identity.key,
          email: identity.email,
          reportId: reportIdRef.current,
          joinedAt: identity.joinedAt,
        });
      });
    })();

    return () => {
      live = false;
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  /*
   * Moving between reports republishes on the existing channel rather than
   * resubscribing — tearing the channel down on every navigation would make this
   * client flicker out of and back into everyone else's list.
   */
  useEffect(() => {
    const identity = identityRef.current as Identity;
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || !identity.email) return;
    void channel.track({
      key: identity.key,
      email: identity.email,
      reportId,
      joinedAt: identity.joinedAt,
    });
  }, [reportId]);

  const byReport = useMemo(() => {
    const map = new Map<string, PresentUser[]>();
    for (const u of users) {
      if (!u.reportId) continue;
      const list = map.get(u.reportId);
      if (list) list.push(u);
      else map.set(u.reportId, [u]);
    }
    for (const [id, list] of map) map.set(id, dedupeByEmail(list));
    return map;
  }, [users]);

  return { users, byReport, me };
}
