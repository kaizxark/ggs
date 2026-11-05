/**
 * Razorpay hosted checkout for UPI.
 *
 * The browser never sees the key secret or the webhook secret. It receives a
 * server-created order, opens Razorpay Checkout, and then asks this server to
 * verify the signed result. Razorpay's `order.paid` webhook is the fallback if
 * the browser closes before that confirmation request arrives.
 *
 * Razorpay Checkout itself shows every UPI app on mobile and a UPI QR on
 * desktop, so this replaces the old static QR + manual UTR flow.
 */

import {
  fail,
  recordGatewayPayment,
  resolvePayableInvoice,
  type SettlementResult,
} from "./fee-payments.js";

type Json = Record<string, unknown>;

const API = "https://api.razorpay.com/v1";
const DEFAULT_PAYEE_NAME = "Global Kids School";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid?: number;
  currency: string;
  status: string;
  receipt?: string;
  notes?: Record<string, string>;
}

interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string;
  notes?: Record<string, string>;
}

interface RazorpayWebhook {
  event: string;
  payload?: {
    order?: { entity?: RazorpayOrder };
    payment?: { entity?: RazorpayPayment };
  };
}

function keyId(): string {
  return String(process.env.RAZORPAY_KEY_ID ?? "").trim();
}

function keySecret(): string {
  return String(process.env.RAZORPAY_KEY_SECRET ?? "").trim();
}

function webhookSecret(): string {
  return String(process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
}

function payeeName(): string {
  return String(process.env.FEE_PAYEE_NAME ?? DEFAULT_PAYEE_NAME).trim() || DEFAULT_PAYEE_NAME;
}

function configured(): boolean {
  return Boolean(keyId() && keySecret());
}

function headers(): Record<string, string> {
  return {
    Authorization: `Basic ${btoa(`${keyId()}:${keySecret()}`)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function gateway(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
}

async function json<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Constant-time hex comparison, so a wrong signature cannot be found byte by byte. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Razorpay's checkout signature is HMAC-SHA256(order_id|payment_id, key_secret). */
export async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret = keySecret()
): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = await hmacHex(secret, `${orderId}|${paymentId}`);
  return sameHex(expected, signature.trim().toLowerCase());
}

/** Razorpay's webhook signature is HMAC-SHA256(raw_body, webhook_secret). */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret = webhookSecret()
): Promise<boolean> {
  if (!rawBody || !signature || !secret) return false;
  const expected = await hmacHex(secret, rawBody);
  return sameHex(expected, signature.trim().toLowerCase());
}

function settlementMethod(method: string): string {
  const value = method.trim().toLowerCase();
  if (value === "upi") return "UPI";
  if (value === "card") return "CARD";
  if (value === "netbanking") return "NETBANKING";
  if (value === "wallet") return "WALLET";
  return value ? value.toUpperCase() : "RAZORPAY";
}

function orderNotes(order: RazorpayOrder | null | undefined): {
  invoiceId: string;
  organisationId: string;
} {
  const notes = order?.notes ?? {};
  return {
    invoiceId: String(notes.invoice_id ?? "").trim(),
    organisationId: String(notes.organisation_id ?? "").trim(),
  };
}

/**
 * Create a Razorpay order for the full outstanding invoice balance.
 *
 * The amount is resolved on the server from the invoice. The invoice and
 * school are carried in the order notes, which Razorpay returns in both the
 * callback and the webhook.
 */
export async function handleFeeOrderRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed.", 405, "method_not_allowed");
  if (!configured()) {
    return fail(
      "Online UPI is not configured on this deployment yet.",
      503,
      "gateway_not_configured"
    );
  }

  let body: Json = {};
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail("Send an invoice to pay.", 400, "invalid_body");
  }

  const invoiceId = String(body.invoiceId ?? "").trim();
  const resolved = await resolvePayableInvoice(req, invoiceId);
  if (!resolved.ok) return resolved.response;

  const { payer } = resolved;
  const customAmount = body.amount !== undefined ? Number(body.amount) : undefined;
  let amount = Math.round(payer.outstanding * 100) / 100;
  if (customAmount !== undefined && Number.isFinite(customAmount) && customAmount > 0) {
    if (customAmount > payer.outstanding + 0.01) {
      return fail(`Amount cannot exceed the invoice balance of ₹${payer.outstanding}.`, 400, "amount_too_large");
    }
    if (customAmount < 15000 && payer.outstanding >= 15000) {
      return fail("Minimum installment payment is ₹15,000.", 400, "below_minimum_installment");
    }
    amount = Math.round(customAmount * 100) / 100;
  }
  if (amount <= 0) {
    return fail("This invoice has no balance to pay.", 409, "invoice_paid");
  }

  const receipt = `FEE-${payer.invoice.invoice_no}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  const res = await gateway("orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      notes: {
        invoice_id: payer.invoice.id,
        organisation_id: payer.invoice.organisation_id,
        student_id: payer.student.id,
        invoice_no: payer.invoice.invoice_no,
      },
    }),
  });

  const raw = await res.text();
  let order: (RazorpayOrder & { error?: { description?: string } }) | null = null;
  try {
    order = JSON.parse(raw) as RazorpayOrder & { error?: { description?: string } };
  } catch {
    order = null;
  }
  if (!res.ok || !order?.id) {
    console.error("razorpay order failed", res.status, order?.error?.description ?? "");
    return fail("The payment could not be started. Please try again.", 502, "gateway_error");
  }

  return Response.json(
    {
      payment: {
        orderId: order.id,
        keyId: keyId(),
        amount,
        currency: "INR",
        name: payeeName(),
        description: `Fee payment for ${payer.invoice.invoice_no}`,
        prefill: {
          name: `${payer.student.first_name} ${payer.student.last_name}`.trim(),
        },
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Verify the browser's post-checkout result and post the payment immediately.
 *
 * The order is fetched back from Razorpay rather than trusting an invoice ID
 * from the browser, so a valid signature for one order cannot be replayed
 * against a different pupil's invoice.
 */
export async function handleFeeConfirmRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed.", 405, "method_not_allowed");
  if (!configured()) {
    return fail(
      "Online UPI is not configured on this deployment yet.",
      503,
      "gateway_not_configured"
    );
  }

  let body: Json = {};
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail("Send the gateway result.", 400, "invalid_body");
  }

  const orderId = String(body.razorpay_order_id ?? "").trim();
  const paymentId = String(body.razorpay_payment_id ?? "").trim();
  const signature = String(body.razorpay_signature ?? "").trim();
  if (!orderId || !paymentId || !signature) {
    return fail("The gateway result is incomplete.", 400, "invalid_body");
  }
  if (!(await verifyPaymentSignature(orderId, paymentId, signature))) {
    return fail("The payment signature could not be verified.", 400, "invalid_signature");
  }

  const [orderRes, paymentRes] = await Promise.all([
    gateway(`orders/${encodeURIComponent(orderId)}`),
    gateway(`payments/${encodeURIComponent(paymentId)}`),
  ]);
  const order = await json<RazorpayOrder>(orderRes);
  const payment = await json<RazorpayPayment>(paymentRes);

  if (!orderRes.ok || !paymentRes.ok || !order?.id || !payment?.id) {
    return fail("The payment could not be confirmed yet.", 502, "gateway_error");
  }
  if (payment.order_id !== orderId || order.id !== orderId) {
    return fail("The gateway result does not match this order.", 400, "invalid_payment");
  }
  if (payment.status !== "captured" || order.status !== "paid") {
    return fail("The payment has not been captured yet.", 409, "not_captured");
  }
  if (
    payment.currency !== "INR" ||
    order.currency !== "INR" ||
    payment.amount !== order.amount ||
    order.amount_paid !== order.amount
  ) {
    return fail("The captured amount does not match the payment order.", 409, "amount_mismatch");
  }

  const notes = orderNotes(order);
  if (!UUID.test(notes.invoiceId) || !UUID.test(notes.organisationId)) {
    return fail("The gateway order is missing its invoice.", 400, "invalid_order");
  }

  const recorded = await recordGatewayPayment({
    invoiceId: notes.invoiceId,
    organisationId: notes.organisationId,
    amount: payment.amount / 100,
    method: settlementMethod(payment.method),
    reference: payment.id,
  });
  if (!recorded.ok) return recorded.response;

  return Response.json(
    {
      recorded: true,
      duplicate: recorded.duplicate,
      paymentId: recorded.paymentId,
      receiptNo: recorded.receiptNo,
      status: recorded.status,
    },
    { status: recorded.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Razorpay webhook receiver.
 *
 * Subscribe to `order.paid` (and optionally `payment.captured`). The raw body
 * is required for HMAC verification, so this must not be parsed before the
 * signature check.
 */
export async function handleFeeWebhookRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed.", 405, "method_not_allowed");
  if (!webhookSecret()) {
    return fail("The payment webhook is not configured.", 503, "gateway_not_configured");
  }

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!(await verifyWebhookSignature(raw, signature))) {
    return fail("Invalid webhook signature.", 401, "invalid_signature");
  }

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(raw) as RazorpayWebhook;
  } catch {
    return fail("Invalid webhook body.", 400, "invalid_body");
  }

  if (event.event !== "order.paid" && event.event !== "payment.captured") {
    return Response.json({ received: true, ignored: true });
  }

  let order = event.payload?.order?.entity ?? null;
  const payment = event.payload?.payment?.entity ?? null;
  if (!payment?.id) return Response.json({ received: true, ignored: true });
  if (payment.status !== "captured") return Response.json({ received: true, ignored: true });

  if (!order && payment.order_id) {
    const res = await gateway(`orders/${encodeURIComponent(payment.order_id)}`);
    if (!res.ok) {
      return fail("The payment order could not be loaded.", 502, "gateway_error");
    }
    order = await json<RazorpayOrder>(res);
  }

  if (!order) return Response.json({ received: true, ignored: true });
  if (payment.order_id && order.id !== payment.order_id) {
    return fail("The gateway result does not match this order.", 400, "invalid_payment");
  }
  if (
    order.currency !== "INR" ||
    payment.currency !== "INR" ||
    payment.currency !== order.currency ||
    payment.amount !== order.amount ||
    order.amount_paid !== order.amount
  ) {
    return fail("The captured amount does not match the payment order.", 409, "amount_mismatch");
  }

  const notes = orderNotes(order);
  if (!UUID.test(notes.invoiceId) || !UUID.test(notes.organisationId)) {
    return fail("The gateway order is missing its invoice.", 400, "invalid_order");
  }

  const recorded: { ok: true } & SettlementResult | { ok: false; response: Response } =
    await recordGatewayPayment({
      invoiceId: notes.invoiceId,
      organisationId: notes.organisationId,
      amount: payment.amount / 100,
      method: settlementMethod(payment.method),
      reference: payment.id,
    });

  if (!recorded.ok) return recorded.response;

  return Response.json({
    received: true,
    duplicate: recorded.duplicate,
    receiptNo: recorded.receiptNo,
  });
}
