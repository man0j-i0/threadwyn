"use client";

import { forwardRef, useId } from "react";
import { CaretDown, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- shared */

const control = cn(
  "w-full rounded-[var(--radius-sm)] border bg-surface text-ink",
  "placeholder:text-subtle/70",
  "transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-expo)]",
  "focus:outline-none focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60",
  "read-only:bg-canvas-veil read-only:text-muted",
);

const controlSizing = "min-h-11 px-3.5 py-2.5 text-sm";

/**
 * Checkbox.
 *
 * The tick is a real SVG sibling, not a `background-image` arbitrary value.
 * The previous version encoded an inline SVG into a Tailwind class, and that
 * data URI contained literal spaces (`viewBox='0 0 16 16'`). Tailwind cannot
 * parse a space inside an arbitrary value, so the class was silently never
 * emitted and no checkbox anywhere in the app ever looked checked — the state
 * was correct, only invisible. Real geometry cannot fail that way.
 */
export function CheckboxControl({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      <input
        type="checkbox"
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px]",
          "border border-line-strong bg-surface",
          "transition-[background-color,border-color] duration-200",
          "checked:border-brand checked:bg-brand",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        className={cn(
          "pointer-events-none absolute size-3 scale-75 opacity-0",
          "transition-[opacity,transform] duration-200 ease-[var(--ease-spring)]",
          "peer-checked:scale-100 peer-checked:opacity-100",
        )}
      >
        <path
          d="M3.5 8.5l3 3 6-6"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const controlState = (invalid?: boolean) =>
  invalid
    ? "border-danger-line bg-danger-soft/40 focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]"
    : "border-line hover:border-line-strong focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]";

/* ----------------------------------------------------------------- Field */

export interface FieldProps {
  label: string;
  /** Persistent helper text. Never use the placeholder to carry instructions. */
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
    "aria-required"?: true;
  }) => React.ReactNode;
}

export function Field({ label, hint, error, required, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="text-[11px] font-normal text-subtle">optional</span> : null}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-[12px] leading-relaxed text-subtle">
          {hint}
        </p>
      ) : null}

      {error ? (
        /* role=alert so screen readers announce the failure immediately */
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[12px] leading-relaxed text-danger">
          <Warning size={13} weight="fill" className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Input */

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: string; suffix?: string }
>(function Input({ className, invalid, prefix, suffix, ...props }, ref) {
  if (prefix || suffix) {
    return (
      <div
        className={cn(
          "flex items-center rounded-[var(--radius-sm)] border bg-surface",
          "transition-[border-color,box-shadow] duration-200",
          "focus-within:shadow-[0_0_0_3px_var(--brand-soft)]",
          invalid
            ? "border-danger-line focus-within:border-danger"
            : "border-line hover:border-line-strong focus-within:border-brand",
          className,
        )}
      >
        {prefix ? (
          <span className="pl-3.5 font-mono text-[13px] text-subtle select-none">{prefix}</span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "min-h-11 w-full bg-transparent px-3 py-2.5 text-sm text-ink tnum",
            "placeholder:text-subtle/70 focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...props}
        />
        {suffix ? (
          <span className="pr-3.5 font-mono text-[13px] text-subtle select-none">{suffix}</span>
        ) : null}
      </div>
    );
  }
  return <input ref={ref} className={cn(control, controlSizing, controlState(invalid), className)} {...props} />;
});

/* -------------------------------------------------------------- Textarea */

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(control, "px-3.5 py-3 text-sm leading-relaxed", controlState(invalid), "resize-y", className)}
      {...props}
    />
  );
});

/* ---------------------------------------------------------------- Select */

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          control,
          controlSizing,
          controlState(invalid),
          "cursor-pointer appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        size={14}
        weight="bold"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-subtle"
      />
    </div>
  );
});

/* -------------------------------------------------------------- Checkbox */

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] p-2.5 -m-2.5",
        "transition-colors duration-200 hover:bg-sunken",
        className,
      )}
    >
      <CheckboxControl id={id} className="mt-0.5" {...props} />
      <span className="min-w-0">
        <span className="block text-[13px] leading-snug font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-relaxed text-subtle">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------- ChipGroup */

/**
 * Multi-select as tappable chips. Preferred over a multi-select box for
 * onboarding — every option stays visible, and each chip clears 44px.
 */
export function ChipGroup({
  options,
  value,
  onChange,
  columns,
  className,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: boolean;
  className?: string;
}) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <div className={cn(columns ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(o.value)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-left text-[13px]",
              "transition-[background-color,border-color,color] duration-200 ease-[var(--ease-out-expo)]",
              active
                ? "border-brand bg-brand-soft font-medium text-brand-ink"
                : "border-line bg-surface text-muted hover:border-line-strong hover:bg-canvas-veil",
            )}
          >
            {/* shape cue, not colour alone */}
            <span
              aria-hidden
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                active ? "border-brand bg-brand" : "border-line-strong",
              )}
            >
              {active ? <span className="size-1.5 rounded-full bg-surface" /> : null}
            </span>
            <span className="min-w-0">
              {o.label}
              {o.hint ? <span className="ml-1.5 text-[11px] text-subtle">{o.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
