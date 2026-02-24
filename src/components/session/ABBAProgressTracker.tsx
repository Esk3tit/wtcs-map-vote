import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { RoundHistoryEntry, MapInfo } from "./types";

interface BanStep {
  step: number;
  team: string;
  completed: boolean;
}

interface ABBAProgressTrackerProps {
  banSteps: BanStep[];
  currentStep: number;
  roundHistory: RoundHistoryEntry[];
  maps: MapInfo[];
}

/**
 * ABBA format progress tracker showing 4-turn ban sequence.
 * Completed turns display team name, banned map thumbnail, and map name.
 * Current turn has a pulsing indicator. Vertical on mobile, horizontal on desktop.
 */
export function ABBAProgressTracker({
  banSteps,
  currentStep,
  roundHistory,
  maps,
}: ABBAProgressTrackerProps) {
  // Build a lookup: round number -> banned map info (round = turn + 1 for ABBA)
  const banByRound = new Map<
    number,
    { mapName: string; imageUrl: string }
  >();
  for (const entry of roundHistory) {
    const ban = entry.bans[0]; // ABBA has exactly 1 ban per round
    if (ban) {
      const mapData = maps.find((m) => m._id === ban.mapId);
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
            <div key={index} className="flex items-start flex-1">
              <div className="flex flex-col items-center min-w-0">
                {/* Step circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 flex-shrink-0",
                    step.completed
                      ? "bg-primary border-primary"
                      : currentStep === index
                        ? "bg-primary/20 border-primary animate-pulse"
                        : "bg-muted border-border"
                  )}
                >
                  {step.completed ? (
                    <Check className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <span
                      className={
                        currentStep === index
                          ? "text-primary font-bold"
                          : "text-muted-foreground"
                      }
                    >
                      {step.step}
                    </span>
                  )}
                </div>
                {/* Team name */}
                <span
                  className={cn(
                    "text-sm text-center",
                    currentStep === index
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {step.team}
                </span>
                {currentStep === index && !step.completed && (
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
            <div key={index} className="flex items-center gap-3">
              {/* Step circle + connecting line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0",
                    step.completed
                      ? "bg-primary border-primary"
                      : currentStep === index
                        ? "bg-primary/20 border-primary animate-pulse"
                        : "bg-muted border-border"
                  )}
                >
                  {step.completed ? (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  ) : (
                    <span
                      className={cn(
                        "text-sm",
                        currentStep === index
                          ? "text-primary font-bold"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.step}
                    </span>
                  )}
                </div>
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
                    currentStep === index
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
                {currentStep === index && !step.completed && (
                  <Badge variant="outline" className="text-xs animate-pulse">
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
