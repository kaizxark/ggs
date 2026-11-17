import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bus,
  Check,
  CreditCard,
  Download,
  IndianRupee,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { MetricBlock } from "@/components/MetricBlock";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePagination, Pager } from "@/components/ErpPagination";
import { toast } from "@/lib/toast";
import {
  useTransportData,
  ANNUAL_TRANSPORT_FEE,
  type StudentTransportRecord,
  type TransportPaymentReceipt,
  type TransportServiceType,
} from "@/lib/transport-data";
import { useStudents } from "@/lib/school-data";
import {
  formatInrCompact,
  todayIso,
} from "@/lib/student-directory";

interface TransportationViewProps {
  onBack: () => void;
  onNavigate?: (view: string, entityId?: any, entityType?: "student" | "staff") => void;
}

export function TransportationView({ onBack, onNavigate }: TransportationViewProps) {
  const { rows: enrolledStudents } = useStudents();
  const {
    routes,
    studentRecords,
    receipts,
    stats,
    updateStudentService,
    recordBusFeePayment,
  } = useTransportData(enrolledStudents);

  const [activeTab, setActiveTab] = useState<"ledger" | "routes" | "receipts" | "breakdown">("ledger");

  // Filters for Ledger
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | "bus" | "self">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Partial" | "Due">("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");

  // Filters for Receipts
  const [receiptSearchQuery, setReceiptSearchQuery] = useState("");
  const [receiptMethodFilter, setReceiptMethodFilter] = useState("all");

  // Modals state
  const [paymentModalStudent, setPaymentModalStudent] = useState<StudentTransportRecord | null>(null);
  const [allocationModalStudent, setAllocationModalStudent] = useState<StudentTransportRecord | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<TransportPaymentReceipt | null>(null);

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<string>(String(ANNUAL_TRANSPORT_FEE));
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentDate, setPaymentDate] = useState(() => todayIso());
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Allocation Form state
  const [allocServiceType, setAllocServiceType] = useState<TransportServiceType>("School Bus");
  const [allocRouteId, setAllocRouteId] = useState<string>("RT-01");
  const [allocStop, setAllocStop] = useState<string>("");
  const [allocNotes, setAllocNotes] = useState<string>("");

  const isFiltered = Boolean(
    searchQuery.trim() ||
      serviceFilter !== "all" ||
      statusFilter !== "all" ||
      gradeFilter !== "all" ||
      routeFilter !== "all"
  );

  const clearFilters = () => {
    setSearchQuery("");
    setServiceFilter("all");
    setStatusFilter("all");
    setGradeFilter("all");
    setRouteFilter("all");
  };

  // Filtered Student Transport Ledger
  const filteredRecords = useMemo(() => {
    let list = studentRecords;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.usn.toLowerCase().includes(q) ||
          (s.routeName && s.routeName.toLowerCase().includes(q)) ||
          (s.pickupStop && s.pickupStop.toLowerCase().includes(q))
      );
    }

    if (serviceFilter !== "all") {
      list = list.filter((s) => (serviceFilter === "bus" ? s.serviceType === "School Bus" : s.serviceType === "Self Drop"));
    }

    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (gradeFilter !== "all") {
      list = list.filter((s) => s.grade === gradeFilter || s.grade.includes(gradeFilter.replace("Grade ", "")));
    }

    if (routeFilter !== "all") {
      list = list.filter((s) => s.routeId === routeFilter);
    }

    return list;
  }, [studentRecords, searchQuery, serviceFilter, statusFilter, gradeFilter, routeFilter]);

  const ledgerPager = usePagination(filteredRecords, 15);

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    let list = receipts;

    if (receiptSearchQuery.trim()) {
      const q = receiptSearchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.usn.toLowerCase().includes(q) ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q)
      );
    }

    if (receiptMethodFilter !== "all") {
      list = list.filter((r) => r.paymentMethod.toLowerCase() === receiptMethodFilter.toLowerCase());
    }

    return list;
  }, [receipts, receiptSearchQuery, receiptMethodFilter]);

  const receiptsPager = usePagination(filteredReceipts, 15);

  // Grade Breakdown
  const gradeBreakdown = useMemo(() => {
    const grades = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
    return grades.map((g) => {
      const records = studentRecords.filter((s) => s.grade === g || s.grade.includes(g.replace("Grade ", "")));
      const totalStudents = records.length;
      const busRiders = records.filter((s) => s.serviceType === "School Bus").length;
      const selfDrop = totalStudents - busRiders;
      const totalBilled = busRiders * ANNUAL_TRANSPORT_FEE;
      const totalPaid = records.reduce((sum, s) => sum + s.paidAmount, 0);
      const pending = Math.max(0, totalBilled - totalPaid);
      const collectionPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0;

      return {
        grade: g,
        totalStudents,
        busRiders,
        selfDrop,
        totalBilled,
        totalPaid,
        pending,
        collectionPct,
      };
    });
  }, [studentRecords]);

  // Total Fleet Capacity across all routes
  const totalFleetCapacity = useMemo(() => {
    return routes.reduce((sum, r) => sum + r.capacity, 0);
  }, [routes]);

  // Handle open payment modal
  const handleOpenPaymentModal = (student: StudentTransportRecord) => {
    setPaymentModalStudent(student);
    setPaymentAmount(
      String(
        student.outstandingBalance > 0
          ? student.outstandingBalance
          : ANNUAL_TRANSPORT_FEE
      )
    );
    setPaymentMethod("UPI");
    setPaymentDate(todayIso());
    setPaymentReference(`UPI-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentNotes("");
  };

  // Handle submit payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalStudent) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid payment amount greater than ₹0.");
      return;
    }

    if (amt > paymentModalStudent.outstandingBalance) {
      toast.error(`Amount cannot exceed balance of ₹${paymentModalStudent.outstandingBalance.toLocaleString("en-IN")}.`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const receipt = recordBusFeePayment(paymentModalStudent.id, {
        amount: amt,
        paymentMethod,
        reference: paymentReference || `REF-${Date.now().toString().slice(-6)}`,
        notes: paymentNotes || `Transportation Fee for ${paymentModalStudent.studentName}`,
        paidAt: paymentDate,
      });

      toast.success("Payment recorded", {
        description: `Receipt ${receipt.receiptNo} issued for ₹${amt.toLocaleString("en-IN")}`,
      });

      setPaymentModalStudent(null);
      setViewingReceipt(receipt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle open allocation modal
  const handleOpenAllocationModal = (student: StudentTransportRecord) => {
    setAllocationModalStudent(student);
    setAllocServiceType(student.serviceType);
    setAllocRouteId(student.routeId || routes[0].id);
    const selectedRoute = routes.find((r) => r.id === (student.routeId || routes[0].id));
    setAllocStop(student.pickupStop !== "Own Conveyance" ? student.pickupStop || selectedRoute?.stops[0] || "" : selectedRoute?.stops[0] || "");
    setAllocNotes(student.notes || "");
  };

  // Handle submit allocation
  const handleSubmitAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocationModalStudent) return;

    updateStudentService(
      allocationModalStudent.id,
      allocServiceType,
      allocServiceType === "School Bus" ? allocRouteId : null,
      allocServiceType === "School Bus" ? allocStop : null,
      undefined,
      allocNotes
    );

    toast.success("Transportation updated");
    setAllocationModalStudent(null);
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Student Name",
      "USN",
      "Class",
      "Section",
      "Conveyance",
      "Route",
      "Stop",
      "Fee (INR)",
      "Paid (INR)",
      "Balance (INR)",
      "Status",
    ];

    const csvRows = filteredRecords.map((r) => [
      `"${r.studentName}"`,
      `"${r.usn}"`,
      `"${r.grade}"`,
      `"${r.section}"`,
      `"${r.serviceType}"`,
      `"${r.routeName || "—"}"`,
      `"${r.pickupStop || "—"}"`,
      r.annualFee,
      r.paidAmount,
      r.outstandingBalance,
      `"${r.status}"`,
    ]);

    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Transport_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  return (
    <div className="page-stack">
      {/* 1. Page Header */}
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Overview"
            current="Transportation"
            onParentClick={onBack}
          />
          <h1 className="page-title">Transportation</h1>
          <p className="page-subtitle">
            Bus routes, pupil allocations and fee collection.
          </p>
        </div>

        <div className="intro-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportCsv}
          >
            <Download size={14} />
            Export
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              const eligible = studentRecords.find(
                (s) => s.serviceType === "School Bus" && s.outstandingBalance > 0
              );
              if (eligible) {
                handleOpenPaymentModal(eligible);
              } else {
                toast.info("Select a student to record payment.");
              }
            }}
          >
            <Plus size={15} />
            Record payment
          </button>
        </div>
      </div>

      {/* 2. Standard 4-Metric Grid (Balanced & Uncrowded) */}
      <div className="metric-grid">
        <MetricBlock
          label="Bus riders"
          value={`${stats.busRidersCount}`}
          comparison={`of ${stats.totalStudents} students (${stats.selfDropCount} self drop)`}
          icon={Bus}
        />
        <MetricBlock
          label="Active fleet"
          value={`${routes.length} routes`}
          comparison={`${totalFleetCapacity} total seats`}
          icon={MapPin}
        />
        <MetricBlock
          label="Collected"
          value={formatInrCompact(stats.totalCollected)}
          comparison={`${stats.collectionRate}% collected`}
          icon={IndianRupee}
        />
        <MetricBlock
          label="Pending balance"
          value={formatInrCompact(stats.totalOutstanding)}
          comparison={`${stats.dueRiders + stats.partialPaidRiders} pupils due`}
          icon={AlertCircle}
          positive={stats.totalOutstanding === 0}
        />
      </div>

      {/* 3. Main Panel */}
      <section className="panel">
        {/* Navigation Tabs */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <SegmentedControl<"ledger" | "routes" | "receipts" | "breakdown">
            ariaLabel="Transportation tabs"
            layoutId="transportTabs"
            value={activeTab}
            onChange={setActiveTab}
            indicatorVariant="brand"
            options={[
              { value: "ledger", label: "Ledger", icon: <Users size={14} />, count: filteredRecords.length },
              { value: "routes", label: "Routes", icon: <Bus size={14} />, count: routes.length },
              { value: "receipts", label: "Receipts", icon: <Printer size={14} />, count: receipts.length },
              { value: "breakdown", label: "Class breakdown", icon: <BarChart3 size={14} /> },
            ]}
          />
        </div>

        {/* TAB 1: LEDGER */}
        {activeTab === "ledger" && (
          <div style={{ padding: "18px 20px" }}>
            {/* Simple Single-Row Filters */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
              <div className="relative" style={{ minWidth: "200px", flex: "1 1 220px" }}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search pupil, USN, route..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input w-full pl-9 pr-7 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="form-select text-xs"
                style={{ width: "auto" }}
              >
                <option value="all">All classes</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={`Grade ${num}`}>
                    Grade {num}
                  </option>
                ))}
              </select>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className="form-select text-xs"
                style={{ width: "auto" }}
              >
                <option value="all">All conveyance</option>
                <option value="bus">School bus ({stats.busRidersCount})</option>
                <option value="self">Self drop ({stats.selfDropCount})</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="form-select text-xs"
                style={{ width: "auto" }}
              >
                <option value="all">All statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
                <option value="Due">Due</option>
              </select>

              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="form-select text-xs"
                style={{ width: "auto" }}
              >
                <option value="all">All routes</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeCode}: {r.name.split("&")[0].trim()}
                  </option>
                ))}
              </select>

              {isFiltered && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="secondary-button compact text-xs"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>

            {/* Table */}
            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pupil</th>
                    <th>Class</th>
                    <th>Mode</th>
                    <th>Route / Stop</th>
                    <th className="text-right">Annual fee</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPager.pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-xs text-[var(--text-muted)]">
                        No pupils match the filter.
                      </td>
                    </tr>
                  ) : (
                    ledgerPager.pageRows.map((record) => {
                      const isBus = record.serviceType === "School Bus";
                      return (
                        <tr key={record.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td>
                            <button
                              type="button"
                              onClick={() => onNavigate?.("StudentProfile", record.id, "student")}
                              className="font-semibold text-xs text-[var(--text-primary)] hover:text-[var(--brand)] text-left block"
                            >
                              {record.studentName}
                            </button>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono block">
                              {record.usn}
                            </span>
                          </td>
                          <td className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            {record.grade} · {record.section}
                          </td>
                          <td>
                            {isBus ? (
                              <span className="status-pill success">
                                <span className="status-dot" />
                                Bus
                              </span>
                            ) : (
                              <span className="status-pill">
                                Self
                              </span>
                            )}
                          </td>
                          <td className="text-xs">
                            {isBus ? (
                              <div>
                                <span className="font-medium text-[var(--text-primary)] block">
                                  {record.routeName}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)] block">
                                  {record.pickupStop} ({record.pickupTime})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="text-right font-mono text-xs">
                            {isBus ? "₹14,000" : "—"}
                          </td>
                          <td className="text-right font-mono text-xs text-[var(--brand)] font-semibold">
                            {isBus ? `₹${record.paidAmount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right font-mono text-xs font-semibold">
                            {isBus ? (
                              record.outstandingBalance === 0 ? (
                                <span className="text-[var(--text-muted)]">₹0</span>
                              ) : (
                                <span className="text-[var(--coral)]">
                                  ₹{record.outstandingBalance.toLocaleString("en-IN")}
                                </span>
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {isBus ? (
                              <span className={`status-pill ${record.status === "Paid" ? "success" : record.status === "Partial" ? "warning" : "danger"}`}>
                                <span className="status-dot" />
                                {record.status}
                              </span>
                            ) : (
                              <span className="status-pill">Self</span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isBus && record.outstandingBalance > 0 && (
                                <button
                                  type="button"
                                  className="secondary-button compact text-[11px] py-0.5 px-2 text-[var(--brand)] border-[var(--brand-border)]"
                                  onClick={() => handleOpenPaymentModal(record)}
                                >
                                  Collect
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary-button compact text-[11px] py-0.5 px-2"
                                onClick={() => handleOpenAllocationModal(record)}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <Pager pagination={ledgerPager as any} noun="pupils" />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROUTES (Clean, Uncrowded Table) */}
        {activeTab === "routes" && (
          <div style={{ padding: "18px 20px" }}>
            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Vehicle</th>
                    <th>Driver & phone</th>
                    <th>Pickup / Drop</th>
                    <th className="text-right">Occupancy</th>
                    <th className="text-right">Collection</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => {
                    const assignedRiders = studentRecords.filter((s) => s.routeId === route.id);
                    const riderCount = assignedRiders.length;
                    const capacityPct = Math.round((riderCount / route.capacity) * 100);
                    const collectedRouteFee = assignedRiders.reduce((s, r) => s + r.paidAmount, 0);

                    return (
                      <tr key={route.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td>
                          <span className="font-semibold text-xs text-[var(--text-primary)] block">
                            {route.routeCode}: {route.name}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] block">
                            {route.stops.slice(0, 3).join(", ")}…
                          </span>
                        </td>
                        <td className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                          {route.vehicleNo}
                        </td>
                        <td className="text-xs whitespace-nowrap">
                          <span className="font-medium text-[var(--text-primary)] block">
                            {route.driverName}
                          </span>
                          <a
                            href={`tel:${route.driverPhone}`}
                            className="text-[11px] text-[var(--brand)] font-mono hover:underline block"
                          >
                            {route.driverPhone}
                          </a>
                        </td>
                        <td className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
                          <div>{route.morningPickupWindow}</div>
                          <div>{route.eveningDropWindow}</div>
                        </td>
                        <td className="text-right text-xs font-mono whitespace-nowrap">
                          <strong className="text-[var(--text-primary)]">{riderCount}</strong>
                          <span className="text-[var(--text-muted)]"> / {route.capacity} ({capacityPct}%)</span>
                        </td>
                        <td className="text-right text-xs font-mono font-semibold text-[var(--brand)] whitespace-nowrap">
                          ₹{collectedRouteFee.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="secondary-button compact text-[11px] py-0.5 px-2"
                            onClick={() => {
                              setRouteFilter(route.id);
                              setServiceFilter("bus");
                              setActiveTab("ledger");
                            }}
                          >
                            View {riderCount}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RECEIPTS */}
        {activeTab === "receipts" && (
          <div style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
              <div className="relative" style={{ minWidth: "200px", flex: "1 1 220px" }}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search receipt #, pupil, USN..."
                  value={receiptSearchQuery}
                  onChange={(e) => setReceiptSearchQuery(e.target.value)}
                  className="search-input w-full pl-9 pr-7 text-xs"
                />
                {receiptSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReceiptSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <select
                value={receiptMethodFilter}
                onChange={(e) => setReceiptMethodFilter(e.target.value)}
                className="form-select text-xs"
                style={{ width: "auto" }}
              >
                <option value="all">All methods</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank transfer">Bank transfer</option>
              </select>

              <span className="text-xs text-[var(--text-muted)] ml-auto">
                Total: <strong className="text-[var(--brand)] font-mono">₹{stats.totalCollected.toLocaleString("en-IN")}</strong>
              </span>
            </div>

            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Pupil</th>
                    <th>Route</th>
                    <th>Method</th>
                    <th>Ref / UTR</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptsPager.pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-xs text-[var(--text-muted)]">
                        No receipts found.
                      </td>
                    </tr>
                  ) : (
                    receiptsPager.pageRows.map((receipt) => (
                      <tr key={receipt.receiptNo} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="font-mono text-xs font-bold text-[var(--brand)]">
                          {receipt.receiptNo}
                        </td>
                        <td className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                          {receipt.paidAt}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => onNavigate?.("StudentProfile", receipt.studentId, "student")}
                            className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] text-left block"
                          >
                            {receipt.studentName}
                          </button>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono block">
                            {receipt.usn} · {receipt.grade}
                          </span>
                        </td>
                        <td className="text-xs text-[var(--text-secondary)]">
                          {receipt.routeName}
                        </td>
                        <td>
                          <span className="status-pill text-[11px]">
                            {receipt.paymentMethod}
                          </span>
                        </td>
                        <td className="font-mono text-[11px] text-[var(--text-muted)]">
                          {receipt.reference}
                        </td>
                        <td className="text-right font-mono text-xs font-bold text-[var(--brand)]">
                          ₹{receipt.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">
                          ₹{receipt.balanceRemaining.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="secondary-button compact text-[11px] py-0.5 px-2"
                            onClick={() => setViewingReceipt(receipt)}
                          >
                            <Printer size={11} />
                            Print
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredReceipts.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <Pager pagination={receiptsPager as any} noun="receipts" />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLASS BREAKDOWN */}
        {activeTab === "breakdown" && (
          <div style={{ padding: "18px 20px" }}>
            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">Bus riders</th>
                    <th className="text-right">Self drop</th>
                    <th className="text-right">Billed (@ ₹14k)</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeBreakdown.map((row) => (
                    <tr
                      key={row.grade}
                      onClick={() => {
                        setGradeFilter(row.grade);
                        setActiveTab("ledger");
                      }}
                      className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      title={`View ${row.grade} pupils`}
                    >
                      <td className="font-semibold text-xs text-[var(--text-primary)]">
                        {row.grade}
                      </td>
                      <td className="text-right text-xs font-mono">{row.totalStudents}</td>
                      <td className="text-right text-xs font-mono font-semibold text-[var(--brand)]">
                        {row.busRiders}
                      </td>
                      <td className="text-right text-xs font-mono text-[var(--text-muted)]">
                        {row.selfDrop}
                      </td>
                      <td className="text-right text-xs font-mono">
                        ₹{row.totalBilled.toLocaleString("en-IN")}
                      </td>
                      <td className="text-right text-xs font-mono font-semibold text-[var(--brand)]">
                        ₹{row.totalPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="text-right text-xs font-mono text-[var(--coral)] font-semibold">
                        {row.pending > 0 ? `₹${row.pending.toLocaleString("en-IN")}` : "₹0"}
                      </td>
                      <td className="text-right text-xs font-mono font-bold">
                        {row.collectionPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-[var(--border)] bg-[var(--bg-hover)]">
                    <td>Total</td>
                    <td className="text-right font-mono">{stats.totalStudents}</td>
                    <td className="text-right font-mono text-[var(--brand)]">{stats.busRidersCount}</td>
                    <td className="text-right font-mono text-[var(--text-muted)]">{stats.selfDropCount}</td>
                    <td className="text-right font-mono">₹{stats.totalBilled.toLocaleString("en-IN")}</td>
                    <td className="text-right font-mono text-[var(--brand)]">₹{stats.totalCollected.toLocaleString("en-IN")}</td>
                    <td className="text-right font-mono text-[var(--coral)]">₹{stats.totalOutstanding.toLocaleString("en-IN")}</td>
                    <td className="text-right font-mono text-[var(--brand)]">{stats.collectionRate}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* MODAL 1: RECORD BUS FEE PAYMENT */}
      {paymentModalStudent && (
        <div className="modal-backdrop" onClick={() => setPaymentModalStudent(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Record payment · {paymentModalStudent.studentName}
              </h3>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setPaymentModalStudent(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 rounded bg-[var(--bg-hover)]">
                <div>
                  <span className="text-[var(--text-muted)] block">Class</span>
                  <strong>{paymentModalStudent.grade} · {paymentModalStudent.section}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Paid so far</span>
                  <strong className="text-[var(--brand)]">₹{paymentModalStudent.paidAmount.toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Balance due</span>
                  <strong className="text-[var(--coral)]">₹{paymentModalStudent.outstandingBalance.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  min="1"
                  max={paymentModalStudent.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="form-input w-full text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-select w-full text-xs"
                    required
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="form-input w-full text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Reference / UTR
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI/42318829104"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="form-input w-full text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setPaymentModalStudent(null)}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button compact"
                  disabled={isSubmittingPayment}
                >
                  {isSubmittingPayment ? "Saving…" : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN TRANSPORT */}
      {allocationModalStudent && (
        <div className="modal-backdrop" onClick={() => setAllocationModalStudent(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Conveyance · {allocationModalStudent.studentName}
              </h3>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setAllocationModalStudent(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Mode
                </label>
                <select
                  value={allocServiceType}
                  onChange={(e) => setAllocServiceType(e.target.value as any)}
                  className="form-select w-full text-xs"
                >
                  <option value="School Bus">School Bus (₹14,000 / yr)</option>
                  <option value="Self Drop">Self Drop (₹0)</option>
                </select>
              </div>

              {allocServiceType === "School Bus" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Route
                    </label>
                    <select
                      value={allocRouteId}
                      onChange={(e) => {
                        setAllocRouteId(e.target.value);
                        const sel = routes.find((r) => r.id === e.target.value);
                        if (sel && sel.stops.length > 0) setAllocStop(sel.stops[0]);
                      }}
                      className="form-select w-full text-xs"
                      required
                    >
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeCode} — {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Pickup stop
                    </label>
                    <select
                      value={allocStop}
                      onChange={(e) => setAllocStop(e.target.value)}
                      className="form-select w-full text-xs"
                    >
                      {routes
                        .find((r) => r.id === allocRouteId)
                        ?.stops.map((stop, idx) => (
                          <option key={idx} value={stop}>
                            {stop}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setAllocationModalStudent(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button compact">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: OFFICIAL PRINTABLE RECEIPT */}
      {viewingReceipt && (
        <div className="modal-backdrop" onClick={() => setViewingReceipt(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(560px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 border-b border-[var(--border)] no-print">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                Receipt {viewingReceipt.receiptNo}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="primary-button compact text-xs"
                  onClick={() => window.print()}
                >
                  <Printer size={13} />
                  Print
                </button>
                <button
                  type="button"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => setViewingReceipt(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 receipt-voucher-printable bg-white text-black font-sans">
              <div className="text-center border-b border-black pb-3 mb-3">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black">
                  Global Kids School
                </h2>
                <p className="text-xs text-gray-700">
                  Tumakuru Campus &middot; Transportation Fee Receipt (AY 2026–27)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3 pb-2 border-b border-gray-300">
                <div>Receipt: <strong className="font-mono">{viewingReceipt.receiptNo}</strong></div>
                <div className="text-right">Date: <strong>{viewingReceipt.paidAt}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3 pb-3 border-b border-gray-300">
                <div>Pupil: <strong>{viewingReceipt.studentName}</strong></div>
                <div>USN: <strong className="font-mono">{viewingReceipt.usn}</strong></div>
                <div>Class: <strong>{viewingReceipt.grade} · {viewingReceipt.section}</strong></div>
                <div>Route: <strong>{viewingReceipt.routeName}</strong></div>
                <div className="col-span-2">Stop: <strong>{viewingReceipt.pickupStop}</strong></div>
              </div>

              <table className="w-full text-xs mb-3 border border-black">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-left">
                    <th className="p-1.5 border-r border-black">Particulars</th>
                    <th className="p-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1.5 border-r border-black">Annual Bus Fee (AY 2026–27)</td>
                    <td className="p-1.5 text-right font-mono font-bold">₹{viewingReceipt.amount.toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-xs space-y-1 mb-4">
                <div>Payment Mode: <strong>{viewingReceipt.paymentMethod} (Ref: {viewingReceipt.reference})</strong></div>
                <div>Balance Due: <strong className="font-mono">{viewingReceipt.balanceRemaining > 0 ? `₹${viewingReceipt.balanceRemaining.toLocaleString("en-IN")}` : "₹0 (Fully Paid)"}</strong></div>
              </div>

              <div className="grid grid-cols-2 pt-6 text-xs text-center border-t border-gray-300 mt-4">
                <div>Depositor Signature</div>
                <div>Authorised Signatory</div>
              </div>
            </div>

            <div className="panel-footer p-3 border-t border-[var(--border)] flex justify-end gap-2 no-print">
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setViewingReceipt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-button compact"
                onClick={() => window.print()}
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
