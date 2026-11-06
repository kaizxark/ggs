import { describe, expect, it } from "vitest";
import handler, { buildReceiptHtml } from "./receipt-email";

describe("Receipt Email Dispatcher", () => {
  it("rejects non-POST requests", async () => {
    const req = new Request("http://localhost/api/receipt-email", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it("rejects request with missing required fields", async () => {
    const req = new Request("http://localhost/api/receipt-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 15000 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("generates formatted receipt and returns dispatch confirmation", async () => {
    const req = new Request("http://localhost/api/receipt-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptNo: "RCP/26-27/0009",
        studentName: "Vihaan Kapoor",
        studentEmail: "vihaan.kapoor@example.com",
        invoiceId: "INV-2026-1099",
        amount: 15000,
        method: "UPI",
        date: "2026-11-07",
        totalFee: 50000,
        remainingBalance: 20000,
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sent).toBe(true);
    expect(data.receiptNo).toBe("RCP/26-27/0009");
    expect(data.recipient).toBe("vihaan.kapoor@example.com");
  });

  it("builds clean HTML receipt with student and payment details", () => {
    const html = buildReceiptHtml({
      receiptNo: "RCP/26-27/0010",
      studentName: "Ishita Nair",
      studentEmail: "ishita.nair@example.com",
      invoiceId: "INV-2026-1048",
      amount: 60000,
      method: "Bank transfer",
      date: "2026-11-07",
      totalFee: 60000,
      remainingBalance: 0,
    });
    expect(html).toContain("Global Kids School");
    expect(html).toContain("RCP/26-27/0010");
    expect(html).toContain("Ishita Nair");
    expect(html).toContain("PAID IN FULL");
  });
});
