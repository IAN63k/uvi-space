"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  badge?: string;
  shortLabel?: string;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = "uvi-space.sidebar.collapsed.v1";

function getCompactLabel(label: string) {
  const words = label.split(" ").filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

const reportNavItems: NavItem[] = [
  { label: "Alistamiento", href: "/reportes/alistamiento", shortLabel: "AL" },
  { label: "EFC 01", href: "/reportes/efc/1", badge: "EFC01", shortLabel: "E1" },
  { label: "EFC 02", href: "/reportes/efc/2", badge: "EFC02", shortLabel: "E2" },
  { label: "EFC 03", href: "/reportes/efc/3", badge: "EFC03", shortLabel: "E3" },
  { label: "Consultas de usuarios", href: "/reportes/consultas-usuarios", shortLabel: "CU" },
  { label: "Inglés", href: "/reportes/ingles", shortLabel: "IN" },
  { label: "Institucionales", href: "/reportes/institucionales", shortLabel: "IT" },
];

const adminNavItems: NavItem[] = [
  { label: "Configuración BD", href: "/configuracion/bd", shortLabel: "BD" },
  { label: "Consola SQL", href: "/utilidades/sql-console", shortLabel: "SQL" },
];

function NavLink({ item, collapsed = false }: { item: NavItem; collapsed?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const compactLabel = item.shortLabel ?? getCompactLabel(item.label);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center rounded-md px-3 py-2 text-sm transition-colors",
        collapsed ? "justify-center" : "justify-between",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {collapsed ? <span className="text-[11px] font-semibold tracking-wide uppercase">{compactLabel}</span> : <span>{item.label}</span>}
      {!collapsed && item.badge ? (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            isActive
              ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
              : "bg-sidebar-accent text-sidebar-accent-foreground group-hover:bg-sidebar-primary/15",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

// Desktop sidebar — always visible on lg+
function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col gap-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex",
        collapsed ? "w-20" : "w-60",
      )}
    >
      <div className="flex items-center justify-end border-b border-sidebar-border px-2 py-2">
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          title={collapsed ? "Expandir" : "Colapsar"}
          className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          )}
        </button>
      </div>
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}

// Mobile sidebar — drawer controlled by parent state
function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-sidebar-foreground hover:opacity-80" onClick={onClose}>
            UVI Space
          </Link>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <SidebarContent onLinkClick={onClose} />
      </aside>
    </>
  );
}

function SidebarContent({
  onLinkClick,
  collapsed = false,
}: {
  onLinkClick?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col gap-0 overflow-y-auto py-3">
      {/* Brand — desktop only (mobile has it in header above) */}
      <div className={cn("hidden px-4 pb-3 lg:block", collapsed && "px-2") }>
        <Link href="/" className={cn("text-sm font-semibold text-sidebar-foreground hover:opacity-80", collapsed && "block text-center text-xs")}>
          {collapsed ? "UVI" : "UVI Space"}
        </Link>
        {!collapsed ? <p className="mt-0.5 text-[11px] text-sidebar-foreground/50">Utilidades Moodle</p> : null}
      </div>

      {/* Reportes */}
      <nav className="px-2">
        {!collapsed ? (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Reportes
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {reportNavItems.map((item) => (
            <li key={item.href} onClick={onLinkClick}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="my-3 mx-3 h-px bg-sidebar-border" />

      {/* Configuración */}
      <nav className="px-2">
        {!collapsed ? (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Configuración
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {adminNavItems.map((item) => (
            <li key={item.href} onClick={onLinkClick}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Inicio shortcut — highlight if on root */}
      <div className="mt-auto px-2 pb-1">
        <Link
          href="/"
          title={collapsed ? "Inicio" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            collapsed && "justify-center",
            pathname === "/"
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          onClick={onLinkClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {!collapsed ? "Inicio" : null}
        </Link>
      </div>
    </div>
  );
}

// Top bar for mobile — shows hamburger button and current page title
export function AppTopbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
      <button
        onClick={onMenuOpen}
        aria-label="Abrir menú"
        className="rounded p-1.5 text-foreground/60 hover:bg-accent hover:text-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>
      <Link href="/" className="text-sm font-semibold">
        UVI Space
      </Link>
    </header>
  );
}

// Root shell — renders desktop sidebar + mobile drawer
export function AppShell({
  children,
  appVersion,
}: {
  children: React.ReactNode;
  appVersion: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (storedValue === null) {
      return;
    }

    setDesktopCollapsed(storedValue === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  return (
    <div className="flex min-h-screen">
      <DesktopSidebar
        collapsed={desktopCollapsed}
        onToggle={() => setDesktopCollapsed((prev) => !prev)}
      />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", desktopCollapsed ? "lg:pl-20" : "lg:pl-60")}>
        <AppTopbar onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border bg-background/90 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/70 md:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} UNIAJCVirtual - UVI Space</span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground/80">v{appVersion}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
