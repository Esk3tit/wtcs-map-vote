import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TokenErrorPage } from "@/components/session/TokenErrorPage";
import { ReadyCountdown } from "@/components/session/ReadyCountdown";
import { ConnectionStatusBadge } from "@/components/session/ConnectionStatusBadge";
import { usePlayerAuth } from "@/hooks/usePlayerAuth";
import { useSessionStatusRedirect } from "@/hooks/useSessionStatusRedirect";
import { SITE_URL } from "@/lib/convexHttp";
import { READY_EXPIRY_MS } from "../../convex/lib/constants";
import { isReadyActive } from "@/lib/ready";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Lock, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

export const Route = createFileRoute("/lobby/$token")({
  component: PlayerLobbyPage,
});

function PlayerLobbyPage() {
  const { token } = Route.useParams();
  // Step 1: Validate token and lock IP via HTTP action
  const auth = usePlayerAuth(token);

  // Step 2: Subscribe to reactive session data (only after auth succeeds)
  // Keep subscription active during "reconnecting" to maintain real-time data
  const data = useQuery(
    api.sessions.getSessionByToken,
    auth.status === "authenticated" || auth.status === "reconnecting"
      ? { token }
      : "skip"
  );

  // Tick every second when WAITING so ready badges stay current
  const isWaiting = data?.status === "valid" && data.session.status === "WAITING";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isWaiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isWaiting]);

  // Ready button state
  const [readyLoading, setReadyLoading] = useState(false);

  const handleReady = useCallback(async () => {
    setReadyLoading(true);
    try {
      const res = await fetch(`${SITE_URL}/api/player/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        toast.error("Failed to ready up. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setReadyLoading(false);
    }
  }, [token]);

  // Auto-redirect based on session status (hook must be before early returns)
  const isRedirecting = useSessionStatusRedirect(data, token, "lobby");

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

  // Render guard: show spinner while redirect is in flight
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { player, session, maps, otherPlayers } = data;

  // Derive own connection status from auth hook.
  // Only "authenticated" and "reconnecting" are reachable here — "loading"
  // and "error" are handled by early returns above.
  const ownConnectionStatus: "connected" | "reconnecting" =
    auth.status === "authenticated" ? "connected" : "reconnecting";

  const playerIsReady = isReadyActive(player.readyAt, now);
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
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
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
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">
                {player.teamName}
              </h2>
              <p className="text-lg text-muted-foreground">({player.role})</p>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Session locked to your device</span>
              </div>
              <ConnectionStatusBadge status={ownConnectionStatus} />
            </div>
          </div>
        </Card>

        {/* Ready Button (WAITING only) */}
        {showReadyButton && (
          <div className="flex flex-col items-center gap-3">
            {playerIsReady && player.readyAt ? (
              <>
                <ReadyCountdown
                  readyAt={player.readyAt}
                  durationMs={READY_EXPIRY_MS}
                  now={now}
                />
                <p className="text-sm font-medium text-green-500">Ready!</p>
              </>
            ) : (
              <Button
                size="lg"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8"
                disabled={readyLoading}
                onClick={handleReady}
              >
                {readyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Ready Up
              </Button>
            )}
          </div>
        )}

        {/* Waiting Indicator */}
        <div className="flex flex-col items-center gap-4 py-8">
          {session.status === "EXPIRED" ? (
            <Clock className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          )}
          <p className="text-lg text-muted-foreground">{getWaitingMessage()}</p>
        </div>

        {/* Map Preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground text-center">
            Maps in this session:
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {maps.map((map) => (
              <div key={map._id} className="space-y-2">
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
                const otherIsReady = isReadyActive(otherPlayer.readyAt, now);
                return (
                  <div
                    key={otherPlayer._id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-lg font-semibold text-foreground">
                      {otherPlayer.teamName}
                    </span>
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
        <p className="text-sm text-center text-muted-foreground">
          The admin will start the session when all players are ready.
        </p>
      </div>
    </div>
  );
}
