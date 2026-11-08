/**
 * Supabase Realtime — one manager, shared by every screen.
 *
 * The ERP already has a single invalidation signal (`live-data.ts`) and a
 * row-level cache (`erp-views.ts`). What it did not have was a complete,
 * reliable feed of database changes: one channel watched six tables at import
 * time, so attendance, classrooms, examinations, settings and the rest only
 * refreshed on focus. This module replaces that with a manager that:
 *
 * - opens **one channel per table**, lazily, only while something is listening;
 * - shares that channel between every component that needs the same table, so
 *   ten widgets do not create ten subscriptions;
 * - closes it when the last listener leaves (`removeChannel`, not just
 *   `unsubscribe`, so the topic is released);
 * - survives `CHANNEL_ERROR` / `TIMED_OUT` with exponential backoff, and
 *   reconnects immediately when the browser comes back online;
 * - re-subscribes when the auth identity changes, because Postgres Changes
 *   authorizes each event against the subscriber's JWT. A channel opened
 *   before sign-in would otherwise stay bound to the wrong role.
 *
 * ## What Realtime guarantees (and what it does not)
 *
 * Postgres Changes checks RLS for every INSERT and UPDATE before delivering it,
 * so a teacher's browser only receives rows they are allowed to read. Supabase
 * does **not** apply RLS to DELETE events (there is no row left to check), so a
 * delete can arrive as a primary key even for a row the listener cannot read.
 * The app treats DELETE purely as "reload this table"; it never renders the
 * payload. That keeps the UI correct without turning the event into a data
 * leak. See the note in `supabase/migrations/017_realtime_publication.sql`.
 *
 * ## Why per-table channels instead of one channel with forty bindings
 *
 * A channel fails as a unit when one of its `postgres_changes` bindings is
 * rejected — for example a table that is missing from the `supabase_realtime`
 * publication. One bad table would then take every other table down with it.
 * Per-table channels isolate that failure, retry only the table that broke,
 * and make cleanup exact.
 */

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeChange {
  table: string;
  eventType: RealtimeEventType;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  receivedAt: number;
}

export type RealtimeListener = (change: RealtimeChange) => void;

interface ChannelEntry {
  channel: RealtimeChannel;
  retry: number;
  timer: ReturnType<typeof setTimeout> | null;
  joined: boolean;
  /** Set before `removeChannel`, so its CLOSED callback is ignored. */
  stopped: boolean;
}

interface AuthSessionLike {
  access_token?: string;
  user?: { id?: string };
}

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
/** A duplicate is an identical event seen again inside this window. */
const DEDUPE_WINDOW_MS = 1_500;
const DEDUPE_MAX_ENTRIES = 400;

/** Stable, cheap fingerprint; no crypto and no row retention. */
function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/**
 * Build a manager around a Supabase client.
 *
 * Exported separately from the singleton so the behaviour can be tested with a
 * fake client: subscription lifetimes, reconnection and auth changes are the
 * parts most likely to regress, and they are not observable through the UI.
 */
export function createRealtimeManager(client: SupabaseClient) {
  const listeners = new Map<string, Set<RealtimeListener>>();
  const channels = new Map<string, ChannelEntry>();
  const seen = new Map<string, number>();

  let initialised = false;
  let authReady = false;
  let userId: string | null = null;
  let authSubscription: { unsubscribe: () => void } | null = null;
  let channelSeq = 0;

  function pruneSeen(now: number) {
    if (seen.size <= DEDUPE_MAX_ENTRIES) return;
    for (const [key, at] of seen) {
      if (now - at > DEDUPE_WINDOW_MS) seen.delete(key);
    }
    // Still full means a very large burst; drop the oldest half rather than
    // letting the map grow without bound.
    if (seen.size > DEDUPE_MAX_ENTRIES) {
      let drop = Math.ceil(seen.size / 2);
      for (const key of seen.keys()) {
        seen.delete(key);
        if (--drop <= 0) break;
      }
    }
  }

  function isDuplicate(change: RealtimeChange): boolean {
    const now = change.receivedAt;
    const row = change.eventType === "DELETE" ? change.old : change.new;
    const pk = row.id ?? row.key ?? "";
    const key = [
      change.table,
      change.eventType,
      String(pk),
      hash(JSON.stringify(change.new)),
      hash(JSON.stringify(change.old)),
    ].join("|");

    pruneSeen(now);
    const previous = seen.get(key);
    if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return true;
    seen.set(key, now);
    return false;
  }

  function dispatch(change: RealtimeChange) {
    if (isDuplicate(change)) return;
    const set = listeners.get(change.table);
    if (!set) return;
    // Copy: a listener is allowed to unsubscribe itself while being called.
    for (const listener of Array.from(set)) {
      try {
        listener(change);
      } catch {
        // One broken consumer must not stop the others from receiving the
        // same event.
      }
    }
  }

  function ensureChannel(table: string) {
    if (!authReady) return;
    if (channels.has(table)) return;
    if (!listeners.get(table)?.size) return;

    // A unique topic per incarnation avoids `client.channel()` returning a
    // previously removed channel with the same name.
    const topic = `erp-db:${table}:${++channelSeq}`;
    const channel = client.channel(topic);
    const entry: ChannelEntry = {
      channel,
      retry: 0,
      timer: null,
      joined: false,
      stopped: false,
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        if (entry.stopped) return;
        const change = payload as unknown as {
          eventType?: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        };
        const eventType = change.eventType as RealtimeEventType | undefined;
        if (!eventType) return;
        dispatch({
          table,
          eventType,
          new: change.new ?? {},
          old: change.old ?? {},
          receivedAt: Date.now(),
        });
      }
    );

    channel.subscribe((status) => {
      if (entry.stopped) return;
      if (status === "SUBSCRIBED") {
        entry.joined = true;
        entry.retry = 0;
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        entry.joined = false;
        scheduleReconnect(table);
        return;
      }
      if (status === "CLOSED") {
        entry.joined = false;
      }
    });

    channels.set(table, entry);
  }

  function destroyChannel(table: string) {
    const entry = channels.get(table);
    if (!entry) return;
    entry.stopped = true;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    channels.delete(table);
    // `removeChannel` releases the topic as well as the socket binding.
    void client.removeChannel(entry.channel);
  }

  function scheduleReconnect(table: string) {
    const entry = channels.get(table);
    if (!entry || entry.timer || !listeners.get(table)?.size) return;
    entry.retry += 1;
    const delay = Math.min(
      RETRY_MAX_MS,
      RETRY_BASE_MS * 2 ** Math.min(entry.retry - 1, 5)
    );
    entry.timer = setTimeout(() => {
      entry.timer = null;
      destroyChannel(table);
      ensureChannel(table);
    }, delay);
  }

  function reconnectUnjoined() {
    for (const table of Array.from(channels.keys())) {
      const entry = channels.get(table);
      if (!entry || entry.joined || entry.timer) continue;
      destroyChannel(table);
      ensureChannel(table);
    }
  }

  function restartAll() {
    for (const table of Array.from(channels.keys())) destroyChannel(table);
    for (const table of listeners.keys()) ensureChannel(table);
  }

  function applySession(session: AuthSessionLike | null | undefined) {
    const token = session?.access_token ?? null;
    const nextUser = session?.user?.id ?? null;
    const wasReady = authReady;

    authReady = Boolean(token);
    // The Realtime client sends this token when it joins a channel and when it
    // refreshes. Setting it explicitly keeps the socket in step with auth even
    // if a consumer subscribed between events.
    void client.realtime.setAuth(token);

    if (nextUser !== userId) {
      userId = nextUser;
      // A different identity must never inherit the previous user's channels.
      if (wasReady && authReady) restartAll();
    }
    if (authReady && !wasReady) restartAll();
  }

  function init() {
    if (initialised) return;
    initialised = true;

    void client.auth
      .getSession()
      .then(({ data }) => applySession(data.session as AuthSessionLike | null))
      .catch(() => {
        authReady = false;
      });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        authReady = false;
        userId = null;
        for (const table of Array.from(channels.keys())) destroyChannel(table);
        void client.realtime.setAuth(null);
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        // Same identity, fresh JWT: the socket only needs the new token.
        void client.realtime.setAuth(session?.access_token ?? null);
        return;
      }
      applySession(session as AuthSessionLike | null);
    });
    authSubscription = data.subscription;

    if (typeof window !== "undefined") {
      window.addEventListener("online", reconnectUnjoined);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reconnectUnjoined();
        });
      }
    }
  }

  /**
   * Listen to one table. Returns an unsubscribe function; the underlying
   * channel is closed automatically when the last listener leaves.
   */
  function subscribeToTable(table: string, listener: RealtimeListener): () => void {
    if (!table) return () => {};
    init();

    let set = listeners.get(table);
    if (!set) {
      set = new Set();
      listeners.set(table, set);
    }
    set.add(listener);
    ensureChannel(table);

    return () => {
      const current = listeners.get(table);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        listeners.delete(table);
        destroyChannel(table);
      }
    };
  }

  /** Listen to several tables with one callback. */
  function subscribeToTables(
    tables: readonly string[],
    listener: RealtimeListener
  ): () => void {
    const unique = Array.from(new Set(tables.filter(Boolean)));
    const unsubscribers = unique.map((table) => subscribeToTable(table, listener));
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }

  /** Tear everything down (used by tests and by a full sign-out reset). */
  function destroy() {
    for (const table of Array.from(channels.keys())) destroyChannel(table);
    listeners.clear();
    seen.clear();
    authSubscription?.unsubscribe();
    authSubscription = null;
    initialised = false;
    authReady = false;
    userId = null;
  }

  return {
    subscribeToTable,
    subscribeToTables,
    destroy,
    isReady: () => authReady,
    /** Number of live channels — useful for diagnostics and tests. */
    channelCount: () => channels.size,
  };
}

/** The app-wide manager. Import this, not a fresh instance. */
export const realtime = createRealtimeManager(supabase);

export const subscribeToTable = realtime.subscribeToTable;
export const subscribeToTables = realtime.subscribeToTables;
