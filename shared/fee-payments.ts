/**
 * Fee payments through a UPI-first payment gateway.
 *
 * The family pays with any UPI app from Razorpay Checkout. Razorpay sends a
 * signed webhook, and the browser's return trip is verified server-side too, so
 * the invoice is marked paid without the office touching a UTR.
 *
 * The ERP remains the only writer of money: the invoice, school and amount are
 * resolved from the database, never trusted from the browser, and the gateway
 * reference makes a retried webhook idempotent.
 */

import {
  resolveCaller,
  SERVICE_KEY,
  SUPABASE_URL,
  type Caller,
} from "./ai-auth.js";
import { canManageFees } from "./student-access.js";

type Json = Record<string, unknown>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeeInvoice {
  id: string;
  organisation_id: string;
  student_id: string;
  invoice_no: string;
  total: number;
  paid_amount: number;
  status: string;
  due_on: string | null;
}

export interface FeeStudent {
  id: string;
  organisation_id: string;
  first_name: string;
  last_name: string;
  usn: string;
}

export interface FeePayer {
  caller: Caller;
  invoice: FeeInvoice;
  student: FeeStudent;
  outstanding: number;
}

export interface SettlementResult {
  duplicate: boolean;
  paymentId: string;
  receiptNo: string;
  status: string;
}

function fail(message: string, status: number, code = "error"): Response {
  return Response.json({ error: code, message }, { status });
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
}

async function rows(path: string): Promise<Json[]> {
  const res = await rest(path);
  if (!res.ok) return [];
  const data = (await res.json()) as Json[];
  return Array.isArray(data) ? data : [];
}

async function one(path: string): Promise<Json | null> {
  return (await rows(path))[0] ?? null;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The caller's relationship to this pupil, resolved from the database. */
async function relationship(
  caller: Caller,
  studentId: string,
  orgId: string
): Promise<"self" | "guardian" | null> {
  const own = await one(
    `profiles?select=student_id&id=eq.${caller.id}&student_id=eq.${studentId}&limit=1`
  );
  if (own) return "self";

  const linked = await one(
    `student_guardians?select=id&student_id=eq.${studentId}` +
      `&portal_profile_id=eq.${caller.id}&organisation_id=eq.${orgId}&limit=1`
  );
  if (linked) return "guardian";

  return null;
}

function invoiceFromRow(row: Json): FeeInvoice {
  return {
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    student_id: String(row.student_id),
    invoice_no: String(row.invoice_no ?? ""),
    total: round2(num(row.total)),
    paid_amount: round2(num(row.paid_amount)),
    status: String(row.status ?? ""),
    due_on: row.due_on ? String(row.due_on) : null,
  };
}

async function studentFor(invoice: FeeInvoice): Promise<FeeStudent | null> {
  const row = await one(
    `students?select=id,organisation_id,first_name,last_name,usn&id=eq.${invoice.student_id}&limit=1`
  );
  if (!row || String(row.organisation_id) !== invoice.organisation_id) return null;
  return {
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    usn: String(row.usn ?? ""),
  };
}

function payable(invoice: FeeInvoice): { ok: true; outstanding: number } | { ok: false; response: Response } {
  if (!["issued", "partial", "overdue"].includes(invoice.status)) {
    return { ok: false, response: fail("This invoice is not open for payment.", 409, "invoice_closed") };
  }
  const outstanding = round2(invoice.total - invoice.paid_amount);
  if (outstanding <= 0) {
    return { ok: false, response: fail("This invoice has already been paid.", 409, "invoice_paid") };
  }
  return { ok: true, outstanding };
}

/**
 * Resolve an invoice and prove the caller may pay it.
 *
 * The route calls this before it creates a gateway order, so a guessed invoice
 * UUID from another school or another family never reaches the browser.
 */
export async function resolvePayableInvoice(
  req: Request,
  invoiceId: string
): Promise<{ ok: true; payer: FeePayer } | { ok: false; response: Response }> {
  if (!SERVICE_KEY) {
    return { ok: false, response: fail("The database is not configured on this deployment.", 503, "not_configured") };
  }
  if (!UUID.test(invoiceId)) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }

  const caller = await resolveCaller(req);
  if (!caller) {
    return { ok: false, response: fail("Sign in to continue.", 401, "unauthenticated") };
  }

  const invoiceRow = await one(
    `invoices?select=id,organisation_id,student_id,invoice_no,total,paid_amount,status,due_on` +
      `&id=eq.${invoiceId}&limit=1`
  );
  if (!invoiceRow) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }
  const invoice = invoiceFromRow(invoiceRow);

  const open = payable(invoice);
  if (!open.ok) return open;

  const student = await studentFor(invoice);
  if (!student) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }

  const callerProfile = await one(
    `profiles?select=organisation_id&id=eq.${caller.id}&limit=1`
  );
  if (!callerProfile?.organisation_id || String(callerProfile.organisation_id) !== invoice.organisation_id) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }

  if (!(await relationship(caller, invoice.student_id, invoice.organisation_id))) {
    return { ok: false, response: fail("You cannot pay this invoice.", 403, "forbidden") };
  }

  return { ok: true, payer: { caller, invoice, student, outstanding: open.outstanding } };
}

/** The finance-desk version of the invoice lookup: an accountant may record any pupil in the school. */
async function resolveStaffInvoice(
  req: Request,
  invoiceId: string
): Promise<{ ok: true; caller: Caller; invoice: FeeInvoice } | { ok: false; response: Response }> {
  if (!SERVICE_KEY) {
    return { ok: false, response: fail("The database is not configured on this deployment.", 503, "not_configured") };
  }
  if (!UUID.test(invoiceId)) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }

  const caller = await resolveCaller(req);
  if (!caller) {
    return { ok: false, response: fail("Sign in to continue.", 401, "unauthenticated") };
  }
  if (!canManageFees(caller.role)) {
    return { ok: false, response: fail("Only the finance office can record a payment.", 403, "forbidden") };
  }

  const invoiceRow = await one(
    `invoices?select=id,organisation_id,student_id,invoice_no,total,paid_amount,status,due_on` +
      `&id=eq.${invoiceId}&limit=1`
  );
  if (!invoiceRow) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }
  const invoice = invoiceFromRow(invoiceRow);

  const callerProfile = await one(`profiles?select=organisation_id&id=eq.${caller.id}&limit=1`);
  if (!callerProfile?.organisation_id || String(callerProfile.organisation_id) !== invoice.organisation_id) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }

  return { ok: true, caller, invoice };
}

/** Resolve an invoice from a gateway's order notes, without a signed-in user. */
async function resolveGatewayInvoice(
  invoiceId: string,
  organisationId: string
): Promise<{ ok: true; invoice: FeeInvoice } | { ok: false; response: Response }> {
  if (!SERVICE_KEY) {
    return { ok: false, response: fail("The database is not configured on this deployment.", 503, "not_configured") };
  }
  if (!UUID.test(invoiceId) || !UUID.test(organisationId)) {
    return { ok: false, response: fail("The gateway order is missing its invoice.", 400, "invalid_order") };
  }

  const row = await one(
    `invoices?select=id,organisation_id,student_id,invoice_no,total,paid_amount,status,due_on` +
      `&id=eq.${invoiceId}&organisation_id=eq.${organisationId}&limit=1`
  );
  if (!row) {
    return { ok: false, response: fail("That invoice could not be found.", 404, "not_found") };
  }
  return { ok: true, invoice: invoiceFromRow(row) };
}

/**
 * Post one settled payment and update its invoice.
 *
 * Idempotency is keyed on the gateway reference (or the UTR for a manual
 * record), so Razorpay's retried webhook and the browser's confirm request can
 * both arrive without double-crediting the invoice.
 */
async function recordSettlement(
  invoice: FeeInvoice,
  input: { amount: number; method: string; reference: string }
): Promise<{ ok: true } & SettlementResult | { ok: false; response: Response }> {
  const reference = input.reference.trim();
  if (!reference) {
    return { ok: false, response: fail("The payment reference is missing.", 400, "invalid_reference") };
  }

  const existing = await one(
    `payments?select=id,receipt_no&organisation_id=eq.${invoice.organisation_id}` +
      `&reference=eq.${encodeURIComponent(reference)}&limit=1`
  );
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      paymentId: String(existing.id),
      receiptNo: String(existing.receipt_no ?? ""),
      status: "RECORDED",
    };
  }

  const open = payable(invoice);
  if (!open.ok) return open;

  const requested = round2(input.amount);
  if (requested <= 0) {
    return { ok: false, response: fail("The settled amount is missing.", 400, "invalid_amount") };
  }
  if (requested > open.outstanding + 0.01) {
    return { ok: false, response: fail("The amount is larger than the invoice balance.", 409, "amount_too_large") };
  }

  const paymentId = await deterministicPaymentId(
    `fee-payment:${invoice.organisation_id}:${reference}`
  );
  const receiptNo = await nextReceiptNo(invoice.organisation_id);
  const paidAt = new Date().toISOString();
  const newPaid = round2(invoice.paid_amount + requested);
  const newStatus = newPaid >= invoice.total ? "paid" : "partial";

  const insertRes = await rest("payments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: paymentId,
      organisation_id: invoice.organisation_id,
      invoice_id: invoice.id,
      receipt_no: receiptNo,
      amount: requested,
      method: input.method,
      paid_at: paidAt,
      reference,
    }),
  });

  if (insertRes.status === 409) {
    const raced = await one(
      `payments?select=id,receipt_no&organisation_id=eq.${invoice.organisation_id}` +
        `&reference=eq.${encodeURIComponent(reference)}&limit=1`
    );
    if (raced) {
      return {
        ok: true,
        duplicate: true,
        paymentId: String(raced.id),
        receiptNo: String(raced.receipt_no ?? ""),
        status: "RECORDED",
      };
    }
    return { ok: false, response: fail("The payment could not be recorded.", 502, "database_error") };
  }
  if (!insertRes.ok) {
    return { ok: false, response: fail("The payment could not be recorded.", 502, "database_error") };
  }

  const updateRes = await rest(
    `invoices?id=eq.${invoice.id}&organisation_id=eq.${invoice.organisation_id}` +
      `&student_id=eq.${invoice.student_id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ paid_amount: newPaid, status: newStatus }),
    }
  );
  if (!updateRes.ok) {
    // The invoice ledger is the source of truth. If its update fails, roll the
    // payment row back so the same reference can be retried instead of being
    // treated as an already-completed duplicate.
    await rest(
      `payments?id=eq.${paymentId}&organisation_id=eq.${invoice.organisation_id}`,
      { method: "DELETE" }
    );
    return { ok: false, response: fail("The invoice could not be updated.", 502, "database_error") };
  }

  return { ok: true, duplicate: false, paymentId, receiptNo, status: newStatus };
}

/**
 * Record a UPI credit the finance office has seen on its bank statement.
 *
 * Kept as a manual fallback for bank transfers and for the rare payment that
 * the gateway cannot confirm. It is idempotent on the UTR.
 */
export async function recordVerifiedUpiPayment(
  req: Request,
  body: Json
): Promise<{ ok: true } & SettlementResult | { ok: false; response: Response }> {
  const invoiceId = String(body.invoiceId ?? "").trim();
  const resolved = await resolveStaffInvoice(req, invoiceId);
  if (!resolved.ok) return resolved;

  const utr = String(body.utr ?? "").replace(/\s+/g, "");
  if (!/^\d{12}$/.test(utr)) {
    return { ok: false, response: fail("Enter the 12-digit UTR from the bank statement.", 400, "invalid_utr") };
  }

  const outstanding = round2(resolved.invoice.total - resolved.invoice.paid_amount);
  const requested =
    body.amount === undefined ? outstanding : round2(num(body.amount));

  if (body.amount !== undefined && requested < 15000 && outstanding >= 15000) {
    return { ok: false, response: fail("Minimum installment payment is ₹15,000.", 400, "below_minimum_installment") };
  }

  return recordSettlement(resolved.invoice, {
    amount: requested,
    method: "UPI",
    reference: utr,
  });
}

/** Record a payment Razorpay has already signed as captured. */
export async function recordGatewayPayment(input: {
  invoiceId: string;
  organisationId: string;
  amount: number;
  method: string;
  reference: string;
}): Promise<{ ok: true } & SettlementResult | { ok: false; response: Response }> {
  const resolved = await resolveGatewayInvoice(input.invoiceId, input.organisationId);
  if (!resolved.ok) return resolved;

  return recordSettlement(resolved.invoice, {
    amount: input.amount,
    method: input.method,
    reference: input.reference,
  });
}

async function deterministicPaymentId(seed: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed))
  );
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function academicYear(now = new Date()): string {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

async function nextReceiptNo(orgId: string): Promise<string> {
  const year = academicYear();
  const latest = await rows(
    `payments?select=receipt_no&organisation_id=eq.${orgId}` +
      `&receipt_no=like.${encodeURIComponent(`RCP/${year}/*`)}&order=receipt_no.desc&limit=1`
  );
  const last = String(latest[0]?.receipt_no ?? "");
  const match = last.match(/(\d+)$/);
  const next = (match ? Number(match[1]) : 0) + 1;
  return `RCP/${year}/${String(next).padStart(4, "0")}`;
}

export { fail };
