import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export interface SmoothSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SmoothFilterDropdownProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: SmoothSelectOption[];
  onChange: (val: string) => void;
  align?: "left" | "right";
  ariaLabel: string;
}

export function SmoothFilterDropdown({
  label,
  icon,
  value,
  options,
  onChange,
  align = "left",
  ariaLabel,
}: SmoothFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const hasValue = Boolean(value && value !== "");

  return (
    <div className="smooth-filter-container" ref={containerRef}>
      <button
        type="button"
        className={`smooth-filter-trigger${hasValue ? " has-value" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon}
        <span>{hasValue ? selectedOption?.label ?? value : label}</span>
        <ChevronDown
          size={13}
          className={`smooth-filter-chevron${open ? " open" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -1 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
            className={`smooth-filter-popover${align === "right" ? " smooth-filter-popover-right" : ""}`}
            role="listbox"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`smooth-filter-item${active ? " active" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={active}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {active && <Check size={13} className="smooth-check-icon shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
