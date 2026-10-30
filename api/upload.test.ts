import { describe, expect, it } from "vitest";
import handler from "./upload";

describe("api/upload", () => {
  it("rejects non-POST requests with 405", async () => {
    const req = new Request("http://localhost/api/upload", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it("handles OPTIONS with 204 for CORS", async () => {
    const req = new Request("http://localhost/api/upload", { method: "OPTIONS" });
    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
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
});
