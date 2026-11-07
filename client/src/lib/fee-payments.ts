import { supabase } from "./supabase";
import { notifyDataChanged } from "./live-data";

export interface FeePaymentSession {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string };
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  retry?: { enabled: boolean };
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
  handler: (response: RazorpaySuccess) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export class FeePaymentError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "FeePaymentError";
    this.status = status;
    this.code = code;
  }
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FeePaymentError(401, "unauthenticated", "Sign in to continue.");
  return token;
}

async function readError(res: Response): Promise<FeePaymentError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return new FeePaymentError(
    res.status,
    String(body.error ?? "error"),
    String(body.message ?? "That request could not be completed.")
  );
}

/** Ask the server to create a Razorpay order for the full outstanding balance or an installment. */
export async function startFeePayment(invoiceId: string, amount?: number): Promise<FeePaymentSession> {
  const token = await authToken();
  const res = await fetch("/api/student-profile?__fee=payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ invoiceId, amount }),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as { payment?: FeePaymentSession };
  if (!body.payment?.orderId || !body.payment.keyId) {
    throw new FeePaymentError(502, "bad_response", "The payment could not be started.");
  }
  return body.payment;
}

/** Verify the Checkout result server-side, which posts the receipt immediately. */
export async function confirmFeePayment(
  result: RazorpaySuccess
): Promise<{ receiptNo: string; duplicate: boolean; status: string }> {
  const token = await authToken();
  const res = await fetch("/api/student-profile?__fee=confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(result),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as {
    receiptNo?: string;
    duplicate?: boolean;
    status?: string;
  };
  notifyDataChanged();
  return {
    receiptNo: String(body.receiptNo ?? ""),
    duplicate: body.duplicate === true,
    status: String(body.status ?? "RECORDED"),
  };
}

/** Finance office: record a bank-verified UTR manually (bank transfer fallback). */
export async function recordUpiPayment(input: {
  invoiceId: string;
  utr: string;
  amount: number;
}): Promise<{ receiptNo: string; duplicate: boolean; status: string }> {
  const token = await authToken();
  const res = await fetch("/api/student-profile?__fee=record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as {
    receiptNo?: string;
    duplicate?: boolean;
    status?: string;
  };
  notifyDataChanged();
  return {
    receiptNo: String(body.receiptNo ?? ""),
    duplicate: body.duplicate === true,
    status: String(body.status ?? "RECORDED"),
  };
}

/**
 * Finance office: record a collection taken outside the gateway.
 *
 * Cash, cheque, POS and a bank transfer all post through here. The reference is
 * the idempotency key, so it is required rather than optional — a second submit
 * of the same entry resolves to the payment already recorded instead of
 * crediting the invoice twice.
 */
export async function recordManualPayment(input: {
  invoiceId: string;
  amount: number;
  method: string;
  reference: string;
  paidOn?: string;
}): Promise<{ receiptNo: string; duplicate: boolean; status: string }> {
  const token = await authToken();
  const res = await fetch("/api/student-profile?__fee=manual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as {
    receiptNo?: string;
    duplicate?: boolean;
    status?: string;
  };
  notifyDataChanged();
  return {
    receiptNo: String(body.receiptNo ?? ""),
    duplicate: body.duplicate === true,
    status: String(body.status ?? "RECORDED"),
  };
}

let checkoutScript: Promise<boolean> | null = null;

/** Load Razorpay's hosted Checkout once. */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutScript) return checkoutScript;

  checkoutScript = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay-checkout]");
    if (existing) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => {
      checkoutScript = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return checkoutScript;
}

/**
 * Open Razorpay Checkout. On mobile this hands off to the installed UPI apps;
 * on desktop it displays the UPI QR/collect screen.
 */
export function openRazorpayCheckout(
  session: FeePaymentSession,
  handlers: {
    onSuccess: (result: RazorpaySuccess) => void;
    onDismiss: () => void;
    onFailure: (message: string) => void;
  }
): void {
  if (!window.Razorpay) {
    throw new FeePaymentError(500, "checkout_unavailable", "The payment window could not open.");
  }

  const checkout = new window.Razorpay({
    key: session.keyId,
    amount: Math.round(session.amount * 100),
    currency: session.currency,
    name: session.name,
    description: session.description,
    order_id: session.orderId,
    prefill: session.prefill,
    theme: { color: "#0f766e" },
    retry: { enabled: true },
    modal: {
      ondismiss: handlers.onDismiss,
      escape: true,
      backdropclose: false,
    },
    handler: handlers.onSuccess,
  });

  checkout.on("payment.failed", (response) => {
    handlers.onFailure(
      response.error?.description ?? "The payment could not be completed. Please try again."
    );
  });

  checkout.open();
}
