import { cn } from "@/lib/utils";

const RADIUS = 28;
const STROKE_WIDTH = 4;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular countdown ring that depletes over `durationMs`.
 * Shows remaining seconds inside a hollow SVG circle.
 *
 * Receives `now` from the parent to avoid running a duplicate timer.
 */
export function ReadyCountdown({
  readyAt,
  durationMs,
  now,
  className,
}: {
  readyAt: number;
  durationMs: number;
  now: number;
  className?: string;
}) {
  const elapsed = now - readyAt;
  const remaining = Math.max(0, durationMs - elapsed);
  const remainingSeconds = Math.ceil(remaining / 1000);
  const fraction = remaining / durationMs; // 1 = full, 0 = empty
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="timer"
      aria-label={`Ready for ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-linear",
            fraction > 0.3 ? "text-green-500" : "text-amber-500"
          )}
        />
      </svg>
      {/* Centered seconds */}
      <span className="absolute text-sm font-bold tabular-nums text-foreground">
        {remainingSeconds}
      </span>
    </div>
  );
}
