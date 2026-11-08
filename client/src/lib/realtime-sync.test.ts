/**
 * Two-session synchronization test for Supabase Realtime across ERP modules.
 *
 * Verifies that:
 * 1. Two separate authenticated users (Session A and Session B) each have
 *    their own authenticated channel subscriptions and token lifecycles.
 * 2. When User A performs an INSERT, UPDATE, or DELETE on any ERP table
 *    (students, staff, attendance, invoices, examinations, timetables, etc.),
 *    User B's collection is updated automatically without requiring any page reload.
 * 3. Filter predicates and primary keys are handled correctly.
 * 4. Invalidation counters debounce bursts and trigger view reloads.
 * 5. Deduplication prevents re-rendering identical events.
 * 6. Sign-out and session teardown in one user does not disrupt the other.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeManager, type RealtimeChange } from "./realtime";

/* ------------------------------------------------------------------ */
/* Multi-session simulated Realtime bus                                */
/* ------------------------------------------------------------------ */

type StatusCb = (status: string) => void;
type ChangeCb = (payload: unknown) => void;

interface ChannelBinding {
  table: string;
  topic: string;
  statusCb: StatusCb | null;
  changeCbs: ChangeCb[];
}

/**
 * A simulated Supabase Realtime router that connects multiple client instances.
 * When a write is emitted on a table, all active subscribers to that table across
 * all sessions receive the postgres_changes payload.
 */
class RealtimeBus {
  private bindings: Array<{ client: SimulatedClient; binding: ChannelBinding }> = [];

  register(client: SimulatedClient, binding: ChannelBinding) {
    this.bindings.push({ client, binding });
  }

  unregister(client: SimulatedClient, binding: ChannelBinding) {
    this.bindings = this.bindings.filter(
      (b) => !(b.client === client && b.binding === binding)
    );
  }

  broadcast(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", next: Record<string, unknown>, old: Record<string, unknown> = {}) {
    for (const { binding } of this.bindings) {
      if (binding.table === table) {
        for (const cb of binding.changeCbs) {
          cb({ eventType, new: next, old });
        }
      }
    }
  }
}

function createSimulatedClient(bus: RealtimeBus, userId: string, token: string) {
  const channels: ChannelBinding[] = [];
  const removed: ChannelBinding[] = [];
  let authStateCb: ((event: string, session: unknown) => void) | null = null;
  let currentSession: unknown = { access_token: token, user: { id: userId } };

  const client = {
    channel(topic: string) {
      // Topic format: `erp-db:<table>:<seq>`
      const parts = topic.split(":");
      const table = parts[1] || "";
      const binding: ChannelBinding = {
        table,
        topic,
        statusCb: null,
        changeCbs: [],
      };
      const channelObj = {
        on: (_event: string, _filter: unknown, cb: ChangeCb) => {
          binding.changeCbs.push(cb);
          return channelObj;
        },
        subscribe: (cb: StatusCb) => {
          binding.statusCb = cb;
          bus.register(client as never, binding);
          Promise.resolve().then(() => cb("SUBSCRIBED"));
          return channelObj;
        },
      };
      channels.push(binding);
      return channelObj;
    },
    removeChannel(channelObj: unknown) {
      const binding = channels.find((b) => b.topic === (channelObj as any)?.topic);
      if (binding) {
        bus.unregister(client as never, binding);
        removed.push(binding);
        binding.statusCb?.("CLOSED");
      }
      return Promise.resolve("ok");
    },
    realtime: {
      setAuth: (_token: string | null) => Promise.resolve(),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authStateCb = cb;
        return { data: { subscription: { unsubscribe: () => (authStateCb = null) } } };
      },
    },
    __session: {
      userId,
      token,
      setSession(session: unknown) {
        currentSession = session;
        authStateCb?.(session ? "SIGNED_IN" : "SIGNED_OUT", session);
      },
    },
  };

  return client;
}

type SimulatedClient = ReturnType<typeof createSimulatedClient>;

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

/* ------------------------------------------------------------------ */
/* Test Suite                                                          */
/* ------------------------------------------------------------------ */

describe("Multi-session Supabase Realtime synchronization", () => {
  let bus: RealtimeBus;
  let clientA: SimulatedClient;
  let clientB: SimulatedClient;
  let managerA: ReturnType<typeof createRealtimeManager>;
  let managerB: ReturnType<typeof createRealtimeManager>;

  beforeEach(async () => {
    vi.useFakeTimers();
    bus = new RealtimeBus();

    // Session A: Admin user
    clientA = createSimulatedClient(bus, "user-admin-1", "jwt-admin-token");
    managerA = createRealtimeManager(clientA as never);

    // Session B: Teacher user
    clientB = createSimulatedClient(bus, "user-teacher-2", "jwt-teacher-token");
    managerB = createRealtimeManager(clientB as never);

    await settle();
  });

  afterEach(() => {
    managerA.destroy();
    managerB.destroy();
    vi.useRealTimers();
  });

  it("synchronizes student INSERT from Session A to Session B in real time", async () => {
    // Session B state: initial students list
    let sessionBStudents = [
      { id: "stu-1", name: "Aarav Sharma", grade: "Grade 8", status: "Active" },
      { id: "stu-2", name: "Ananya Iyer", grade: "Grade 8", status: "Active" },
    ];

    // Session B subscribes to 'students' table
    managerB.subscribeToTable("students", (change) => {
      if (change.eventType === "INSERT") {
        sessionBStudents = [...sessionBStudents, change.new as any];
      }
    });
    await settle();

    // Session A registers a new student into the database
    const newStudent = { id: "stu-3", name: "Kabir Verma", grade: "Grade 8", status: "Active" };
    bus.broadcast("students", "INSERT", newStudent);
    await settle();

    // Verify Session B received the update without refreshing
    expect(sessionBStudents).toHaveLength(3);
    expect(sessionBStudents[2]).toEqual(newStudent);
  });

  it("synchronizes attendance and fee UPDATE from Session A to Session B in real time", async () => {
    // Session B state: invoices ledger
    let sessionBInvoices = [
      { id: "inv-101", student: "Vihaan Nair", total: 50000, paid: 25000, outstanding: 25000, status: "Due" },
      { id: "inv-102", student: "Diya Rao", total: 60000, paid: 60000, outstanding: 0, status: "Paid" },
    ];

    managerB.subscribeToTable("invoices", (change) => {
      if (change.eventType === "UPDATE") {
        const updated = change.new as any;
        sessionBInvoices = sessionBInvoices.map((inv) =>
          inv.id === updated.id ? { ...inv, ...updated } : inv
        );
      }
    });
    await settle();

    // Session A records a fee payment settling inv-101
    const updatedInvoice = {
      id: "inv-101",
      student: "Vihaan Nair",
      total: 50000,
      paid: 50000,
      outstanding: 0,
      status: "Paid",
    };
    bus.broadcast("invoices", "UPDATE", updatedInvoice, { id: "inv-101", status: "Due" });
    await settle();

    // Session B's ledger immediately reflects the settled status
    const target = sessionBInvoices.find((i) => i.id === "inv-101");
    expect(target?.status).toBe("Paid");
    expect(target?.outstanding).toBe(0);
    expect(target?.paid).toBe(50000);
  });

  it("synchronizes DELETE events across sessions", async () => {
    let sessionBStaff = [
      { id: "stf-1", name: "Meera Shah", role: "Teacher" },
      { id: "stf-2", name: "Ravi Menon", role: "Faculty" },
    ];

    managerB.subscribeToTable("staff", (change) => {
      if (change.eventType === "DELETE") {
        const removed = change.old as any;
        sessionBStaff = sessionBStaff.filter((s) => s.id !== removed.id);
      }
    });
    await settle();

    // Session A deletes stf-2
    bus.broadcast("staff", "DELETE", {}, { id: "stf-2" });
    await settle();

    expect(sessionBStaff).toHaveLength(1);
    expect(sessionBStaff[0].id).toBe("stf-1");
  });

  it("invalidates aggregate views across sessions on changes to dependent tables", async () => {
    // Invalidation counter in Session B for [attendance, students]
    let invalidationCount = 0;
    const unsubscribe = managerB.subscribeToTables(["attendance", "students"], () => {
      invalidationCount++;
    });
    await settle();

    // Session A records daily attendance marking 25 students
    bus.broadcast("attendance", "INSERT", { id: "att-1", student_id: "stu-1", status: "present" });
    await settle();

    expect(invalidationCount).toBe(1);

    // Session A adds another student
    bus.broadcast("students", "INSERT", { id: "stu-99", name: "New Pupil" });
    await settle();

    expect(invalidationCount).toBe(2);
    unsubscribe();
  });

  it("handles filtered views and moves rows in and out of collections", async () => {
    // Session B only displays Grade 10 students
    let grade10Students = [
      { id: "s10-1", name: "Kunal Shah", grade: "Grade 10" },
    ];

    const filterGrade10 = (row: any) => row.grade === "Grade 10";

    managerB.subscribeToTable("students", (change) => {
      const row = change.new as any;
      if (change.eventType === "INSERT") {
        if (filterGrade10(row)) {
          grade10Students = [...grade10Students, row];
        }
      } else if (change.eventType === "UPDATE") {
        if (!filterGrade10(row)) {
          // Moved out of Grade 10
          grade10Students = grade10Students.filter((s) => s.id !== row.id);
        } else if (!grade10Students.some((s) => s.id === row.id)) {
          // Moved into Grade 10
          grade10Students = [...grade10Students, row];
        } else {
          grade10Students = grade10Students.map((s) => (s.id === row.id ? row : s));
        }
      }
    });
    await settle();

    // Session A inserts a Grade 9 student (should NOT appear in Session B's Grade 10 view)
    bus.broadcast("students", "INSERT", { id: "s9-1", name: "Neha Roy", grade: "Grade 9" });
    await settle();
    expect(grade10Students).toHaveLength(1);

    // Session A promotes s9-1 to Grade 10 (should appear in Session B's Grade 10 view)
    bus.broadcast("students", "UPDATE", { id: "s9-1", name: "Neha Roy", grade: "Grade 10" }, { id: "s9-1", grade: "Grade 9" });
    await settle();
    expect(grade10Students).toHaveLength(2);
    expect(grade10Students.map((s) => s.id)).toContain("s9-1");

    // Session A moves Kunal Shah to Grade 11 (should disappear from Grade 10 view)
    bus.broadcast("students", "UPDATE", { id: "s10-1", name: "Kunal Shah", grade: "Grade 11" }, { id: "s10-1", grade: "Grade 10" });
    await settle();
    expect(grade10Students).toHaveLength(1);
    expect(grade10Students[0].id).toBe("s9-1");
  });

  it("suppresses duplicate events within the 1.5s deduplication window", async () => {
    let receivedCount = 0;
    managerB.subscribeToTable("examinations", () => {
      receivedCount++;
    });
    await settle();

    const examChange = { id: "EXM-MID", title: "Midterm Exam 2026" };

    // Emit the same event twice in rapid succession
    bus.broadcast("examinations", "INSERT", examChange);
    bus.broadcast("examinations", "INSERT", examChange);
    await settle();

    // Deduplication should deliver it exactly once
    expect(receivedCount).toBe(1);

    // Advance beyond the 1.5s deduplication window
    await vi.advanceTimersByTimeAsync(2000);

    // A fresh event should now be accepted
    bus.broadcast("examinations", "INSERT", { id: "EXM-FINAL", title: "Final Exam 2026" });
    await settle();
    expect(receivedCount).toBe(2);
  });

  it("isolates sign-out so Session B's sign-out does not affect Session A", async () => {
    let aReceived = 0;
    let bReceived = 0;

    managerA.subscribeToTable("messages", () => aReceived++);
    managerB.subscribeToTable("messages", () => bReceived++);
    await settle();

    // Both are connected
    bus.broadcast("messages", "INSERT", { id: "msg-1", text: "Hello school" });
    await settle();
    expect(aReceived).toBe(1);
    expect(bReceived).toBe(1);

    // Session B signs out
    clientB.__session.setSession(null);
    await settle();
    expect(managerB.channelCount()).toBe(0);

    // A new message arrives: Session A still receives it, Session B does not
    bus.broadcast("messages", "INSERT", { id: "msg-2", text: "Notice for tomorrow" });
    await settle();
    expect(aReceived).toBe(2);
    expect(bReceived).toBe(1);
  });
});
