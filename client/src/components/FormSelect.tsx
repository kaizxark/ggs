import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export interface FormSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  error?: string;
  disabled?: boolean;
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option…",
  ariaLabel,
  error,
  disabled = false,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [maxHeight, setMaxHeight] = useState<number>(220);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const shouldFlip = spaceBelow < 220 && spaceAbove > spaceBelow;
    setPlacement(shouldFlip ? "top" : "bottom");
    const available = shouldFlip ? spaceAbove : spaceBelow;
    setMaxHeight(Math.max(120, Math.min(240, available)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);
  const hasValue = Boolean(value !== undefined && value !== null && value !== "");

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        marginTop: 7,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 38,
          padding: "0 12px",
          borderRadius: 10,
          background: "var(--bg-input)",
          border: error ? "1px solid var(--danger, #ff453a)" : open ? "1px solid var(--brand, #0a84ff)" : "1px solid var(--border-strong)",
          boxShadow: open ? "0 0 0 3px var(--brand-soft, rgba(10, 132, 255, 0.15))" : "none",
          color: hasValue ? "var(--text-primary, #ffffff)" : "var(--text-muted, rgba(255, 255, 255, 0.45))",
          fontSize: 13,
          fontWeight: 400,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.14s ease, box-shadow 0.14s ease",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption?.icon}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {hasValue ? selectedOption?.label ?? value : placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.16s ease",
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: placement === "top" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: placement === "top" ? 2 : -2 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            style={{
              position: "absolute",
              top: placement === "bottom" ? "calc(100% + 5px)" : "auto",
              bottom: placement === "top" ? "calc(100% + 5px)" : "auto",
              left: 0,
              right: 0,
              zIndex: 9999,
              maxHeight,
              overflowY: "auto",
              padding: 5,
              borderRadius: 12,
              background: "rgba(24, 25, 30, 0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--border-strong, rgba(255, 255, 255, 0.14))",
              boxShadow: "0 18px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)",
              transformOrigin: placement === "top" ? "bottom center" : "top center",
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={active}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    color: active ? "var(--text-primary, #ffffff)" : "var(--text-secondary, rgba(255, 255, 255, 0.8))",
                    fontSize: 13,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    outline: "none",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.icon}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{opt.label}</span>
                  </span>
                  {active && (
                    <Check
                      size={14}
                      style={{
                        color: "var(--brand, #0a84ff)",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
