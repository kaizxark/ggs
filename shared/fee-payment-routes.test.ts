import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleFeeConfirmRequest,
  handleFeePaymentRequest,
  handleFeeRecordRequest,
  handleFeeWebhookRequest,
} from "./fee-payment-routes";
import { verifyPaymentSignature, verifyWebhookSignature } from "./fee-gateway";

const URL = "https://erp.example/api/student-profile";

beforeEach(() => {
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "checkout_secret");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "webhook_secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Razorpay signatures", () => {
  it("accepts the checkout signature for order|payment", async () => {
    const signature = createHmac("sha256", "checkout_secret")
      .update("order_ABC|pay_XYZ")
      .digest("hex");
    await expect(
      verifyPaymentSignature("order_ABC", "pay_XYZ", signature, "checkout_secret")
    ).resolves.toBe(true);
  });

  it("rejects a checkout signature for a different order", async () => {
    const signature = createHmac("sha256", "checkout_secret")
      .update("order_ABC|pay_XYZ")
      .digest("hex");
    await expect(
      verifyPaymentSignature("order_OTHER", "pay_XYZ", signature, "checkout_secret")
    ).resolves.toBe(false);
  });

  it("accepts a webhook signature over the raw body", async () => {
    const raw = JSON.stringify({ event: "order.paid" });
    const signature = createHmac("sha256", "webhook_secret").update(raw).digest("hex");
    await expect(verifyWebhookSignature(raw, signature, "webhook_secret")).resolves.toBe(true);
  });
});

describe("fee payment routes", () => {
  it("refuses GET on the order route", async () => {
    const res = await handleFeePaymentRequest(
      new Request(`${URL}?__fee=payment`, { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("refuses GET on the confirm route", async () => {
    const res = await handleFeeConfirmRequest(
      new Request(`${URL}?__fee=confirm`, { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("refuses GET on the webhook route", async () => {
    const res = await handleFeeWebhookRequest(
      new Request(`${URL}?__fee=webhook`, { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("refuses GET on the manual record route", async () => {
    const res = await handleFeeRecordRequest(
      new Request(`${URL}?__fee=record`, { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("rejects a confirm request without gateway fields", async () => {
    const res = await handleFeeConfirmRequest(
      new Request(`${URL}?__fee=confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_body" });
  });

  it("records a valid order.paid webhook exactly once", async () => {
    const invoiceId = "11111111-1111-4111-8111-111111111111";
    const organisationId = "22222222-2222-4222-8222-222222222222";
    const studentId = "33333333-3333-4333-8333-333333333333";
    const writes: Array<{ url: string; method: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/rest/v1/invoices?select=")) {
          return Response.json([
            {
              id: invoiceId,
              organisation_id: organisationId,
              student_id: studentId,
              invoice_no: "INV-2026-0001",
              total: 10000,
              paid_amount: 0,
              status: "issued",
              due_on: null,
            },
          ]);
        }
        if (url.includes("/rest/v1/payments?select=")) return Response.json([]);
        if (url.endsWith("/rest/v1/payments") && method === "POST") {
          writes.push({ url, method, body: JSON.parse(String(init?.body ?? "{}")) });
          return Response.json([{ id: "pay_test_1" }], { status: 201 });
        }
        if (url.includes("/rest/v1/invoices?id=eq.") && method === "PATCH") {
          writes.push({ url, method, body: JSON.parse(String(init?.body ?? "{}")) });
          return Response.json([{}]);
        }
        return new Response("not found", { status: 404 });
      })
    );

    const event = {
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: "order_test_1",
            amount: 500,
            amount_paid: 500,
            currency: "INR",
            status: "paid",
            notes: { invoice_id: invoiceId, organisation_id: organisationId },
          },
        },
        payment: {
          entity: {
            id: "pay_test_1",
            order_id: "order_test_1",
            amount: 500,
            currency: "INR",
            status: "captured",
            method: "upi",
          },
        },
      },
    };
    const raw = JSON.stringify(event);
    const signature = createHmac("sha256", "webhook_secret").update(raw).digest("hex");

    const res = await handleFeeWebhookRequest(
      new Request(`${URL}?__fee=webhook`, {
        method: "POST",
        headers: { "x-razorpay-signature": signature },
        body: raw,
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ received: true, duplicate: false });
    const inserted = writes.find((write) => write.method === "POST");
    expect(inserted?.body).toMatchObject({
      amount: 5,
      method: "UPI",
      reference: "pay_test_1",
      invoice_id: invoiceId,
    });
    const patched = writes.find((write) => write.method === "PATCH");
    expect(patched?.body).toMatchObject({ paid_amount: 5, status: "partial" });
  });

  it("rejects a webhook with a bad signature", async () => {
    const res = await handleFeeWebhookRequest(
      new Request(`${URL}?__fee=webhook`, {
        method: "POST",
        headers: { "x-razorpay-signature": "not-a-signature" },
        body: JSON.stringify({ event: "order.paid" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("reports missing gateway configuration", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    const res = await handleFeePaymentRequest(
      new Request(`${URL}?__fee=payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "00000000-0000-0000-0000-000000000000" }),
      })
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: "gateway_not_configured" });
  });
});
