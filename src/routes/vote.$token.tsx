import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Lock, Volume2, X, Loader2, AlertTriangle } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/vote/$token")({
  component: PlayerVotingPage,
});

// Separate Timer component that resets when key changes
function CountdownTimer({
  initialSeconds,
  isActive,
}: {
  initialSeconds: number;
  isActive: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  return (
    <span>
      0:{timeLeft.toString().padStart(2, "0")}
    </span>
  );
}

function PlayerVotingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const data = useQuery(api.sessions.getSessionByToken, { token });

  const [confirmBanMap, setConfirmBanMap] = useState<{
    _id: Id<"sessionMaps">;
    name: string;
  } | null>(null);

  // Auto-redirect to results when session completes
  useEffect(() => {
    if (data?.status === "valid") {
      const { session } = data;
      if (session.status === "COMPLETE") {
        navigate({
          to: "/results/$sessionId",
          params: { sessionId: session._id },
        });
      } else if (session.status === "DRAFT" || session.status === "WAITING") {
        navigate({ to: "/lobby/$token", params: { token } });
      }
    }
  }, [data, navigate, token]);

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
    return <TokenErrorPage error={data.error} />;
  }

  const { player, session, maps, otherPlayers } = data;

  // Calculate turn order for ABBA format
  // ABBA pattern: [0, 1, 1, 0] -> Player A, Player B, Player B, Player A
  const allPlayers = [player, ...otherPlayers];
  const playerIndex = 0; // Current player is always first in our array

  // Determine whose turn it is (simplified for 2-player ABBA)
  const abbaPattern = [0, 1, 1, 0]; // Indexes into allPlayers
  const currentTurnPlayerIndex =
    session.format === "ABBA"
      ? abbaPattern[session.currentTurn % abbaPattern.length]
      : null;
  const isYourTurn =
    session.format === "ABBA"
      ? currentTurnPlayerIndex === playerIndex
      : !player.hasVotedThisRound;

  // Get opponent team name
  const opponentTeam =
    otherPlayers.length > 0 ? otherPlayers[0].teamName : "Opponent";

  // Build ban steps for progress tracker (ABBA format)
  const banSteps =
    session.format === "ABBA"
      ? abbaPattern.map((pIndex, stepIndex) => ({
          step: stepIndex + 1,
          team: pIndex === playerIndex ? player.teamName : opponentTeam,
          completed: stepIndex < session.currentTurn,
        }))
      : [];

  const currentStep = banSteps.findIndex((step) => !step.completed);

  const handleBanMap = (mapId: Id<"sessionMaps">, mapName: string) => {
    if (!isYourTurn) return;
    setConfirmBanMap({ _id: mapId, name: mapName });
  };

  const confirmBan = () => {
    if (!confirmBanMap) return;

    // TODO: Call submitBan mutation (out of scope for WAR-11)
    // For now, just close the dialog
    console.log("Ban map:", confirmBanMap._id);
    setConfirmBanMap(null);
  };

  // Show paused state
  if (session.status === "PAUSED") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Session Paused</h1>
          <p className="text-muted-foreground">
            The admin has paused this session. Please wait for them to resume.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold">
              {session.matchName}
            </h1>
            <Badge variant="secondary" className="bg-muted text-xs sm:text-sm">
              {session.format === "ABBA" ? "ABBA Ban" : "Multiplayer Vote"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">You are:</span>
            <span className="font-bold text-foreground">{player.role}</span>
            <span className="text-muted-foreground">({player.teamName})</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        {/* Turn Status Section */}
        <div className="max-w-5xl mx-auto mb-8">
          <div
            className={`rounded-lg p-6 text-center mb-4 ${
              isYourTurn
                ? "bg-green-950/50 border-2 border-green-600"
                : "bg-muted border-2 border-border"
            }`}
          >
            <div className="text-2xl font-bold mb-2">
              {session.format === "ABBA"
                ? isYourTurn
                  ? "YOUR TURN TO BAN"
                  : `Waiting for ${opponentTeam} to ban...`
                : isYourTurn
                  ? "CAST YOUR VOTE"
                  : "Waiting for others to vote..."}
            </div>
          </div>

          <div
            className={`text-center mb-4 font-mono text-4xl sm:text-5xl md:text-7xl font-bold ${
              isYourTurn ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {/* Key resets the timer when turn changes */}
            <CountdownTimer
              key={`${session.currentTurn}-${session.currentRound}`}
              initialSeconds={session.turnTimerSeconds}
              isActive={session.status === "IN_PROGRESS"}
            />
          </div>

          {isYourTurn && (
            <p className="text-center text-muted-foreground text-lg">
              {session.format === "ABBA"
                ? "Select a map to ban"
                : "Select a map to vote for"}
            </p>
          )}
        </div>

        {/* Map Grid */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {maps.map((map) => {
              const bannedByPlayer = map.bannedByPlayerId
                ? allPlayers.find((p) => p._id === map.bannedByPlayerId)
                : null;

              return (
                <Card
                  key={map._id}
                  className={`overflow-hidden transition-all duration-200 relative group ${
                    map.state === "AVAILABLE" && isYourTurn
                      ? "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/20 active:ring-2 active:ring-primary"
                      : ""
                  } ${map.state === "BANNED" ? "opacity-60" : ""}`}
                  onClick={() => {
                    if (map.state === "AVAILABLE" && isYourTurn) {
                      handleBanMap(map._id, map.name);
                    }
                  }}
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={map.imageUrl || "/placeholder.svg"}
                      alt={map.name}
                      className={`w-full h-full object-cover ${map.state === "BANNED" ? "grayscale" : ""}`}
                    />

                    {/* Banned Overlay */}
                    {map.state === "BANNED" && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <X className="w-16 h-16 text-red-600" strokeWidth={4} />
                      </div>
                    )}

                    {/* Winner Overlay */}
                    {map.state === "WINNER" && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check
                          className="w-16 h-16 text-primary"
                          strokeWidth={4}
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="font-semibold text-center">{map.name}</div>
                    {map.state === "BANNED" && bannedByPlayer && (
                      <div className="text-xs text-center text-muted-foreground mt-1">
                        Banned by {bannedByPlayer.teamName}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Progress Tracker (ABBA format only) */}
        {session.format === "ABBA" && banSteps.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              {banSteps.map((step, index) => (
                <div key={index} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 ${
                        step.completed
                          ? "bg-primary border-primary"
                          : currentStep === index
                            ? "bg-primary/20 border-primary"
                            : "bg-muted border-border"
                      }`}
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
                    <span
                      className={`text-sm text-center ${
                        currentStep === index
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.team}
                    </span>
                  </div>
                  {index < banSteps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${step.completed ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multiplayer Vote Status */}
        {session.format === "MULTIPLAYER" && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-6 p-4 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">
                Round {session.currentRound}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      player.hasVotedThisRound
                        ? "bg-green-500"
                        : "bg-muted-foreground animate-pulse"
                    }`}
                  />
                  <span className="text-sm font-medium">{player.teamName}</span>
                  {player.hasVotedThisRound ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {otherPlayers.map((op) => (
                  <div key={op._id} className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        op.hasVotedThisRound
                          ? "bg-green-500"
                          : "bg-muted-foreground animate-pulse"
                      }`}
                    />
                    <span className="text-sm font-medium">{op.teamName}</span>
                    {op.hasVotedThisRound ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>Session locked to your device</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Volume2 className="w-4 h-4 flex-shrink-0" />
            <span>Audio alerts enabled</span>
          </div>
        </div>
      </footer>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmBanMap}
        onOpenChange={(open) => !open && setConfirmBanMap(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Ban</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to ban{" "}
              <span className="font-semibold text-foreground">
                {confirmBanMap?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TokenErrorPage({ error }: { error: string }) {
  const errorMessages: Record<string, { title: string; message: string }> = {
    INVALID_TOKEN: {
      title: "Invalid Access Code",
      message:
        "This access code is invalid or has been revoked. Please contact your tournament administrator for a new link.",
    },
    TOKEN_EXPIRED: {
      title: "Access Code Expired",
      message:
        "This access code has expired. Please request a new link from your tournament administrator.",
    },
    SESSION_NOT_FOUND: {
      title: "Session Not Found",
      message:
        "The voting session could not be found. It may have been deleted.",
    },
  };

  const { title, message } = errorMessages[error] ?? {
    title: "Error",
    message: "An unexpected error occurred.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
