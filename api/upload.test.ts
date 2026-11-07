import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveCaller = vi.fn();
vi.mock("../shared/ai-auth.js", () => ({
  resolveCaller: (req: Request) => resolveCaller(req),
}));

import handler from "./upload";

describe("api/upload", () => {
  beforeEach(() => {
    resolveCaller.mockReset();
    resolveCaller.mockResolvedValue({
      id: "user-1",
      email: "teacher@example.com",
      role: "teacher",
      superAdmin: false,
    });
  });

  it("rejects non-POST requests with 405", async () => {
    const req = new Request("http://localhost/api/upload", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it("answers OPTIONS with 204 and no wildcard CORS grant", async () => {
    const req = new Request("http://localhost/api/upload", { method: "OPTIONS" });
    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("refuses an anonymous upload", async () => {
    resolveCaller.mockResolvedValue(null);
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "aGVsbG8=", contentType: "image/png" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("rejects empty JSON body with 400", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("bad_request");
  });

  it("rejects corrupt or unparseable base64", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "!!!not-valid-base64-at-all!!!" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("rejects a content type outside the image allow-list", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: "aGVsbG8=",
        contentType: "image/svg+xml",
        folder: "avatars",
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_type");
  });
});
