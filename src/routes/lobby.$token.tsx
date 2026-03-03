import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TokenErrorPage } from "@/components/session/TokenErrorPage";
import { SessionEndedPage } from "@/components/session/SessionEndedPage";
import { ConnectionStatusBadge } from "@/components/session/ConnectionStatusBadge";
import { DisconnectedOverlay } from "@/components/session/DisconnectedOverlay";
import { usePlayerAuth } from "@/hooks/usePlayerAuth";
import { useSessionStatusRedirect } from "@/hooks/useSessionStatusRedirect";
import { SITE_URL } from "@/lib/convexHttp";
import { isReadyActive } from "@/lib/ready";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { audioManager } from "@/lib/audio";
import { Lock, Loader2, CheckCircle2, Volume2, VolumeX, LogIn } from "lucide-react";
import { TeamAvatar } from "@/components/session/team-avatar";
import { useEffect, useState, useCallback, useRef } from "react";
import { MAP_STAGGER_DELAY_MS } from "@/lib/animation";
import { PlayerRouteErrorComponent } from "@/components/error-boundary";

export const Route = createFileRoute("/lobby/$token")({
  component: PlayerLobbyPage,
  errorComponent: PlayerRouteErrorComponent,
});

function PlayerLobbyPage() {
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

  // Audio unlock gate — requires a user gesture before lobby sounds can play.
  // Without this, a player who pastes the link and never interacts won't hear
  // the player-ready sound when others ready up.
  const [hasEntered, setHasEntered] = useState(false);

  // Ready button state
  const [readyLoading, setReadyLoading] = useState(false);

  // Audio: the "Enter Lobby" gate above guarantees a user gesture before this point.
  const [muted, setMuted] = useState(() => audioManager.muted);
  const toggleMute = useCallback(() => {
    const newMuted = audioManager.toggleMute();
    setMuted(newMuted);
  }, []);

  // Play sound when another player becomes ready
  const prevReadyRef = useRef<Record<string, boolean>>({});
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (!hasEntered) return;
    if (data?.status !== "valid" || !data.otherPlayers) return;

    // On first render, seed the ref with current states without playing sounds
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      for (const other of data.otherPlayers) {
        prevReadyRef.current[other._id] = isReadyActive(other.readyAt);
      }
      return;
    }

    for (const other of data.otherPlayers) {
      const wasReady = prevReadyRef.current[other._id] ?? false;
      const nowReady = isReadyActive(other.readyAt);
      if (!wasReady && nowReady) {
        audioManager.play("player-ready");
      }
      prevReadyRef.current[other._id] = nowReady;
    }
  }, [data, hasEntered]);

  const handleReady = useCallback(async () => {
    // Capture toggle direction at click-time (before async/re-render)
    const wasReady = data?.status === "valid" && isReadyActive(data.player.readyAt);
    const action = wasReady ? "cancel ready" : "ready up";
    setReadyLoading(true);
    try {
      const res = await fetch(`${SITE_URL}/api/player/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        toast.error(`Failed to ${action}. Please try again.`);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setReadyLoading(false);
    }
  }, [token, data]);

  // Auto-redirect based on session status (hook must be before early returns)
  const isRedirecting = useSessionStatusRedirect(data, token, "lobby");

  // Auth loading
  if (auth.status === "loading") {
    return <LobbyPageSkeleton />;
  }

  // Auth error
  if (auth.status === "error") {
    return <TokenErrorPage error={auth.error ?? "INVALID_TOKEN"} onRetry={auth.error === "NETWORK_ERROR" ? auth.retry : undefined} />;
  }

  // Loading state (waiting for reactive query after auth)
  if (data === undefined) {
    return <LobbyPageSkeleton />;
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

  // Audio consent gate — requires a user gesture to unlock browser autoplay.
  // The player chooses sound on/off before entering the lobby, so the
  // player-ready sound works reliably even if this is their first interaction.
  if (!hasEntered) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-foreground">
              {data.session.matchName}
            </h1>
            <Badge variant="outline" className="text-base px-4 py-1">
              {data.session.format === "ABBA" ? "ABBA Ban" : "Multiplayer Vote"}
            </Badge>
          </div>

          <Card className="p-6 border-primary/20">
            <div className="flex items-center justify-center gap-4">
              <TeamAvatar
                name={data.player.teamName}
                logoUrl={data.player.teamLogoUrl}
                size="lg"
              />
              <div className="text-left min-w-0">
                <p className="text-sm text-muted-foreground">Joining as</p>
                <h2 className="text-2xl font-bold text-foreground truncate">
                  {data.player.teamName}
                </h2>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm text-foreground text-left">
                This session uses sound effects for ready alerts and voting cues.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={!muted}
              aria-label={`Sound effects ${muted ? "off" : "on"}`}
              className={cn(
                "w-full flex items-center justify-between rounded-lg border px-4 py-3 transition-colors cursor-pointer",
                muted
                  ? "border-border bg-muted/50"
                  : "border-primary/30 bg-primary/5"
              )}
            >
              <span className="text-sm font-medium text-foreground">
                Sound effects
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  muted
                    ? "bg-muted text-muted-foreground"
                    : "bg-green-500/15 text-green-500"
                )}
              >
                {muted ? "OFF" : "ON"}
              </span>
            </button>

            <p className="text-xs text-muted-foreground">
              You can change this anytime in the lobby.
            </p>
          </Card>

          <Button
            size="lg"
            className="gap-2 px-8 text-lg"
            onClick={() => setHasEntered(true)}
            autoFocus
          >
            <LogIn className="w-5 h-5" />
            Enter Lobby
          </Button>
        </div>
      </div>
    );
  }

  const { player, session, maps, otherPlayers } = data;

  const playerIsReady = isReadyActive(player.readyAt);
  const showReadyButton = session.status === "WAITING";

  // Get waiting message based on status
  const getWaitingMessage = () => {
    switch (session.status) {
      case "DRAFT":
        return "Waiting for admin to finalize session setup...";
      case "WAITING":
        return "Waiting for admin to start the session...";
      case "PAUSED":
        return "Session is paused. Waiting for admin to resume...";
      case "EXPIRED":
        return "This session has expired.";
      case "IN_PROGRESS":
      case "COMPLETE":
        return "Redirecting...";
      default: {
        const _exhaustiveCheck: never = session.status;
        return _exhaustiveCheck;
      }
    }
  };

  return (
    <>
      <div
        className="min-h-screen bg-background p-6 flex items-center justify-center"
        aria-hidden={auth.isOverlayVisible || undefined}
        inert={auth.isOverlayVisible || undefined}
      >
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-foreground">
              {session.matchName}
            </h1>
            <Badge variant="outline" className="text-base px-4 py-1">
              {session.format === "ABBA" ? "ABBA Ban" : "Multiplayer Vote"}
            </Badge>
          </div>

          {/* Identity Card */}
          <Card className="p-6 border-primary/20">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">You are joining as:</p>
              <div className="flex items-center gap-4">
                <TeamAvatar
                  name={player.teamName}
                  logoUrl={player.teamLogoUrl}
                  size="lg"
                />
                <div className="space-y-2 min-w-0">
                  <h2 className="text-3xl font-bold text-foreground truncate">
                    {player.teamName}
                  </h2>
                  <p className="text-lg text-muted-foreground">({player.role})</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Session locked to your device</span>
                </div>
                <ConnectionStatusBadge status={auth.connectionStatus} />
              </div>
            </div>
          </Card>

          {/* Ready Button (WAITING only) — toggles ready/un-ready */}
          {showReadyButton && (
            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                className={cn(
                  "gap-2 px-8",
                  playerIsReady
                    ? "bg-muted hover:bg-muted/80 text-foreground"
                    : "bg-green-600 hover:bg-green-700 text-white animate-pulse"
                )}
                disabled={readyLoading}
                onClick={handleReady}
                autoFocus={!playerIsReady}
              >
                {readyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                {playerIsReady ? "Cancel Ready" : "Ready Up"}
              </Button>
              {playerIsReady && (
                <p className="text-sm font-medium text-green-500">Ready!</p>
              )}
            </div>
          )}

          {/* Waiting Indicator */}
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-lg text-muted-foreground motion-safe:animate-pulse">{getWaitingMessage()}</p>
          </div>

          {/* Map Preview */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground text-center">
              Maps in this session:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {maps.map((map, index) => (
                <div
                  key={map._id}
                  className="space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:fill-mode-backwards"
                  style={{ animationDelay: `${index * MAP_STAGGER_DELAY_MS}ms` }}
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <img
                      src={map.imageUrl || "/placeholder.svg"}
                      alt={map.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {map.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Other Players Status */}
          {otherPlayers.length > 0 && (
            <Card className="p-4 bg-card/50">
              <div className="space-y-3">
                {otherPlayers.map((otherPlayer) => {
                  const otherIsReady = isReadyActive(otherPlayer.readyAt);
                  return (
                    <div
                      key={otherPlayer._id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamAvatar
                          name={otherPlayer.teamName}
                          logoUrl={otherPlayer.teamLogoUrl}
                          size="sm"
                        />
                        <span className="text-lg font-semibold text-foreground truncate">
                          {otherPlayer.teamName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {showReadyButton && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                otherIsReady ? "bg-green-500" : "bg-muted"
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                otherIsReady
                                  ? "text-green-500"
                                  : "text-muted-foreground"
                              )}
                            >
                              {otherIsReady ? "Ready" : "Not ready"}
                            </span>
                          </div>
                        )}
                        <ConnectionStatusBadge
                          status={otherPlayer.connectionStatus}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>When all players are ready and connected, the match begins automatically.</p>
            <button
              type="button"
              onClick={toggleMute}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
              aria-label={muted ? "Unmute audio" : "Mute audio"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

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

function LobbyPageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center" aria-busy="true">
      <div role="status" aria-live="polite" className="sr-only">Loading lobby</div>
      <div className="w-full max-w-2xl space-y-8 animate-pulse">
        {/* Header: match name + format badge */}
        <div className="text-center space-y-3">
          <div className="h-10 w-64 bg-muted rounded mx-auto" />
          <div className="h-7 w-32 bg-muted rounded-full mx-auto" />
        </div>

        {/* Identity card */}
        <div className="rounded-lg border border-primary/20 p-6 space-y-3">
          <div className="h-4 w-36 bg-muted rounded mx-auto" />
          <div className="flex items-center justify-center gap-3">
            <div className="size-10 bg-muted rounded-full shrink-0" />
            <div className="h-8 w-48 bg-muted rounded" />
          </div>
          <div className="h-5 w-24 bg-muted rounded mx-auto" />
        </div>

        {/* Map preview grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-video rounded-lg bg-muted" />
              <div className="h-3 w-16 bg-muted rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Player status */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="h-5 w-32 bg-muted rounded" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-6 bg-muted rounded-full shrink-0" />
                <div className="h-5 w-40 bg-muted rounded" />
              </div>
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
