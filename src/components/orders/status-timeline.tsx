import { Check, Prohibit } from "@phosphor-icons/react/dist/ssr";
import type { OrderStatus } from "@prisma/client";

import { cn, formatDateTime } from "@/lib/utils";
import { STATUS_LABELS, STATUS_LADDER } from "@/lib/order-status";

type Event = { id: string; status: OrderStatus; note: string | null; actor: string; createdAt: string };

/**
 * The tracker shows the whole ladder, not just what has happened — so a buyer
 * can see what is still to come without having to know the process. Completed
 * stages carry a tick as well as a colour, which keeps the state readable in
 * greyscale and for colour-blind users.
 */
export function StatusTimeline({
  status,
  events,
  compact,
}: {
  status: OrderStatus;
  events: Event[];
  compact?: boolean;
}) {
  if (status === "CANCELLED") {
    const cancelledAt = events.find((e) => e.status === "CANCELLED");
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-danger-line bg-danger-soft p-4">
        <Prohibit size={17} weight="fill" className="mt-px shrink-0 text-danger" />
        <div>
          <p className="text-[13.5px] font-medium text-danger">Cancelled</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-danger/85">
            {cancelledAt?.note ?? "This order was cancelled and any reserved stock was returned."}
          </p>
          {cancelledAt ? (
            <p className="mt-1.5 font-mono text-[11px] text-danger/70">{formatDateTime(cancelledAt.createdAt)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_LADDER.indexOf(status);
  const eventByStatus = new Map(events.map((e) => [e.status, e]));

  return (
    <ol className={cn("relative", compact ? "space-y-3" : "space-y-5")}>
      {STATUS_LADDER.map((stage, i) => {
        const done = i < currentIndex;
        const isCurrent = i === currentIndex;
        const event = eventByStatus.get(stage);
        const reached = done || isCurrent;

        return (
          <li key={stage} className="relative flex gap-3.5">
            {/* connector */}
            {i < STATUS_LADDER.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-6 left-[11px] w-px",
                  compact ? "h-[calc(100%-0.25rem)]" : "h-[calc(100%+0.5rem)]",
                  done ? "bg-brand" : "bg-line",
                )}
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done
                  ? "border-brand bg-brand text-white"
                  : isCurrent
                    ? "border-brand bg-surface"
                    : "border-line bg-surface",
              )}
            >
              {done ? (
                <Check size={11} weight="bold" />
              ) : isCurrent ? (
                <span className="size-2 rounded-full bg-brand" />
              ) : null}
            </span>

            <div className={cn("min-w-0 flex-1", compact ? "pb-0" : "pb-1")}>
              <p
                className={cn(
                  "text-[13.5px] leading-tight",
                  reached ? "font-medium text-ink" : "text-subtle",
                )}
              >
                {STATUS_LABELS[stage]}
                {isCurrent ? (
                  <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-ink">
                    Current
                  </span>
                ) : null}
              </p>
              {event?.note ? (
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{event.note}</p>
              ) : !reached ? (
                <p className="mt-1 text-[12px] text-subtle">Not yet reached</p>
              ) : null}
              {event ? (
                <p className="mt-1 font-mono text-[10.5px] text-subtle">
                  {formatDateTime(event.createdAt)} · {event.actor}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
