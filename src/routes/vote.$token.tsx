import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { SessionEndedPage } from "@/components/session/SessionEndedPage";
import { CountdownTimer } from "@/components/session/CountdownTimer";
import { SessionPausedOverlay } from "@/components/session/SessionPausedOverlay";
import { DisconnectedOverlay } from "@/components/session/DisconnectedOverlay";
import { TurnFlashOverlay } from "@/components/session/TurnFlashOverlay";
import { VoteMapCard } from "@/components/session/VoteMapCard";
import {
  ConnectionStatusBadge,
  STATUS_CONFIG,
} from "@/components/session/ConnectionStatusBadge";
import { usePlayerAuth } from "@/hooks/usePlayerAuth";
import { useRevealPhase } from "@/hooks/useRevealPhase";
import { useSessionStatusRedirect } from "@/hooks/useSessionStatusRedirect";
import { SITE_URL } from "@/lib/convexHttp";
import { cn } from "@/lib/utils";
import { Check, Lock, X, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/vote/$token")({
  component: PlayerVotingPage,
});

// ============================================================================
// Voting Error Handling
// ============================================================================

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

// ============================================================================
// Component
// ============================================================================

function PlayerVotingPage() {
  const { token } = Route.useParams();

  // Track terminal session state (EXPIRED) to stop heartbeat and subscription.
  // Latches to true once detected — EXPIRED is a terminal state.
  const [sessionExpired, setSessionExpired] = useState(false);

  // Step 1: Validate token and lock IP via HTTP action
  const auth = usePlayerAuth(token, { sessionExpired });

  // Step 2: Subscribe to reactive session data (only after auth succeeds)
  // Keep subscription active during "reconnecting" and "disconnected" to maintain real-time data
  const data = useQuery(
    api.sessions.getSessionByToken,
    auth.isSubscriptionActive ? { token } : "skip"
  );

  const [pendingAction, setPendingAction] = useState<{
    _id: Id<"sessionMaps">;
    name: string;
    type: "ban" | "vote";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimisticVote, setOptimisticVote] = useState<{
    mapId: Id<"sessionMaps">;
    forRound: number;
  } | null>(null);

  // Derive session values
  const currentRound =
    data?.status === "valid" ? data.session.currentRound : undefined;
  const sessionStatus =
    data?.status === "valid" ? data.session.status : undefined;
  const sessionFormat =
    data?.status === "valid" ? data.session.format : undefined;
  const isPaused = sessionStatus === "PAUSED";
  const isMultiplayer = sessionFormat === "MULTIPLAYER";

  // Derive the effective optimistic ID synchronously during render.
  // When currentRound changes (e.g. deadlock revote), this evaluates to null
  // immediately — no effect needed.
  const optimisticVotedMapId =
    optimisticVote && optimisticVote.forRound === currentRound
      ? optimisticVote.mapId
      : null;

  // Round phase state machine (multiplayer reveal)
  const {
    phaseState,
    isRevealPhase,
    isWinnerReveal,
    isAnyReveal,
    revealData,
    remainingMs,
  } = useRevealPhase({
    currentRound,
    sessionStatus,
    maps: data?.status === "valid" ? data.maps : [],
    sessionWinnerMapId:
      data?.status === "valid" ? data.session.winnerMapId : undefined,
    isRevoteRound:
      data?.status === "valid" ? (data.session.isRevoteRound ?? false) : false,
    isMultiplayer,
    isPaused,
  });

  // Auto-redirect based on session status (suppressed during reveal phases)
  // By passing undefined during reveal, the hook's guard prevents it from firing.
  const redirectData =
    phaseState.phase === "REVEALING" ||
    phaseState.phase === "WINNER_REVEAL" ||
    // Suppress redirect while winner detection effect catches up (1-render gap)
    (isMultiplayer && sessionStatus === "COMPLETE" && phaseState.phase === "VOTING")
      ? undefined
      : data;
  const isRedirecting = useSessionStatusRedirect(redirectData, token, "vote");

  // Auto-dismiss confirmation dialog when the pending action is no longer valid.
  // Covers: map banned by opponent, turn expired, session paused, reveal phase, disconnect.
  // INVARIANT: AlertDialog renders via portal to document.body, escaping the
  // inert wrapper. This effect ensures the dialog is dismissed when paused or
  // disconnected, since the portal cannot be blocked by the inert attribute.
  useEffect(() => {
    if (!pendingAction) return;

    // Dismiss immediately on disconnect — prevents stale vote submission through portal
    if (auth.status === "reconnecting" || auth.status === "disconnected") {
      setPendingAction(null);
      return;
    }

    if (data?.status !== "valid") return;

    const map = data.maps.find((m) => m._id === pendingAction._id);
    const shouldDismiss =
      !map ||
      map.state !== "AVAILABLE" ||
      !data.isYourTurn ||
      data.session.status === "PAUSED" ||
      isAnyReveal;

    if (shouldDismiss) {
      setPendingAction(null);
    }
  }, [data, pendingAction, isAnyReveal, auth.status]);

  // Clear optimistic vote indicator once server state confirms the same vote
  useEffect(() => {
    if (
      data?.status === "valid" &&
      optimisticVotedMapId &&
      data.playerVotedMapId === optimisticVotedMapId
    ) {
      setOptimisticVote(null);
    }
  }, [data, optimisticVotedMapId]);

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
    return <TokenErrorPage error={auth.error ?? "INVALID_TOKEN"} onRetry={auth.error === "NETWORK_ERROR" ? auth.retry : undefined} />;
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

  // Render guard: show spinner while redirect is in flight
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Terminal session state: latch expired flag to stop heartbeat, then show error page
  if (data.session.status === "EXPIRED" || sessionExpired) {
    if (!sessionExpired) setSessionExpired(true);
    return <SessionEndedPage reason="EXPIRED" />;
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

  // Separate maps into active (current round) and previously eliminated
  const activeMaps = isAnyReveal
    ? maps.filter(
        (m) =>
          m.state === "AVAILABLE" ||
          m.state === "WINNER" ||
          (m.state === "BANNED" &&
            revealData &&
            m.bannedAtRound === revealData.completedRound)
      )
    : maps.filter((m) => m.state !== "BANNED");

  const previouslyEliminatedMaps =
    session.format === "MULTIPLAYER"
      ? maps.filter(
          (m) =>
            m.state === "BANNED" &&
            m.bannedAtRound !== undefined &&
            (!isAnyReveal ||
              !revealData ||
              m.bannedAtRound < revealData.completedRound)
        )
      : [];

  // Check if a specific map was just eliminated in the current reveal
  const isJustEliminated = (mapId: Id<"sessionMaps">) =>
    isAnyReveal &&
    revealData !== null &&
    revealData.eliminatedMapIds.includes(mapId);

  // Check if a map survived the current reveal round
  const isSurvivor = (mapId: Id<"sessionMaps">, mapState: string) =>
    isRevealPhase &&
    revealData !== null &&
    revealData.outcome === "ROUND_ADVANCED" &&
    mapState === "AVAILABLE" &&
    !revealData.eliminatedMapIds.includes(mapId);

  // Check if a map is the winner during winner reveal
  const isWinnerMap = (mapId: Id<"sessionMaps">) =>
    isWinnerReveal && phaseState.phase === "WINNER_REVEAL" && phaseState.winnerMapId === mapId;

  // Find the winner map name for accessibility announcements
  const winnerMapName = (phaseState.phase === "WINNER_REVEAL" || phaseState.phase === "REDIRECTING")
    ? maps.find((m) => m._id === phaseState.winnerMapId)?.name
    : undefined;

  // Whether the UI is interactive (not paused and not in a reveal phase)
  const isInteractive = !isPaused && !isAnyReveal;

  const handleMapClick = (mapId: Id<"sessionMaps">, mapName: string) => {
    if (!isYourTurn || isSubmitting || !isInteractive) return;

    setPendingAction({
      _id: mapId,
      name: mapName,
      type: session.format === "ABBA" ? "ban" : "vote",
    });
  };

  const submitAction = async () => {
    if (!pendingAction || isSubmitting || isPaused) return;
    if (auth.status === "reconnecting" || auth.status === "disconnected") return;

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
        if (pendingAction.type === "vote" && currentRound !== undefined) {
          setOptimisticVote({ mapId: pendingAction._id, forRound: currentRound });
        }
        setPendingAction(null);
      } else {
        toast.error(
          getVotingErrorMessage((result.error ?? "") as VotingErrorCode)
        );
      }
    } catch (error) {
      console.error("Vote submission failed:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute countdown text for reveal
  const revealCountdown = Math.max(1, Math.ceil(remainingMs / 1000));

  // Compute accessibility announcement
  const eliminatedCount = revealData?.eliminatedMapIds.length ?? 0;
  const survivingCount = activeMaps.filter(
    (m) => m.state === "AVAILABLE"
  ).length;

  return (
    <>
    <div
      className="min-h-screen bg-background text-foreground flex flex-col"
      aria-hidden={auth.isOverlayVisible || undefined}
      inert={auth.isOverlayVisible || undefined}
    >
      <SessionPausedOverlay isPaused={isPaused} />

      {/* ARIA live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isRevealPhase &&
          revealData &&
          (revealData.outcome === "REVOTE"
            ? `Round ${revealData.completedRound} complete. Deadlock! All maps eliminated. Revoting with same maps. Next round in ${revealCountdown} seconds.`
            : `Round ${revealData.completedRound} complete. ${eliminatedCount} map${eliminatedCount !== 1 ? "s" : ""} eliminated. ${survivingCount} map${survivingCount !== 1 ? "s" : ""} remaining. Next round in ${revealCountdown} seconds.`)}
        {isWinnerReveal &&
          winnerMapName &&
          `Session complete. Winner: ${winnerMapName}.`}
        {!isAnyReveal &&
          session.format === "ABBA" &&
          isYourTurn &&
          "Your turn to ban."}
      </div>

      <div inert={!isInteractive}>
        {/* Header */}
        <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-xl font-bold">
                {session.matchName}
              </h1>
              <Badge
                variant="secondary"
                className="bg-muted text-xs sm:text-sm"
              >
                {session.format === "ABBA" ? "ABBA Ban" : "Multiplayer Vote"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">You are:</span>
              <span className="font-bold text-foreground">{player.role}</span>
              <span className="text-muted-foreground">
                ({player.teamName})
              </span>
              <ConnectionStatusBadge
                status={auth.connectionStatus}
                showLabel={false}
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-6 py-8">
          {/* Turn Status / Reveal Banner Section */}
          <div className="max-w-5xl mx-auto mb-8">
            {/* Banner */}
            {isWinnerReveal ? (
              /* Winner Reveal Banner */
              <div className="rounded-lg p-6 text-center mb-4 bg-amber-950/50 border-2 border-amber-500 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Trophy className="w-8 h-8 text-amber-400" />
                  <div className="text-3xl sm:text-4xl font-bold text-amber-400">
                    {revealData?.outcome === "RANDOM_WINNER"
                      ? "RANDOM WINNER!"
                      : "WINNER!"}
                  </div>
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
                {winnerMapName && (
                  <p className="text-lg text-amber-200/80">{winnerMapName}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting to results in {revealCountdown}s...
                </p>
              </div>
            ) : isRevealPhase && revealData ? (
              /* Round Results Reveal Banner */
              <div
                className={cn(
                  "rounded-lg p-6 text-center mb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
                  revealData.outcome === "REVOTE"
                    ? "bg-red-950/50 border-2 border-red-600"
                    : "bg-amber-950/50 border-2 border-amber-600"
                )}
              >
                <div className="text-2xl sm:text-3xl font-bold mb-2">
                  ROUND {revealData.completedRound} RESULTS
                </div>
                {revealData.outcome === "REVOTE" && (
                  <p className="text-red-400 font-medium">
                    Deadlock! Revoting with same maps...
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Next round in {revealCountdown}s...
                </p>
              </div>
            ) : (
              /* Normal Voting Banner */
              <>
                <div
                  className={cn(
                    "rounded-lg p-6 text-center mb-4",
                    isYourTurn
                      ? "bg-green-950/50 border-2 border-green-600"
                      : "bg-muted border-2 border-border"
                  )}
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
                  className={cn(
                    "text-center mb-4 font-mono text-4xl sm:text-5xl md:text-7xl font-bold",
                    isYourTurn ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {/* Key resets the timer when turn changes */}
                  <CountdownTimer
                    key={`${session.currentTurn}-${session.currentRound}`}
                    turnTimerSeconds={session.turnTimerSeconds}
                    timerStartedAt={session.timerStartedAt}
                    timerPausedAt={session.timerPausedAt}
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
              </>
            )}
          </div>

          {/* Map Grid */}
          <div className="max-w-6xl mx-auto mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {(session.format === "MULTIPLAYER"
                ? activeMaps
                : maps
              ).map((map) => {
                const bannedByPlayer = map.bannedByPlayerId
                  ? allPlayers.find((p) => p._id === map.bannedByPlayerId)
                  : null;
                const isMyVote =
                  (map._id === data.playerVotedMapId ||
                    map._id === optimisticVotedMapId) &&
                  map.state === "AVAILABLE";

                return (
                  <VoteMapCard
                    key={map._id}
                    map={map}
                    isMyVote={isMyVote}
                    isYourTurn={isYourTurn}
                    isSubmitting={isSubmitting}
                    isInteractive={isInteractive}
                    isAnyReveal={isAnyReveal}
                    justEliminated={isJustEliminated(map._id)}
                    survivor={isSurvivor(map._id, map.state)}
                    winner={isWinnerMap(map._id)}
                    bannedByTeamName={bannedByPlayer?.teamName}
                    onMapClick={handleMapClick}
                  />
                );
              })}
            </div>
          </div>

          {/* Previously Eliminated Maps (Multiplayer only) */}
          {session.format === "MULTIPLAYER" &&
            previouslyEliminatedMaps.length > 0 && (
              <div className="max-w-6xl mx-auto mb-8">
                <h3 className="text-sm text-muted-foreground mb-3">
                  Previously Eliminated
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {previouslyEliminatedMaps.map((map) => (
                    <Card key={map._id} className="opacity-50 overflow-hidden">
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={map.imageUrl || "/placeholder.svg"}
                          alt={map.name}
                          className="w-full h-full object-cover grayscale"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <X
                            className="w-6 h-6 text-red-500"
                            strokeWidth={3}
                          />
                        </div>
                      </div>
                      <div className="p-1.5 text-xs text-center truncate text-muted-foreground">
                        {map.name}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

          {/* Progress Tracker (ABBA format only) */}
          {session.format === "ABBA" && banSteps.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                {banSteps.map((step, index) => (
                  <div key={index} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2",
                          step.completed
                            ? "bg-primary border-primary"
                            : currentStep === index
                              ? "bg-primary/20 border-primary"
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
                {isAnyReveal ? (
                  /* Reveal: show "Round complete" */
                  <span className="text-sm font-medium text-green-500 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Round {revealData?.completedRound ?? session.currentRound - 1} complete
                  </span>
                ) : (
                  /* Normal voting: show round + player status */
                  <>
                    <span className="text-sm text-muted-foreground">
                      Round {session.currentRound}
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            player.hasVotedThisRound
                              ? STATUS_CONFIG.connected.dotColor
                              : "bg-muted-foreground animate-pulse"
                          )}
                        />
                        <span className="text-sm font-medium">
                          {player.teamName}
                        </span>
                        {player.hasVotedThisRound ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {otherPlayers.map((op) => {
                        // Dot color: voted=green, otherwise derive from connection status config
                        const dotClass = op.hasVotedThisRound
                          ? STATUS_CONFIG.connected.dotColor
                          : op.connectionStatus === "disconnected"
                            ? STATUS_CONFIG.disconnected.dotColor
                            : op.connectionStatus === "reconnecting"
                              ? `${STATUS_CONFIG.reconnecting.dotColor} animate-pulse`
                              : "bg-muted-foreground animate-pulse";
                        return (
                          <div key={op._id} className="flex items-center gap-2">
                            <div
                              className={cn("w-3 h-3 rounded-full", dotClass)}
                            />
                            <span className="text-sm font-medium">
                              {op.teamName}
                            </span>
                            {op.hasVotedThisRound ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>Session locked to your device</span>
            </div>
            <ConnectionStatusBadge status={auth.connectionStatus} />
          </div>
        </footer>

        {/* Confirmation Dialog (Ban / Vote) */}
        <AlertDialog
          open={!!pendingAction && !isPaused && !isAnyReveal}
          onOpenChange={(open) =>
            !open && !isSubmitting && setPendingAction(null)
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction?.type === "ban"
                  ? "Confirm Ban"
                  : "Confirm Vote"}
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
                    {pendingAction?.type === "ban"
                      ? "Banning..."
                      : "Voting..."}
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
    </div>

    {/* Turn transition flash (ABBA: fires when isYourTurn goes false→true) */}
    {session.format === "ABBA" && (
      <TurnFlashOverlay
        isYourTurn={isYourTurn}
        isSuppressed={auth.isOverlayVisible}
      />
    )}

    {/* Disconnected overlay (shows during reconnecting + disconnected) */}
    {auth.isOverlayVisible && (
      <DisconnectedOverlay
        status={auth.status === "reconnecting" ? "reconnecting" : "disconnected"}
        retryAttempt={auth.retryAttempt}
        maxRetries={auth.maxRetries}
        onRetry={auth.retry}
      />
    )}
    </>
  );
}
