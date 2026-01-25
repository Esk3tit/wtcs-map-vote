import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, AlertTriangle, Clock } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/lobby/$token")({
  component: PlayerLobbyPage,
});

function PlayerLobbyPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const data = useQuery(api.sessions.getSessionByToken, { token });

  // Auto-redirect based on session status
  useEffect(() => {
    if (data?.status === "valid") {
      const { session } = data;
      if (session.status === "IN_PROGRESS") {
        navigate({ to: "/vote/$token", params: { token } });
      } else if (session.status === "COMPLETE") {
        navigate({ to: "/results/$sessionId", params: { sessionId: session._id } });
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
      default:
        return "Waiting...";
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
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-500">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </Card>

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
              {otherPlayers.map((otherPlayer) => (
                <div
                  key={otherPlayer._id}
                  className="flex items-center justify-between"
                >
                  <span className="text-lg font-semibold text-foreground">
                    {otherPlayer.teamName}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        otherPlayer.isConnected ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        otherPlayer.isConnected
                          ? "text-green-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {otherPlayer.isConnected
                        ? "Connected"
                        : "Not yet connected"}
                    </span>
                  </div>
                </div>
              ))}
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
