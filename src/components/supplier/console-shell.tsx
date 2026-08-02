"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChartLineUp,
  Package,
  SignOut,
  Storefront,
  Stack,
  UserCircle,
  X,
  List as ListIcon,
} from "@phosphor-icons/react";

import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/system/theme-toggle";

const NAV = [
  { href: "/supplier", label: "Overview", icon: ChartLineUp, exact: true },
  { href: "/supplier/products", label: "Inventory", icon: Stack },
  { href: "/supplier/orders", label: "Orders", icon: Package },
  { href: "/supplier/profile", label: "Business profile", icon: UserCircle },
];

/**
 * The supplier console is a working tool, not a storefront — so it gets a
 * persistent sidebar at ≥1024px (adaptive navigation) and a slide-over below
 * that, rather than the marketing header. Nav placement never changes between
 * pages here.
 */
export function ConsoleShell({
  children,
  businessName,
  pendingCount,
}: {
  children: React.ReactNode;
  businessName: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Supplier console" className="space-y-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[13.5px]",
              "transition-colors duration-200",
              active ? "bg-brand-soft font-medium text-brand-ink" : "text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <Icon size={17} weight={active ? "fill" : "light"} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/supplier/orders" && pendingCount > 0 ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 font-mono text-[10px] font-medium text-white">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* ------------------------------------------------------- desktop rail */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-canvas-veil lg:flex lg:flex-col">
        <div className="border-b border-line px-5 py-4">
          <Logo size="sm" />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="eyebrow px-3 pt-2 pb-3 text-subtle">Console</p>
          {nav}
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-mono text-[11px] font-medium text-white">
              {initials(businessName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">{businessName}</span>
              <span className="block text-[10.5px] text-subtle">Supplier account</span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <Link
              href="/marketplace"
              className="flex min-h-9 flex-1 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-[12.5px] text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <Storefront size={14} weight="light" />
              View marketplace
            </Link>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-3 text-[12.5px] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <SignOut size={14} weight="light" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-15 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl lg:hidden">
          <Logo size="sm" showWordmark={false} />
          <span className="truncate text-[14px] font-medium text-ink">{businessName}</span>
          <div className="flex-1" />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open console menu"
            className="relative grid size-10 cursor-pointer place-items-center rounded-full text-ink transition-colors hover:bg-sunken"
          >
            <ListIcon size={19} weight="light" />
            {pendingCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-canvas" />
            ) : null}
          </button>
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/* ------------------------------------------------------------- drawer */}
      <AnimatePresence>
        {menuOpen ? (
          <div className="fixed inset-0 z-80 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-default bg-[#191713]/45 backdrop-blur-[2px]"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Console menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 right-0 flex w-72 flex-col border-l border-line bg-surface"
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
                <span className="text-[14px] font-medium text-ink">Console</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close"
                  className="grid size-9 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
                >
                  <X size={15} weight="bold" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{nav}</div>
              <div className="border-t border-line p-3">
                <Link
                  href="/marketplace"
                  className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-ink"
                >
                  <Storefront size={15} weight="light" />
                  View marketplace
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-[13px] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <SignOut size={15} weight="light" />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
