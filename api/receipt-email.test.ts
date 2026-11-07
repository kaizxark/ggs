import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveCaller = vi.fn();
vi.mock("../shared/ai-auth.js", () => ({
  resolveCaller: (req: Request) => resolveCaller(req),
}));

import handler, { buildReceiptHtml } from "./receipt-email";

function post(body: unknown) {
  return new Request("http://localhost/api/receipt-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const receipt = {
  receiptNo: "RCP/26-27/0009",
  studentName: "Vihaan Kapoor",
  studentEmail: "vihaan.kapoor@example.com",
  invoiceId: "INV-2026-1099",
  amount: 15000,
  method: "UPI",
  date: "2026-11-07",
  totalFee: 50000,
  remainingBalance: 20000,
};

describe("Receipt Email Dispatcher", () => {
  beforeEach(() => {
    resolveCaller.mockReset();
    resolveCaller.mockResolvedValue({
      id: "accountant-1",
      email: "accounts@example.com",
      role: "accountant",
      superAdmin: false,
    });
  });

  it("rejects non-POST requests", async () => {
    const req = new Request("http://localhost/api/receipt-email", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it("refuses an anonymous request before reading the body", async () => {
    resolveCaller.mockResolvedValue(null);
    const res = await handler(post(receipt));
    expect(res.status).toBe(401);
  });

  it("refuses a role that cannot send receipts", async () => {
    resolveCaller.mockResolvedValue({
      id: "teacher-1",
      email: "teacher@example.com",
      role: "teacher",
      superAdmin: false,
    });
    const res = await handler(post(receipt));
    expect(res.status).toBe(403);
  });

  it("rejects request with missing required fields", async () => {
    const res = await handler(post({ amount: 15000 }));
    expect(res.status).toBe(400);
  });

  it("rejects a recipient that is not a real address", async () => {
    const res = await handler(post({ ...receipt, studentEmail: "not-an-address" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_recipient");
  });

  it("records a receipt when SMTP is not configured", async () => {
    const res = await handler(post(receipt));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    // Honest reporting: no transport means nothing was actually sent.
    expect(data.sent).toBe(false);
    expect(data.mode).toBe("recorded");
    expect(data.receiptNo).toBe("RCP/26-27/0009");
    expect(data.recipient).toBe("vihaan.kapoor@example.com");
  });

  it("builds clean HTML receipt with student and payment details", () => {
    const html = buildReceiptHtml(receipt);
    expect(html).toContain("Global Kids School");
    expect(html).toContain("RCP/26-27/0009");
    expect(html).toContain("Vihaan Kapoor");
    expect(html).toContain("PARTIAL PAYMENT");
  });

  it("escapes HTML injected through the payload", () => {
    const html = buildReceiptHtml({
      ...receipt,
      studentName: '<script>alert("x")</script>',
      reference: '"><img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });
});
