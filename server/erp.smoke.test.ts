import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Global Kids School ERP app surface", () => {
  it("keeps the public auth entrypoint available for the shell", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const currentUser = await caller.auth.me();

    expect(currentUser).toBeNull();
  });
});
