"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "uvi-space.theme.v1";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Sync initial state from DOM (set by the inline script)
    setIsDark(document.documentElement.classList.contains("dark"));

    // When no manual preference is stored, follow system changes in real time
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) return; // user overrode it — leave it alone
      document.documentElement.classList.toggle("dark", e.matches);
      setIsDark(e.matches);
    };

    mq.addEventListener("change", handleSystemChange);
    return () => mq.removeEventListener("change", handleSystemChange);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
    setIsDark(next);
  };

  const label = isDark ? "Modo claro" : "Modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center",
      )}
    >
      {isDark
        ? <Sun  className="h-3.5 w-3.5 shrink-0" />
        : <Moon className="h-3.5 w-3.5 shrink-0" />
      }
      {!collapsed && <span className="text-xs">{label}</span>}
    </button>
  );
}
