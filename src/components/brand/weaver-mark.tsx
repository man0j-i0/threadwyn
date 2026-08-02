import { cn } from "@/lib/utils";

type Mood = "empty" | "search" | "error" | "done" | "thinking";

/**
 * "The Weavers" — the brand characters. Deliberately abstract: a loom shuttle
 * and its thread, never a cartoon face. The thread's state carries the message,
 * so the same mark can hold four different moments without becoming clutter.
 */
export function WeaverMark({ mood = "empty", className }: { mood?: Mood; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden
      className={cn("text-brand", className)}
    >
      {/* warp threads — the loom the shuttle passes through */}
      <g stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.25" strokeLinecap="round">
        {[24, 34, 44, 54, 64, 74].map((x) => (
          <line key={x} x1={x} y1="14" x2={x} y2="82" />
        ))}
      </g>

      {/* woven weft — how far the cloth has been made */}
      <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeOpacity="0.4">
        {mood === "done"
          ? [26, 33, 40, 47, 54, 61, 68].map((y) => <line key={y} x1="22" y1={y} x2="76" y2={y} />)
          : [26, 33, 40].map((y) => <line key={y} x1="22" y1={y} x2="76" y2={y} />)}
      </g>

      {/* the shuttle */}
      <g transform={mood === "error" ? "translate(0,4) rotate(-8 48 52)" : undefined}>
        <path
          d="M28 52 Q48 42 68 52 Q48 62 28 52 Z"
          fill="var(--surface)"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="48" cy="52" r="3.25" fill="currentColor" fillOpacity="0.9" />
        <circle cx="38" cy="52" r="1.25" fill="currentColor" fillOpacity="0.35" />
        <circle cx="58" cy="52" r="1.25" fill="currentColor" fillOpacity="0.35" />
      </g>

      {/* the loose thread — this is what changes per mood */}
      {mood === "empty" ? (
        <path
          d="M68 52 C78 56 74 66 66 68 C58 70 60 78 68 80"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />
      ) : null}

      {mood === "search" ? (
        <>
          <circle
            cx="68"
            cy="68"
            r="9"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeOpacity="0.55"
            fill="var(--surface)"
          />
          <path
            d="M68 52 C74 55 72 58 68 59"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeOpacity="0.55"
          />
          <line
            x1="75"
            y1="75"
            x2="82"
            y2="82"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.55"
          />
        </>
      ) : null}

      {mood === "error" ? (
        <g className="text-danger" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M68 54 C73 58 71 62 68 64" strokeOpacity="0.75" />
          <path d="M74 70 C71 73 73 77 76 79" strokeOpacity="0.75" />
        </g>
      ) : null}

      {mood === "done" ? (
        <g className="text-positive">
          <circle cx="72" cy="74" r="11" fill="var(--surface)" />
          <circle cx="72" cy="74" r="9.5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M67.5 74.5l3 3 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}

      {mood === "thinking" ? (
        <g fill="currentColor" fillOpacity="0.5">
          <circle cx="64" cy="70" r="2">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0s" />
          </circle>
          <circle cx="72" cy="70" r="2">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
          </circle>
          <circle cx="80" cy="70" r="2">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
          </circle>
        </g>
      ) : null}
    </svg>
  );
}
