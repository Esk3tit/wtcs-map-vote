import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { RoundHistoryEntry, MapInfo, BanStep } from "@/components/session/types";

interface ABBAProgressTrackerProps {
  banSteps: BanStep[];
  currentStepIndex: number;
  roundHistory: RoundHistoryEntry[];
  maps: MapInfo[];
}

function StepCircle({
  completed,
  isCurrent,
  stepNumber,
  size = "md",
}: {
  completed: boolean;
  isCurrent: boolean;
  stepNumber: number;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-10 h-10 mb-2";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div
      className={cn(
        sizeClasses,
        "rounded-full flex items-center justify-center border-2 flex-shrink-0",
        completed
          ? "bg-primary border-primary"
          : isCurrent
            ? "bg-primary/20 border-primary motion-safe:animate-pulse"
            : "bg-muted border-border"
      )}
    >
      {completed ? (
        <Check className={cn(iconSize, "text-primary-foreground")} />
      ) : (
        <span
          className={cn(
            size === "sm" && "text-sm",
            isCurrent ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          {stepNumber}
        </span>
      )}
    </div>
  );
}

/**
 * ABBA format progress tracker showing 4-turn ban sequence.
 * Completed turns display team name, banned map thumbnail, and map name.
 * Current turn has a pulsing indicator. Vertical on mobile, horizontal on desktop.
 */
export function ABBAProgressTracker({
  banSteps,
  currentStepIndex,
  roundHistory,
  maps,
}: ABBAProgressTrackerProps) {
  // Build a lookup: round number -> banned map info (round = turn + 1 for ABBA)
  const mapInfoById = new Map(maps.map((m) => [m._id, m]));
  const banByRound = new Map<
    number,
    { mapName: string; imageUrl: string }
  >();
  for (const entry of roundHistory) {
    const ban = entry.bans[0]; // ABBA has exactly 1 ban per round
    if (ban) {
      const mapData = mapInfoById.get(ban.mapId);
      banByRound.set(entry.round, {
        mapName: ban.mapName,
        imageUrl: mapData?.imageUrl ?? "",
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start justify-between">
        {banSteps.map((step, index) => {
          const banInfo = banByRound.get(step.step);
          return (
            <div key={step.step} className="flex items-start flex-1">
              <div className="flex flex-col items-center min-w-0">
                {/* Step circle */}
                <StepCircle
                  completed={step.completed}
                  isCurrent={currentStepIndex === index}
                  stepNumber={step.step}
                  size="md"
                />
                {/* Team name */}
                <span
                  className={cn(
                    "text-sm text-center",
                    currentStepIndex === index
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {step.team}
                </span>
                {currentStepIndex === index && !step.completed && (
                  <span className="sr-only">Current step</span>
                )}
                {/* Banned map info (completed steps only) */}
                {step.completed && banInfo && (
                  <div className="flex flex-col items-center mt-1.5 gap-1">
                    <div className="w-16 h-9 rounded overflow-hidden border border-border/50">
                      <img
                        src={banInfo.imageUrl || "/placeholder.svg"}
                        alt={banInfo.mapName}
                        className="w-full h-full object-cover grayscale opacity-60"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-20 text-center">
                      {banInfo.mapName}
                    </span>
                  </div>
                )}
              </div>
              {/* Connecting line */}
              {index < banSteps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 mt-5",
                    step.completed ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="flex sm:hidden flex-col gap-3">
        {banSteps.map((step, index) => {
          const banInfo = banByRound.get(step.step);
          return (
            <div key={step.step} className="flex items-center gap-3">
              {/* Step circle + connecting line */}
              <div className="flex flex-col items-center">
                <StepCircle
                  completed={step.completed}
                  isCurrent={currentStepIndex === index}
                  stepNumber={step.step}
                  size="sm"
                />
                {index < banSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-4 mt-1",
                      step.completed ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
              {/* Step content */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={cn(
                    "text-sm flex-shrink-0",
                    currentStepIndex === index
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {step.team}
                </span>
                {step.completed && banInfo && (
                  <>
                    <span className="text-muted-foreground text-xs">—</span>
                    <div className="w-10 h-6 rounded overflow-hidden border border-border/50 flex-shrink-0">
                      <img
                        src={banInfo.imageUrl || "/placeholder.svg"}
                        alt={banInfo.mapName}
                        className="w-full h-full object-cover grayscale opacity-60"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {banInfo.mapName}
                    </span>
                  </>
                )}
                {currentStepIndex === index && !step.completed && (
                  <Badge variant="outline" className="text-xs motion-safe:animate-pulse">
                    Current
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
