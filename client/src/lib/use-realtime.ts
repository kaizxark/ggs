/**
 * React bindings for the Realtime manager.
 *
 * Three shapes, because the app needs three things:
 *
 * - `useRealtimeTable` — raw INSERT/UPDATE/DELETE events for one table. Used
 *   by the generic table hook, which patches rows in place.
 * - `useRealtimeTables` — raw events across a set of tables.
 * - `useRealtimeInvalidation` — "something in these tables changed, reload".
 *   Coalesced, because one save often writes several rows and one repaint is
 *   enough. This is what every `useErpView` uses.
 *
 * Handlers live in a ref so passing an inline arrow function does not tear the
 * subscription down and rebuild it on every render — that churn is what makes
 * realtime feel like it disconnects at random.
 */

import { useEffect, useRef, useState } from "react";
import {
  subscribeToTable,
  subscribeToTables,
  type RealtimeChange,
} from "./realtime";

export function useRealtimeTable(
  table: string,
  handler: (change: RealtimeChange) => void,
  enabled = true
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !table) return;
    return subscribeToTable(table, (change) => handlerRef.current(change));
  }, [table, enabled]);
}

export function useRealtimeTables(
  tables: readonly string[],
  handler: (change: RealtimeChange) => void,
  enabled = true
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  // A stable key keeps an inline array literal from resubscribing each render.
  const key = tables.join("|");

  useEffect(() => {
    if (!enabled) return;
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    return subscribeToTables(list, (change) => handlerRef.current(change));
  }, [key, enabled]);
}

/**
 * A revision counter that increments when any of `tables` changes.
 *
 * Include the returned number in a loader's dependency list. Bursts are
 * coalesced over `debounceMs`; the default is below the threshold where a
 * person notices, but long enough to collapse a multi-row save.
 */
export function useRealtimeInvalidation(
  tables: readonly string[],
  options: { debounceMs?: number; enabled?: boolean } = {}
): number {
  const { debounceMs = 80, enabled = true } = options;
  const [version, setVersion] = useState(0);
  const key = tables.join("|");

  useEffect(() => {
    if (!enabled) return;
    const list = key ? key.split("|") : [];
    if (!list.length) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToTables(list, () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setVersion((current) => current + 1);
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [key, enabled, debounceMs]);

  return version;
}

export interface UseRealtimeSubscriptionOptions<T> {
  pk?: keyof T & string;
  filter?: (row: Record<string, unknown>) => boolean;
  enabled?: boolean;
}

/**
 * Reusable React hook for managing collections with Supabase Realtime subscriptions.
 *
 * Automatically handles:
 * - INSERT: appends or updates row by primary key (respecting optional filter)
 * - UPDATE: updates row in place, or adds/removes row if filter match status changed
 * - DELETE: removes row by primary key (safely handling Postgres RLS replica identity)
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  table: string,
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  options: UseRealtimeSubscriptionOptions<T> = {}
): void {
  const { pk = "id" as keyof T & string, filter, enabled = true } = options;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useRealtimeTable(
    table,
    (change) => {
      const matches = (row: Record<string, unknown>) =>
        filterRef.current ? filterRef.current(row) : true;

      setRows((current) => {
        if (change.eventType === "INSERT") {
          if (!matches(change.new)) return current;
          const incoming = change.new as unknown as T;
          if (current.some((row) => String(row[pk]) === String(incoming[pk]))) {
            return current.map((row) =>
              String(row[pk]) === String(incoming[pk]) ? incoming : row
            );
          }
          return [...current, incoming];
        }
        if (change.eventType === "UPDATE") {
          const incoming = change.new as unknown as T;
          if (!matches(change.new)) {
            return current.filter((row) => String(row[pk]) !== String(incoming[pk]));
          }
          if (!current.some((row) => String(row[pk]) === String(incoming[pk]))) {
            return [...current, incoming];
          }
          return current.map((row) =>
            String(row[pk]) === String(incoming[pk]) ? incoming : row
          );
        }
        if (change.eventType === "DELETE") {
          const gone = change.old as unknown as T;
          return current.filter((row) => String(row[pk]) !== String(gone[pk]));
        }
        return current;
      });
    },
    enabled
  );
}

