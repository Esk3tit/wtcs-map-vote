import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, X, Loader2, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/results/$sessionId")({
  component: VotingResultsPage,
});

// Lightweight check for session ID - Convex IDs are opaque strings
const isValidSessionId = (id: string): boolean => {
  return typeof id === "string" && id.length > 0;
};

function VotingResultsPage() {
  const { sessionId } = Route.useParams();
  const isValidId = isValidSessionId(sessionId);
  const typedSessionId = sessionId as Id<"sessions">;

  const data = useQuery(
    api.sessions.getSessionResults,
    isValidId ? { sessionId: typedSessionId } : "skip"
  );

  // Invalid session ID format
  if (!isValidId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Session ID</h1>
          <p className="text-muted-foreground">
            The session ID in the URL is invalid.
          </p>
        </Card>
      </div>
    );
  }

  // Loading state
  if (data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error states
  if (data.status === "error") {
    return <ResultsErrorPage error={data.error} />;
  }

  const { session, teams, winnerMap, maps, banHistory } = data;

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{session.matchName}</h1>
          <p className="text-xl text-muted-foreground">
            {teams.length >= 2 ? `${teams[0]} vs ${teams[1]}` : teams.join(", ")}
          </p>
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
            <Trophy className="w-16 h-16 text-primary" />

            <Card className="overflow-hidden border-2 border-primary shadow-2xl shadow-primary/30 max-w-md w-full">
              <div className="aspect-video relative">
                <img
                  src={winnerMap.imageUrl || "/placeholder.svg"}
                  alt={winnerMap.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 text-center space-y-3">
                <h2 className="text-4xl font-bold">{winnerMap.name}</h2>
                <Badge className="bg-primary text-primary-foreground text-base px-4 py-1">
                  WINNER
                </Badge>
              </div>
            </Card>
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
          <Card className="p-6">
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
                  <div className="flex-1">
                    <span className="font-semibold text-foreground">
                      {ban.teamName}
                    </span>
                    <span className="text-muted-foreground"> banned </span>
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
          <h3 className="text-xl font-bold mb-4 text-center">Map Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {maps.map((map) => {
              const isBanned = map.state === "BANNED";
              const isWinner = map.state === "WINNER";

              return (
                <Card
                  key={map._id}
                  className={`overflow-hidden transition-all ${
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
