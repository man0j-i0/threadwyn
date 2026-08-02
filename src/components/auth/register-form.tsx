"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeSlash, Storefront, User } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { registerSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

type Role = "BUYER" | "SUPPLIER";

const ROLES: { value: Role; title: string; body: string; icon: React.ReactNode }[] = [
  {
    value: "BUYER",
    title: "I'm sourcing fabric",
    body: "Browse mills, compare specs, order by the metre.",
    icon: <User size={18} weight="light" />,
  },
  {
    value: "SUPPLIER",
    title: "I'm selling fabric",
    body: "List your catalogue, manage stock, take orders.",
    icon: <Storefront size={18} weight="light" />,
  },
];

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRole: Role = searchParams.get("role") === "supplier" ? "SUPPLIER" : "BUYER";
  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Validated on blur, not on keystroke — nobody wants to be told their email
  // is invalid while they're still typing the domain.
  function validateField(key: "name" | "email" | "password", value: string) {
    const result = registerSchema.shape[key].safeParse(value);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.success) delete next[key];
      else next[key] = result.error.issues[0]!.message;
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      document.getElementById(`register-${Object.keys(fieldErrors)[0]}`)?.focus();
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json()) as {
        data?: { next: string };
        error?: { message: string; fields?: Record<string, string> };
      };

      if (!res.ok) {
        if (body.error?.fields) setErrors(body.error.fields);
        setFormError(body.error?.message ?? "Could not create your account.");
        return;
      }

      router.push(body.data!.next);
      router.refresh();
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} noValidate className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-[13px] font-medium text-ink">Which side of the counter?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-md)] border p-4 text-left",
                    "transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]",
                    active
                      ? "border-brand bg-brand-soft shadow-[0_0_0_3px_var(--brand-soft)]"
                      : "border-line bg-surface hover:border-line-strong hover:bg-canvas-veil",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full border transition-colors",
                      active ? "border-brand bg-brand text-white" : "border-line bg-canvas-veil text-muted",
                    )}
                  >
                    {r.icon}
                  </span>
                  <span
                    className={cn("text-[13.5px] font-medium", active ? "text-brand-ink" : "text-ink")}
                  >
                    {r.title}
                  </span>
                  <span className="text-[12px] leading-relaxed text-subtle">{r.body}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {formError ? (
          <div role="alert" className="rounded-[var(--radius-sm)] border border-danger-line bg-danger-soft px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-danger">{formError}</p>
          </div>
        ) : null}

        <Field label="Full name" error={errors.name} required>
          {(props) => (
            <Input
              {...props}
              id="register-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => validateField("name", e.target.value)}
              placeholder="Anaya Rao"
              invalid={Boolean(errors.name)}
            />
          )}
        </Field>

        <Field label="Work email" error={errors.email} required>
          {(props) => (
            <Input
              {...props}
              id="register-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => validateField("email", e.target.value)}
              placeholder="you@company.com"
              invalid={Boolean(errors.email)}
            />
          )}
        </Field>

        <Field
          label="Password"
          hint="At least 8 characters."
          error={errors.password}
          required
        >
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                id="register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={(e) => validateField("password", e.target.value)}
                placeholder="••••••••"
                invalid={Boolean(errors.password)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
              >
                {showPassword ? <EyeSlash size={15} weight="light" /> : <Eye size={15} weight="light" />}
              </button>
            </div>
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy}
          trailingIcon={busy ? undefined : <ArrowRight size={13} weight="bold" />}
        >
          {busy ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-[12px] leading-relaxed text-subtle">
          Next you&apos;ll set up your profile — a short conversation, not a long form. It takes about a minute.
        </p>
      </form>
    </div>
  );
}
