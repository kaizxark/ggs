import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  User,
  UserCog,
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
  email,
  username,
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
  email?: string;
  username?: string;
  activeView: string;
  primaryItems: StaffMobileTab[];
  navGroups: StaffMobileNavGroup[];
  onNavigate: (view: string) => void;
  onOpenSearch: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccountOpen(false);
    setNavMenuOpen(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  useEffect(() => {
    if (!accountOpen && !navMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setNavMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [accountOpen, navMenuOpen]);

  // Bottom tabs: 4 operational favorites + 1 "Menu" button
  const tabs: MobileTabItem[] = useMemo(() => [
    ...primaryItems,
    { id: "__more", label: "Menu", icon: Menu },
  ], [primaryItems]);

  const isPrimaryView = primaryItems.some(
    item => item.id === activeView || item.label === activeView
  );

  const activeTab = navMenuOpen
    ? "__more"
    : isPrimaryView
      ? (primaryItems.find(item => item.id === activeView || item.label === activeView)?.id ?? activeView)
      : "__more";

  const selectTab = (id: string) => {
    setAccountOpen(false);
    if (id === "__more") {
      setNavMenuOpen(true);
      return;
    }
    setNavMenuOpen(false);
    onNavigate(id);
  };

  const openView = (view: string) => {
    setNavMenuOpen(false);
    setAccountOpen(false);
    onNavigate(view);
  };

  // Filter out items that are already accessible from the bottom tab bar
  const secondaryNavGroups = useMemo(() => {
    return navGroups
      .map(group => ({
        label: group.label,
        items: group.items.filter(
          item =>
            !primaryItems.some(
              p => p.id === item.label || p.label === item.label
            )
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [navGroups, primaryItems]);

  const sheetOpen = accountOpen || navMenuOpen;

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
            <strong className="staff-mobile-brand-title">Global Kids</strong>
            <small>
              {name || (isExecutive ? "Administrator" : "Staff")} · {role}
            </small>
          </span>
        </div>

        <button
          type="button"
          className="staff-mobile-icon"
          onClick={onOpenSearch}
          aria-label="Search directory"
        >
          <Search size={18} />
        </button>

        {/* Clicking the avatar opens the user's Account & Profile Drawer */}
        <button
          type="button"
          className="staff-mobile-avatar"
          onClick={() => {
            setNavMenuOpen(false);
            setAccountOpen(true);
          }}
          aria-label="Open profile and account settings"
        >
          {photoUrl ? <img src={photoUrl} alt="" /> : initials}
        </button>
      </header>

      <div
        className={`staff-mobile-scroll ${sheetOpen ? "locked" : ""}`}
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

      {/* Scrim backdrop for either sheet */}
      {sheetOpen && (
        <div
          className="staff-more-scrim"
          onClick={() => {
            setAccountOpen(false);
            setNavMenuOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* 1. Account & Profile Drawer (opened strictly via Header Avatar) */}
      {accountOpen && (
        <aside
          className="staff-more-sheet staff-account-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Account and Profile"
        >
          <div className="staff-sheet-handle" />

          <div className="staff-more-head">
            <div>
              <p className="staff-more-eyebrow">User Account</p>
              <h2>Profile & Access</h2>
            </div>
            <button
              type="button"
              className="staff-mobile-icon"
              onClick={() => setAccountOpen(false)}
              aria-label="Close profile drawer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="staff-account-card">
            <div className="staff-account-avatar">
              {photoUrl ? <img src={photoUrl} alt={name} /> : initials}
            </div>
            <div className="staff-account-info">
              <strong className="staff-account-name">{name || "Global Kids User"}</strong>
              <span className="staff-role-badge">
                {isExecutive ? <ShieldCheck size={12} /> : <User size={12} />}
                {role}
              </span>
              {(email || username) && (
                <span className="staff-account-email">{email || username}</span>
              )}
            </div>
          </div>

          <div className="staff-account-actions">
            <button
              type="button"
              className="staff-account-action"
              onClick={() => openView("Settings")}
            >
              <Settings2 size={18} className="text-[var(--text-muted)]" />
              <div className="staff-account-action-copy">
                <strong>Settings & Preferences</strong>
                <small>Account security, passwords, theme</small>
              </div>
              <ChevronRight size={15} className="text-[var(--text-faint)]" />
            </button>

            {isExecutive && (
              <button
                type="button"
                className="staff-account-action"
                onClick={() => openView("User management")}
              >
                <UserCog size={18} className="text-[var(--brand)]" />
                <div className="staff-account-action-copy">
                  <strong>User Management</strong>
                  <small>Manage staff logins, credentials, roles</small>
                </div>
                <ChevronRight size={15} className="text-[var(--text-faint)]" />
              </button>
            )}

            <button
              type="button"
              className="staff-account-action"
              onClick={() => {
                setAccountOpen(false);
                onOpenSearch();
              }}
            >
              <Search size={18} className="text-[var(--text-muted)]" />
              <div className="staff-account-action-copy">
                <strong>Search School Directory</strong>
                <small>Lookup students, staff, USNs, records</small>
              </div>
              <ChevronRight size={15} className="text-[var(--text-faint)]" />
            </button>
          </div>

          <button
            type="button"
            className="staff-account-signout"
            onClick={() => {
              setAccountOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={16} />
            <span>Sign out of session</span>
          </button>
        </aside>
      )}

      {/* 2. Secondary School Modules Drawer (opened strictly via bottom "Menu" tab) */}
      {navMenuOpen && (
        <aside
          className="staff-more-sheet staff-nav-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="More School Modules"
        >
          <div className="staff-sheet-handle" />

          <div className="staff-more-head">
            <div>
              <p className="staff-more-eyebrow">School System</p>
              <h2>All Modules</h2>
              <span className="text-xs text-[var(--text-muted)]">
                Secondary modules not on the quick bar
              </span>
            </div>
            <button
              type="button"
              className="staff-mobile-icon"
              onClick={() => setNavMenuOpen(false)}
              aria-label="Close navigation drawer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="staff-more-groups">
            {secondaryNavGroups.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                All primary sections are already pinned on the bottom bar.
              </div>
            ) : (
              secondaryNavGroups.map(group => (
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
                        {current && (
                          <span className="text-[11px] font-bold text-[var(--brand)] px-1.5 py-0.5 rounded bg-[var(--brand-soft)] mr-1">
                            Current
                          </span>
                        )}
                        <ChevronRight size={15} />
                      </button>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
