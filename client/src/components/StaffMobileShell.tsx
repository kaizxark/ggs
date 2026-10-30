import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";

import { MobileTabBar, type MobileTabItem } from "./MobileTabBar";

export interface StaffMobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface StaffMobileNavGroup {
  label: string;
  items: Array<{ label: string; icon: LucideIcon }>;
}

export function StaffMobileShell({
  name,
  role,
  isExecutive = false,
  initials,
  photoUrl,
  activeView,
  primaryItems,
  navGroups,
  onNavigate,
  onOpenSearch,
  onSignOut,
  children,
}: {
  name: string;
  role: string;
  isExecutive?: boolean;
  initials: string;
  photoUrl?: string | null;
  activeView: string;
  primaryItems: StaffMobileTab[];
  navGroups: StaffMobileNavGroup[];
  onNavigate: (view: string) => void;
  onOpenSearch: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const tabs: MobileTabItem[] = [
    ...primaryItems,
    { id: "__more", label: "Menu", icon: Menu },
  ];
  const activeTab = moreOpen
    ? "__more"
    : primaryItems.some(item => item.id === activeView)
      ? activeView
      : "__more";

  const selectTab = (id: string) => {
    if (id === "__more") {
      setMoreOpen(true);
      return;
    }
    onNavigate(id);
  };

  const openView = (view: string) => {
    setMoreOpen(false);
    onNavigate(view);
  };

  return (
    <div className="staff-mobile">
      <header className="staff-mobile-top">
        <div
          className="staff-mobile-brand"
          onClick={() => onNavigate("Overview")}
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
        >
          <img src="/global-kids-logo.svg" alt="Global Kids" />
          <span>
            <div className="staff-mobile-brand-title">
              <strong>Global Kids</strong>
              {isExecutive && (
                <span
                  className={`mobile-exec-pill ${
                    role.toLowerCase().includes("super") ? "super" : ""
                  }`}
                >
                  <ShieldCheck size={10} />
                  {role.toLowerCase().includes("super") ? "Super" : "Admin"}
                </span>
              )}
            </div>
            <small>
              {name || (isExecutive ? "Administrator" : "Staff")} · {role}
            </small>
          </span>
        </div>
        <button
          type="button"
          className="staff-mobile-icon"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          className="staff-mobile-avatar"
          onClick={() => setMoreOpen(true)}
          aria-label="Open all sections"
        >
          {photoUrl ? <img src={photoUrl} alt="" /> : initials}
        </button>
      </header>

      <div
        className={`staff-mobile-scroll ${moreOpen ? "locked" : ""}`}
        ref={scrollRef}
      >
        <div className="content-area staff-mobile-content">{children}</div>
      </div>

      <MobileTabBar
        items={tabs}
        active={activeTab}
        onSelect={selectTab}
        ariaLabel={isExecutive ? "Administration navigation" : "Staff navigation"}
      />

      {moreOpen && (
        <>
          <div
            className="staff-more-scrim"
            onClick={() => setMoreOpen(false)}
          />
          <aside
            className="staff-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
          >
            <div className="staff-more-head">
              <div>
                <p className="staff-more-eyebrow">
                  {isExecutive ? "Administration & School" : "All sections"}
                </p>
                <h2>{name || (isExecutive ? "Administrator" : "Staff")}</h2>
                <span className="flex items-center gap-1.5 mt-0.5">
                  {isExecutive && (
                    <ShieldCheck size={13} className="text-[var(--brand)]" />
                  )}
                  {role}
                </span>
              </div>
              <button
                type="button"
                className="staff-mobile-icon"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="staff-more-groups">
              {navGroups.map(group => (
                <section className="staff-more-group" key={group.label}>
                  <p>{group.label}</p>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const current = item.label === activeView;
                    return (
                      <button
                        type="button"
                        key={item.label}
                        className={`staff-more-item ${current ? "active" : ""}`}
                        onClick={() => openView(item.label)}
                        aria-current={current ? "page" : undefined}
                      >
                        <Icon size={17} />
                        <span>{item.label}</span>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>

            <button
              type="button"
              className="staff-more-signout"
              onClick={() => {
                setMoreOpen(false);
                onSignOut();
              }}
            >
              <LogOut size={17} />
              <span>Log out</span>
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
