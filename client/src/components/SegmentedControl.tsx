import React, { useId } from "react";
import { motion } from "framer-motion";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  style?: React.CSSProperties;
  layoutId?: string;
  ariaLabel?: string;
  indicatorVariant?: "glass" | "brand";
  indicatorClassName?: string;
  buttonClassName?: string;
}

/**
 * Apple-grade Segmented Control with horizontal sliding motion indicator.
 * Moves fluidly between tabs with high-fidelity spring physics.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = "",
  style,
  layoutId,
  ariaLabel,
  indicatorVariant = "glass",
  indicatorClassName = "",
  buttonClassName = "",
}: SegmentedControlProps<T>) {
  const autoId = useId();
  const activeLayoutId = layoutId || `segmented-pill-${autoId}`;

  return (
    <div
      className={`segmented-control ${className}`}
      role="group"
      aria-label={ariaLabel}
      style={style}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`${isActive ? "active" : ""} ${buttonClassName}`.trim()}
            style={{
              position: "relative",
              zIndex: 1,
              background: "transparent",
              boxShadow: "none",
            }}
          >
            {isActive && (
              <motion.div
                layoutId={activeLayoutId}
                className={`segmented-indicator ${
                  indicatorVariant === "brand" ? "segmented-indicator-brand" : ""
                } ${indicatorClassName}`.trim()}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 38,
                  mass: 0.8,
                }}
              />
            )}
            <span
              style={{
                position: "relative",
                zIndex: 2,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
              }}
            >
              {opt.icon}
              {opt.label}
              {opt.count !== undefined && (
                <span className="count-badge" style={{ marginLeft: 4 }}>
                  {opt.count}
                </span>
              )}
              {opt.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
