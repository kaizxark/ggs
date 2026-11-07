/**
 * HTTP adapters for the fee-payment flow.
 *
 * These live in `shared/` rather than in their own `api/` files because the
 * Vercel Hobby plan caps a deployment at twelve serverless functions and this
 * project already has twelve. `api/student-profile` is the multiplexer: a
 * request carrying `?__fee=...` is dispatched here before the profile handler
 * runs. Every action still resolves its own caller or signature, so none of
 * them borrow the profile route's authorization.
 */

import {
  handleFeeConfirmRequest,
  handleFeeOrderRequest,
  handleFeeWebhookRequest,
} from "./fee-gateway.js";
import { fail, recordManualPayment, recordVerifiedUpiPayment } from "./fee-payments.js";

/** Create a Razorpay order and return the public Checkout parameters. */
export const handleFeePaymentRequest = handleFeeOrderRequest;

/** Verify the browser's signed Checkout result. */
export { handleFeeConfirmRequest, handleFeeWebhookRequest };

/** Manual fallback for a bank-transfer UTR the office has verified. */
export async function handleFeeRecordRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed.", 405, "method_not_allowed");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Send the invoice and UTR.", 400, "invalid_body");
  }

  const result = await recordVerifiedUpiPayment(req, body);
  if (!result.ok) return result.response;
  return Response.json(
    {
      recorded: true,
      duplicate: result.duplicate,
      paymentId: result.paymentId,
      receiptNo: result.receiptNo,
      status: result.status,
    },
    { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } }
  );
}

/** A collection the office took as cash, cheque, card or a bank transfer. */
export async function handleFeeManualRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed.", 405, "method_not_allowed");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Send the invoice, method, reference and amount.", 400, "invalid_body");
  }

  const result = await recordManualPayment(req, body);
  if (!result.ok) return result.response;
  return Response.json(
    {
      recorded: true,
      duplicate: result.duplicate,
      paymentId: result.paymentId,
      receiptNo: result.receiptNo,
      status: result.status,
    },
    { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } }
  );
}
