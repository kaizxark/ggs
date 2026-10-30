import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

export interface MobileTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function MobileTabBar({
  items,
  active,
  onSelect,
  ariaLabel,
}: {
  items: MobileTabItem[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex(item => item.id === active)
  );
  const style = {
    "--tab-count": items.length,
    "--tab-index": activeIndex,
  } as CSSProperties;

  return (
    <nav className="mobile-tab-bar" aria-label={ariaLabel} style={style}>
      <span className="mobile-tab-slider" aria-hidden="true" />
      {items.map(item => {
        const Icon = item.icon;
        const current = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            className={current ? "active" : ""}
            onClick={() => onSelect(item.id)}
            aria-current={current ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={current ? 2.2 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
