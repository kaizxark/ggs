import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FeePaymentError,
  confirmFeePayment,
  loadRazorpayCheckout,
  openRazorpayCheckout,
  startFeePayment,
  type RazorpaySuccess,
} from "@/lib/fee-payments";

interface FeePaymentDialogProps {
  open: boolean;
  invoiceId: string | null;
  invoiceNo: string;
  outstanding: number;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void | Promise<void>;
}

function rupees(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function FeePaymentDialog({
  open,
  invoiceId,
  invoiceNo,
  outstanding,
  onOpenChange,
  onPaid,
}: FeePaymentDialogProps) {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"full" | "installment">("full");
  const [installmentAmount, setInstallmentAmount] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setStarting(false);
    setPaying(false);
    setConfirming(false);
    setDone(false);
    setPaymentMode("full");
    setInstallmentAmount(Math.min(outstanding, 15000).toString());
  }, [open, invoiceId, outstanding]);

  const effectiveAmount = paymentMode === "full"
    ? outstanding
    : Number(installmentAmount.replace(/[^0-9.]/g, "")) || 0;

  async function confirm(result: RazorpaySuccess) {
    setConfirming(true);
    setError("");
    try {
      const receipt = await confirmFeePayment(result);
      setDone(true);
      toast.success(receipt.duplicate ? "Payment already recorded" : "Payment successful", {
        description: receipt.receiptNo
          ? `${invoiceNo} · ${receipt.receiptNo}`
          : `${invoiceNo} has been updated.`,
      });
      await onPaid();
      window.setTimeout(() => onOpenChange(false), 900);
    } catch (err) {
      // The money has left the family's account. Razorpay's webhook is the
      // fallback, so keep the message reassuring and refresh the profile shortly.
      setError(
        err instanceof FeePaymentError
          ? `${err.message} The receipt will appear automatically once the bank confirms it.`
          : "The payment was received. The receipt will appear automatically once the bank confirms it."
      );
      window.setTimeout(() => {
        void onPaid();
      }, 3500);
    } finally {
      setConfirming(false);
      setPaying(false);
    }
  }

  async function pay() {
    if (!invoiceId || starting || paying || confirming) return;
    setError("");

    if (paymentMode === "installment") {
      if (!effectiveAmount || effectiveAmount <= 0) {
        setError("Enter a valid installment amount.");
        return;
      }
      if (effectiveAmount < 15000 && outstanding >= 15000) {
        setError("Minimum installment amount is ₹15,000 according to school policy.");
        return;
      }
      if (effectiveAmount > outstanding + 0.01) {
        setError(`Amount cannot exceed the outstanding balance of ${rupees(outstanding)}.`);
        return;
      }
    }

    setStarting(true);
    try {
      const [session, loaded] = await Promise.all([
        startFeePayment(invoiceId, effectiveAmount),
        loadRazorpayCheckout(),
      ]);
      if (!loaded) {
        throw new FeePaymentError(
          0,
          "checkout_unavailable",
          "The payment window could not load. Check your connection and try again."
        );
      }
      setPaying(true);
      openRazorpayCheckout(session, {
        onSuccess: (result) => {
          void confirm(result);
        },
        onDismiss: () => {
          setPaying(false);
          setError("Payment cancelled. You can try again whenever you are ready.");
        },
        onFailure: (message) => {
          setPaying(false);
          setError(message);
        },
      });
    } catch (err) {
      setError(
        err instanceof FeePaymentError
          ? err.message
          : "The payment could not be started. Check your connection and try again."
      );
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || paying || confirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,440px)] gap-0 p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone size={18} />
            Pay {invoiceNo}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pay online via UPI. Minimum installment payment is ₹15,000.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          {/* Payment Type Selection (Full vs Installment) */}
          {outstanding > 15000 && (
            <div className="flex rounded-xl p-1 bg-[var(--bg-raised)] border border-[var(--border)] gap-1">
              <button
                type="button"
                onClick={() => setPaymentMode("full")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  paymentMode === "full"
                    ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Full Balance ({rupees(outstanding)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode("installment");
                  if (!installmentAmount) setInstallmentAmount("15000");
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  paymentMode === "installment"
                    ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Pay in Installment
              </button>
            </div>
          )}

          {paymentMode === "full" ? (
            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[var(--text-muted)]">Amount payable</span>
                <span className="text-2xl font-semibold tracking-tight">{rupees(outstanding)}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Full outstanding balance for this invoice.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Installment Amount (₹)</span>
                <span className="text-xs text-[var(--text-muted)]">Max: {rupees(outstanding)}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={15000}
                  max={outstanding}
                  step={500}
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  placeholder="15000"
                  className="w-full px-3 py-2 text-base font-semibold rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[var(--text-muted)]">Presets:</span>
                <button
                  type="button"
                  onClick={() => setInstallmentAmount("15000")}
                  className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] font-medium border border-[var(--border)]"
                >
                  ₹15,000 (Min)
                </button>
                {outstanding >= 20000 && (
                  <button
                    type="button"
                    onClick={() => setInstallmentAmount("20000")}
                    className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] font-medium border border-[var(--border)]"
                  >
                    ₹20,000
                  </button>
                )}
                {outstanding >= 30000 && (
                  <button
                    type="button"
                    onClick={() => setInstallmentAmount("30000")}
                    className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] font-medium border border-[var(--border)]"
                  >
                    ₹30,000
                  </button>
                )}
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)]">
                School policy: minimum installment payment is ₹15,000.
              </p>
            </div>
          )}

          <div className="notice flex items-start gap-2 text-xs">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              You will choose any UPI app — Google Pay, PhonePe, Paytm, BHIM or another — inside
              the secure Razorpay window. Do not close it until the payment completes.
            </span>
          </div>

          {error && (
            <div className="notice notice-warning flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div className="notice flex items-start gap-2 text-xs">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <span>The payment is recorded. This invoice will refresh in a moment.</span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[var(--border)] px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
            Close
          </Button>
          <Button onClick={() => void pay()} disabled={busy || done}>
            {(starting || confirming) && <Loader2 size={14} className="animate-spin" />}
            {starting
              ? "Starting…"
              : confirming
                ? "Confirming…"
                : paying
                  ? "Complete in Razorpay"
                  : done
                    ? "Paid"
                    : `Pay ${rupees(effectiveAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
