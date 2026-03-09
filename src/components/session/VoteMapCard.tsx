import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X, Trophy, ShieldCheck } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

/** Delay between each card's elimination animation in multiplayer reveal */
const ELIMINATION_STAGGER_DELAY_MS = 150;

// ============================================================================
// Types
// ============================================================================

export interface VoteMapCardProps {
  map: {
    _id: Id<"sessionMaps">;
    name: string;
    imageUrl: string | null;
    state: string;
    bannedAtRound?: number;
    bannedByPlayerId?: Id<"sessionPlayers">;
    voteCount?: number;
  };
  isMyVote: boolean;
  isYourTurn: boolean;
  isSubmitting: boolean;
  isInteractive: boolean;
  isAnyReveal: boolean;
  justEliminated: boolean;
  justBanned: boolean;
  eliminationStaggerIndex?: number;
  survivor: boolean;
  winner: boolean;
  bannedByTeamName: string | undefined;
  onMapClick: (mapId: Id<"sessionMaps">, mapName: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function VoteMapCard({
  map,
  isMyVote,
  isYourTurn,
  isSubmitting,
  isInteractive,
  isAnyReveal,
  justEliminated,
  justBanned,
  eliminationStaggerIndex,
  survivor,
  winner,
  bannedByTeamName,
  onMapClick,
}: VoteMapCardProps) {
  const isClickable =
    isInteractive &&
    isYourTurn &&
    map.state === "AVAILABLE" &&
    !isSubmitting;

  const isBanned = map.state === "BANNED";
  const isAnimating = justBanned || justEliminated;

  return (
    <Card
      className={cn(
        "overflow-hidden relative group",
        "motion-safe:transition-[box-shadow,opacity] motion-safe:duration-200",
        // Normal voting styles
        !isAnyReveal &&
          isClickable &&
          "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/20 active:ring-2 active:ring-primary",
        !isAnyReveal &&
          isMyVote &&
          "ring-2 ring-amber-400 shadow-lg shadow-amber-400/20",
        !isAnyReveal &&
          isBanned &&
          !justBanned &&
          "opacity-60",
        !isAnyReveal &&
          isSubmitting &&
          "pointer-events-none opacity-80",
        // ABBA ban: animate opacity down during ban transition
        justBanned &&
          "motion-safe:transition-[box-shadow,opacity] motion-safe:duration-500 motion-safe:ease-out opacity-60",
        // Reveal styles
        justEliminated &&
          "ring-2 ring-red-500/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
        survivor &&
          "ring-2 ring-green-500/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
        // Winner: amber ring + pulse animation
        winner && [
          "ring-2 ring-amber-400 motion-safe:animate-winner-pulse motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
          "motion-reduce:shadow-lg motion-reduce:shadow-amber-400/30",
        ]
      )}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={
        isClickable ? `Ban ${map.name}` :
        winner ? `Winner: ${map.name}` :
        isBanned ? `${map.name} - Banned` :
        justEliminated ? `${map.name} - Eliminated` :
        map.name
      }
      data-animation-state={
        justBanned ? "banning" :
        justEliminated ? "eliminating" :
        winner ? "winning" :
        isBanned ? "banned" :
        "idle"
      }
      onClick={() => {
        if (isClickable) {
          onMapClick(map._id, map.name);
        }
      }}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onMapClick(map._id, map.name);
        }
      }}
    >
      <div className="aspect-video relative overflow-hidden">
        <img
          src={map.imageUrl || "/placeholder.svg"}
          alt={map.name}
          className={cn(
            "w-full h-full object-cover",
            // Narrowed transition to GPU-friendly properties
            "motion-safe:transition-[filter,opacity] motion-safe:ease-out",
            justBanned && "motion-safe:duration-500",
            justEliminated && "motion-safe:duration-[800ms]",
            !isAnimating && "motion-safe:duration-200",
            // Grayscale states (CSS transition animates the change)
            isBanned && "grayscale",
            justEliminated && "grayscale brightness-50",
          )}
          style={
            justEliminated && eliminationStaggerIndex !== undefined
              ? { transitionDelay: `${eliminationStaggerIndex * ELIMINATION_STAGGER_DELAY_MS}ms` }
              : undefined
          }
        />

        {/* Just Eliminated Overlay (multiplayer reveal) */}
        {justEliminated && (
          <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <X
              className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-red-500 motion-safe:animate-stamp-in"
              style={
                eliminationStaggerIndex !== undefined
                  ? { animationDelay: `${eliminationStaggerIndex * ELIMINATION_STAGGER_DELAY_MS}ms` }
                  : undefined
              }
              strokeWidth={3}
            />
          </div>
        )}

        {/* Standard Banned Overlay (non-reveal) — animated on justBanned */}
        {isBanned && !justEliminated && (
          <div
            className={cn(
              "absolute inset-0 bg-black/60 flex items-center justify-center",
              justBanned && "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            )}
          >
            <X
              className={cn(
                "w-16 h-16 text-red-600",
                justBanned && "motion-safe:animate-stamp-in"
              )}
              strokeWidth={4}
            />
          </div>
        )}

        {/* Survivor Badge (reveal) */}
        {survivor && (
          <div className="absolute top-2 right-2 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-500 motion-safe:delay-300">
            <Badge className="bg-green-600 text-white border-green-500 gap-1">
              <ShieldCheck className="w-3 h-3" />
              Safe
            </Badge>
          </div>
        )}

        {/* Winner Map Overlay */}
        {winner && (
          <div className="absolute inset-0 bg-amber-500/20 flex flex-col items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-amber-400 motion-safe:animate-stamp-in" />
            <Badge className="mt-2 bg-amber-500 text-white border-amber-400 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-200">
              WINNER
            </Badge>
          </div>
        )}

        {/* Winner Overlay (ABBA / non-reveal) */}
        {map.state === "WINNER" && !winner && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Check
              className="w-16 h-16 text-primary"
              strokeWidth={4}
            />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="font-semibold text-center">
          {map.name}
        </div>
        {!isAnyReveal && isMyVote && (
          <div className="text-xs text-center text-amber-400 mt-1">
            Your ban
          </div>
        )}
        {isBanned &&
          !justEliminated &&
          bannedByTeamName && (
            <div className="text-xs text-center text-muted-foreground mt-1">
              Banned by {bannedByTeamName}
            </div>
          )}
        {justEliminated && map.voteCount !== undefined && (
          <div className="text-xs text-center text-red-400 mt-1">
            Eliminated ({map.voteCount}{" "}
            {map.voteCount === 1 ? "vote" : "votes"})
          </div>
        )}
      </div>
    </Card>
  );
}
