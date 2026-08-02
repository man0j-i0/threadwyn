"use client";

import { useEffect, useState } from "react";
import { MoonStars, Sun } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  // The theme class is stamped on <html> by ThemeScript before first paint, so
  // the truth lives in the DOM. Read it on the next frame rather than
  // synchronously in the effect body, which would cascade a second render.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("threadwyn-theme", next);
    } catch {
      /* private mode — the toggle still works for this session */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-full text-muted",
        "transition-colors duration-200 ease-[var(--ease-out-expo)]",
        "hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      {/* Render nothing until mounted so server and client markup agree. */}
      {theme === null ? null : theme === "dark" ? (
        <Sun size={18} weight="light" />
      ) : (
        <MoonStars size={18} weight="light" />
      )}
    </button>
  );
}
