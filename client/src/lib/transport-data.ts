import { useCallback, useEffect, useMemo, useState } from "react";
import type { Student } from "./school-data";
import { notifyDataChanged, useDataRevision } from "./live-data";

export const ANNUAL_TRANSPORT_FEE = 14000;

export type TransportServiceType = "School Bus" | "Self Drop";
export type TransportPaymentStatus = "Paid" | "Partial" | "Due" | "Self Drop";

export interface BusRoute {
  id: string;
  routeCode: string;
  name: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  attendantName: string;
  morningPickupWindow: string;
  eveningDropWindow: string;
  capacity: number;
  stops: string[];
  status: "Active" | "Delayed" | "Maintenance";
}

export interface StudentTransportRecord {
  id: string;
  studentName: string;
  usn: string;
  grade: string;
  section: string;
  guardianName: string;
  guardianPhone: string;
  serviceType: TransportServiceType;
  routeId: string | null;
  routeName: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  pickupStop: string | null;
  pickupTime: string | null;
  dropTime: string | null;
  annualFee: number; // ₹14,000 for School Bus, ₹0 for Self Drop
  paidAmount: number;
  outstandingBalance: number;
  status: TransportPaymentStatus;
  lastPaymentDate: string | null;
  notes?: string;
}

export interface TransportPaymentReceipt {
  receiptNo: string;
  studentId: string;
  studentName: string;
  usn: string;
  grade: string;
  section: string;
  routeName: string;
  pickupStop: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  paidAt: string;
  receivedBy: string;
  annualFee: number;
  balanceRemaining: number;
  notes?: string;
}

export interface TransportStats {
  totalStudents: number;
  busRidersCount: number;
  selfDropCount: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  fullyPaidRiders: number;
  partialPaidRiders: number;
  dueRiders: number;
}

export const INITIAL_BUS_ROUTES: BusRoute[] = [
  {
    id: "RT-01",
    routeCode: "Route 01",
    name: "Sira Road & Batawadi",
    vehicleNo: "KA-06-B-1041 (GK-T04)",
    driverName: "Suresh Gowda",
    driverPhone: "+91 98451 22341",
    attendantName: "Mallikarjun",
    morningPickupWindow: "07:10 AM – 07:45 AM",
    eveningDropWindow: "03:40 PM – 04:15 PM",
    capacity: 35,
    stops: ["Sira Gate", "Batawadi Circle", "SIT Main Entrance", "Gandhi Nagar", "School Campus"],
    status: "Active",
  },
  {
    id: "RT-02",
    routeCode: "Route 02",
    name: "MG Road & Town Hall",
    vehicleNo: "KA-06-B-2082 (GK-T07)",
    driverName: "Manjunath K.",
    driverPhone: "+91 97400 55182",
    attendantName: "Rangaswamy",
    morningPickupWindow: "07:15 AM – 07:50 AM",
    eveningDropWindow: "03:45 PM – 04:20 PM",
    capacity: 40,
    stops: ["Town Hall", "MG Road Post Office", "Ashoka Nagar", "Someshwara Puram", "School Campus"],
    status: "Active",
  },
  {
    id: "RT-03",
    routeCode: "Route 03",
    name: "Kyathsandra & Toll Gate",
    vehicleNo: "KA-06-B-3112 (GK-T02)",
    driverName: "Lakshmi V.",
    driverPhone: "+91 99012 34819",
    attendantName: "Geetha Bai",
    morningPickupWindow: "07:05 AM – 07:40 AM",
    eveningDropWindow: "03:35 PM – 04:10 PM",
    capacity: 35,
    stops: ["Kyathsandra Old Gate", "Siddaganga Mutt", "Melekote Cross", "Antharasanahalli", "School Campus"],
    status: "Active",
  },
  {
    id: "RT-04",
    routeCode: "Route 04",
    name: "B.H. Road & Gubbi Gate",
    vehicleNo: "KA-06-B-4409 (GK-T09)",
    driverName: "Ramesh Prasad",
    driverPhone: "+91 96118 72004",
    attendantName: "Hanumanthappa",
    morningPickupWindow: "07:20 AM – 07:55 AM",
    eveningDropWindow: "03:50 PM – 04:25 PM",
    capacity: 30,
    stops: ["Gubbi Gate Circle", "Mandipet", "Belagumba Road", "Kothithopu", "School Campus"],
    status: "Active",
  },
  {
    id: "RT-05",
    routeCode: "Route 05",
    name: "Sapthagiri Extn & Ring Road",
    vehicleNo: "KA-06-B-5521 (GK-T11)",
    driverName: "Farhan Sayeed",
    driverPhone: "+91 94482 19033",
    attendantName: "Naveen Kumar",
    morningPickupWindow: "07:10 AM – 07:45 AM",
    eveningDropWindow: "03:40 PM – 04:15 PM",
    capacity: 35,
    stops: ["Sapthagiri Extn 1st Stage", "Maralur Dinné", "Ring Road Junction", "Vinayaka Nagar", "School Campus"],
    status: "Active",
  },
  {
    id: "RT-06",
    routeCode: "Route 06",
    name: "Hesaraghatta Link & SSIT",
    vehicleNo: "KA-06-B-6690 (GK-T06)",
    driverName: "Deepak Nayak",
    driverPhone: "+91 99801 64220",
    attendantName: "Shashidhar",
    morningPickupWindow: "07:25 AM – 08:00 AM",
    eveningDropWindow: "03:55 PM – 04:30 PM",
    capacity: 40,
    stops: ["Kuvempu Nagar", "Shanti Nagar", "SSIT Campus Gate", "Jayanagar West", "School Campus"],
    status: "Active",
  },
];

const STORAGE_ALLOCATIONS_KEY = "erp_transport_allocations_v1";
const STORAGE_RECEIPTS_KEY = "erp_transport_receipts_v1";

interface StoredOverride {
  serviceType: TransportServiceType;
  routeId: string | null;
  pickupStop: string | null;
  pickupTime: string | null;
  paidAmount: number;
  lastPaymentDate: string | null;
  notes?: string;
}

/** Deterministically seeds initial transport allocations for enrolled students */
function seedInitialAllocations(students: Student[]): Record<string, StoredOverride> {
  const result: Record<string, StoredOverride> = {};
  const routes = INITIAL_BUS_ROUTES;

  students.forEach((stu, index) => {
    const sId = String(stu.id);
    // Approximately 42% of students take the school bus, the rest self-drop
    const isBusRider = index % 5 === 0 || index % 5 === 2; // ~40% riders
    if (isBusRider) {
      const route = routes[index % routes.length];
      const stop = route.stops[index % (route.stops.length - 1)]; // pickup stop
      
      // Determine payment distribution among riders:
      // ~45% fully paid (₹14,000), ~35% Term 1 paid (₹7,000), ~20% pending (₹0)
      let paidAmount = 0;
      let lastPaymentDate: string | null = null;
      if (index % 3 === 0) {
        paidAmount = 14000;
        lastPaymentDate = "2026-08-14";
      } else if (index % 3 === 1) {
        paidAmount = 7000;
        lastPaymentDate = "2026-09-02";
      } else {
        paidAmount = 0;
        lastPaymentDate = null;
      }

      result[sId] = {
        serviceType: "School Bus",
        routeId: route.id,
        pickupStop: stop,
        pickupTime: route.morningPickupWindow.split("–")[0].trim(),
        paidAmount,
        lastPaymentDate,
      };
    } else {
      result[sId] = {
        serviceType: "Self Drop",
        routeId: null,
        pickupStop: null,
        pickupTime: null,
        paidAmount: 0,
        lastPaymentDate: null,
        notes: "Dropped and picked up by parents / guardian",
      };
    }
  });

  return result;
}

/** Initial receipts matching seed payments */
function seedInitialReceipts(students: Student[], allocations: Record<string, StoredOverride>): TransportPaymentReceipt[] {
  const receipts: TransportPaymentReceipt[] = [];
  let seq = 101;

  students.forEach((stu) => {
    const sId = String(stu.id);
    const alloc = allocations[sId];
    if (alloc && alloc.serviceType === "School Bus" && alloc.paidAmount > 0) {
      const route = INITIAL_BUS_ROUTES.find((r) => r.id === alloc.routeId);
      const isFull = alloc.paidAmount === 14000;

      if (isFull) {
        // Two receipts of 7,000 or one of 14,000
        receipts.push({
          receiptNo: `TRN-2026-${seq++}`,
          studentId: sId,
          studentName: stu.name,
          usn: stu.usn || "—",
          grade: stu.grade || "Grade 6",
          section: stu.section || "A",
          routeName: route ? `${route.routeCode} (${route.name})` : "School Bus Service",
          pickupStop: alloc.pickupStop || "Assigned Stop",
          amount: 14000,
          paymentMethod: seq % 2 === 0 ? "UPI" : "Bank transfer",
          reference: `UTR-TRN-902${seq}8`,
          paidAt: alloc.lastPaymentDate || "2026-08-14",
          receivedBy: "Accounts Office",
          annualFee: ANNUAL_TRANSPORT_FEE,
          balanceRemaining: 0,
          notes: "Annual Bus Fee 2026–27 (Full Settlement)",
        });
      } else {
        receipts.push({
          receiptNo: `TRN-2026-${seq++}`,
          studentId: sId,
          studentName: stu.name,
          usn: stu.usn || "—",
          grade: stu.grade || "Grade 6",
          section: stu.section || "A",
          routeName: route ? `${route.routeCode} (${route.name})` : "School Bus Service",
          pickupStop: alloc.pickupStop || "Assigned Stop",
          amount: 7000,
          paymentMethod: seq % 3 === 0 ? "Cash" : "UPI",
          reference: `UTR-TRN-811${seq}4`,
          paidAt: alloc.lastPaymentDate || "2026-09-02",
          receivedBy: "Accounts Office",
          annualFee: ANNUAL_TRANSPORT_FEE,
          balanceRemaining: 7000,
          notes: "Term 1 Bus Transportation Fee (Installment 1 of 2)",
        });
      }
    }
  });

  return receipts;
}

export function useTransportData(students: Student[]) {
  const revision = useDataRevision();

  // Load or seed overrides from localStorage
  const [allocations, setAllocations] = useState<Record<string, StoredOverride>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(STORAGE_ALLOCATIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load transport allocations from localStorage", e);
    }
    return {};
  });

  const [receipts, setReceipts] = useState<TransportPaymentReceipt[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_RECEIPTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load transport receipts from localStorage", e);
    }
    return [];
  });

  // Ensure allocations are populated when students are available
  useEffect(() => {
    if (!students || students.length === 0) return;

    setAllocations((prev) => {
      const missing = students.some((s) => !prev[String(s.id)]);
      if (!missing && Object.keys(prev).length > 0) return prev;

      const seeded = seedInitialAllocations(students);
      const merged = { ...seeded, ...prev };
      try {
        localStorage.setItem(STORAGE_ALLOCATIONS_KEY, JSON.stringify(merged));
      } catch (e) {
        console.warn("Failed to write transport allocations", e);
      }

      // Also ensure receipts exist
      setReceipts((prevReceipts) => {
        if (prevReceipts.length > 0) return prevReceipts;
        const initialR = seedInitialReceipts(students, merged);
        try {
          localStorage.setItem(STORAGE_RECEIPTS_KEY, JSON.stringify(initialR));
        } catch (e) {
          console.warn("Failed to write transport receipts", e);
        }
        return initialR;
      });

      return merged;
    });
  }, [students]);

  // Compose complete StudentTransportRecords
  const studentRecords = useMemo<StudentTransportRecord[]>(() => {
    const routesMap = new Map(INITIAL_BUS_ROUTES.map((r) => [r.id, r]));

    return students.map((stu) => {
      const sId = String(stu.id);
      const alloc = allocations[sId] || {
        serviceType: "Self Drop",
        routeId: null,
        pickupStop: null,
        pickupTime: null,
        paidAmount: 0,
        lastPaymentDate: null,
      };

      const isBus = alloc.serviceType === "School Bus";
      const route = alloc.routeId ? routesMap.get(alloc.routeId) : null;
      const annualFee = isBus ? ANNUAL_TRANSPORT_FEE : 0;
      const paid = isBus ? Math.min(annualFee, alloc.paidAmount || 0) : 0;
      const outstanding = Math.max(0, annualFee - paid);

      let status: TransportPaymentStatus = "Self Drop";
      if (isBus) {
        if (outstanding === 0 && paid > 0) status = "Paid";
        else if (paid > 0 && outstanding > 0) status = "Partial";
        else status = "Due";
      }

      const gradeStr = stu.grade
        ? String(stu.grade).startsWith("Grade")
          ? String(stu.grade)
          : `Grade ${stu.grade}`
        : "Grade 6";

      return {
        id: sId,
        studentName: stu.name,
        usn: stu.usn || "—",
        grade: gradeStr,
        section: stu.section || "A",
        guardianName: (stu as any).family || `${stu.name.split(" ").slice(-1)[0]} family`,
        guardianPhone: (stu as any).phone || "+91 98450 00000",
        serviceType: alloc.serviceType,
        routeId: route?.id || null,
        routeName: route ? `${route.routeCode} (${route.name})` : null,
        vehicleNo: route?.vehicleNo || null,
        driverName: route?.driverName || null,
        driverPhone: route?.driverPhone || null,
        pickupStop: isBus ? alloc.pickupStop || route?.stops[0] || "School Gate" : "Own Conveyance",
        pickupTime: isBus ? alloc.pickupTime || route?.morningPickupWindow.split("–")[0].trim() || "07:15 AM" : null,
        dropTime: isBus ? route?.eveningDropWindow.split("–")[1].trim() || "04:15 PM" : null,
        annualFee,
        paidAmount: paid,
        outstandingBalance: outstanding,
        status,
        lastPaymentDate: alloc.lastPaymentDate,
        notes: alloc.notes,
      };
    });
  }, [students, allocations, revision]);

  // Aggregate stats
  const stats = useMemo<TransportStats>(() => {
    let busRiders = 0;
    let selfDrop = 0;
    let totalBilled = 0;
    let totalCollected = 0;
    let fullyPaid = 0;
    let partialPaid = 0;
    let due = 0;

    studentRecords.forEach((r) => {
      if (r.serviceType === "School Bus") {
        busRiders++;
        totalBilled += r.annualFee;
        totalCollected += r.paidAmount;
        if (r.status === "Paid") fullyPaid++;
        else if (r.status === "Partial") partialPaid++;
        else due++;
      } else {
        selfDrop++;
      }
    });

    const totalOutstanding = Math.max(0, totalBilled - totalCollected);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;

    return {
      totalStudents: studentRecords.length,
      busRidersCount: busRiders,
      selfDropCount: selfDrop,
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      fullyPaidRiders: fullyPaid,
      partialPaidRiders: partialPaid,
      dueRiders: due,
    };
  }, [studentRecords]);

  // Action: Update a student's transport service type, route, and stop
  const updateStudentService = useCallback(
    (
      studentId: string,
      serviceType: TransportServiceType,
      routeId?: string | null,
      pickupStop?: string | null,
      pickupTime?: string | null,
      notes?: string
    ) => {
      setAllocations((prev) => {
        const existing = prev[studentId] || {
          serviceType: "Self Drop",
          routeId: null,
          pickupStop: null,
          pickupTime: null,
          paidAmount: 0,
          lastPaymentDate: null,
        };

        const updated: StoredOverride = {
          ...existing,
          serviceType,
          routeId: serviceType === "School Bus" ? routeId || INITIAL_BUS_ROUTES[0].id : null,
          pickupStop: serviceType === "School Bus" ? pickupStop || null : null,
          pickupTime: serviceType === "School Bus" ? pickupTime || null : null,
          notes: notes !== undefined ? notes : existing.notes,
        };

        const next = { ...prev, [studentId]: updated };
        try {
          localStorage.setItem(STORAGE_ALLOCATIONS_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save transport allocation", e);
        }
        notifyDataChanged();
        return next;
      });
    },
    []
  );

  // Action: Record payment towards bus fees
  const recordBusFeePayment = useCallback(
    (
      studentId: string,
      input: {
        amount: number;
        paymentMethod: string;
        reference: string;
        receivedBy?: string;
        notes?: string;
        paidAt?: string;
      }
    ) => {
      const student = studentRecords.find((s) => s.id === studentId);
      if (!student) {
        throw new Error("Student not found.");
      }
      if (student.serviceType !== "School Bus") {
        throw new Error("Cannot collect transport fees for students marked as Self Drop.");
      }
      if (input.amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }
      if (input.amount > student.outstandingBalance) {
        throw new Error(
          `Payment amount (₹${input.amount.toLocaleString("en-IN")}) exceeds remaining balance of ₹${student.outstandingBalance.toLocaleString("en-IN")}.`
        );
      }

      const receiptSeq = Math.floor(1000 + Math.random() * 9000);
      const receiptNo = `TRN-2026-${receiptSeq}`;
      const paidDate = input.paidAt || new Date().toISOString().slice(0, 10);
      const newPaidAmount = student.paidAmount + input.amount;
      const newBalance = Math.max(0, ANNUAL_TRANSPORT_FEE - newPaidAmount);

      const receipt: TransportPaymentReceipt = {
        receiptNo,
        studentId,
        studentName: student.studentName,
        usn: student.usn,
        grade: student.grade,
        section: student.section,
        routeName: student.routeName || "School Bus Route",
        pickupStop: student.pickupStop || "School Bus Stop",
        amount: input.amount,
        paymentMethod: input.paymentMethod || "Bank transfer",
        reference: input.reference || `REF-${receiptSeq}`,
        paidAt: paidDate,
        receivedBy: input.receivedBy || "Accounts Desk",
        annualFee: ANNUAL_TRANSPORT_FEE,
        balanceRemaining: newBalance,
        notes: input.notes || "Annual Bus Transportation Fee Collection",
      };

      // Save allocation update
      setAllocations((prev) => {
        const existing = prev[studentId] || {
          serviceType: "School Bus",
          routeId: student.routeId,
          pickupStop: student.pickupStop,
          pickupTime: student.pickupTime,
          paidAmount: 0,
          lastPaymentDate: null,
        };

        const updated: StoredOverride = {
          ...existing,
          paidAmount: newPaidAmount,
          lastPaymentDate: paidDate,
        };

        const next = { ...prev, [studentId]: updated };
        try {
          localStorage.setItem(STORAGE_ALLOCATIONS_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to persist allocation update", e);
        }
        return next;
      });

      // Save receipt
      setReceipts((prev) => {
        const next = [receipt, ...prev];
        try {
          localStorage.setItem(STORAGE_RECEIPTS_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to persist transport receipt", e);
        }
        return next;
      });

      notifyDataChanged();
      return receipt;
    },
    [studentRecords]
  );

  return {
    routes: INITIAL_BUS_ROUTES,
    studentRecords,
    receipts,
    stats,
    updateStudentService,
    recordBusFeePayment,
  };
}
