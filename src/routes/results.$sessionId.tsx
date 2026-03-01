import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSessionStatusRedirect } from "@/hooks/useSessionStatusRedirect";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Loader2, AlertTriangle, Clock } from "lucide-react";
import { TeamAvatar } from "@/components/session/team-avatar";

export const Route = createFileRoute("/results/$sessionId")({
  component: VotingResultsPage,
  validateSearch: (
    search: Record<string, unknown>
  ): { token?: string } => ({
    token:
      typeof search.token === "string" && /^[a-f0-9]{32}$/.test(search.token)
        ? search.token
        : undefined,
  }),
});

function VotingResultsPage() {
  const { sessionId } = Route.useParams();
  const { token } = Route.useSearch();
  const typedSessionId = sessionId as Id<"sessions">;

  const data = useQuery(api.sessions.getSessionResults, {
    sessionId: typedSessionId,
  });

  // Subscribe to session status for reset detection (only when token present)
  // Uses lightweight query — only fetches session ID and status, no maps/players/votes.
  const sessionData = useQuery(
    api.sessions.getSessionStatusByToken,
    token ? { token } : "skip"
  );

  // Auto-redirect to lobby on session reset (hook must be before early returns)
  const isRedirecting = useSessionStatusRedirect(
    sessionData,
    token,
    "results"
  );

  // Render guard: show spinner while redirect is in flight
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Loading state
  if (data === undefined) {
    return <ResultsPageSkeleton />;
  }

  // Error states
  if (data.status === "error") {
    return <ResultsErrorPage error={data.error} />;
  }

  const { session, teams, teamLogos, winnerMap, maps, banHistory } = data;

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{session.matchName}</h1>
          <div className="flex items-center justify-center gap-3 text-xl text-muted-foreground flex-wrap">
            {session.format === "ABBA" && teams.length === 2 ? (
              <>
                <TeamAvatar name={teams[0]} logoUrl={teamLogos[teams[0]]} />
                <span className="font-semibold">{teams[0]}</span>
                <span>vs</span>
                <TeamAvatar name={teams[1]} logoUrl={teamLogos[teams[1]]} />
                <span className="font-semibold">{teams[1]}</span>
              </>
            ) : (
              teams.map((team) => (
                <div key={team} className="flex items-center gap-2">
                  <TeamAvatar name={team} logoUrl={teamLogos[team]} size="sm" />
                  <span>{team}</span>
                </div>
              ))
            )}
          </div>
          <Badge
            variant="secondary"
            className="bg-green-950/50 text-green-400 border-green-600"
          >
            COMPLETE
          </Badge>
        </div>

        {/* Winner Showcase */}
        {winnerMap ? (
          <div className="flex flex-col items-center space-y-6">
            <Trophy className="w-16 h-16 text-primary motion-safe:animate-stamp-in" />

            <div
              className="max-w-md w-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500"
              style={{ animationDelay: "400ms" }}
            >
              <Card
                className="overflow-hidden border-2 border-primary shadow-2xl shadow-primary/30 motion-safe:animate-winner-pulse"
                style={{ animationDelay: "800ms" }}
              >
                <div className="aspect-video relative">
                  <img
                    src={winnerMap.imageUrl || "/placeholder.svg"}
                    alt={winnerMap.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="p-6 text-center space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-300"
                  style={{ animationDelay: "600ms" }}
                >
                  <h2 className="text-4xl font-bold">{winnerMap.name}</h2>
                  <Badge className="bg-primary text-primary-foreground text-base px-4 py-1">
                    WINNER
                  </Badge>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">
              No winner determined yet
            </p>
          </div>
        )}

        {/* Ban History Section */}
        {banHistory.length > 0 && (
          <Card
            className="p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
            style={{ animationDelay: "1000ms" }}
          >
            <h3 className="text-2xl font-bold mb-6">Ban Order</h3>
            <div className="space-y-4">
              {banHistory.map((ban) => (
                <div
                  key={ban.order}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <span className="text-lg font-bold text-muted-foreground w-8">
                    {ban.order}.
                  </span>
                  <img
                    src={ban.mapImage || "/placeholder.svg"}
                    alt={ban.mapName}
                    className="w-16 h-10 object-cover rounded grayscale"
                  />
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <TeamAvatar
                      name={ban.teamName}
                      logoUrl={teamLogos[ban.teamName]}
                      size="sm"
                    />
                    <span className="font-semibold text-foreground">
                      {ban.teamName}
                    </span>
                    <span className="text-muted-foreground">banned</span>
                    <span className="font-semibold text-foreground">
                      {ban.mapName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Visual Map Summary */}
        <div>
          <h3
            className="text-xl font-bold mb-4 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            style={{ animationDelay: "1100ms" }}
          >
            Map Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {maps.map((map, index) => {
              const isBanned = map.state === "BANNED";
              const isWinner = map.state === "WINNER";

              return (
                <div
                  key={map._id}
                  className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  style={{ animationDelay: `${1200 + index * 50}ms` }}
                >
                  <Card
                    className={`overflow-hidden ${
                      isWinner
                        ? "border-2 border-primary ring-2 ring-primary/50"
                        : ""
                    } ${isBanned ? "opacity-60" : ""}`}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={map.imageUrl || "/placeholder.svg"}
                        alt={map.name}
                        className={`w-full h-full object-cover ${isBanned ? "grayscale" : ""}`}
                      />

                      {isBanned && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <X className="w-12 h-12 text-red-600" strokeWidth={4} />
                        </div>
                      )}

                      {isWinner && (
                        <div className="absolute top-2 right-2">
                          <Trophy className="w-6 h-6 text-primary" />
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      <div className="text-sm font-semibold text-center">
                        {map.name}
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground font-semibold">
            Session Complete
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background py-12 px-6 animate-pulse" aria-busy="true">
      <div role="status" aria-live="polite" className="sr-only">Loading results</div>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="h-9 w-72 bg-muted rounded mx-auto" />
          {/* Simplified 2-team placeholder — teams data isn't available during loading */}
          <div className="flex items-center justify-center gap-3">
            <div className="size-8 bg-muted rounded-full shrink-0" />
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-6 w-8 bg-muted rounded" />
            <div className="size-8 bg-muted rounded-full shrink-0" />
            <div className="h-6 w-24 bg-muted rounded" />
          </div>
          <div className="h-6 w-24 bg-muted rounded-full mx-auto" />
        </div>

        {/* Trophy + winner card */}
        <div className="flex flex-col items-center space-y-6">
          <div className="w-16 h-16 bg-muted rounded-full" />
          <div className="max-w-md w-full rounded-lg border-2 border-muted overflow-hidden">
            <div className="aspect-video bg-muted" />
            <div className="p-6 text-center space-y-3">
              <div className="h-10 w-48 bg-muted rounded mx-auto" />
              <div className="h-7 w-24 bg-muted rounded-full mx-auto" />
            </div>
          </div>
        </div>

        {/* Map summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border overflow-hidden">
              <div className="aspect-video bg-muted" />
              <div className="p-2">
                <div className="h-4 w-20 bg-muted rounded mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ResultsErrorCode = "SESSION_NOT_FOUND" | "SESSION_NOT_COMPLETE";

function ResultsErrorPage({ error }: { error: ResultsErrorCode }) {
  const errorMessages: Record<
    ResultsErrorCode,
    { title: string; message: string; icon: React.ReactNode }
  > = {
    SESSION_NOT_FOUND: {
      title: "Session Not Found",
      message:
        "The voting session could not be found. It may have been deleted.",
      icon: <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />,
    },
    SESSION_NOT_COMPLETE: {
      title: "Session In Progress",
      message:
        "This session has not finished yet. Results will be available once the voting is complete.",
      icon: <Clock className="h-12 w-12 text-primary mx-auto" />,
    },
  };

  const { title, message, icon } = errorMessages[error];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center space-y-4">
        {icon}
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
