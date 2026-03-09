import { ChevronDown, X } from "lucide-react";
import type { RoundHistoryEntry, MapInfo } from "@/components/session/types";

interface RoundHistoryProps {
  roundHistory: RoundHistoryEntry[];
  maps: MapInfo[];
}

/**
 * Collapsible round history for MULTIPLAYER format.
 * Groups eliminated maps by round with thumbnails, names, and vote counts.
 */
export function RoundHistory({ roundHistory, maps }: RoundHistoryProps) {
  if (roundHistory.length === 0) return null;

  const totalBans = roundHistory.reduce(
    (sum, entry) => sum + entry.bans.length,
    0
  );

  // Build map image lookup
  const imageByMapId = new Map(
    maps.map((m) => [m._id, m.imageUrl])
  );

  return (
    <div className="max-w-6xl mx-auto mb-8">
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          <h3 className="text-sm text-muted-foreground">
            Round History
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {totalBans} eliminated
          </span>
        </summary>

        <div className="mt-3 space-y-4">
          {roundHistory.map((entry) => (
            <div key={entry.round}>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">
                Round {entry.round}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {entry.bans.map((ban) => {
                  const imageUrl = imageByMapId.get(ban.mapId) ?? "";
                  return (
                    <div
                      key={ban.mapId}
                      className="opacity-60 rounded-lg overflow-hidden border border-border/50 bg-card"
                    >
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={imageUrl || "/placeholder.svg"}
                          alt={ban.mapName}
                          className="w-full h-full object-cover grayscale"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <X
                            className="w-5 h-5 text-red-500"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      <div className="p-1.5">
                        <div className="text-xs text-center truncate text-muted-foreground">
                          {ban.mapName}
                        </div>
                        {ban.voteCount !== undefined && ban.voteCount > 0 && (
                          <div className="text-[10px] text-center text-muted-foreground/70">
                            {ban.voteCount}{" "}
                            {ban.voteCount === 1 ? "ban" : "bans"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
