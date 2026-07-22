import * as Y from "yjs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getReport, saveReportData } from "@/lib/store";
import { SEED_ORIGIN, docToReportData, isEmptyDoc, seedDoc } from "./doc";

export type CollabStatus = "connecting" | "ready" | "missing" | "error";

/** Applied-from-elsewhere. Never re-broadcast or re-persisted. */
export const REMOTE_ORIGIN = "remote";

/**
 * Realtime caps a broadcast message at 256KB. Updates from typing are tens of
 * bytes; the exception is a logo, which is a base64 data URL embedded in the
 * document and can be hundreds of KB.
 *
 * Oversized updates simply skip the broadcast hop and reach peers through the
 * database instead — slower by a few hundred milliseconds, which nobody notices
 * on an image upload. This is safe only because applying a Yjs update twice, or
 * out of order, is a no-op: the two transports can overlap freely.
 */
const BROADCAST_MAX = 200_000;

/** How long to coalesce local edits before writing them to the log. */
const PERSIST_DEBOUNCE = 500;
/** How long to wait before mirroring the document into `reports.data`. */
const SNAPSHOT_DEBOUNCE = 2000;
/** Replay cost past this many rows justifies folding them into one snapshot. */
const COMPACT_THRESHOLD = 200;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000; // chunked so a large logo update cannot blow the stack
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface UpdateRow {
  id: number;
  payload: string;
}

export interface CollabProviderOptions {
  reportId: string;
  onStatus?: (status: CollabStatus) => void;
  /** Fired on every document change, local or remote. */
  onChange?: () => void;
}

/**
 * Binds one `Y.Doc` to one report row.
 *
 * Two transports carry the same updates: Realtime broadcast for latency, and an
 * append-only table for durability. Yjs updates are idempotent and
 * order-independent, so running both costs nothing in correctness — a client
 * that misses a broadcast still converges via the log, and a client that gets
 * both applies the second as a no-op.
 */
export class ReportCollabProvider {
  readonly doc = new Y.Doc();
  readonly reportId: string;

  private supabase = createClient();
  private channel: RealtimeChannel | null = null;
  private subscribed = false;
  private destroyed = false;

  private onStatus: CollabProviderOptions["onStatus"];
  private onChange: CollabProviderOptions["onChange"];

  /** Local updates waiting to be folded into one row. */
  private pending: Uint8Array[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotDirty = false;

  /** Highest log row this client has applied — the safe cut for compaction. */
  private maxAppliedId = 0;
  /** Rows this client wrote, so its own echo can be skipped. */
  private ownRows = new Set<number>();

  constructor(opts: CollabProviderOptions) {
    this.reportId = opts.reportId;
    this.onStatus = opts.onStatus;
    this.onChange = opts.onChange;

    this.doc.on("update", this.handleLocalUpdate);
  }

  /* ------------------------------------------------------------- lifecycle */

  async connect(): Promise<void> {
    this.onStatus?.("connecting");

    // Subscribing before the initial read closes the gap where an update
    // committed between "read the log" and "start listening" would be missed.
    await this.openChannel();
    if (this.destroyed) return;

    const rows = await this.readLog();
    if (this.destroyed) return;
    if (rows === null) {
      this.onStatus?.("error");
      return;
    }

    this.applyRows(rows);

    if (rows.length === 0 && isEmptyDoc(this.doc)) {
      const ok = await this.bootstrap();
      if (this.destroyed) return;
      if (!ok) return;
    }

    this.onStatus?.("ready");
    this.onChange?.();

    if (rows.length > COMPACT_THRESHOLD) void this.compact();
  }

  destroy(): void {
    this.destroyed = true;
    this.doc.off("update", this.handleLocalUpdate);

    // Flush rather than drop: these are edits the user has already made.
    if (this.persistTimer) clearTimeout(this.persistTimer);
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    void this.flushPending();
    if (this.snapshotDirty) void this.writeSnapshot();

    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    this.doc.destroy();
  }

  /* ---------------------------------------------------------------- loading */

  private async readLog(): Promise<UpdateRow[] | null> {
    const { data, error } = await this.supabase
      .from("report_updates")
      .select("id, payload")
      .eq("report_id", this.reportId)
      .order("id", { ascending: true });

    if (error) {
      console.error("collab: reading the update log failed:", error.message);
      return null;
    }
    return data as UpdateRow[];
  }

  private applyRows(rows: UpdateRow[]): void {
    if (rows.length === 0) return;
    // One transaction so the editor re-renders once, not once per row.
    this.doc.transact(() => {
      for (const row of rows) {
        try {
          Y.applyUpdate(this.doc, fromBase64(row.payload), REMOTE_ORIGIN);
        } catch (err) {
          // A single corrupt row should not make the report unopenable.
          console.error("collab: skipping unreadable update", row.id, err);
        }
        if (row.id > this.maxAppliedId) this.maxAppliedId = row.id;
      }
    }, REMOTE_ORIGIN);
  }

  /**
   * Build the document from the pre-CRDT `reports.data` blob.
   *
   * The seed is built in a throwaway doc and only adopted once the database has
   * accepted it. Seeding our own doc first and then discovering we lost the race
   * would leave this client — and only this client — with two of every block,
   * with no clean way to undo it.
   */
  private async bootstrap(): Promise<boolean> {
    const report = await getReport(this.reportId);
    if (this.destroyed) return false;
    if (!report) {
      this.onStatus?.("missing");
      return false;
    }

    const scratch = new Y.Doc();
    seedDoc(scratch, report.data);
    const seed = Y.encodeStateAsUpdate(scratch);
    scratch.destroy();

    const { data, error } = await this.supabase
      .from("report_updates")
      .insert({
        report_id: this.reportId,
        payload: toBase64(seed),
        is_seed: true,
      })
      .select("id")
      .single();

    if (!error) {
      this.ownRows.add((data as { id: number }).id);
      Y.applyUpdate(this.doc, seed, REMOTE_ORIGIN);
      this.maxAppliedId = Math.max(this.maxAppliedId, (data as { id: number }).id);
      return true;
    }

    // 23505 = another client seeded first. Theirs is authoritative; ours is
    // discarded unapplied.
    if (error.code === "23505") {
      const rows = await this.readLog();
      if (this.destroyed) return false;
      if (rows === null) {
        this.onStatus?.("error");
        return false;
      }
      this.applyRows(rows);
      return true;
    }

    console.error("collab: seeding failed:", error.message);
    this.onStatus?.("error");
    return false;
  }

  /* ---------------------------------------------------------------- channel */

  private openChannel(): Promise<void> {
    return new Promise((resolve) => {
      const channel = this.supabase.channel(`report:${this.reportId}`, {
        // Private: the anon key is in the browser bundle, so a public channel
        // would let anyone stream this report's edits. Backed by the
        // realtime.messages policies in the collab migration.
        config: { private: true },
      });

      channel.on("broadcast", { event: "y" }, ({ payload }) => {
        const b64 = (payload as { b64?: string })?.b64;
        if (typeof b64 === "string") this.applyRemote(b64);
      });

      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "report_updates",
          filter: `report_id=eq.${this.reportId}`,
        },
        ({ new: row }) => {
          const { id, payload } = row as UpdateRow;
          if (id > this.maxAppliedId) this.maxAppliedId = id;
          // Our own writes have already been applied locally.
          if (this.ownRows.has(id)) {
            this.ownRows.delete(id);
            return;
          }
          this.applyRemote(payload);
        },
      );

      channel.on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reports",
          filter: `id=eq.${this.reportId}`,
        },
        () => this.onStatus?.("missing"),
      );

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Broadcast is the latency path, not the correctness path — the log
          // still carries every edit, so this resolves rather than failing.
          console.error("collab: realtime channel unavailable:", status);
          resolve();
        }
      });

      this.channel = channel;
    });
  }

  private applyRemote(b64: string): void {
    if (this.destroyed) return;
    try {
      Y.applyUpdate(this.doc, fromBase64(b64), REMOTE_ORIGIN);
    } catch (err) {
      console.error("collab: dropping unreadable remote update", err);
    }
  }

  /* --------------------------------------------------------------- writing */

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    this.snapshotDirty = true;
    this.scheduleSnapshot();
    this.onChange?.();

    // Remote updates are already durable; the seed is written by bootstrap().
    if (origin === REMOTE_ORIGIN || origin === SEED_ORIGIN) return;

    const b64 = toBase64(update);
    if (this.subscribed && this.channel && b64.length <= BROADCAST_MAX) {
      void this.channel.send({ type: "broadcast", event: "y", payload: { b64 } });
    }

    this.pending.push(update);
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.flushPending(), PERSIST_DEBOUNCE);
  };

  /** Fold buffered edits into a single log row. */
  private async flushPending(): Promise<void> {
    if (this.pending.length === 0) return;
    const merged = Y.mergeUpdates(this.pending);
    this.pending = [];

    const { data, error } = await this.supabase
      .from("report_updates")
      .insert({ report_id: this.reportId, payload: toBase64(merged) })
      .select("id")
      .single();

    if (error) {
      // Put them back so the next flush retries; the edits are still live in
      // every connected peer's document via broadcast.
      this.pending.unshift(merged);
      console.error("collab: persisting an update failed:", error.message);
      return;
    }
    this.ownRows.add((data as { id: number }).id);
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => void this.writeSnapshot(), SNAPSHOT_DEBOUNCE);
  }

  /**
   * Mirror the document into `reports.data`, which is what the library cards and
   * the PDF renderer read — neither of them knows about Yjs.
   *
   * Every client does this, and the last write wins. That is safe here precisely
   * because the document is a CRDT: all clients converge on identical content,
   * so their snapshots converge too. A snapshot can briefly lag the newest edit;
   * the log remains the source of truth and the next write corrects it.
   */
  private async writeSnapshot(): Promise<void> {
    if (!this.snapshotDirty) return;
    this.snapshotDirty = false;
    const ok = await saveReportData(this.reportId, docToReportData(this.doc));
    if (!ok) this.snapshotDirty = true;
  }

  /**
   * Fold the replayed log into one row so the next reader does less work.
   *
   * Rows written after `maxAppliedId` are left in place: they may not be in the
   * snapshot, and deleting them could lose edits.
   */
  private async compact(): Promise<void> {
    const cut = this.maxAppliedId;
    if (cut <= 0) return;

    const { error } = await this.supabase.rpc("compact_report_updates", {
      p_report_id: this.reportId,
      p_payload: toBase64(Y.encodeStateAsUpdate(this.doc)),
      p_max_id: cut,
    });
    // Purely an optimisation — a failure leaves the log intact and correct.
    if (error) console.error("collab: compaction failed:", error.message);
  }
}
