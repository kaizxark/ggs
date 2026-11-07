import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

interface Coords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [coords, setCoords] = useState<Coords | null>(null);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    /* The UI zoom is gone, so the viewport and the measured rect share one
       coordinate space; the popover can use them directly. */
    const rect = triggerRef.current.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setOpen(false);
      return;
    }

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 8;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    const shouldFlip = spaceBelow < 200 && spaceAbove > spaceBelow;
    const nextPlacement = shouldFlip ? "top" : "bottom";
    setPlacement(nextPlacement);

    const available = shouldFlip ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, available - 8));

    // Match button width, clamped to viewport with 8px margins
    const width = Math.min(Math.max(rect.width, 160), vw - margin * 2);
    let left = rect.left;
    if (left + width > vw - margin) {
      left = vw - width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    if (shouldFlip) {
      setCoords({
        bottom: vh - rect.top + 6,
        left,
        width,
        maxHeight,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight,
      });
    }
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      updateCoords();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (open) {
      updateCoords();
    }
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;

    const handleScroll = (e: Event) => {
      // If the scroll target is inside the popover list itself, ignore so it scrolls smoothly
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      updateCoords();
    };

    const handleResize = () => updateCoords();

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleResize);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updateCoords]);

  const selectedOption = options.find((o) => o.value === value);
  const hasValue = Boolean(value !== undefined && value !== null && value !== "");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        marginTop: 7,
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
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
          border: error
            ? "1px solid var(--danger)"
            : open
            ? "1px solid var(--brand)"
            : "1px solid var(--border-strong)",
          boxShadow: open
            ? "0 0 0 3px var(--brand-soft, var(--brand-soft))"
            : "none",
          color: hasValue
            ? "var(--text-primary)"
            : "var(--text-muted)",
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

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                initial={{
                  opacity: 0,
                  scale: 0.98,
                  y: placement === "top" ? 4 : -4,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  y: placement === "top" ? 2 : -2,
                }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                role="listbox"
                style={{
                  position: "fixed",
                  top: coords.top !== undefined ? coords.top : "auto",
                  bottom: coords.bottom !== undefined ? coords.bottom : "auto",
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                  zIndex: 99999,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  padding: 5,
                  borderRadius: 12,
                  background: "var(--bg-panel)",
                  backdropFilter: "blur(32px) saturate(190%)",
                  WebkitBackdropFilter: "blur(32px) saturate(190%)",
                  border: "1px solid var(--border-strong)",
                  boxShadow:
                    "var(--shadow-popover)",
                  transformOrigin:
                    placement === "top" ? "bottom center" : "top center",
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
                        background: active
                          ? "var(--bg-hover)"
                          : "transparent",
                        color: active
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        fontSize: 13,
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        outline: "none",
                        transition: "background 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            "var(--bg-raised)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.background = "transparent";
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
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {opt.label}
                        </span>
                      </span>
                      {active && (
                        <Check
                          size={14}
                          style={{
                            color: "var(--brand)",
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
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
