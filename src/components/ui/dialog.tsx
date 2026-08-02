"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Modal surface. Handles the four things hand-rolled dialogs usually miss:
 * escape-to-close, scroll lock, focus trapping, and returning focus to the
 * trigger on close. On mobile it becomes a bottom sheet with a grab handle.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusables() {
      return Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    }

    // Move focus into the dialog so screen readers start reading it.
    const raf = requestAnimationFrame(() => (focusables()[0] ?? panelRef.current)?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const widths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  }[size];

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-80 flex items-end justify-center sm:items-center sm:p-6">
          {/* Scrim strong enough to isolate the panel; blur is fine here — fixed layer. */}
          <motion.button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-default bg-[#191713]/45 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface",
              "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]",
              "border border-line shadow-[var(--shadow-xl)]",
              widths,
              className,
            )}
          >
            {/* grab handle — mobile affordance for swipe-to-dismiss expectation */}
            <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong sm:hidden" />

            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-snug font-medium text-ink">{title}</h2>
                {description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-subtle">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-1.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>

            {footer ? (
              <div className="flex items-center justify-end gap-3 border-t border-line bg-canvas-veil px-5 py-4 sm:px-6">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Side drawer. Used for filters on mobile and the cart on every breakpoint.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-80">
          <motion.button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-default bg-[#191713]/40 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={cn(
              "absolute inset-y-0 flex w-full max-w-md flex-col bg-surface shadow-[var(--shadow-xl)]",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
              "border-line",
              className,
            )}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-1.5 grid size-9 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="border-t border-line bg-canvas-veil p-5">{footer}</div> : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
