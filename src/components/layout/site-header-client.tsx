"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CaretDown,
  Handbag,
  MagnifyingGlass,
  SignOut,
  Storefront,
  User as UserIcon,
} from "@phosphor-icons/react";

import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/system/theme-toggle";

type Category = { name: string; slug: string; blurb: string; accentHex: string };
type SessionUser = { name: string; email: string; role: "BUYER" | "SUPPLIER"; onboarded: boolean };

export function HeaderClient({
  floating,
  cartCount,
  categories,
  user,
}: {
  floating: boolean;
  cartCount: number;
  categories: Category[];
  user: SessionUser | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  // Passive listener + a boolean threshold: this fires at most twice per
  // scroll gesture rather than on every frame.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setCatsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const solid = !floating || scrolled;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-60 w-full",
          "transition-[background-color,border-color,box-shadow] duration-500 ease-[var(--ease-out-expo)]",
          solid
            ? "border-b border-line bg-canvas/85 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/70"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:h-18 sm:gap-5 sm:px-6 lg:px-10">
          <Logo />

          {/* ------------------------------- desktop nav ------------------------------ */}
          <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 lg:flex">
            <NavLink href="/marketplace" active={pathname === "/marketplace"}>
              Marketplace
            </NavLink>

            <div
              className="relative"
              onMouseEnter={() => setCatsOpen(true)}
              onMouseLeave={() => setCatsOpen(false)}
            >
              <button
                type="button"
                aria-expanded={catsOpen}
                aria-haspopup="true"
                onClick={() => setCatsOpen((v) => !v)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium",
                  "transition-colors duration-200 hover:bg-sunken",
                  catsOpen ? "text-ink" : "text-muted",
                )}
              >
                Categories
                <CaretDown
                  size={11}
                  weight="bold"
                  className={cn("transition-transform duration-300", catsOpen && "rotate-180")}
                />
              </button>

              <AnimatePresence>
                {catsOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-0 pt-2"
                  >
                    <div className="grid w-[560px] grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-line bg-surface p-2 shadow-[var(--shadow-lg)]">
                      {categories.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/marketplace?category=${c.slug}`}
                          className="group flex items-start gap-3 rounded-[var(--radius-sm)] p-2.5 transition-colors hover:bg-sunken"
                        >
                          <span
                            aria-hidden
                            className="mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-surface"
                            style={{ backgroundColor: c.accentHex }}
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-ink">{c.name}</span>
                            <span className="mt-0.5 block truncate text-[12px] text-subtle">{c.blurb}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <NavLink href="/suppliers" active={pathname.startsWith("/suppliers")}>
              Suppliers
            </NavLink>
          </nav>

          <div className="flex-1" />

          {/* --------------------------------- actions -------------------------------- */}
          <Link
            href="/marketplace"
            aria-label="Search fabrics"
            className="hidden h-10 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 text-[13px] text-subtle transition-colors hover:border-line-strong hover:text-muted md:flex"
          >
            <MagnifyingGlass size={15} weight="light" />
            <span>Search fabrics…</span>
            <kbd className="ml-3 rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-subtle">
              /
            </kbd>
          </Link>

          <ThemeToggle className="hidden sm:grid" />

          {user?.role === "BUYER" || !user ? (
            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <Handbag size={19} weight="light" />
              {cartCount > 0 ? (
                <span className="absolute top-1 right-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] leading-4.5 font-medium text-white">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {user ? (
            <AccountMenu user={user} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" size="sm">
                Get started
              </ButtonLink>
            </div>
          )}

          {/* -------------------------- mobile hamburger morph ------------------------- */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink transition-colors hover:bg-sunken lg:hidden"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 rounded-full bg-current",
                  "transition-transform duration-400 ease-[var(--ease-spring)]",
                  menuOpen ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 rounded-full bg-current",
                  "transition-[opacity,width] duration-300",
                  menuOpen ? "top-1.5 w-0 opacity-0" : "top-1.5 w-3.5 opacity-100",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-5 rounded-full bg-current",
                  "transition-transform duration-400 ease-[var(--ease-spring)]",
                  menuOpen ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} user={user} />
    </>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-200",
        active ? "text-ink" : "text-muted hover:bg-sunken hover:text-ink",
      )}
    >
      {children}
      {active ? (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-3.5 -bottom-0.5 h-px bg-brand"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}
    </Link>
  );
}

function AccountMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function signOut() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const home = user.role === "BUYER" ? "/dashboard" : "/supplier";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 transition-colors hover:border-line-strong"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand font-mono text-[11px] font-medium text-white">
          {initials(user.name)}
        </span>
        <CaretDown
          size={10}
          weight="bold"
          className={cn("text-subtle transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.99, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full right-0 mt-2 w-60 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="border-b border-line px-4 py-3.5">
              <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-subtle">{user.email}</p>
              <p className="eyebrow mt-2 text-brand-ink">
                {user.role === "BUYER" ? "Buyer account" : "Supplier account"}
              </p>
            </div>
            <div className="p-1.5">
              <MenuItem href={home} icon={user.role === "BUYER" ? <UserIcon size={15} weight="light" /> : <Storefront size={15} weight="light" />}>
                {user.role === "BUYER" ? "My dashboard" : "Supplier console"}
              </MenuItem>
              {user.role === "BUYER" ? (
                <>
                  <MenuItem href="/orders" icon={<Handbag size={15} weight="light" />}>
                    My orders
                  </MenuItem>
                  <MenuItem href="/dashboard/profile" icon={<UserIcon size={15} weight="light" />}>
                    Profile & preferences
                  </MenuItem>
                </>
              ) : (
                <>
                  <MenuItem href="/supplier/products" icon={<Storefront size={15} weight="light" />}>
                    Inventory
                  </MenuItem>
                  <MenuItem href="/supplier/orders" icon={<Handbag size={15} weight="light" />}>
                    Orders
                  </MenuItem>
                </>
              )}
            </div>
            {/* Sign out sits below a divider — destructive-ish actions stay separated. */}
            <div className="border-t border-line p-1.5">
              <button
                type="button"
                onClick={signOut}
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <SignOut size={15} weight="light" />
                Sign out
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileMenu({
  open,
  onClose,
  categories,
  user,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  user: SessionUser | null;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 top-16 z-50 overflow-y-auto bg-canvas/95 backdrop-blur-2xl sm:top-18 lg:hidden"
        >
          <div className="mx-auto max-w-2xl px-5 py-8">
            <nav aria-label="Mobile" className="space-y-1">
              {[
                { href: "/marketplace", label: "Marketplace" },
                { href: "/suppliers", label: "Suppliers" },
                ...(user
                  ? [
                      user.role === "BUYER"
                        ? { href: "/dashboard", label: "My dashboard" }
                        : { href: "/supplier", label: "Supplier console" },
                      user.role === "BUYER"
                        ? { href: "/orders", label: "My orders" }
                        : { href: "/supplier/orders", label: "Orders" },
                    ]
                  : []),
              ].map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="block border-b border-line py-4 font-display text-2xl font-medium text-ink"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9"
            >
              <p className="eyebrow mb-3.5 text-subtle">Browse by category</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/marketplace?category=${c.slug}`}
                    onClick={onClose}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] text-muted"
                  >
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: c.accentHex }} />
                    {c.name}
                  </Link>
                ))}
              </div>
            </motion.div>

            {!user ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 flex flex-col gap-3"
              >
                <ButtonLink href="/register" size="lg" fullWidth onClick={onClose}>
                  Create an account
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg" fullWidth onClick={onClose}>
                  Sign in
                </ButtonLink>
              </motion.div>
            ) : null}

            <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
              <span className="text-[13px] text-subtle">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
