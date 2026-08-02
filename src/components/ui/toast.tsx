"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle, Info, Warning, WarningOctagon, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  /** Optional single recovery action — "Undo", "Retry", "View order". */
  action?: { label: string; onClick: () => void };
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: ToastTone };

const ToastContext = createContext<{
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle size={18} weight="fill" className="text-positive" />,
  error: <WarningOctagon size={18} weight="fill" className="text-danger" />,
  warning: <Warning size={18} weight="fill" className="text-warn" />,
  info: <Info size={18} weight="fill" className="text-info" />,
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter;
      const next: Toast = { tone: "info", ...input, id };
      setToasts((prev) => [...prev.slice(-2), next]);
      // Errors persist longer — the user needs time to read the recovery path.
      const ttl = next.tone === "error" ? 7000 : next.action ? 6000 : 4000;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* polite, not assertive — toasts announce without stealing focus */}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-90 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3",
                "rounded-[var(--radius-md)] border border-line bg-surface p-3.5",
                "shadow-[var(--shadow-lg)]",
              )}
            >
              <span className="mt-px shrink-0">{icons[t.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug font-medium text-ink">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">{t.description}</p>
                ) : null}
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 cursor-pointer text-[12px] font-medium text-brand-ink underline underline-offset-4 hover:text-brand-hover"
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={13} weight="bold" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
