"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { ArrowRight, Check, Prohibit } from "@phosphor-icons/react";

import { STATUS_FLOW, STATUS_LABELS } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const NEXT_COPY: Partial<Record<OrderStatus, { cta: string; blurb: string }>> = {
  ACCEPTED: {
    cta: "Accept order",
    blurb: "Confirms you're holding the stock. The buyer sees the order move out of Pending immediately.",
  },
  PREPARING: {
    cta: "Start preparing",
    blurb: "Tells the buyer cutting and rolling is under way.",
  },
  READY_FOR_DISPATCH: {
    cta: "Mark ready",
    blurb: "The cloth is rolled, wrapped and labelled, waiting on a carrier.",
  },
  COMPLETED: {
    cta: "Mark completed",
    blurb: "Handed to the carrier. This closes the order — it can't be moved afterwards.",
  },
  CANCELLED: {
    cta: "Cancel order",
    blurb: "Returns every line's metres to your stock and closes the order. This can't be undone.",
  },
};

/**
 * The buttons offered are derived from the same adjacency map the API enforces,
 * so the UI can never present a transition the server would reject.
 */
export function OrderActions({
  reference,
  status,
  expectedReadyAt,
}: {
  reference: string;
  status: OrderStatus;
  expectedReadyAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [readyDate, setReadyDate] = useState(expectedReadyAt ? expectedReadyAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);

  const allowed = STATUS_FLOW[status];
  const forward = allowed.filter((s) => s !== "CANCELLED");
  const canCancel = allowed.includes("CANCELLED");

  async function apply() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/supplier/orders/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: target,
          note: note.trim() || undefined,
          expectedReadyAt:
            target === "ACCEPTED" && readyDate ? new Date(`${readyDate}T12:00:00Z`).toISOString() : undefined,
        }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not update the order.");

      toast({
        tone: "success",
        title: `${reference} → ${STATUS_LABELS[target]}`,
        description:
          target === "CANCELLED"
            ? "Stock has been returned to your inventory."
            : "The buyer's tracker has updated.",
      });
      setTarget(null);
      setNote("");
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Status not changed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (allowed.length === 0) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-line bg-canvas-veil px-3.5 py-3 text-[12.5px] leading-relaxed text-subtle">
        This order is {STATUS_LABELS[status].toLowerCase()} and can no longer be changed.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {forward.map((next) => (
          <Button
            key={next}
            onClick={() => setTarget(next)}
            trailingIcon={<ArrowRight size={13} weight="bold" />}
          >
            {NEXT_COPY[next]?.cta ?? STATUS_LABELS[next]}
          </Button>
        ))}
        {canCancel ? (
          <Button variant="danger" onClick={() => setTarget("CANCELLED")} icon={<Prohibit size={14} weight="light" />}>
            Cancel
          </Button>
        ) : null}
      </div>

      <Dialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target ? (NEXT_COPY[target]?.cta ?? STATUS_LABELS[target]) : ""}
        description={target ? NEXT_COPY[target]?.blurb : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Back
            </Button>
            <Button
              variant={target === "CANCELLED" ? "danger" : "primary"}
              onClick={apply}
              loading={busy}
              icon={busy ? undefined : <Check size={14} weight="bold" />}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {target === "ACCEPTED" ? (
            <Field
              label="Expected ready date"
              optional
              hint="Shown on the buyer's tracker. A realistic date here prevents most chase-up calls."
            >
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={readyDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setReadyDate(e.target.value)}
                />
              )}
            </Field>
          ) : null}

          <Field
            label="Note for the buyer"
            optional
            hint="Appears on their order timeline. Leave blank to use the default message."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  target === "CANCELLED"
                    ? "Loom capacity booked out through next month."
                    : "Cutting from lot 44B, shade approved against your reference."
                }
              />
            )}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
