/**
 * One invalidation signal for every live view.
 *
 * The dashboard reads Supabase through several caches (the view cache, the
 * raw-table cache, the directory's page cache), so a write in one screen used
 * to leave every other screen holding the old answer until the page was
 * reloaded. This module is the single place those caches are told that
 * something changed: a mutation calls `notifyDataChanged()`, every mounted
 * loader re-runs, and only the parts of the UI that read that data repaint.
 *
 * Two other paths keep the screen honest without a reload:
 *
 * - `focus` / `visibilitychange` refetch when the tab is brought back, so a
 *   change made in another tab or another device appears on return.
 * - `BroadcastChannel` forwards a write made in one tab to every other tab in
 *   the same browser immediately.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;
type Invalidator = () => void;

const listeners = new Set<Listener>();
const invalidators = new Set<Invalidator>();

let revision = 0;
let lastBump = 0;
let scheduled: ReturnType<typeof setTimeout> | null = null;

/** Clear caches owned by a data layer, before subscribers re-read. */
export function registerDataInvalidator(invalidate: Invalidator): () => void {
  invalidators.add(invalidate);
  return () => invalidators.delete(invalidate);
}

function bump(broadcast: boolean) {
  lastBump = Date.now();
  invalidators.forEach((invalidate) => {
    try {
      invalidate();
    } catch {
      // One broken cache must not stop the others from being cleared.
    }
  });
  revision += 1;
  listeners.forEach((listener) => listener());

  if (broadcast) {
    try {
      channel?.postMessage({ type: "invalidate", at: lastBump });
    } catch {
      // A closed channel or a serialisation failure is not fatal.
    }
  }
}

/**
 * Announce that data changed.
 *
 * Coalesced: a save that writes a dozen settings rows must repaint once, not
 * a dozen times. The short delay is below the point a person notices and long
 * enough to swallow a burst of writes.
 */
export function notifyDataChanged(): void {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    bump(true);
  }, 60);
}

/** Subscribe a loader to the global revision. */
export function useDataRevision(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => revision,
    () => 0
  );
}

/* ------------------------------------------------------------------ */
/* Cross-tab and focus refresh                                         */
/* ------------------------------------------------------------------ */

let channel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    channel = new BroadcastChannel("ggs-erp-data");
  } catch {
    channel = null;
  }
}

if (channel) {
  channel.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "invalidate") bump(false);
  });
}

/*
 * Realtime is the second source of truth: a row changed by somebody else (or
 * by another device) arrives without a reload.
 *
 * That feed now lives in `realtime.ts` and is subscribed per view, so a screen
 * only listens to the tables it actually reads. This module stays responsible
 * for the *local* signal — a mutation in this tab, a write forwarded from
 * another tab, and a refetch when the tab is brought back.
 */
if (typeof window !== "undefined") {
  const refresh = () => {
    // Focus and visibilitychange both fire when a tab is brought back; one
    // refresh is enough.
    if (Date.now() - lastBump < 500) return;
    bump(false);
  };
  window.addEventListener("focus", refresh);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
  }
}
