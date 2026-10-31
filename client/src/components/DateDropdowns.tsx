import React, { useEffect, useMemo, useState } from "react";

export interface DateDropdownsProps {
  value?: string; // ISO format "YYYY-MM-DD"
  onChange: (isoDate: string) => void;
  minYear?: number;
  maxYear?: number;
  defaultToToday?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Indian Standard Date Selector: Day -> Month -> Year dropdowns.
 * Internal state formats to standard ISO "YYYY-MM-DD" for backend parity.
 */
export function DateDropdowns({
  value,
  onChange,
  minYear = 1980,
  maxYear = 2035,
  defaultToToday = false,
  disabled = false,
  error,
  className = "",
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
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return d;
    });
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
      // Validate day overflow
      const maxD = new Date(parseInt(newYear, 10), parseInt(newMonth, 10), 0).getDate();
      const validDay = parseInt(newDay, 10) > maxD ? String(maxD).padStart(2, "0") : newDay;
      onChange(`${newYear}-${newMonth}-${validDay}`);
    } else {
      onChange("");
    }
  };

  const selectStyle: React.CSSProperties = {
    height: "38px",
    borderRadius: "10px",
    background: "var(--bg-input, rgba(20, 21, 26, 0.75))",
    border: error ? "1px solid var(--danger, #ff453a)" : "1px solid var(--border, rgba(255, 255, 255, 0.12))",
    color: "var(--text-primary, #ffffff)",
    fontSize: "13px",
    fontWeight: 500,
    padding: "0 10px",
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "border-color 0.15s ease",
  };

  return (
    <div className={`date-dropdowns-group ${className}`} style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1.1fr", gap: "8px", width: "100%" }}>
        {/* 1. Day Dropdown */}
        <select
          value={day}
          disabled={disabled}
          onChange={(e) => updateDate(e.target.value, month, year)}
          style={selectStyle}
          className="focus:border-[var(--brand)]"
          aria-label="Day"
        >
          <option value="" disabled style={{ background: "#1c1e24", color: "#888" }}>
            Day
          </option>
          {daysList.map((d) => (
            <option key={d} value={d} style={{ background: "#1c1e24", color: "#fff" }}>
              {parseInt(d, 10)}
            </option>
          ))}
        </select>

        {/* 2. Month Dropdown */}
        <select
          value={month}
          disabled={disabled}
          onChange={(e) => updateDate(day, e.target.value, year)}
          style={selectStyle}
          className="focus:border-[var(--brand)]"
          aria-label="Month"
        >
          <option value="" disabled style={{ background: "#1c1e24", color: "#888" }}>
            Month
          </option>
          {MONTH_NAMES.map((name, idx) => {
            const mVal = String(idx + 1).padStart(2, "0");
            return (
              <option key={mVal} value={mVal} style={{ background: "#1c1e24", color: "#fff" }}>
                {name}
              </option>
            );
          })}
        </select>

        {/* 3. Year Dropdown */}
        <select
          value={year}
          disabled={disabled}
          onChange={(e) => updateDate(day, month, e.target.value)}
          style={selectStyle}
          className="focus:border-[var(--brand)]"
          aria-label="Year"
        >
          <option value="" disabled style={{ background: "#1c1e24", color: "#888" }}>
            Year
          </option>
          {yearsList.map((y) => (
            <option key={y} value={y} style={{ background: "#1c1e24", color: "#fff" }}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <span className="field-error" style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--danger, #ff453a)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
