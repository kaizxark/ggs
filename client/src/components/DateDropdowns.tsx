import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

export interface DateDropdownsProps {
  value?: string; // ISO format "YYYY-MM-DD"
  onChange: (isoDate: string) => void;
  minYear?: number;
  maxYear?: number;
  defaultToToday?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  showPreview?: boolean;
}

const MONTH_NAMES = [
  { value: "01", short: "Jan", full: "January" },
  { value: "02", short: "Feb", full: "February" },
  { value: "03", short: "Mar", full: "March" },
  { value: "04", short: "Apr", full: "April" },
  { value: "05", short: "May", full: "May" },
  { value: "06", short: "Jun", full: "June" },
  { value: "07", short: "Jul", full: "July" },
  { value: "08", short: "Aug", full: "August" },
  { value: "09", short: "Sep", full: "September" },
  { value: "10", short: "Oct", full: "October" },
  { value: "11", short: "Nov", full: "November" },
  { value: "12", short: "Dec", full: "December" },
];

/**
 * Indian Standard Date Selector: Day -> Month -> Year dropdowns.
 * Formats internally to standard ISO "YYYY-MM-DD" for backend parity.
 */
export function DateDropdowns({
  value,
  onChange,
  minYear = 2015,
  maxYear = 2035,
  defaultToToday = false,
  disabled = false,
  error,
  className = "",
  showPreview = true,
}: DateDropdownsProps) {
  // Parse current value
  const parsed = useMemo(() => {
    if (!value && defaultToToday) {
      const today = new Date();
      return {
        day: String(today.getDate()).padStart(2, "0"),
        month: String(today.getMonth() + 1).padStart(2, "0"),
        year: String(today.getFullYear()),
      };
    }
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return { day: d, month: m, year: y };
    }
    return { day: "", month: "", year: "" };
  }, [value, defaultToToday]);

  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  // Sync internal state if external value changes
  useEffect(() => {
    setDay(parsed.day);
    setMonth(parsed.month);
    setYear(parsed.year);
  }, [parsed]);

  // If defaultToToday and value was empty, trigger onChange
  useEffect(() => {
    if (!value && defaultToToday && parsed.day && parsed.month && parsed.year) {
      onChange(`${parsed.year}-${parsed.month}-${parsed.day}`);
    }
  }, [value, defaultToToday, parsed, onChange]);

  // Compute number of days in selected month and year
  const daysInMonth = useMemo(() => {
    const y = parseInt(year, 10) || 2026;
    const m = parseInt(month, 10) || 1;
    return new Date(y, m, 0).getDate();
  }, [year, month]);

  const daysList = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [daysInMonth]);

  const yearsList = useMemo(() => {
    const list: string[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(String(y));
    }
    return list;
  }, [minYear, maxYear]);

  const updateDate = (newDay: string, newMonth: string, newYear: string) => {
    setDay(newDay);
    setMonth(newMonth);
    setYear(newYear);

    if (newDay && newMonth && newYear) {
      // Validate day overflow (e.g. Feb 31 -> Feb 28)
      const maxD = new Date(parseInt(newYear, 10), parseInt(newMonth, 10), 0).getDate();
      const validDay = parseInt(newDay, 10) > maxD ? String(maxD).padStart(2, "0") : newDay;
      onChange(`${newYear}-${newMonth}-${validDay}`);
    } else {
      onChange("");
    }
  };

  const selectedMonthObj = MONTH_NAMES.find((m) => m.value === month);
  const previewLabel = useMemo(() => {
    if (!day || !month || !year) return null;
    const mObj = MONTH_NAMES.find((m) => m.value === month);
    return `${day} ${mObj?.short || month} ${year}`;
  }, [day, month, year]);

  const selectStyle: React.CSSProperties = {
    width: "100%",
    height: "38px",
    borderRadius: "9px",
    background: "rgba(255, 255, 255, 0.04)",
    border: error ? "1px solid var(--danger, #ff453a)" : "1px solid var(--border)",
    color: "var(--text-primary, #ffffff)",
    fontSize: "13px",
    fontWeight: 500,
    padding: "0 28px 0 12px",
    appearance: "none",
    WebkitAppearance: "none",
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "border-color 0.15s ease, background 0.15s ease",
  };

  return (
    <div className={`date-dropdowns-group ${className}`} style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.15fr", gap: "8px", width: "100%" }}>
        {/* 1. Day Selector */}
        <div style={{ position: "relative", width: "100%" }}>
          <select
            value={day}
            disabled={disabled}
            onChange={(e) => updateDate(e.target.value, month, year)}
            style={selectStyle}
            className="hover:border-[var(--brand)] focus:border-[var(--brand)]"
            aria-label="Day"
          >
            <option value="" disabled style={{ background: "#181a20", color: "#888" }}>
              Day
            </option>
            {daysList.map((d) => (
              <option key={d} value={d} style={{ background: "#181a20", color: "#f0f2f5" }}>
                {parseInt(d, 10)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--text-muted)",
            }}
          />
        </div>

        {/* 2. Month Selector */}
        <div style={{ position: "relative", width: "100%" }}>
          <select
            value={month}
            disabled={disabled}
            onChange={(e) => updateDate(day, e.target.value, year)}
            style={selectStyle}
            className="hover:border-[var(--brand)] focus:border-[var(--brand)]"
            aria-label="Month"
          >
            <option value="" disabled style={{ background: "#181a20", color: "#888" }}>
              Month
            </option>
            {MONTH_NAMES.map((m) => (
              <option key={m.value} value={m.value} style={{ background: "#181a20", color: "#f0f2f5" }}>
                {m.full}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--text-muted)",
            }}
          />
        </div>

        {/* 3. Year Selector */}
        <div style={{ position: "relative", width: "100%" }}>
          <select
            value={year}
            disabled={disabled}
            onChange={(e) => updateDate(day, month, e.target.value)}
            style={selectStyle}
            className="hover:border-[var(--brand)] focus:border-[var(--brand)]"
            aria-label="Year"
          >
            <option value="" disabled style={{ background: "#181a20", color: "#888" }}>
              Year
            </option>
            {yearsList.map((y) => (
              <option key={y} value={y} style={{ background: "#181a20", color: "#f0f2f5" }}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--text-muted)",
            }}
          />
        </div>
      </div>

      {showPreview && previewLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginTop: "5px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <CalendarDays size={12} className="text-[var(--brand)]" />
          <span>Indian Format (DD-MM-YYYY): <strong style={{ color: "var(--text-secondary)" }}>{previewLabel}</strong></span>
        </div>
      )}

      {error && (
        <span className="field-error" style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--danger, #ff453a)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
