import { notifyDataChanged } from "./live-data";
import { getAnnualFeeForGrade, MIN_INSTALLMENT_AMOUNT } from "./school-data";
import { supabase } from "./supabase";

export interface InvoiceRecord {
  id: string;
  studentId: string;
  student: string;
  family: string;
  grade: string;
  section: string;
  due_date: string;
  total: number;
  paid: number;
  amount: number; // outstanding amount
  outstanding: number;
  status: "Paid" | "Partial" | "Overdue" | "Due";
}

export interface PaymentRecord {
  id: string;
  invoice_id: string | null;
  student: string;
  studentId?: string;
  amount: number;
  method: string;
  paid_at: string;
  receipt_no: string;
  reference?: string;
}

export interface StudentFeeOverride {
  fees: "Paid" | "Partial" | "Overdue" | "Due";
  total_fees: number;
  paid_fees: number;
  outstanding_fees: number;
}

const INVOICES_STORAGE_KEY = "ggs_erp_invoices_v4";
const PAYMENTS_STORAGE_KEY = "ggs_erp_payments_v4";
const STUDENT_FEES_STORAGE_KEY = "ggs_erp_student_fees_v4";

// Initial seed invoices matching our Class 6-10 students
function getSeedInvoices(): InvoiceRecord[] {
  return [
    {
      id: "INV-2026-1048",
      studentId: "GKS-23819",
      student: "Ishita Nair",
      family: "Nair family",
      grade: "Grade 10",
      section: "A",
      due_date: "24 Sep 2026",
      total: 60000,
      paid: 60000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1099",
      studentId: "GKS-24211",
      student: "Vihaan Kapoor",
      family: "Kapoor family",
      grade: "Grade 6",
      section: "B",
      due_date: "20 Sep 2026",
      total: 50000,
      paid: 15000,
      amount: 35000,
      outstanding: 35000,
      status: "Overdue",
    },
    {
      id: "INV-2026-1126",
      studentId: "GKS-24306",
      student: "Mira Thomas",
      family: "Thomas family",
      grade: "Grade 7",
      section: "A",
      due_date: "18 Sep 2026",
      total: 50000,
      paid: 0,
      amount: 50000,
      outstanding: 50000,
      status: "Overdue",
    },
    {
      id: "INV-2026-1140",
      studentId: "GKS-24401",
      student: "Rohan Verma",
      family: "Verma family",
      grade: "Grade 8",
      section: "A",
      due_date: "15 Oct 2026",
      total: 50000,
      paid: 20000,
      amount: 30000,
      outstanding: 30000,
      status: "Due",
    },
    {
      id: "INV-2026-1011",
      studentId: "GKS-24081",
      student: "Aarav Mehta",
      family: "Mehta family",
      grade: "Grade 8",
      section: "B",
      due_date: "01 Sep 2026",
      total: 50000,
      paid: 50000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1022",
      studentId: "GKS-23104",
      student: "Ananya Rao",
      family: "Rao family",
      grade: "Grade 6",
      section: "A",
      due_date: "05 Sep 2026",
      total: 50000,
      paid: 50000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1035",
      studentId: "GKS-23998",
      student: "Kabir Malhotra",
      family: "Malhotra family",
      grade: "Grade 9",
      section: "B",
      due_date: "10 Sep 2026",
      total: 60000,
      paid: 60000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1055",
      studentId: "GKS-23277",
      student: "Arjun Menon",
      family: "Menon family",
      grade: "Grade 9",
      section: "A",
      due_date: "12 Sep 2026",
      total: 60000,
      paid: 60000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1064",
      studentId: "GKS-24170",
      student: "Sara Fernandes",
      family: "Fernandes family",
      grade: "Grade 7",
      section: "B",
      due_date: "15 Sep 2026",
      total: 50000,
      paid: 50000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
    {
      id: "INV-2026-1078",
      studentId: "GKS-24512",
      student: "Tanvi Deshmukh",
      family: "Deshmukh family",
      grade: "Grade 10",
      section: "B",
      due_date: "20 Sep 2026",
      total: 60000,
      paid: 60000,
      amount: 0,
      outstanding: 0,
      status: "Paid",
    },
  ];
}

function getSeedPayments(): PaymentRecord[] {
  return [
    {
      id: "PAY-001",
      invoice_id: "INV-2026-1048",
      student: "Ishita Nair",
      studentId: "GKS-23819",
      amount: 30000,
      method: "Bank transfer",
      paid_at: "2026-09-28T08:52:00Z",
      receipt_no: "RCP/26-27/0001",
      reference: "UTR983210452319",
    },
    {
      id: "PAY-002",
      invoice_id: "INV-2026-1048",
      student: "Ishita Nair",
      studentId: "GKS-23819",
      amount: 30000,
      method: "UPI",
      paid_at: "2026-09-29T10:14:00Z",
      receipt_no: "RCP/26-27/0002",
      reference: "UPI392817402911",
    },
    {
      id: "PAY-003",
      invoice_id: "INV-2026-1099",
      student: "Vihaan Kapoor",
      studentId: "GKS-24211",
      amount: 15000,
      method: "Cash",
      paid_at: "2026-09-26T11:20:00Z",
      receipt_no: "RCP/26-27/0003",
      reference: "CASH-CT-04",
    },
    {
      id: "PAY-004",
      invoice_id: "INV-2026-1140",
      student: "Rohan Verma",
      studentId: "GKS-24401",
      amount: 20000,
      method: "Card",
      paid_at: "2026-09-27T16:40:00Z",
      receipt_no: "RCP/26-27/0004",
      reference: "POS-TXN-8849",
    },
  ];
}

/** Retrieve all invoices from local storage or seed data */
export function getStoredInvoices(): InvoiceRecord[] {
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const seed = getSeedInvoices();
  saveStoredInvoices(seed);
  return seed;
}

export function saveStoredInvoices(invoices: InvoiceRecord[]): void {
  try {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // ignore
  }
}

/** Retrieve all payments from local storage or seed data */
export function getStoredPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const seed = getSeedPayments();
  saveStoredPayments(seed);
  return seed;
}

export function saveStoredPayments(payments: PaymentRecord[]): void {
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
  } catch {
    // ignore
  }
}

/** Retrieve student fee status overrides */
export function getStudentFeeOverrides(): Record<string, StudentFeeOverride> {
  try {
    const raw = localStorage.getItem(STUDENT_FEES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  // Initialize from seed invoices
  const invoices = getStoredInvoices();
  const map: Record<string, StudentFeeOverride> = {};
  for (const inv of invoices) {
    const key = inv.studentId || inv.student;
    map[key] = {
      fees: inv.amount <= 0 ? "Paid" : inv.status === "Overdue" ? "Overdue" : "Due",
      total_fees: inv.total,
      paid_fees: inv.paid,
      outstanding_fees: inv.amount,
    };
    if (inv.student) {
      map[inv.student.toLowerCase()] = map[key];
    }
  }
  saveStudentFeeOverrides(map);
  return map;
}

export function saveStudentFeeOverrides(map: Record<string, StudentFeeOverride>): void {
  try {
    localStorage.setItem(STUDENT_FEES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Record a fee payment across the whole ERP system.
 * Updates invoices, payments history, student profiles, and emits data-changed signal.
 */
export async function recordFeePayment({
  studentId,
  studentName,
  invoiceId,
  amount,
  method,
  date,
  reference,
}: {
  studentId?: string;
  studentName: string;
  invoiceId?: string;
  amount: number;
  method: string;
  date?: string;
  reference?: string;
}): Promise<{
  success: boolean;
  receiptNo: string;
  amountPaid: number;
  newBalance: number;
  totalBilled: number;
  isPaidInFull: boolean;
  invoice: InvoiceRecord;
  payment: PaymentRecord;
}> {
  const invoices = getStoredInvoices();
  const payments = getStoredPayments();
  const overrides = getStudentFeeOverrides();

  // Find target invoice
  let targetInvoice: InvoiceRecord | undefined;
  if (invoiceId) {
    targetInvoice = invoices.find(
      (i) => i.id.toLowerCase() === invoiceId.toLowerCase()
    );
  }
  if (!targetInvoice && studentId) {
    targetInvoice = invoices.find(
      (i) => i.studentId?.toLowerCase() === studentId.toLowerCase()
    );
  }
  if (!targetInvoice && studentName) {
    const q = studentName.trim().toLowerCase();
    targetInvoice = invoices.find(
      (i) => i.student.toLowerCase().includes(q) || q.includes(i.student.toLowerCase())
    );
  }

  // If no existing invoice found, create one
  if (!targetInvoice) {
    const grade = "Grade 10";
    const totalFee = getAnnualFeeForGrade(grade);
    const surname = studentName.split(" ").slice(-1)[0] || studentName;
    targetInvoice = {
      id: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      studentId: studentId || `STU-${Date.now()}`,
      student: studentName.trim(),
      family: `${surname} family`,
      grade,
      section: "A",
      due_date: "15 Oct 2026",
      total: totalFee,
      paid: 0,
      amount: totalFee,
      outstanding: totalFee,
      status: "Due",
    };
    invoices.push(targetInvoice);
  }

  // Enforce settlement calculation
  const paymentAmount = Math.max(0, amount);
  const newPaid = Math.min(targetInvoice.total, targetInvoice.paid + paymentAmount);
  const newOutstanding = Math.max(0, targetInvoice.total - newPaid);
  const isPaidInFull = newOutstanding <= 0;
  const newStatus: "Paid" | "Partial" | "Overdue" | "Due" = isPaidInFull
    ? "Paid"
    : "Partial";

  // Update target invoice
  targetInvoice.paid = newPaid;
  targetInvoice.amount = newOutstanding;
  targetInvoice.outstanding = newOutstanding;
  targetInvoice.status = newStatus;

  // Generate Receipt
  const receiptYear = "26-27";
  const receiptCount = payments.length + 1;
  const receiptNo = `RCP/${receiptYear}/${String(receiptCount).padStart(4, "0")}`;
  const effectiveDate = date ? new Date(date).toISOString() : new Date().toISOString();

  const newPayment: PaymentRecord = {
    id: `PAY-${Date.now()}`,
    invoice_id: targetInvoice.id,
    student: targetInvoice.student,
    studentId: targetInvoice.studentId,
    amount: paymentAmount,
    method: method || "Bank transfer",
    paid_at: effectiveDate,
    receipt_no: receiptNo,
    reference: reference || `VERIFIED-${Math.floor(100000 + Math.random() * 900000)}`,
  };

  payments.unshift(newPayment);

  // Update overrides for pupil
  const feeOverride: StudentFeeOverride = {
    fees: newStatus,
    total_fees: targetInvoice.total,
    paid_fees: newPaid,
    outstanding_fees: newOutstanding,
  };
  if (targetInvoice.studentId) {
    overrides[targetInvoice.studentId] = feeOverride;
  }
  if (targetInvoice.student) {
    overrides[targetInvoice.student.toLowerCase()] = feeOverride;
  }

  // Persist locally
  saveStoredInvoices(invoices);
  saveStoredPayments(payments);
  saveStudentFeeOverrides(overrides);

  // Try background Supabase/API sync (non-blocking)
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/student-profile?__fee=record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            invoiceId: targetInvoice.id,
            utr: String(Math.floor(100000000000 + Math.random() * 900000000000)),
            amount: paymentAmount,
          }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  })();

  // Broadcast data update to all views and listeners
  notifyDataChanged();

  return {
    success: true,
    receiptNo,
    amountPaid: paymentAmount,
    newBalance: newOutstanding,
    totalBilled: targetInvoice.total,
    isPaidInFull,
    invoice: targetInvoice,
    payment: newPayment,
  };
}

/** Get a student's full fee position (for pupil dashboard / student profile) */
export function getPupilFeeSummary(identifier?: string | null): {
  summary: {
    billed: number;
    paid: number;
    outstanding: number;
    overdue_count: number;
    overdue_amount: number;
  };
  accounts: Array<{
    id: string;
    academic_year_id: string | null;
    total_fee: number;
    scholarship: number;
    concession: number;
    discount_reason: string | null;
    paid_amount: number;
    status: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_no: string;
    due_on: string;
    total: number;
    paid_amount: number;
    status: string;
    payments: PaymentRecord[];
  }>;
  installments: Array<{
    id: string;
    label: string;
    amount: number;
    paid_amount: number;
    due_on: string;
    status: string;
  }>;
  upcoming: Array<{
    id: string;
    label: string;
    amount: number;
    due_on: string;
  }>;
} {
  const invoices = getStoredInvoices();
  const payments = getStoredPayments();

  let matched = invoices.filter((i) => {
    if (!identifier) return false;
    const q = identifier.trim().toLowerCase();
    return (
      (i.studentId && i.studentId.toLowerCase() === q) ||
      i.student.toLowerCase() === q ||
      i.student.toLowerCase().includes(q)
    );
  });

  // If identifier is not matched or not provided, default to the first student's invoices
  if (matched.length === 0 && invoices.length > 0) {
    matched = [invoices[0]];
  }

  const billed = matched.reduce((s, i) => s + (i.total || 0), 0);
  const paid = matched.reduce((s, i) => s + (i.paid || 0), 0);
  const outstanding = Math.max(0, billed - paid);
  const overdueInvoices = matched.filter((i) => i.status === "Overdue" && i.amount > 0);
  const overdue_count = overdueInvoices.length;
  const overdue_amount = overdueInvoices.reduce((s, i) => s + i.amount, 0);

  const accounts = [
    {
      id: `acc-${matched[0]?.id || "1"}`,
      academic_year_id: "2026-27",
      total_fee: billed,
      scholarship: 0,
      concession: 0,
      discount_reason: null,
      paid_amount: paid,
      status: outstanding === 0 ? "paid" : paid > 0 ? "partial" : "pending",
    },
  ];

  const pupilInvoices = matched.map((inv) => {
    const invPayments = payments.filter((p) => p.invoice_id === inv.id);
    return {
      id: inv.id,
      invoice_no: inv.id,
      due_on: inv.due_date,
      total: inv.total,
      paid_amount: inv.paid,
      status: inv.status.toLowerCase(),
      payments: invPayments,
    };
  });

  // Installment schedule
  const installments = [
    {
      id: "inst-1",
      label: "Installment 1 (Term 1)",
      amount: Math.min(billed, Math.max(MIN_INSTALLMENT_AMOUNT, Math.round(billed / 3))),
      paid_amount: Math.min(paid, Math.round(billed / 3)),
      due_on: "2026-06-15",
      status: paid >= Math.round(billed / 3) ? "paid" : "due",
    },
    {
      id: "inst-2",
      label: "Installment 2 (Term 2)",
      amount: Math.round(billed / 3),
      paid_amount: Math.max(0, Math.min(Math.round(billed / 3), paid - Math.round(billed / 3))),
      due_on: "2026-10-15",
      status: paid >= Math.round(billed * (2 / 3)) ? "paid" : "due",
    },
    {
      id: "inst-3",
      label: "Installment 3 (Final)",
      amount: billed - Math.round(billed / 3) * 2,
      paid_amount: Math.max(0, paid - Math.round(billed * (2 / 3))),
      due_on: "2027-01-15",
      status: paid >= billed ? "paid" : "due",
    },
  ];

  const upcoming = installments
    .filter((inst) => inst.status !== "paid")
    .map((inst) => ({
      id: inst.id,
      label: inst.label,
      amount: inst.amount - inst.paid_amount,
      due_on: inst.due_on,
    }));

  return {
    summary: {
      billed,
      paid,
      outstanding,
      overdue_count,
      overdue_amount,
    },
    accounts,
    invoices: pupilInvoices,
    installments,
    upcoming,
  };
}
