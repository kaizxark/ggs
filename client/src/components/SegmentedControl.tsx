import React, { useId } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: React.ReactNode;
  disabled?: boolean;
  mobileLabel?: string;
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
  mobileMode?: "auto" | "dropdown" | "two-way" | "scroll" | "none";
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props && "children" in props) {
      return extractText(props.children);
    }
  }
  return "";
}

/**
 * Universal Responsive Segmented Control
 * - On desktop / larger viewports: Apple-grade horizontal sliding indicator with spring physics.
 * - On mobile / smaller viewports: Intelligently transforms into a logical, responsive mobile selector:
 *     * 2 compact options: Clean full-width 50/50 touch split-toggle.
 *     * 3+ options or long labels: Native mobile dropdown with custom trigger UI (no horizontal scrolling, zero clipping).
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
  mobileMode = "auto",
}: SegmentedControlProps<T>) {
  const autoId = useId();
  const activeLayoutId = layoutId || `segmented-pill-${autoId}`;
  const isBrand = indicatorVariant === "brand";

  const activeOption = options.find((opt) => opt.value === value) || options[0];

  // Determine mobile display mode
  const shouldRenderMobile = mobileMode !== "none";
  const isCompactTwoWay =
    mobileMode === "two-way" ||
    (mobileMode === "auto" &&
      options.length === 2 &&
      options.every((opt) => extractText(opt.label).length <= 15));

  return (
    <>
      {shouldRenderMobile &&
        (isCompactTwoWay ? (
          /* Mobile 2-way touch split toggle (< 640px) */
          <div
            className={`segmented-control-2way-mobile sm:hidden ${
              isBrand ? "variant-brand" : "variant-glass"
            } ${className}`.trim()}
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
                >
                  <span className="flex items-center justify-center gap-1.5 truncate">
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="count-badge ml-1">{opt.count}</span>
                    )}
                    {opt.badge}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Mobile Dropdown Selector (< 640px) */
          <div
            className={`segmented-mobile-select sm:hidden ${
              isBrand ? "variant-brand" : "variant-glass"
            } ${className}`.trim()}
            style={style}
          >
            <div className="segmented-mobile-select-trigger">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {activeOption?.icon && (
                  <span className="text-[var(--text-muted)] flex-shrink-0 flex items-center">
                    {activeOption.icon}
                  </span>
                )}
                <span className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                  {activeOption?.label}
                </span>
                {activeOption?.count !== undefined && (
                  <span className="count-badge text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] font-mono ml-1 flex-shrink-0">
                    {activeOption.count}
                  </span>
                )}
                {activeOption?.badge}
              </div>
              <div className="flex items-center gap-1 text-[var(--text-muted)] pl-2 border-l border-[var(--border)] ml-2 flex-shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                  Switch
                </span>
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Native invisible select overlaid for instantaneous native mobile wheel/sheet */}
            <select
              aria-label={ariaLabel || "Select option"}
              value={value}
              onChange={(e) => onChange(e.target.value as T)}
              className="segmented-mobile-native-select"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.mobileLabel || extractText(opt.label)}
                  {opt.count !== undefined ? ` (${opt.count})` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}

      {/* Desktop / Large Screen Slider (>= 640px) */}
      <div
        className={`segmented-control ${
          shouldRenderMobile ? "hidden sm:inline-flex" : "inline-flex"
        } ${isBrand ? "variant-brand" : "variant-glass"} ${className}`.trim()}
        role="group"
        aria-label={ariaLabel}
        style={style}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          const isBrandActive = isActive && isBrand;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => onChange(opt.value)}
              className={`${isActive ? "active" : ""} ${
                isBrandActive ? "active-brand" : ""
              } ${buttonClassName}`.trim()}
              style={{
                position: "relative",
                zIndex: 1,
                background: "transparent",
                boxShadow: "none",
                color: isBrandActive ? "#ffffff" : undefined,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId={activeLayoutId}
                  className={`segmented-indicator ${
                    isBrand ? "segmented-indicator-brand" : ""
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
                  color: isBrandActive ? "#ffffff" : undefined,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {opt.icon}
                {opt.label}
                {opt.count !== undefined && (
                  <span
                    className="count-badge"
                    style={{
                      marginLeft: 4,
                      background: isBrandActive
                        ? "rgba(255, 255, 255, 0.22)"
                        : undefined,
                      color: isBrandActive ? "#ffffff" : undefined,
                      borderColor: isBrandActive
                        ? "rgba(255, 255, 255, 0.35)"
                        : undefined,
                    }}
                  >
                    {opt.count}
                  </span>
                )}
                {opt.badge}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
