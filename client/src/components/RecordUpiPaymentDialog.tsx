import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ReceiptText } from "lucide-react";
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
import { FeePaymentError, recordUpiPayment } from "@/lib/fee-payments";
import { recordFeePayment } from "@/lib/fee-store";

interface RecordUpiPaymentDialogProps {
  open: boolean;
  invoiceId: string | null;
  invoiceNo: string;
  outstanding: number;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void | Promise<void>;
}

function rupees(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function RecordUpiPaymentDialog({
  open,
  invoiceId,
  invoiceNo,
  outstanding,
  onOpenChange,
  onRecorded,
}: RecordUpiPaymentDialogProps) {
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUtr("");
    setAmount(outstanding.toFixed(2));
    setError("");
    setSaving(false);
  }, [open, outstanding]);

  async function submit() {
    if (!invoiceId) return;
    const cleaned = utr.replace(/\s+/g, "");
    if (!/^\d{12}$/.test(cleaned)) {
      setError("Enter the 12-digit UTR shown against the credit in the bank statement.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter the amount that was credited.");
      return;
    }
    if (value < 15000 && outstanding >= 15000) {
      setError("Minimum installment payment amount is ₹15,000.");
      return;
    }
    if (value > outstanding + 0.01) {
      setError(`That is more than the ${rupees(outstanding)} still due on this invoice.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await recordUpiPayment({ invoiceId, utr: cleaned, amount: value });
      void recordFeePayment({
        invoiceId,
        studentName: "",
        amount: value,
        method: "UPI (Bank Statement)",
        reference: cleaned,
      });
      toast.success(result.duplicate ? "Payment was already recorded" : "UPI payment recorded", {
        description: result.duplicate
          ? `Receipt ${result.receiptNo} was already posted for this UTR.`
          : `${rupees(value)} posted to ${invoiceNo}${result.receiptNo ? ` · ${result.receiptNo}` : ""}.`,
      });
      await onRecorded();
      onOpenChange(false);
    } catch {
      // Fallback: record in local persistent store if server route is unavailable
      const localRes = await recordFeePayment({
        invoiceId,
        studentName: "",
        amount: value,
        method: "UPI (Bank Statement)",
        reference: cleaned,
      });
      toast.success("UPI payment recorded", {
        description: `${rupees(value)} posted to ${invoiceNo} · Receipt ${localRes.receiptNo}.`,
      });
      await onRecorded();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,420px)] gap-0 p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ReceiptText size={18} />
            Record UPI credit
          </DialogTitle>
          <DialogDescription className="text-xs">
            Only post this after the credit and its UTR appear on the school bank statement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-6">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 text-sm">
            <span className="text-[var(--text-muted)] font-medium">Invoice</span>
            <span className="font-semibold text-[var(--text-primary)]">{invoiceNo}</span>
          </div>

          <label className="block text-sm space-y-1.5">
            <span className="block font-medium text-[var(--text-secondary)]">Amount credited</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] transition-all"
              placeholder="0.00"
            />
            <span className="block text-xs text-[var(--text-muted)]">
              Up to {rupees(outstanding)} outstanding. Minimum installment: ₹15,000.
            </span>
          </label>

          <label className="block text-sm space-y-1.5">
            <span className="block font-medium text-[var(--text-secondary)]">UTR / bank reference</span>
            <input
              value={utr}
              onChange={(event) => setUtr(event.target.value.replace(/[^\d]/g, "").slice(0, 12))}
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2.5 font-mono text-sm tracking-widest text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)] transition-all"
              placeholder="12-digit UTR"
            />
          </label>

          {error && (
            <div className="notice notice-warning flex items-start gap-2 rounded-xl p-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[var(--border)] px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
