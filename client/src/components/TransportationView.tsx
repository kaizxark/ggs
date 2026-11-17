import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bus,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Filter,
  IndianRupee,
  MapPin,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
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
  type BusRoute,
  type StudentTransportRecord,
  type TransportPaymentReceipt,
  type TransportServiceType,
} from "@/lib/transport-data";
import { useStudents } from "@/lib/school-data";
import {
  formatInrCompact,
  formatMoney,
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

  // Filters for Tab 1 (Ledger)
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | "bus" | "self">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Partial" | "Due">("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");

  // Filters for Tab 3 (Receipts)
  const [receiptSearchQuery, setReceiptSearchQuery] = useState("");
  const [receiptMethodFilter, setReceiptMethodFilter] = useState("all");

  // Modals state
  const [paymentModalStudent, setPaymentModalStudent] = useState<StudentTransportRecord | null>(null);
  const [allocationModalStudent, setAllocationModalStudent] = useState<StudentTransportRecord | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<TransportPaymentReceipt | null>(null);

  // Record Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<string>(
    String(ANNUAL_TRANSPORT_FEE)
  );
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
          (s.pickupStop && s.pickupStop.toLowerCase().includes(q)) ||
          s.guardianName.toLowerCase().includes(q)
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

  // Financial sums for current filtered view
  const { totalFilteredBilled, totalFilteredPaid, totalFilteredBalance } = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let balance = 0;
    for (const r of filteredRecords) {
      billed += r.annualFee;
      paid += r.paidAmount;
      balance += r.outstandingBalance;
    }
    return {
      totalFilteredBilled: billed,
      totalFilteredPaid: paid,
      totalFilteredBalance: balance,
    };
  }, [filteredRecords]);

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
          r.reference.toLowerCase().includes(q) ||
          r.routeName.toLowerCase().includes(q)
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
      toast.error(`Amount cannot exceed pending balance of ₹${paymentModalStudent.outstandingBalance.toLocaleString("en-IN")}.`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const receipt = recordBusFeePayment(paymentModalStudent.id, {
        amount: amt,
        paymentMethod,
        reference: paymentReference || `REF-${Date.now().toString().slice(-6)}`,
        notes: paymentNotes || `Transportation Fee collection for ${paymentModalStudent.studentName}`,
        paidAt: paymentDate,
      });

      toast.success("Bus fee payment recorded successfully", {
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

    toast.success("Transportation service updated", {
      description:
        allocServiceType === "School Bus"
          ? `${allocationModalStudent.studentName} enrolled in School Bus (Annual Fee ₹14,000)`
          : `${allocationModalStudent.studentName} set to Self Drop (Annual Fee ₹0)`,
    });

    setAllocationModalStudent(null);
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Student Name",
      "USN",
      "Class",
      "Section",
      "Guardian Name",
      "Guardian Phone",
      "Transport Service",
      "Assigned Route",
      "Pickup Stop",
      "Annual Bus Fee (INR)",
      "Total Paid (INR)",
      "Balance Due (INR)",
      "Payment Status",
      "Last Payment Date",
    ];

    const csvRows = filteredRecords.map((r) => [
      `"${r.studentName}"`,
      `"${r.usn}"`,
      `"${r.grade}"`,
      `"${r.section}"`,
      `"${r.guardianName}"`,
      `"${r.guardianPhone}"`,
      `"${r.serviceType}"`,
      `"${r.routeName || "—"}"`,
      `"${r.pickupStop || "—"}"`,
      r.annualFee,
      r.paidAmount,
      r.outstandingBalance,
      `"${r.status}"`,
      `"${r.lastPaymentDate || "—"}"`,
    ]);

    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Global_Kids_Transport_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Transportation ledger exported to CSV");
  };

  return (
    <div className="page-stack">
      {/* 1. Page Header & Canonical Actions */}
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Overview"
            current="Transportation"
            onParentClick={onBack}
          />
          <h1 className="page-title flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
              <Bus size={18} />
            </span>
            <span>Transportation & Fleet Management</span>
          </h1>
          <p className="page-subtitle">
            School bus routing, student conveyance management, and dedicated annual transportation fee collection (₹14,000/annum).
          </p>
        </div>

        <div className="intro-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportCsv}
            title="Export transportation records to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
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
                toast.info("Select a student from the ledger below to record their bus fee payment.");
              }
            }}
          >
            <Plus size={16} />
            <span>Record Bus Payment</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards (Executive Telemetry Grid) */}
      <div className="metric-grid five-cols">
        <MetricBlock
          label="Bus Riders"
          value={`${stats.busRidersCount} / ${stats.totalStudents}`}
          comparison={`${stats.selfDropCount} pupils self-drop (${Math.round((stats.selfDropCount / (stats.totalStudents || 1)) * 100)}%)`}
          icon={Bus}
          positive={true}
        />
        <MetricBlock
          label="Fleet Capacity"
          value={`${routes.length} Active Routes`}
          comparison={`${stats.busRidersCount} of ${totalFleetCapacity} seats (${Math.round((stats.busRidersCount / (totalFleetCapacity || 1)) * 100)}% occupancy)`}
          icon={ShieldCheck}
          positive={true}
        />
        <MetricBlock
          label="Assessed Fees"
          value={formatInrCompact(stats.totalBilled)}
          comparison={`₹14,000/yr × ${stats.busRidersCount} riders`}
          icon={CreditCard}
          positive={true}
        />
        <MetricBlock
          label="Fee Collected"
          value={formatInrCompact(stats.totalCollected)}
          comparison={`${stats.collectionRate}% collected to date`}
          icon={CheckCircle2}
          positive={stats.collectionRate >= 50}
        />
        <MetricBlock
          label="Pending Balance"
          value={formatInrCompact(stats.totalOutstanding)}
          comparison={`${stats.dueRiders} due · ${stats.partialPaidRiders} partial`}
          icon={AlertCircle}
          positive={stats.totalOutstanding === 0}
        />
      </div>

      {/* 3. Main Panel Container */}
      <section className="panel">
        {/* Panel Header with SegmentedControl Tabs */}
        <div className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <SegmentedControl<"ledger" | "routes" | "receipts" | "breakdown">
            ariaLabel="Transportation navigation"
            layoutId="transportNavTabs"
            value={activeTab}
            onChange={setActiveTab}
            indicatorVariant="brand"
            options={[
              {
                value: "ledger",
                label: "Pupil Ledger",
                icon: <Users size={14} />,
                count: filteredRecords.length,
              },
              {
                value: "routes",
                label: "Routes & Fleet",
                icon: <Bus size={14} />,
                count: routes.length,
              },
              {
                value: "receipts",
                label: "Payment Receipts",
                icon: <Printer size={14} />,
                count: receipts.length,
              },
              {
                value: "breakdown",
                label: "Class Breakdown",
                icon: <BarChart3 size={14} />,
              },
            ]}
          />

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
            <span>AY 2026–27 · Active Transport Roster</span>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: BUS FEE & PUPIL LEDGER                                      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "ledger" && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Filter Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              {/* Search Bar */}
              <div className="relative lg:col-span-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search pupil, USN, route, stop, guardian..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input w-full pl-9 pr-8 text-xs sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Grade / Class Filter */}
              <div className="lg:col-span-2">
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="form-select w-full text-xs"
                >
                  <option value="all">All Classes (1–10)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={`Grade ${num}`}>
                      Grade {num}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Type Filter */}
              <div className="lg:col-span-2">
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value as any)}
                  className="form-select w-full text-xs"
                >
                  <option value="all">All Services ({studentRecords.length})</option>
                  <option value="bus">School Bus Riders ({stats.busRidersCount})</option>
                  <option value="self">Self Drop Pupils ({stats.selfDropCount})</option>
                </select>
              </div>

              {/* Payment Status Filter */}
              <div className="lg:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="form-select w-full text-xs"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="Paid">Fully Paid (₹14k)</option>
                  <option value="Partial">Partial Paid (₹7k)</option>
                  <option value="Due">Pending Due (₹14k)</option>
                </select>
              </div>

              {/* Route Filter */}
              <div className="lg:col-span-2">
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="form-select w-full text-xs"
                >
                  <option value="all">All Bus Routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeCode} ({r.name.slice(0, 16)}…)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-bar: Active Telemetry & Quick Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1 pb-1 border-t border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
                <span>
                  Showing <strong className="text-[var(--text-primary)]">{filteredRecords.length}</strong> of {studentRecords.length} pupils
                </span>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <span>
                  Billed: <strong className="font-mono text-[var(--text-primary)]">₹{totalFilteredBilled.toLocaleString("en-IN")}</strong>
                </span>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <span>
                  Collected: <strong className="font-mono text-[var(--brand)]">₹{totalFilteredPaid.toLocaleString("en-IN")}</strong>
                </span>
                {totalFilteredBalance > 0 && (
                  <>
                    <span className="text-[var(--text-muted)]">&middot;</span>
                    <span>
                      Pending: <strong className="font-mono text-[var(--coral)]">₹{totalFilteredBalance.toLocaleString("en-IN")}</strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isFiltered && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="secondary-button compact text-[11px] py-1 px-2.5 flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Filters</span>
                  </button>
                )}
                <div className="flex items-center gap-1 bg-[var(--bg-hover)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setServiceFilter("all");
                      setStatusFilter("all");
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      serviceFilter === "all" && statusFilter === "all"
                        ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceFilter("bus");
                      setStatusFilter("all");
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      serviceFilter === "bus" && statusFilter === "all"
                        ? "bg-[var(--bg-panel)] text-[var(--brand)] shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    Bus Riders ({stats.busRidersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceFilter("bus");
                      setStatusFilter("Due");
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      statusFilter === "Due"
                        ? "bg-[var(--bg-panel)] text-[var(--coral)] shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    Due ({stats.dueRiders})
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger Data Table */}
            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pupil & USN</th>
                    <th>Class</th>
                    <th>Conveyance Mode</th>
                    <th>Route & Pickup Stop</th>
                    <th className="text-right">Annual Fee</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance Due</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPager.pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                          <Users size={28} className="opacity-40" />
                          <p className="text-sm font-medium">No pupils found matching the selected filters.</p>
                          {isFiltered && (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="secondary-button compact text-xs mt-1"
                            >
                              <RotateCcw size={12} />
                              <span>Clear all filters</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ledgerPager.pageRows.map((record) => {
                      const isBus = record.serviceType === "School Bus";
                      return (
                        <tr key={record.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span className="avatar avatar-sm flex-shrink-0">
                                {record.studentName.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => onNavigate?.("StudentProfile", record.id, "student")}
                                  className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] hover:text-[var(--brand)] hover:underline block truncate text-left"
                                  title={`View ${record.studentName}'s profile`}
                                >
                                  {record.studentName}
                                </button>
                                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                                  <span>{record.usn}</span>
                                  <span>&middot;</span>
                                  <span className="truncate max-w-[120px]" title={record.guardianName}>
                                    G: {record.guardianName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            <span className="font-semibold text-[var(--text-secondary)]">
                              {record.grade}
                            </span>
                            <span className="text-[var(--text-muted)] ml-1">
                              &middot; {record.section}
                            </span>
                          </td>
                          <td>
                            {isBus ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--brand-soft)] text-[var(--brand)]">
                                <Bus size={12} />
                                <span>School Bus</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-hover)] text-[var(--text-muted)]">
                                <UserCheck size={12} />
                                <span>Self Drop</span>
                              </span>
                            )}
                          </td>
                          <td className="text-xs">
                            {isBus ? (
                              <div>
                                <span className="font-medium text-[var(--text-primary)] block truncate max-w-[200px]" title={record.routeName || ""}>
                                  {record.routeName}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                                  <MapPin size={10} className="text-[var(--brand)] flex-shrink-0" />
                                  <span className="truncate max-w-[180px]">{record.pickupStop}</span>
                                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">({record.pickupTime})</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-muted)] italic">Parent drop & pick</span>
                            )}
                          </td>
                          <td className="text-right font-mono text-xs sm:text-sm">
                            {isBus ? "₹14,000" : "—"}
                          </td>
                          <td className="text-right font-mono text-xs sm:text-sm text-[var(--brand)] font-semibold">
                            {isBus ? `₹${record.paidAmount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right font-mono text-xs sm:text-sm font-semibold">
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
                              record.status === "Paid" ? (
                                <span className="status-pill success">
                                  <span className="status-dot" />
                                  Paid
                                </span>
                              ) : record.status === "Partial" ? (
                                <span className="status-pill warning">
                                  <span className="status-dot" />
                                  Partial
                                </span>
                              ) : (
                                <span className="status-pill danger">
                                  <span className="status-dot" />
                                  Due
                                </span>
                              )
                            ) : (
                              <span className="status-pill">
                                <span className="status-dot" />
                                Self Drop
                              </span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isBus && record.outstandingBalance > 0 && (
                                <button
                                  type="button"
                                  className="secondary-button compact text-[11px] py-1 px-2.5 text-[var(--brand)] border-[var(--brand-border)] hover:bg-[var(--brand-soft)]"
                                  onClick={() => handleOpenPaymentModal(record)}
                                  title="Record Bus Fee Payment"
                                >
                                  <CreditCard size={12} />
                                  <span>Collect</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary-button compact text-[11px] py-1 px-2.5"
                                onClick={() => handleOpenAllocationModal(record)}
                                title="Change Transport Service or Route"
                              >
                                <span>{isBus ? "Change Route" : "Enroll Bus"}</span>
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

            {/* Pagination */}
            {filteredRecords.length > 0 && (
              <Pager pagination={ledgerPager as any} noun="pupils" />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: BUS ROUTES & FLEET                                          */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "routes" && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Fleet Overview Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--bg-hover)] p-4 rounded-xl border border-[var(--border)]">
              <div>
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block font-semibold">
                  Fleet Size
                </span>
                <strong className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {routes.length} Active Vehicles
                </strong>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">100% Inspected & Licensed</p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block font-semibold">
                  Total Capacity
                </span>
                <strong className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-mono">
                  {totalFleetCapacity} Seats
                </strong>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Across {routes.length} dedicated routes</p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block font-semibold">
                  Active Enrollment
                </span>
                <strong className="text-base sm:text-lg font-bold text-[var(--brand)] font-mono">
                  {stats.busRidersCount} Pupils
                </strong>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {Math.round((stats.busRidersCount / (totalFleetCapacity || 1)) * 100)}% Fleet Occupancy
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block font-semibold">
                  Staff on Duty
                </span>
                <strong className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {routes.length} Drivers & Attendants
                </strong>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Verified background checks</p>
              </div>
            </div>

            {/* Route Cards Grid */}
            <div className="route-card-grid">
              {routes.map((route) => {
                const assignedRiders = studentRecords.filter((s) => s.routeId === route.id);
                const riderCount = assignedRiders.length;
                const capacityPct = Math.round((riderCount / route.capacity) * 100);
                const totalRouteFee = riderCount * ANNUAL_TRANSPORT_FEE;
                const collectedRouteFee = assignedRiders.reduce((s, r) => s + r.paidAmount, 0);
                const pendingRouteFee = Math.max(0, totalRouteFee - collectedRouteFee);

                return (
                  <div key={route.id} className="route-card">
                    <div>
                      {/* Route Header */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[var(--brand-soft)] text-[var(--brand)]">
                          <Bus size={13} />
                          {route.routeCode}
                        </span>
                        <span className="status-pill success text-[11px]">
                          <span className="status-dot" />
                          {route.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)] mb-1">
                        {route.name}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] font-mono mb-3 flex items-center gap-1.5">
                        <Bus size={12} className="text-[var(--text-muted)]" />
                        <span>Vehicle: {route.vehicleNo}</span>
                      </p>

                      {/* Driver & Attendant */}
                      <div className="space-y-1.5 text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-3 pb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Driver:</span>
                          <span className="font-medium flex items-center gap-1">
                            {route.driverName}
                            <a
                              href={`tel:${route.driverPhone}`}
                              className="text-[var(--brand)] hover:underline ml-1 inline-flex items-center"
                              title={`Call driver ${route.driverName}`}
                            >
                              <Phone size={11} />
                            </a>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Attendant:</span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {route.attendantName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Morning Pickup:</span>
                          <span className="font-mono text-[11.5px]">{route.morningPickupWindow}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Evening Drop:</span>
                          <span className="font-mono text-[11.5px]">{route.eveningDropWindow}</span>
                        </div>
                      </div>

                      {/* Capacity Meter */}
                      <div className="bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border-subtle)] mb-3.5">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-[var(--text-secondary)]">Seat Occupancy</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">
                            {riderCount} / {route.capacity} seats ({capacityPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              capacityPct > 95
                                ? "bg-[var(--coral)]"
                                : capacityPct > 80
                                ? "bg-[var(--orange)]"
                                : "bg-[var(--brand)]"
                            }`}
                            style={{ width: `${Math.min(100, capacityPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Stops Trail */}
                      <div className="mb-2">
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                          Route Stops & Sequence
                        </span>
                        <div className="route-stops-trail">
                          {route.stops.map((stop, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                              <span className="route-stop-pill">
                                <span className="font-mono text-[10px] text-[var(--brand)] font-bold">{i + 1}.</span>
                                <span>{stop}</span>
                              </span>
                              {i < route.stops.length - 1 && (
                                <span className="route-stop-arrow">&rarr;</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Financial summary for route */}
                    <div className="border-t border-[var(--border)] pt-3.5 mt-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[var(--text-muted)] block text-[11px]">Route Collection</span>
                        <strong className="text-[var(--brand)] font-mono text-sm">
                          ₹{collectedRouteFee.toLocaleString("en-IN")}
                        </strong>
                        {pendingRouteFee > 0 && (
                          <span className="text-[10px] text-[var(--coral)] font-mono block">
                            (₹{pendingRouteFee.toLocaleString("en-IN")} pending)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="secondary-button compact text-[11px] py-1 px-3 flex items-center gap-1.5"
                        onClick={() => {
                          setRouteFilter(route.id);
                          setServiceFilter("bus");
                          setActiveTab("ledger");
                        }}
                      >
                        <span>View {riderCount} Pupils</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: PAYMENT RECEIPTS                                            */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "receipts" && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search receipt #, pupil name, USN, UTR..."
                  value={receiptSearchQuery}
                  onChange={(e) => setReceiptSearchQuery(e.target.value)}
                  className="search-input w-full pl-9 pr-8 text-xs sm:text-sm"
                />
                {receiptSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setReceiptSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div>
                <select
                  value={receiptMethodFilter}
                  onChange={(e) => setReceiptMethodFilter(e.target.value)}
                  className="form-select w-full text-xs"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank transfer">Bank transfer</option>
                </select>
              </div>

              <div className="text-right flex items-center justify-end">
                <span className="text-xs text-[var(--text-muted)]">
                  Total Collected: <strong className="text-[var(--brand)] font-mono text-sm">₹{stats.totalCollected.toLocaleString("en-IN")}</strong>
                </span>
              </div>
            </div>

            {/* Receipts Table */}
            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Date</th>
                    <th>Pupil & USN</th>
                    <th>Assigned Route</th>
                    <th>Method</th>
                    <th>Reference / UTR</th>
                    <th className="text-right">Amount Paid</th>
                    <th className="text-right">Balance Remaining</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptsPager.pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[var(--text-muted)]">
                        No bus fee receipts recorded yet.
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
                            className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] hover:underline block text-left"
                          >
                            {receipt.studentName}
                          </button>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">
                            {receipt.usn} &middot; {receipt.grade}
                          </div>
                        </td>
                        <td className="text-xs text-[var(--text-secondary)]">
                          {receipt.routeName}
                        </td>
                        <td>
                          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            {receipt.paymentMethod}
                          </span>
                        </td>
                        <td className="font-mono text-[11px] text-[var(--text-muted)]">
                          {receipt.reference}
                        </td>
                        <td className="text-right font-mono text-xs sm:text-sm font-bold text-[var(--brand)]">
                          ₹{receipt.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">
                          ₹{receipt.balanceRemaining.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="secondary-button compact text-[11px] py-1 px-2.5 flex items-center gap-1 ml-auto"
                            onClick={() => setViewingReceipt(receipt)}
                            title="View and Print Official Bus Fee Receipt"
                          >
                            <Printer size={12} />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredReceipts.length > 0 && (
              <Pager pagination={receiptsPager as any} noun="receipts" />
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: CLASS-WISE BREAKDOWN                                        */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "breakdown" && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-[var(--text-muted)]">
                Comparative overview of bus fee enrollment (₹14,000/pupil) versus self-drop pupils across all classes. Click any row to view students.
              </p>
              <span className="text-xs text-[var(--brand)] font-semibold">
                Overall Collection Rate: {stats.collectionRate}%
              </span>
            </div>

            <div className="table-container scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Grade / Class</th>
                    <th className="text-right">Total Pupils</th>
                    <th className="text-right">Bus Riders</th>
                    <th className="text-right">Self Drop</th>
                    <th className="text-right">Assessed Fee (@ ₹14k)</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Pending Balance</th>
                    <th className="text-right">Collection Rate</th>
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
                      title={`Click to filter pupil ledger to ${row.grade}`}
                    >
                      <td className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                        <span>{row.grade}</span>
                        <ChevronDown size={12} className="-rotate-90 opacity-40" />
                      </td>
                      <td className="text-right text-xs font-mono">{row.totalStudents}</td>
                      <td className="text-right text-xs font-mono font-bold text-[var(--brand)]">
                        {row.busRiders}
                        <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">
                          ({row.totalStudents > 0 ? Math.round((row.busRiders / row.totalStudents) * 100) : 0}%)
                        </span>
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
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-[var(--border)] h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-[var(--brand)] rounded-full"
                              style={{ width: `${Math.min(100, row.collectionPct)}%` }}
                            />
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                              row.collectionPct >= 80
                                ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                                : row.collectionPct >= 50
                                ? "bg-[var(--orange-soft)] text-[var(--orange)]"
                                : "bg-[var(--coral-soft)] text-[var(--coral)]"
                            }`}
                          >
                            {row.collectionPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-[var(--border)] bg-[var(--bg-hover)]">
                    <td>Total / Roster Summary</td>
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

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: RECORD BUS FEE PAYMENT                                    */}
      {/* ------------------------------------------------------------------ */}
      {paymentModalStudent && (
        <div className="modal-backdrop" onClick={() => setPaymentModalStudent(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border)]">
              <div>
                <span className="text-[11px] font-bold text-[var(--brand)] uppercase tracking-wider block">
                  Transportation Fee Collection
                </span>
                <h3 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
                  Record Bus Fee Payment
                </h3>
              </div>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setPaymentModalStudent(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-4 sm:p-5 space-y-4">
              {/* Student Summary Card */}
              <div className="bg-[var(--bg-hover)] p-3.5 rounded-lg border border-[var(--border)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-[var(--text-primary)]">
                    {paymentModalStudent.studentName}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {paymentModalStudent.usn}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                  <div>Class: {paymentModalStudent.grade} &middot; Section {paymentModalStudent.section}</div>
                  <div>Assigned Route: {paymentModalStudent.routeName}</div>
                  <div>Pickup Stop: {paymentModalStudent.pickupStop}</div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px] uppercase font-semibold">Annual Fee</span>
                    <strong className="font-mono">₹14,000</strong>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px] uppercase font-semibold">Paid So Far</span>
                    <strong className="font-mono text-[var(--brand)]">
                      ₹{paymentModalStudent.paidAmount.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px] uppercase font-semibold">Remaining Due</span>
                    <strong className="font-mono text-[var(--coral)]">
                      ₹{paymentModalStudent.outstandingBalance.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Quick Amount Presets */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Quick Amount Presets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="secondary-button compact text-xs justify-center py-1.5"
                    onClick={() => setPaymentAmount(String(paymentModalStudent.outstandingBalance))}
                  >
                    Full Due (₹{paymentModalStudent.outstandingBalance.toLocaleString("en-IN")})
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact text-xs justify-center py-1.5"
                    onClick={() => setPaymentAmount("7000")}
                    disabled={paymentModalStudent.outstandingBalance < 7000}
                  >
                    Term 1 (₹7,000)
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact text-xs justify-center py-1.5"
                    onClick={() => setPaymentAmount(String(ANNUAL_TRANSPORT_FEE))}
                    disabled={paymentModalStudent.outstandingBalance < ANNUAL_TRANSPORT_FEE}
                  >
                    Annual (₹14,000)
                  </button>
                </div>
              </div>

              {/* Amount Field */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Collection Amount (INR) <span className="text-[var(--coral)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[var(--text-muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={paymentModalStudent.outstandingBalance}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="form-input w-full pl-7 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              {/* Payment Method & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Method <span className="text-[var(--coral)]">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-select w-full text-xs"
                    required
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash (Office Counter)</option>
                    <option value="Bank transfer">NEFT / RTGS / Bank Transfer</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Cheque">Cheque / Demand Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Date <span className="text-[var(--coral)]">*</span>
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

              {/* Reference / UTR */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Reference / UTR / Transaction No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI/42318829104 or Cash Receipt #"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="form-input w-full text-xs font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Notes / Receipt Remark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bus fee Term 1 collected in person"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="form-input w-full text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
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
                  <Check size={14} />
                  <span>{isSubmittingPayment ? "Recording..." : "Record & Issue Receipt"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: ASSIGN TRANSPORT OR TOGGLE SELF-DROP                      */}
      {/* ------------------------------------------------------------------ */}
      {allocationModalStudent && (
        <div className="modal-backdrop" onClick={() => setAllocationModalStudent(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border)]">
              <div>
                <span className="text-[11px] font-bold text-[var(--brand)] uppercase tracking-wider block">
                  Transport Allocation
                </span>
                <h3 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
                  {allocationModalStudent.studentName}
                </h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {allocationModalStudent.usn} &middot; {allocationModalStudent.grade}
                </span>
              </div>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setAllocationModalStudent(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation} className="p-4 sm:p-5 space-y-4">
              {/* Service Selection Toggle */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  Select Transportation Mode
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      allocServiceType === "School Bus"
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-1 ring-[var(--brand)]"
                        : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                    }`}
                    onClick={() => setAllocServiceType("School Bus")}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Bus size={18} className={allocServiceType === "School Bus" ? "text-[var(--brand)]" : "text-[var(--text-muted)]"} />
                      {allocServiceType === "School Bus" && <Check size={14} className="text-[var(--brand)]" />}
                    </div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      School Bus
                    </span>
                    <span className="text-[11px] font-mono text-[var(--brand)] font-semibold mt-0.5 block">
                      ₹14,000 / year
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      allocServiceType === "Self Drop"
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-1 ring-[var(--brand)]"
                        : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                    }`}
                    onClick={() => setAllocServiceType("Self Drop")}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <UserCheck size={18} className={allocServiceType === "Self Drop" ? "text-[var(--brand)]" : "text-[var(--text-muted)]"} />
                      {allocServiceType === "Self Drop" && <Check size={14} className="text-[var(--brand)]" />}
                    </div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      Self Drop
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
                      ₹0 (Parent Drop)
                    </span>
                  </button>
                </div>
              </div>

              {/* If School Bus: Route & Stop Selector */}
              {allocServiceType === "School Bus" && (
                <div className="space-y-3 bg-[var(--bg-hover)] p-3.5 rounded-lg border border-[var(--border)]">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Assign Bus Route
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
                          {r.routeCode} — {r.name} ({r.vehicleNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Pickup & Drop Stop
                    </label>
                    <div className="space-y-1.5">
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
                      <input
                        type="text"
                        placeholder="Or enter custom landmark / pickup stop"
                        value={allocStop}
                        onChange={(e) => setAllocStop(e.target.value)}
                        className="form-input w-full text-xs"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                    <AlertCircle size={13} className="text-[var(--brand)] flex-shrink-0" />
                    <span>Enrolling in bus service assesses an annual bus fee of ₹14,000.</span>
                  </div>
                </div>
              )}

              {/* If Self Drop Info Note */}
              {allocServiceType === "Self Drop" && (
                <div className="bg-[var(--bg-hover)] p-3 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <p>
                    Parent/guardian will drop and pick up student directly from school campus. 
                    No transportation fees will be billed or collected for this pupil (₹0).
                  </p>
                </div>
              )}

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Remarks / Guardian Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parent requested bus pickup from Term 2"
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  className="form-input w-full text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setAllocationModalStudent(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button compact">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: OFFICIAL PRINTABLE RECEIPT                                */}
      {/* ------------------------------------------------------------------ */}
      {viewingReceipt && (
        <div className="modal-backdrop" onClick={() => setViewingReceipt(null)}>
          <div
            className="app-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(600px, 100%)" }}
          >
            <div className="panel-header flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border)] no-print">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-[var(--brand)]" />
                <h3 className="font-bold text-base text-[var(--text-primary)]">
                  Transportation Fee Official Receipt
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="primary-button compact text-xs"
                  onClick={() => window.print()}
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => setViewingReceipt(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Voucher Content */}
            <div className="p-6 receipt-voucher-printable bg-white text-black font-sans">
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-4 mb-4">
                <h2 className="text-xl font-bold uppercase tracking-wider text-black">
                  Global Kids School
                </h2>
                <p className="text-xs text-gray-700">
                  Affiliated to Karnataka State Board &middot; Tumakuru Campus, Karnataka
                </p>
                <p className="text-[11px] text-gray-600 font-mono">
                  Phone: +91 98765 43210 &middot; Email: accounts@globalkids.edu.in
                </p>
                <div className="inline-block border border-black px-3 py-1 text-xs font-bold uppercase tracking-widest mt-2 bg-gray-50">
                  Official Transportation Fee Receipt (AY 2026–27)
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-4 pb-3 border-b border-gray-300">
                <div>
                  <div className="text-gray-600">Receipt No:</div>
                  <strong className="font-mono text-sm">{viewingReceipt.receiptNo}</strong>
                </div>
                <div className="text-right">
                  <div className="text-gray-600">Date of Payment:</div>
                  <strong>{viewingReceipt.paidAt}</strong>
                </div>
              </div>

              {/* Student & Transport Details */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-4 pb-4 border-b border-gray-300">
                <div>
                  <span className="text-gray-600 block text-[11px]">Pupil Name:</span>
                  <strong className="text-sm">{viewingReceipt.studentName}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[11px]">USN / Roll:</span>
                  <strong className="font-mono">{viewingReceipt.usn}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[11px]">Enrolled Class:</span>
                  <strong>{viewingReceipt.grade} &middot; Section {viewingReceipt.section}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[11px]">Assigned Bus Route:</span>
                  <strong>{viewingReceipt.routeName}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 block text-[11px]">Designated Stop:</span>
                  <strong>{viewingReceipt.pickupStop}</strong>
                </div>
              </div>

              {/* Fee Breakdown Table */}
              <table className="w-full text-xs mb-4 border border-black">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-left">
                    <th className="p-2 border-r border-black">Fee Particulars</th>
                    <th className="p-2 text-right border-r border-black">Assessed Fee</th>
                    <th className="p-2 text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 border-r border-black">
                      <div className="font-bold">Annual School Bus Transportation Fee</div>
                      <div className="text-[11px] text-gray-600">
                        Academic Year 2026–27 &middot; Route: {viewingReceipt.routeName}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono border-r border-black">
                      ₹14,000
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-sm">
                      ₹{viewingReceipt.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-black font-bold">
                    <td className="p-2 text-right border-r border-black">Total Paid in This Receipt:</td>
                    <td className="p-2 text-right border-r border-black font-mono">
                      ₹{viewingReceipt.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="p-2 text-right font-mono text-sm">
                      ₹{viewingReceipt.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Payment Method & Outstanding Balance */}
              <div className="bg-gray-50 p-3 rounded border border-gray-300 text-xs mb-6 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Mode of Payment:</span>
                  <strong>{viewingReceipt.paymentMethod} (Ref: {viewingReceipt.reference})</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Remaining Transport Balance Due:</span>
                  <strong className={viewingReceipt.balanceRemaining > 0 ? "text-red-700 font-mono" : "text-green-700 font-mono"}>
                    {viewingReceipt.balanceRemaining > 0 ? `₹${viewingReceipt.balanceRemaining.toLocaleString("en-IN")}` : "Fully Settled (₹0)"}
                  </strong>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 pt-8 text-xs text-center border-t border-gray-400 mt-6">
                <div>
                  <div className="text-gray-600 mb-1">Parent / Depositor Signature</div>
                  <div className="h-8 border-b border-dashed border-gray-400 w-3/4 mx-auto" />
                </div>
                <div>
                  <div className="font-bold">{viewingReceipt.receivedBy}</div>
                  <div className="text-gray-600 mb-1">Accounts & Finance Department</div>
                  <div className="h-8 border-b border-dashed border-gray-400 w-3/4 mx-auto" />
                  <span className="text-[10px] text-gray-500 mt-1 block">Authorised Signatory & Seal</span>
                </div>
              </div>
            </div>

            <div className="panel-footer p-4 border-t border-[var(--border)] flex justify-end gap-2 no-print">
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
                <Printer size={14} />
                <span>Print Official Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
