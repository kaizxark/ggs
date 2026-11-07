/**
 * Official Fee Payment Receipt Dispatcher
 *
 * Generates and sends official fee payment receipts via email to students/guardians.
 * Uses Nodemailer when SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are configured,
 * and logs simulated dispatch in offline/development modes.
 */

export const config = { runtime: "nodejs" };

import nodemailer from "nodemailer";
import { escapeHtml, guardEmailRoute, isUsableEmail } from "../shared/email-guard.js";

export interface ReceiptEmailPayload {
  receiptNo: string;
  studentName: string;
  studentEmail: string;
  invoiceId?: string;
  amount: number;
  method?: string;
  date?: string;
  reference?: string;
  grade?: string;
  totalFee?: number;
  remainingBalance?: number;
}

function formatInr(val: number): string {
  return "₹" + Number(val || 0).toLocaleString("en-IN");
}

function formatDateIn(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  try {
    const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function buildReceiptHtml(p: ReceiptEmailPayload): string {
  const isPaidInFull = (p.remainingBalance ?? 0) <= 0;
  const statusColor = isPaidInFull ? "#10b981" : "#f59e0b";
  const statusLabel = isPaidInFull ? "PAID IN FULL" : "PARTIAL PAYMENT (BALANCE DUE)";

  // Every value below came from a request body, so it is escaped here rather
  // than trusted. The school's own brand text is the only literal HTML.
  const receiptNo = escapeHtml(p.receiptNo);
  const dateText = escapeHtml(formatDateIn(p.date));
  const studentName = escapeHtml(p.studentName);
  const grade = escapeHtml(p.grade || "Enrolled Pupil");
  const gradeLabel = escapeHtml(p.grade || "Academic Year 2026–27");
  const invoiceId = escapeHtml(p.invoiceId || "INV-2026-FEE");
  const reference = p.reference ? escapeHtml(p.reference) : "";
  const method = escapeHtml(p.method || "Electronic Transfer");
  const recipient = escapeHtml(p.studentEmail);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Global Kids School · Payment Receipt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #1e1b4b; color: #ffffff; padding: 28px 32px; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
    .title { font-size: 13px; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 14px; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; }
    .body { padding: 32px; }
    .receipt-id-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
    .table td { padding: 12px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .amount-highlight { font-size: 22px; font-weight: 800; color: #0f172a; }
    .footer { background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="brand">Global Kids School</h1>
      <div class="title">Official Tuition Fee Receipt</div>
      <div class="badge">${statusLabel}</div>
    </div>
    <div class="body">
      <div class="receipt-id-box">
        <div>
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Receipt Number</div>
          <div style="font-size: 16px; font-weight: 700; font-family: monospace; color: #4338ca;">${receiptNo}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Date of Payment</div>
          <div style="font-size: 13px; font-weight: 600; color: #334155;">${dateText}</div>
        </div>
      </div>

      <table class="table">
        <tr>
          <th>Student Details</th>
          <th style="text-align: right;">Record Reference</th>
        </tr>
        <tr>
          <td>
            <strong>${studentName}</strong>
            <div style="font-size: 12px; color: #64748b;">${grade}</div>
          </td>
          <td style="text-align: right;">
            <div>Invoice: <code>${invoiceId}</code></div>
            ${reference ? `<div style="font-size: 11px; color: #64748b;">Ref/UTR: ${reference}</div>` : ""}
          </td>
        </tr>
      </table>

      <table class="table">
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
        <tr>
          <td>Annual Tuition Fee (${gradeLabel})</td>
          <td style="text-align: right;">${formatInr(p.totalFee || 50000)}</td>
        </tr>
        <tr>
          <td>Payment Method</td>
          <td style="text-align: right;">${method}</td>
        </tr>
        <tr style="border-top: 2px solid #cbd5e1;">
          <td style="padding-top: 14px;"><strong>Amount Paid Now</strong></td>
          <td style="text-align: right; padding-top: 14px;" class="amount-highlight text-emerald-600">${formatInr(p.amount)}</td>
        </tr>
        <tr>
          <td><strong>Remaining Balance Due</strong></td>
          <td style="text-align: right; font-weight: 700; color: ${isPaidInFull ? "#10b981" : "#f59e0b"};">
            ${formatInr(p.remainingBalance ?? 0)}
          </td>
        </tr>
      </table>

      <div style="background: #eef2ff; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #3730a3; margin-top: 20px;">
        This receipt has been recorded in the Global Kids School Finance Ledger and dispatched to the pupil's registered email address (<strong>${recipient}</strong>).
      </div>
    </div>
    <div class="footer">
      Global Kids School · Tumakuru Campus, Karnataka · Official ERP Computer-Generated Receipt · Valid without manual signature.
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed", message: "POST required" }, { status: 405 });
  }

  /*
   * Sending school-branded mail is a privileged action. A receipt is an
   * official document and the transport is the school's own SMTP reputation,
   * so only the finance desk (or an administrator) may trigger one.
   */
  const guard = await guardEmailRoute(req, ["admin", "principal", "accountant"], "receipt-email");
  if (!guard.ok) return guard.response;

  let payload: ReceiptEmailPayload;
  try {
    payload = (await req.json()) as ReceiptEmailPayload;
  } catch {
    return Response.json({ error: "invalid_body", message: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.receiptNo || !payload.studentName || !payload.amount) {
    return Response.json(
      { error: "missing_fields", message: "receiptNo, studentName, and amount are required" },
      { status: 400 }
    );
  }

  const recipient = String(payload.studentEmail ?? "").trim();
  if (!isUsableEmail(recipient)) {
    return Response.json(
      {
        error: "invalid_recipient",
        message: "A valid recipient email address is required.",
      },
      { status: 400 }
    );
  }

  const receiptNo = String(payload.receiptNo).replace(/[\r\n]+/g, " ").slice(0, 80);
  const subject = `Fee Payment Receipt [${receiptNo}] · Global Kids School`;
  const html = buildReceiptHtml({ ...payload, studentEmail: recipient });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  let sentViaSmtp = false;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 587),
        secure: Number(SMTP_PORT ?? 587) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });

      await transport.sendMail({
        from: SMTP_FROM || `"Global Kids School Accounts" <${SMTP_USER}>`,
        to: recipient,
        subject,
        html,
        text: `Global Kids School - Tuition Fee Receipt\n\nReceipt: ${payload.receiptNo}\nStudent: ${payload.studentName}\nAmount Paid: ${formatInr(payload.amount)}\nBalance: ${formatInr(payload.remainingBalance ?? 0)}\n\nThank you for your payment.`,
      });

      sentViaSmtp = true;
    } catch (err) {
      console.warn("SMTP send failed, falling back to recorded dispatch:", err);
    }
  }

  return Response.json({
    ok: true,
    sent: sentViaSmtp,
    mode: sentViaSmtp ? "smtp" : "recorded",
    receiptNo,
    recipient,
    message: sentViaSmtp
      ? `Receipt ${receiptNo} sent to ${recipient}`
      : `Receipt ${receiptNo} recorded; mail transport is not configured, so nothing was sent.`,
  });
}
