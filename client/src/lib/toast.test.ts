import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wrapper's whole job is the `id` it attaches.
 *
 * Sonner treats a call carrying an id already on screen as an *update* to that
 * toast rather than a new one. Without it, the thirty-odd buttons wired
 * directly to `onClick={() => toast(...)}` stacked a new card per click, which
 * is what made rapid clicking look broken. These assert the id is derived
 * stably from the message, because an id that changed per call would collapse
 * nothing.
 */

const calls: { method: string; message: unknown; options: Record<string, unknown> }[] = [];

vi.mock("sonner", () => {
  const record =
    (method: string) =>
    (message: unknown, options?: Record<string, unknown>) => {
      calls.push({ method, message, options: options ?? {} });
      return String(calls.length);
    };
  const base = record("default");
  return {
    toast: Object.assign(base, {
      success: record("success"),
      error: record("error"),
      warning: record("warning"),
      info: record("info"),
    }),
  };
});

async function loadToast() {
  vi.resetModules();
  const mod = await import("./toast");
  return mod;
}

beforeEach(() => {
  calls.length = 0;
});

describe("toast wrapper", () => {
  it("gives the same message the same id, so a repeat updates one card", async () => {
    const { toast } = await loadToast();
    toast.success("Saved");
    toast.success("Saved");
    toast.success("Saved");

    const ids = calls.map((c) => c.options.id);
    expect(new Set(ids).size).toBe(1);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("keeps different messages on different ids", async () => {
    const { toast } = await loadToast();
    toast.success("Student created");
    toast.success("Invoice exported");

    const ids = calls.map((c) => c.options.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("separates the same body carrying different descriptions", async () => {
    // Two failures can share a title and differ only in detail; collapsing those
    // would hide one of them.
    const { toast } = await loadToast();
    toast.error("Could not save", { description: "Network unreachable" });
    toast.error("Could not save", { description: "Permission denied" });

    expect(new Set(calls.map((c) => c.options.id)).size).toBe(2);
  });

  it("de-duplicates across types too", async () => {
    // Same words, different severity: still the same message to a reader, and
    // two cards saying it at once would be noise.
    const { toast } = await loadToast();
    toast("Settings opened");
    toast.info("Settings opened");
    expect(new Set(calls.map((c) => c.options.id)).size).toBe(1);
  });

  it("gives errors longer on screen than confirmations", async () => {
    // An error carries instructions to act on; a confirmation does not.
    const { toast } = await loadToast();
    toast.error("Could not save the profile");
    toast.success("Profile updated");

    const err = calls.find((c) => c.method === "error");
    const ok = calls.find((c) => c.method === "success");
    expect(Number(err?.options.duration)).toBeGreaterThan(
      Number(ok?.options.duration)
    );
  });

  it("lets a caller override the duration", async () => {
    const { toast } = await loadToast();
    toast.success("Copied", { duration: 9000 });
    expect(calls[0].options.duration).toBe(9000);
  });

  it("keeps untyped toasts brief", async () => {
    // "Filters opened" is an acknowledgement, not news.
    const { toast } = await loadToast();
    toast("Filters opened");
    expect(calls[0].method).toBe("default");
    expect(Number(calls[0].options.duration)).toBeLessThan(4200);
  });

  it("passes the message and options through untouched", async () => {
    const { toast } = await loadToast();
    toast.success("Password changed", { description: "Use it next time." });

    expect(calls[0].message).toBe("Password changed");
    expect(calls[0].options.description).toBe("Use it next time.");
  });

  it("caps how many toasts are shown at once", async () => {
    const { MAX_VISIBLE } = await loadToast();
    // A stack that grows unbounded runs up the side of the window.
    expect(MAX_VISIBLE).toBeGreaterThan(0);
    expect(MAX_VISIBLE).toBeLessThanOrEqual(5);
  });
});