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
  const [placement, setPlacement] = useState<{
    vertical: "bottom" | "top";
    horizontal: "left" | "right";
  }>({ vertical: "bottom", horizontal: align });

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;

    const updatePlacement = () => {
      if (!containerRef.current) return;
      const zoomVal = Number.parseFloat(
        (getComputedStyle(document.documentElement) as any).zoom ?? ""
      );
      const zoom = Number.isFinite(zoomVal) && zoomVal > 0 ? zoomVal : 1;

      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight / zoom;
      const vw = window.innerWidth / zoom;
      const rectBottom = rect.bottom / zoom;
      const rectTop = rect.top / zoom;
      const rectLeft = rect.left / zoom;
      const rectRight = rect.right / zoom;

      const spaceBelow = vh - rectBottom;
      const spaceAbove = rectTop;
      const vertical = spaceBelow < 260 && spaceAbove > spaceBelow ? "top" : "bottom";

      const spaceRight = vw - rectLeft;
      const spaceLeft = rectRight;
      let horizontal: "left" | "right" = align;
      if (align === "left" && spaceRight < 220 && spaceLeft > spaceRight) {
        horizontal = "right";
      } else if (align === "right" && spaceLeft < 220 && spaceRight > spaceLeft) {
        horizontal = "left";
      }

      setPlacement({ vertical, horizontal });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, { capture: true });
    };
  }, [open, align]);

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
            initial={{ opacity: 0, scale: 0.97, y: placement.vertical === "top" ? 2 : -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: placement.vertical === "top" ? 1 : -1 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
            className={`smooth-filter-popover${
              placement.vertical === "top" ? " smooth-filter-popover-top" : ""
            }${placement.horizontal === "right" ? " smooth-filter-popover-right" : ""}`}
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
