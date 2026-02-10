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
import { TokenErrorPage } from "@/components/session/TokenErrorPage";
import { usePlayerAuth } from "@/hooks/usePlayerAuth";
import { SITE_URL } from "@/lib/convexHttp";
import { Check, Lock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/vote/$token")({
  component: PlayerVotingPage,
});

// Union type for all known voting error codes
type VotingErrorCode =
  | "NOT_YOUR_TURN"
  | "MAP_UNAVAILABLE"
  | "SESSION_NOT_IN_PROGRESS"
  | "ALREADY_VOTED"
  | "IP_MISMATCH"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "FORMAT_NOT_ABBA"
  | "FORMAT_NOT_MULTIPLAYER"
  | "INVALID_REQUEST"
  | "INVALID_IP";

// Map backend error codes to user-friendly messages
function getVotingErrorMessage(error: VotingErrorCode): string {
  switch (error) {
    case "NOT_YOUR_TURN":
      return "It's not your turn";
    case "MAP_UNAVAILABLE":
      return "This map is no longer available";
    case "SESSION_NOT_IN_PROGRESS":
      return "Session is no longer active";
    case "ALREADY_VOTED":
      return "You already voted this round";
    case "IP_MISMATCH":
      return "Session is locked to another device";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "Your session has expired. Please refresh.";
    case "SESSION_NOT_FOUND":
      return "Session not found. It may have been deleted.";
    case "FORMAT_NOT_ABBA":
    case "FORMAT_NOT_MULTIPLAYER":
      return "Invalid action for this session format";
    case "INVALID_REQUEST":
      return "Invalid request. Please refresh and try again.";
    case "INVALID_IP":
      return "Session is locked to another device";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Helper function to calculate remaining time from server timestamp
function calculateRemainingTime(
  turnTimerSeconds: number,
  timerStartedAt: number | undefined
): number {
  if (!timerStartedAt) return turnTimerSeconds;
  const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
  return Math.max(0, turnTimerSeconds - elapsed);
}

// Separate Timer component that calculates remaining time from server timestamp
function CountdownTimer({
  turnTimerSeconds,
  timerStartedAt,
  isActive,
}: {
  turnTimerSeconds: number;
  timerStartedAt: number | undefined;
  isActive: boolean;
}) {
  const [remaining, setRemaining] = useState(() =>
    calculateRemainingTime(turnTimerSeconds, timerStartedAt)
  );

  useEffect(() => {
    // Recalculate when timerStartedAt changes (e.g., new turn starts)
    setRemaining(calculateRemainingTime(turnTimerSeconds, timerStartedAt));
  }, [turnTimerSeconds, timerStartedAt]);

  useEffect(() => {
    if (!isActive || !timerStartedAt) return;

    const timer = setInterval(() => {
      setRemaining(calculateRemainingTime(turnTimerSeconds, timerStartedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timerStartedAt, turnTimerSeconds]);

  // Show placeholder when timer hasn't started
  if (!timerStartedAt) {
    return <span>--:--</span>;
  }

  return <span>0:{remaining.toString().padStart(2, "0")}</span>;
}

function PlayerVotingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  // Step 1: Validate token and lock IP via HTTP action
  const auth = usePlayerAuth(token);

  // Step 2: Subscribe to reactive session data (only after auth succeeds)
  const data = useQuery(
    api.sessions.getSessionByToken,
    auth.status === "authenticated" ? { token } : "skip"
  );

  const [pendingAction, setPendingAction] = useState<{
    _id: Id<"sessionMaps">;
    name: string;
    type: "ban" | "vote";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-redirect to results when session completes (hook before early returns)
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

  // Auto-dismiss dialog when the selected map is no longer available (e.g. opponent banned it)
  useEffect(() => {
    if (!pendingAction || data?.status !== "valid") return;
    const map = data.maps.find((m) => m._id === pendingAction._id);
    if (!map || map.state !== "AVAILABLE") {
      setPendingAction(null);
    }
  }, [data, pendingAction]);

  // Auto-dismiss dialog when turn expires (server flips isYourTurn to false)
  useEffect(() => {
    if (pendingAction && data?.status === "valid" && !data.isYourTurn) {
      setPendingAction(null);
    }
  }, [data, pendingAction]);

  // Auth loading
  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auth error
  if (auth.status === "error") {
    return <TokenErrorPage error={auth.error ?? "INVALID_TOKEN"} />;
  }

  // Loading state (waiting for reactive query after auth)
  if (data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error states from reactive query
  if (data.status === "error") {
    // TOKEN_NOT_ACTIVATED is a transient state while the token is being activated.
    // Show a loading spinner instead of an error page.
    if (data.error === "TOKEN_NOT_ACTIVATED") {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return <TokenErrorPage error={data.error} />;
  }

  const { player, session, maps, otherPlayers, isYourTurn } = data;

  // Combine players for display purposes
  const allPlayers = [player, ...otherPlayers];

  // Get opponent team name
  const opponentTeam =
    otherPlayers.length > 0 ? otherPlayers[0].teamName : "Opponent";

  // Build ban steps for progress tracker (ABBA format)
  // Note: This is for display only. Turn detection is server-authoritative via isYourTurn.
  // Pattern shows alternating teams: Team A, Team B, Team B, Team A
  const banSteps =
    session.format === "ABBA"
      ? [0, 1, 1, 0].map((pIndex, stepIndex) => ({
          step: stepIndex + 1,
          team: pIndex === 0 ? player.teamName : opponentTeam,
          completed: stepIndex < session.currentTurn,
        }))
      : [];

  const currentStep = banSteps.findIndex((step) => !step.completed);

  const handleMapClick = (mapId: Id<"sessionMaps">, mapName: string) => {
    if (!isYourTurn || isSubmitting) return;

    setPendingAction({
      _id: mapId,
      name: mapName,
      type: session.format === "ABBA" ? "ban" : "vote",
    });
  };

  const submitAction = async () => {
    if (!pendingAction || isSubmitting) return;

    const endpoint =
      pendingAction.type === "ban"
        ? "/api/player/submit-ban"
        : "/api/player/submit-vote";

    setIsSubmitting(true);
    try {
      const res = await fetch(`${SITE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mapId: pendingAction._id }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        toast.error("Server error. Please try again.");
        return;
      }

      const result: { status: string; error?: string } = await res.json();

      if (result.status === "ok") {
        setPendingAction(null);
      } else {
        toast.error(getVotingErrorMessage((result.error ?? "") as VotingErrorCode));
      }
    } catch (error) {
      console.error("Vote submission failed:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
              turnTimerSeconds={session.turnTimerSeconds}
              timerStartedAt={session.timerStartedAt}
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
              const isMyVote =
                map._id === data.playerVotedMapId &&
                map.state === "AVAILABLE";

              return (
                <Card
                  key={map._id}
                  className={`overflow-hidden transition-all duration-200 relative group ${
                    map.state === "AVAILABLE" && isYourTurn && !isSubmitting
                      ? "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/20 active:ring-2 active:ring-primary"
                      : ""
                  } ${isMyVote ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/20" : ""} ${map.state === "BANNED" ? "opacity-60" : ""} ${
                    isSubmitting ? "pointer-events-none opacity-80" : ""
                  }`}
                  onClick={() => {
                    if (map.state === "AVAILABLE" && isYourTurn && !isSubmitting) {
                      handleMapClick(map._id, map.name);
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
                    {isMyVote && (
                      <div className="text-xs text-center text-amber-400 mt-1">
                        Your vote
                      </div>
                    )}
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
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground max-w-6xl mx-auto">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Session locked to your device</span>
        </div>
      </footer>

      {/* Confirmation Dialog (Ban / Vote) */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) =>
          !open && !isSubmitting && setPendingAction(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "ban" ? "Confirm Ban" : "Confirm Vote"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "ban"
                ? "Are you sure you want to ban "
                : "Vote to eliminate "}
              <span className="font-semibold text-foreground">
                {pendingAction?.name}
              </span>
              {pendingAction?.type === "ban"
                ? "? This action cannot be undone."
                : "? This cannot be changed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submitAction}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {pendingAction?.type === "ban" ? "Banning..." : "Voting..."}
                </>
              ) : pendingAction?.type === "ban" ? (
                "Confirm Ban"
              ) : (
                "Confirm Vote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
