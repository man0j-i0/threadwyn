"use client";

import Link from "next/link";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base = cn(
  "relative inline-flex cursor-pointer select-none items-center justify-center gap-2",
  "font-medium whitespace-nowrap rounded-full",
  "transition-[background-color,color,box-shadow,transform,border-color] duration-300 ease-[var(--ease-spring)]",
  "active:scale-[0.98]",
  "disabled:pointer-events-none disabled:opacity-45",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
);

const variants: Record<Variant, string> = {
  primary: cn(
    "bg-brand text-white shadow-[var(--shadow-sm)]",
    "hover:bg-brand-hover hover:shadow-[var(--shadow-md)]",
    "dark:text-[#08110d]",
  ),
  secondary: cn(
    "bg-surface text-ink border border-line shadow-[var(--shadow-xs)]",
    "hover:border-line-strong hover:bg-canvas-veil",
  ),
  outline: cn("border border-brand-line bg-transparent text-brand-ink", "hover:bg-brand-soft"),
  ghost: cn("text-muted hover:bg-sunken hover:text-ink"),
  accent: cn("bg-accent text-white shadow-[var(--shadow-sm)]", "hover:bg-accent-hover", "dark:text-[#1b0f09]"),
  danger: cn("bg-danger-soft text-danger border border-danger-line", "hover:bg-danger hover:text-white"),
};

const sizes: Record<Size, string> = {
  /* Every size clears the 44px touch target via min-h, even the small one. */
  sm: "h-9 min-h-9 px-3.5 text-[13px]",
  md: "h-11 min-h-11 px-5 text-sm",
  lg: "h-13 min-h-13 px-7 text-[15px]",
};

const iconWellSizes: Record<Size, string> = {
  sm: "size-6 -mr-1.5",
  md: "size-7 -mr-2.5",
  lg: "size-8 -mr-3.5",
};

const iconWellTone: Record<Variant, string> = {
  primary: "bg-white/15 dark:bg-black/15",
  accent: "bg-white/15 dark:bg-black/15",
  secondary: "bg-sunken",
  outline: "bg-brand-soft",
  ghost: "bg-sunken",
  danger: "bg-danger/10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Leading icon, rendered inline before the label. */
  icon?: React.ReactNode;
  /**
   * Trailing icon. Nested inside its own circular well flush with the button's
   * right padding, so it reads as a control within a control rather than a
   * glyph floating beside the text.
   */
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    trailingIcon,
    fullWidth,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button must stay in the a11y tree as "busy", not vanish.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", "group", className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {trailingIcon ? (
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full",
            "transition-transform duration-300 ease-[var(--ease-spring)]",
            "group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105",
            iconWellSizes[size],
            iconWellTone[variant],
          )}
        >
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});

export interface ButtonLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  fullWidth,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", "group", className)}
      {...props}
    >
      {icon}
      {children}
      {trailingIcon ? (
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full",
            "transition-transform duration-300 ease-[var(--ease-spring)]",
            "group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105",
            iconWellSizes[size],
            iconWellTone[variant],
          )}
        >
          {trailingIcon}
        </span>
      ) : null}
    </Link>
  );
}

/** Square icon-only control. Always requires an accessible label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: Variant;
    size?: Size;
  }
>(function IconButton({ className, label, variant = "ghost", size = "md", children, ...props }, ref) {
  const box = size === "sm" ? "size-9" : size === "lg" ? "size-12" : "size-11";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], box, "shrink-0 p-0", className)}
      {...props}
    >
      {children}
    </button>
  );
});
