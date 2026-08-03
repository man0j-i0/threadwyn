"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { CaretDown, CheckCircle, X } from "@phosphor-icons/react";

import { cn, formatMoney, titleCase } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export type Facets = {
  categories: { value: string; label: string; count: number; accentHex: string }[];
  suppliers: { value: string; label: string; count: number; city: string; verified: boolean }[];
  weaves: { value: string; label: string; count: number }[];
  fibres: { value: string; label: string; count: number }[];
  sustainability: { value: string; label: string; count: number }[];
  price: { min: number; max: number };
  gsm: { min: number; max: number };
};

/**
 * Every control writes to the URL and lets the server re-render. There is no
 * local filter state to fall out of sync, the back button behaves, and a
 * filtered view is a link someone can paste to a colleague.
 */
export function FilterPanel({ facets, onApplied }: { facets: Facets; onApplied?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Every control used to read straight from searchParams, which only updates
  // once the server has re-rendered. So a click produced no visible change for
  // a few hundred milliseconds and the box looked like it had not registered.
  // `draft` holds the intended state immediately; the URL catches up behind it.
  const [draft, setDraft] = useState<string | null>(null);
  const url = searchParams.toString();
  const [lastUrl, setLastUrl] = useState(url);
  if (lastUrl !== url) {
    setLastUrl(url);
    setDraft(null); // navigation landed — the URL is the truth again
  }

  const view = draft !== null ? new URLSearchParams(draft) : searchParams;

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(draft ?? searchParams.toString());
      mutate(params);
      // Any filter change invalidates the current page number.
      params.delete("page");

      setDraft(params.toString());
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        onApplied?.();
      });
    },
    [router, pathname, searchParams, draft, onApplied],
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      commit((params) => {
        const current = (params.get(key) ?? "").split(",").filter(Boolean);
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        if (next.length) params.set(key, next.join(","));
        else params.delete(key);
      });
    },
    [commit],
  );

  const setSingle = useCallback(
    (key: string, value: string | null) => {
      commit((params) => {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      });
    },
    [commit],
  );

  const isOn = (key: string, value: string) =>
    (view.get(key) ?? "").split(",").filter(Boolean).includes(value);

  return (
    <div className="relative space-y-1">
      {pending ? (
        <div className="pointer-events-none absolute -top-1 right-0 z-10">
          <Spinner className="size-4 text-brand" label="Applying filters" />
        </div>
      ) : null}

      <Group title="Availability" defaultOpen>
        <ToggleRow
          label="In stock only"
          hint="Hide fabrics awaiting a fresh lot"
          checked={view.get("inStock") === "1"}
          onChange={(on) => setSingle("inStock", on ? "1" : null)}
        />
        <ToggleRow
          label="Featured by the mill"
          checked={view.get("featured") === "1"}
          onChange={(on) => setSingle("featured", on ? "1" : null)}
        />
      </Group>

      <Group title="Category" defaultOpen count={facets.categories.length}>
        <div className="space-y-0.5">
          {facets.categories.map((c) => (
            <FacetRow
              key={c.value}
              label={c.label}
              count={c.count}
              checked={isOn("category", c.value)}
              onChange={() => toggleMulti("category", c.value)}
              swatch={c.accentHex}
            />
          ))}
        </div>
      </Group>

      <Group title="Price per metre" defaultOpen>
        <RangeInputs
          minKey="priceMin"
          maxKey="priceMax"
          bounds={facets.price}
          unit="₹"
          searchParams={view}
          onCommit={setSingle}
          presets={[
            { label: "Under ₹300", min: null, max: 300 },
            { label: "₹300–₹600", min: 300, max: 600 },
            { label: "₹600–₹1000", min: 600, max: 1000 },
            { label: "₹1000+", min: 1000, max: null },
          ]}
        />
      </Group>

      <Group title="Weight (gsm)">
        <RangeInputs
          minKey="gsmMin"
          maxKey="gsmMax"
          bounds={facets.gsm}
          unit=""
          searchParams={view}
          onCommit={setSingle}
          presets={[
            { label: "Light · ≤160", min: null, max: 160 },
            { label: "Mid · 160–280", min: 160, max: 280 },
            { label: "Heavy · 280+", min: 280, max: null },
          ]}
        />
      </Group>

      <Group title="Fibre" count={facets.fibres.length}>
        <div className="flex flex-wrap gap-1.5">
          {facets.fibres.map((f) => (
            <Chip
              key={f.value}
              label={titleCase(f.label)}
              count={f.count}
              active={isOn("fibre", f.value)}
              onClick={() => toggleMulti("fibre", f.value)}
            />
          ))}
        </div>
      </Group>

      <Group title="Weave" count={facets.weaves.length}>
        <div className="flex flex-wrap gap-1.5">
          {facets.weaves.map((w) => (
            <Chip
              key={w.value}
              label={titleCase(w.label)}
              count={w.count}
              active={isOn("weave", w.value)}
              onClick={() => toggleMulti("weave", w.value)}
            />
          ))}
        </div>
      </Group>

      <Group title="Certification" count={facets.sustainability.length}>
        <div className="space-y-0.5">
          {facets.sustainability.map((s) => (
            <FacetRow
              key={s.value}
              label={s.label}
              count={s.count}
              checked={isOn("sustainability", s.value)}
              onChange={() => toggleMulti("sustainability", s.value)}
            />
          ))}
        </div>
      </Group>

      <Group title="Mill" count={facets.suppliers.length}>
        <div className="space-y-0.5">
          {facets.suppliers.map((s) => (
            <FacetRow
              key={s.value}
              label={s.label}
              sublabel={s.city}
              count={s.count}
              checked={isOn("supplier", s.value)}
              onChange={() => toggleMulti("supplier", s.value)}
              verified={s.verified}
            />
          ))}
        </div>
      </Group>

      <Group title="Order terms">
        <div className="space-y-3.5 pt-1">
          <NumberField
            label="Max MOQ"
            suffix="m"
            value={view.get("moqMax") ?? ""}
            onCommit={(v) => setSingle("moqMax", v)}
            placeholder="Any"
          />
          <NumberField
            label="Min stock on hand"
            suffix="m"
            value={view.get("stockMin") ?? ""}
            onCommit={(v) => setSingle("stockMin", v)}
            placeholder="Any"
          />
          <NumberField
            label="Max lead time"
            suffix="days"
            value={view.get("leadTimeMax") ?? ""}
            onCommit={(v) => setSingle("leadTimeMax", v)}
            placeholder="Any"
          />
        </div>
      </Group>
    </div>
  );
}

/* -------------------------------------------------------------- fragments */

function Group({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-3.5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 py-1 text-left"
      >
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="flex items-center gap-2">
          {count != null ? <span className="font-mono text-[10.5px] text-subtle tnum">{count}</span> : null}
          <CaretDown
            size={11}
            weight="bold"
            className={cn("text-subtle transition-transform duration-300", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? <div className="pt-3">{children}</div> : null}
    </div>
  );
}

function FacetRow({
  label,
  sublabel,
  count,
  checked,
  onChange,
  swatch,
  verified,
}: {
  label: string;
  sublabel?: string;
  count: number;
  checked: boolean;
  onChange: () => void;
  swatch?: string;
  verified?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[var(--radius-xs)] px-2 py-1.5 -mx-2",
        "transition-colors duration-200 hover:bg-sunken",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={cn(
          "size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-surface",
          "transition-colors duration-200 checked:border-brand checked:bg-brand",
          "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6' stroke='white' stroke-width='2.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      />
      {swatch ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: swatch }} />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] text-muted">{label}</span>
          {verified ? <CheckCircle size={10} weight="fill" className="shrink-0 text-brass" /> : null}
        </span>
        {sublabel ? <span className="block truncate text-[10.5px] text-subtle">{sublabel}</span> : null}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-subtle tnum">{count}</span>
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[12.5px] text-muted">{label}</span>
        {hint ? <span className="mt-0.5 block text-[10.5px] text-subtle">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full",
          "transition-colors duration-300",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        {/* Pinned in pixels. The knob is 18px inside a 38px track with 2px of
            padding, so it travels exactly 16px and can never overhang an edge. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-[var(--shadow-sm)]",
            "transition-transform duration-300 ease-[var(--ease-spring)]",
            checked ? "translate-x-[16px]" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px]",
        "transition-[background-color,border-color,color] duration-200",
        active
          ? "border-brand bg-brand-soft font-medium text-brand-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:bg-canvas-veil",
      )}
    >
      {label}
      <span className="font-mono text-[10px] opacity-60 tnum">{count}</span>
    </button>
  );
}

function RangeInputs({
  minKey,
  maxKey,
  bounds,
  unit,
  searchParams,
  onCommit,
  presets,
}: {
  minKey: string;
  maxKey: string;
  bounds: { min: number; max: number };
  unit: string;
  searchParams: URLSearchParams;
  onCommit: (key: string, value: string | null) => void;
  presets: { label: string; min: number | null; max: number | null }[];
}) {
  const currentMin = searchParams.get(minKey);
  const currentMax = searchParams.get(maxKey);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = String(p.min ?? "") === (currentMin ?? "") && String(p.max ?? "") === (currentMax ?? "");
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onCommit(minKey, p.min == null ? null : String(p.min));
                onCommit(maxKey, p.max == null ? null : String(p.max));
              }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1.5 text-[11.5px] transition-colors duration-200",
                active
                  ? "border-brand bg-brand-soft font-medium text-brand-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:bg-canvas-veil",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <BoundInput
          aria-label={`Minimum ${unit === "₹" ? "price" : "weight"}`}
          placeholder={`${unit}${bounds.min}`}
          defaultValue={currentMin ?? ""}
          onCommit={(v) => onCommit(minKey, v)}
        />
        <span aria-hidden className="text-[11px] text-subtle">
          to
        </span>
        <BoundInput
          aria-label={`Maximum ${unit === "₹" ? "price" : "weight"}`}
          placeholder={`${unit}${bounds.max}`}
          defaultValue={currentMax ?? ""}
          onCommit={(v) => onCommit(maxKey, v)}
        />
      </div>
    </div>
  );
}

function BoundInput({
  defaultValue,
  placeholder,
  onCommit,
  ...props
}: {
  defaultValue: string;
  placeholder: string;
  onCommit: (value: string | null) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      key={defaultValue}
      type="number"
      inputMode="numeric"
      defaultValue={defaultValue}
      placeholder={placeholder}
      // Commit on blur or Enter, never per keystroke — otherwise every digit
      // fires a navigation and a query.
      onBlur={(e) => onCommit(e.target.value.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit((e.target as HTMLInputElement).value.trim() || null);
        }
      }}
      className="min-h-9 w-full min-w-0 rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink tnum placeholder:text-subtle/70 focus:border-brand focus:outline-none"
      {...props}
    />
  );
}

function NumberField({
  label,
  suffix,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  suffix: string;
  value: string;
  placeholder: string;
  onCommit: (value: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11.5px] text-muted">{label}</label>
      <div className="flex items-center rounded-[var(--radius-xs)] border border-line bg-surface focus-within:border-brand">
        <input
          key={value}
          type="number"
          inputMode="numeric"
          defaultValue={value}
          placeholder={placeholder}
          onBlur={(e) => onCommit(e.target.value.trim() || null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value.trim() || null);
            }
          }}
          className="min-h-9 w-full min-w-0 bg-transparent px-2.5 py-1.5 font-mono text-[12px] text-ink tnum placeholder:text-subtle/70 focus:outline-none"
        />
        <span className="pr-2.5 font-mono text-[11px] text-subtle">{suffix}</span>
      </div>
    </div>
  );
}

/** Removable chips for whatever is currently applied. */
export function ActiveFilters({
  chips,
  className,
}: {
  chips: { key: string; label: string; value: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (chips.length === 0) return null;

  function remove(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const multi = ["category", "fibre", "weave", "supplier", "sustainability"];
    if (multi.includes(key)) {
      const next = (params.get(key) ?? "").split(",").filter((v) => v && v !== value);
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c) => (
        <button
          key={`${c.key}-${c.value}`}
          type="button"
          onClick={() => remove(c.key, c.value)}
          className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft py-1 pr-2 pl-2.5 font-mono text-[11px] text-brand-ink transition-colors hover:border-danger-line hover:bg-danger-soft hover:text-danger"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label}
          <X size={9} weight="bold" className="opacity-50 group-hover:opacity-100" />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={clearAll}
          className="ml-1 cursor-pointer text-[11.5px] text-subtle underline underline-offset-4 transition-colors hover:text-ink"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

export { formatMoney };
