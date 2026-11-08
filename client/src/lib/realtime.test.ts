/**
 * Tests for the Realtime manager.
 *
 * The interesting behaviour here is not the socket — Supabase owns that — but
 * the lifecycle around it: ref-counted channels, dedupe, retry with backoff,
 * teardown on sign-out and restart on identity change. Those are all covered
 * with a fake client whose channels never actually touch the network.
 *
 * Auth responses resolve asynchronously (as `getSession` does in the real
 * client), so each test awaits a microtask flush before asserting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeManager, type RealtimeChange } from "./realtime";

/* ------------------------------------------------------------------ */
/* Fake Supabase client                                                */
/* ------------------------------------------------------------------ */

type StatusCb = (status: string) => void;
type ChangeCb = (payload: unknown) => void;

interface FakeChannel {
  topic: string;
  changeCbs: ChangeCb[];
  statusCb: StatusCb | null;
}

function createFakeClient() {
  const channels: FakeChannel[] = [];
  const removed: FakeChannel[] = [];
  const authTokens: Array<string | null> = [];
  let authStateCb: ((event: string, session: unknown) => void) | null = null;
  let session: unknown = null;

  const client = {
    channel(topic: string) {
      const channel: FakeChannel = {
        topic,
        changeCbs: [] as ChangeCb[],
        statusCb: null,
      };
      channel.on = undefined as never;
      const withCbs = Object.assign(channel, {
        on: (_event: string, _filter: unknown, cb: ChangeCb) => {
          channel.changeCbs.push(cb);
          return withCbs;
        },
        subscribe: (cb: StatusCb) => {
          channel.statusCb = cb;
          // Join asynchronously, like a socket handshake would.
          Promise.resolve().then(() => cb("SUBSCRIBED"));
          return withCbs;
        },
      });
      channels.push(channel);
      return withCbs;
    },
    removeChannel(channel: FakeChannel) {
      removed.push(channel);
      // Mirrors the real client: removing emits CLOSED on the status callback.
      channel.statusCb?.("CLOSED");
      return Promise.resolve("ok");
    },
    realtime: {
      setAuth(token: string | null) {
        authTokens.push(token);
        return Promise.resolve();
      },
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authStateCb = cb;
        return { data: { subscription: { unsubscribe: () => (authStateCb = null) } } };
      },
    },
    /** Test helpers, not part of a real client. */
    __test: {
      emitChange(
        channelIndex: number,
        eventType: string,
        next: Record<string, unknown> = {},
        old: Record<string, unknown> = {}
      ) {
        const channel = channels[channelIndex];
        for (const cb of channel.changeCbs) cb({ eventType, new: next, old });
      },
      emitAuth(event: string, next: unknown) {
        session = next;
        authStateCb?.(event, next);
      },
      channels,
      removed,
      authTokens,
    },
  };

  return client;
}

type FakeClient = ReturnType<typeof createFakeClient>;

const SESSION = () => ({ access_token: "jwt-a", user: { id: "user-a" } });

/** Let the manager's async auth handshake and channel joins settle. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

/** Sign in through the fake client so the manager becomes ready. */
async function signIn(
  client: FakeClient,
  event = "SIGNED_IN",
  user: { access_token: string; user: { id: string } } | null = SESSION() as never
) {
  client.__test.emitAuth(event, user);
  await settle();
}

function collect(manager: ReturnType<typeof createRealtimeManager>, table: string) {
  const received: RealtimeChange[] = [];
  const unsubscribe = manager.subscribeToTable(table, (change) => received.push(change));
  return { received, unsubscribe };
}

/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRealtimeManager", () => {
  it("does not open a channel before the client is authenticated", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    const { unsubscribe } = collect(manager, "students");
    await settle();
    expect(client.__test.channels).toHaveLength(0);

    // Realtime authorises each event against the caller's JWT, so there is
    // nothing useful to subscribe with before sign-in.
    await signIn(client);
    expect(client.__test.channels).toHaveLength(1);

    unsubscribe();
    manager.destroy();
  });

  it("shares one channel between listeners of the same table", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    const a = manager.subscribeToTable("students", () => {});
    manager.subscribeToTable("students", () => {});
    manager.subscribeToTable("staff", () => {});
    await settle();
    expect(client.__test.channels).toHaveLength(2);

    a();
    expect(manager.channelCount()).toBe(2); // one student listener still goes
    manager.destroy();
    expect(manager.channelCount()).toBe(0);
  });

  it("closes the channel when the last listener unsubscribes", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    const a = manager.subscribeToTable("students", () => {});
    const b = manager.subscribeToTable("students", () => {});
    await settle();
    expect(client.__test.channels).toHaveLength(1);

    a();
    expect(client.__test.removed).toHaveLength(0);
    b();
    await settle();
    expect(client.__test.removed).toHaveLength(1);
    manager.destroy();
  });

  it("delivers INSERT, UPDATE and DELETE to listeners", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    const { received } = collect(manager, "students");
    await settle();

    client.__test.emitChange(0, "INSERT", { id: "s1" });
    client.__test.emitChange(0, "UPDATE", { id: "s1", name: "New" });
    client.__test.emitChange(0, "DELETE", {}, { id: "s1" });

    expect(received.map((c) => c.eventType)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    expect(received[2].new).toEqual({}); // DELETE carries no row data
    manager.destroy();
  });

  it("drops an identical event seen twice within the dedupe window", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    const { received } = collect(manager, "students");
    await settle();

    client.__test.emitChange(0, "UPDATE", { id: "s1", name: "Same" });
    client.__test.emitChange(0, "UPDATE", { id: "s1", name: "Same" });
    expect(received).toHaveLength(1);

    // Past the window the same payload is a genuine redelivery, not a replay.
    vi.advanceTimersByTime(2_000);
    client.__test.emitChange(0, "UPDATE", { id: "s1", name: "Same" });
    expect(received).toHaveLength(2);

    // A different row is never a duplicate of the last one.
    client.__test.emitChange(0, "UPDATE", { id: "s2", name: "Same" });
    expect(received).toHaveLength(3);
    manager.destroy();
  });

  it("reconnects an errored channel with exponential backoff", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    manager.subscribeToTable("students", () => {});
    await settle();
    expect(client.__test.channels).toHaveLength(1);

    client.__test.channels[0].statusCb?.("CHANNEL_ERROR");
    await settle();
    // Nothing before the base delay…
    await vi.advanceTimersByTimeAsync(999);
    expect(client.__test.channels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); // 1s base
    expect(client.__test.channels).toHaveLength(2);

    // Fail again: the delay doubles to 2s.
    client.__test.channels[1].statusCb?.("CHANNEL_ERROR");
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(client.__test.channels).toHaveLength(3);
    expect(client.__test.removed.length).toBeGreaterThanOrEqual(2);
    manager.destroy();
  });

  it("retries immediately when the browser comes back online", async () => {
    const client = createFakeClient();
    const onlineTarget = new EventTarget();
    const manager = createRealtimeManager(client as never, { onlineTarget });
    await signIn(client);

    manager.subscribeToTable("students", () => {});
    await settle();
    client.__test.channels[0].statusCb?.("CHANNEL_ERROR");
    await settle();

    onlineTarget.dispatchEvent(new Event("online"));
    await settle();
    expect(client.__test.channels).toHaveLength(2);
    manager.destroy();
  });

  it("tears channels down on sign-out", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    manager.subscribeToTable("students", () => {});
    await settle();
    expect(client.__test.channels).toHaveLength(1);

    await signIn(client, "SIGNED_OUT", null);
    expect(client.__test.removed).toHaveLength(1);
    expect(manager.channelCount()).toBe(0);
    expect(client.__test.authTokens.at(-1)).toBeNull();
    manager.destroy();
  });

  it("restarts channels when the signed-in identity changes", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    manager.subscribeToTable("students", () => {});
    await settle();

    // Same user, refreshed JWT: tokens update, channels stay.
    client.__test.emitAuth("TOKEN_REFRESHED", {
      access_token: "jwt-a2",
      user: { id: "user-a" },
    });
    await settle();
    expect(client.__test.removed).toHaveLength(0);
    expect(client.__test.authTokens.at(-1)).toBe("jwt-a2");

    // A different user must never inherit the previous session's channels.
    await signIn(client, "SIGNED_IN", {
      access_token: "jwt-x",
      user: { id: "user-x" },
    } as never);
    expect(client.__test.removed).toHaveLength(1);
    expect(client.__test.channels).toHaveLength(2); // old destroyed, new created
    manager.destroy();
  });

  it("never leaks an exception from one listener into the others", async () => {
    const client = createFakeClient();
    const manager = createRealtimeManager(client as never);
    await signIn(client);

    const { received } = collect(manager, "students");
    manager.subscribeToTable("students", () => {
      throw new Error("consumer broke");
    });
    await settle();

    expect(() => client.__test.emitChange(0, "INSERT", { id: "s1" })).not.toThrow();
    expect(received).toHaveLength(1);
    manager.destroy();
  });
});
