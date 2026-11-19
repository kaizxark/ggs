import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { notifyDataChanged, useDataRevision } from "@/lib/live-data";
import { useRealtimeInvalidation } from "@/lib/use-realtime";

/**
 * Official School Fee Structure Policy (AY 2026–27)
 * - Classes 1, 2, 3, 4: ₹30,000 / year
 * - Classes 5, 6, 7: ₹35,000 / year
 * - Classes 8, 9, 10: ₹40,000 / year
 */
export const DEFAULT_FEE_STRUCTURE: Record<number, number> = {
  1: 30000,
  2: 30000,
  3: 30000,
  4: 30000,
  5: 35000,
  6: 35000,
  7: 35000,
  8: 40000,
  9: 40000,
  10: 40000,
};

export const SETTINGS_KEY = "fee_structure:annual_by_grade";
const STORAGE_KEY = "erp_fee_structure_annual_v2";

export interface CohortBand {
  id: "primary" | "middle" | "secondary";
  name: string;
  label: string;
  description: string;
  grades: number[];
  defaultAmount: number;
  color: string;
  bg: string;
  border: string;
}

export const COHORT_BANDS: CohortBand[] = [
  {
    id: "primary",
    name: "Primary Wing",
    label: "Classes 1–4",
    description: "Foundational primary education & co-curricular curriculum",
    grades: [1, 2, 3, 4],
    defaultAmount: 30000,
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.25)",
  },
  {
    id: "middle",
    name: "Middle School",
    label: "Classes 5–7",
    description: "Core academic curriculum with practical lab instruction",
    grades: [5, 6, 7],
    defaultAmount: 35000,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.1)",
    border: "rgba(59, 130, 246, 0.25)",
  },
  {
    id: "secondary",
    name: "Secondary Wing",
    label: "Classes 8–10",
    description: "Advanced board prep, STEM labs, and career orientation",
    grades: [8, 9, 10],
    defaultAmount: 40000,
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.1)",
    border: "rgba(139, 92, 246, 0.25)",
  },
];

/** Extract grade number from string like "Grade 4", "Class 4", "4", etc. */
export function parseGradeNumber(grade: string | number | null | undefined): number | null {
  if (grade === null || grade === undefined) return null;
  const match = String(grade).match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return n >= 1 && n <= 12 ? n : null;
}

/** Get the configured annual fee for a given grade string or number */
export function getFeeForGrade(
  grade: string | number | null | undefined,
  structure: Record<number, number> = DEFAULT_FEE_STRUCTURE
): number {
  const gNum = parseGradeNumber(grade);
  if (gNum && structure[gNum] !== undefined) {
    return structure[gNum];
  }
  if (gNum) {
    if (gNum <= 4) return structure[1] ?? 30000;
    if (gNum <= 7) return structure[5] ?? 35000;
    return structure[10] ?? 40000;
  }
  return 35000;
}

/** Format currency */
export function formatFeeInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function getCohortBand(gradeNumber: number): CohortBand {
  if (gradeNumber <= 4) return COHORT_BANDS[0];
  if (gradeNumber <= 7) return COHORT_BANDS[1];
  return COHORT_BANDS[2];
}

/** Read cached fee structure from localStorage */
export function getCachedFeeStructure(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const out = { ...DEFAULT_FEE_STRUCTURE };
        for (let g = 1; g <= 10; g++) {
          if (typeof parsed[g] === "number" && parsed[g] > 0) {
            out[g] = parsed[g];
          }
        }
        return out;
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_FEE_STRUCTURE };
}

/**
 * Reactive hook for managing the institutional fee structure.
 * Reads from Supabase `settings`, caches locally, invalidates with Realtime,
 * and allows administrators to update the fee structure.
 */
export function useFeeStructure() {
  const [structure, setStructure] = useState<Record<number, number>>(getCachedFeeStructure);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const revision = useDataRevision();
  const realtimeRevision = useRealtimeInvalidation(["settings"]);

  const loadRemote = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (!error && data && data.value && typeof data.value === "object") {
        const remoteObj = data.value as Record<string, number>;
        const merged = { ...DEFAULT_FEE_STRUCTURE };
        for (let g = 1; g <= 10; g++) {
          if (typeof remoteObj[g] === "number" && remoteObj[g] > 0) {
            merged[g] = remoteObj[g];
          }
        }
        setStructure(merged);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
    } catch {
      // offline / fallback to current
    }
  }, []);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote, revision, realtimeRevision]);

  const updateStructure = useCallback(
    async (next: Record<number, number>): Promise<{ success: boolean; error?: string }> => {
      setSaving(true);
      try {
        const cleaned: Record<number, number> = { ...DEFAULT_FEE_STRUCTURE };
        for (let g = 1; g <= 10; g++) {
          const val = Number(next[g]);
          if (!Number.isFinite(val) || val < 0) {
            throw new Error(`Invalid fee amount for Class ${g}`);
          }
          cleaned[g] = Math.round(val);
        }

        // 1. Optimistic update
        setStructure(cleaned);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        } catch {
          // ignore
        }

        // 2. Persist to Supabase settings
        const { error } = await supabase.from("settings").upsert(
          {
            id: "set-fee-structure-annual",
            key: SETTINGS_KEY,
            value: cleaned,
          },
          { onConflict: "key" }
        );

        if (error) {
          console.warn("Could not persist fee structure to Supabase settings:", error.message);
        }

        // 3. Broadcast invalidation to all views
        notifyDataChanged();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to update fee structure" };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const resetToDefault = useCallback(async () => {
    return updateStructure(DEFAULT_FEE_STRUCTURE);
  }, [updateStructure]);

  const getFee = useCallback(
    (grade: string | number | null | undefined): number => {
      return getFeeForGrade(grade, structure);
    },
    [structure]
  );

  return {
    structure,
    getFee,
    updateStructure,
    resetToDefault,
    loading,
    saving,
    cohortBands: COHORT_BANDS,
  };
}
// Institutional fee structure definitions and cohort tiers
