import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ActorType } from "../../../convex/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Copy,
  Lock,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  FileQuestion,
  Activity,
  User,
  Bot,
  Shield,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  getStatusColor,
  formatStatus,
  formatRelativeTime,
} from "@/components/session/utils";

// ============================================================================
// Constants
// ============================================================================

const AUDIT_LOG_PAGE_SIZE = 50;

export const Route = createFileRoute("/admin/session/$sessionId")({
  component: SessionDetailPage,
});

// ============================================================================
// Audit Log Helpers
// ============================================================================

const formatActionLabel = (action: string): string => {
  return action
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};

const ACTOR_ICONS: Record<ActorType, typeof Shield> = {
  ADMIN: Shield,
  PLAYER: User,
  SYSTEM: Bot,
};

const getActorIcon = (actorType: ActorType) => {
  const Icon = ACTOR_ICONS[actorType];
  return <Icon className="w-3 h-3" />;
};

const ACTOR_BADGE_VARIANTS: Record<ActorType, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  PLAYER: "secondary",
  SYSTEM: "outline",
};

const getActorBadgeVariant = (actorType: ActorType): "default" | "secondary" | "outline" => {
  return ACTOR_BADGE_VARIANTS[actorType];
};

// ============================================================================
// Map State Helpers
// ============================================================================

const getMapStateOverlay = (
  state: "AVAILABLE" | "BANNED" | "WINNER",
  bannedByTeam: string | undefined
) => {
  if (state === "BANNED") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
        <X className="w-8 h-8 text-destructive mb-1" />
        {bannedByTeam && (
          <p className="text-xs text-white font-medium px-2 text-center">
            Banned by {bannedByTeam}
          </p>
        )}
      </div>
    );
  }
  if (state === "WINNER") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
        <CheckCircle2 className="w-8 h-8 text-green-400 mb-1" />
        <p className="text-xs text-white font-medium">Winner</p>
      </div>
    );
  }
  return null;
};

// ============================================================================
// Role Formatting
// ============================================================================

const formatPlayerRole = (role: string, format: string): string => {
  if (format === "ABBA") {
    if (role === "PLAYER_A") return "Player A — Bans 1st & 4th";
    if (role === "PLAYER_B") return "Player B — Bans 2nd & 3rd";
  }
  // Multiplayer: PLAYER_1, PLAYER_2, etc.
  const num = role.replace("PLAYER_", "");
  return `Player ${num}`;
};

// ============================================================================
// Main Component
// ============================================================================

// Simple validation for Convex session IDs (they start with specific prefixes)
const isValidSessionId = (id: string): boolean => {
  // Convex IDs are non-empty strings - basic sanity check
  return typeof id === "string" && id.length > 0;
};

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const isValidId = isValidSessionId(sessionId);
  const typedSessionId = sessionId as Id<"sessions">;
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error("Failed to copy token:", err);
    }
  };

  const session = useQuery(
    api.sessions.getSession,
    isValidId ? { sessionId: typedSessionId } : "skip"
  );

  const auditLogs = useQuery(
    api.audit.getRecentLogs,
    isValidId ? { sessionId: typedSessionId, limit: AUDIT_LOG_PAGE_SIZE } : "skip"
  );

  // Build a lookup map from player ID to team name for audit log details
  // Memoized to prevent unnecessary recalculations on re-renders
  const playerTeamMap = useMemo(
    () => new Map(session?.players.map((p) => [p._id, p.teamName]) ?? []),
    [session?.players]
  );

  // Invalid session ID state
  if (!isValidId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileQuestion className="w-16 h-16 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Invalid session ID
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            The session ID provided is not valid.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/admin/dashboard" />}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Loading state
  if (session === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found state
  if (session === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileQuestion className="w-16 h-16 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Session not found
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            This session may have been deleted or the ID is invalid.
          </p>
        </div>
        <Button variant="outline" render={<Link to="/admin/dashboard" />}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isLive = session.status === "IN_PROGRESS";
  const canStart =
    session.status === "WAITING" || session.status === "DRAFT";

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-4 py-4 pl-16 md:px-8 md:pl-8 space-y-4">
          <Button
            variant="ghost"
            render={<Link to="/admin/dashboard" />}
            className="gap-2 -ml-3 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {session.matchName}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {session.format}
                </Badge>
                <Badge
                  variant="outline"
                  className={getStatusColor(session.status)}
                >
                  {formatStatus(session.status)}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              {canStart && (
                <Button
                  disabled
                  className="gap-2 bg-chart-4 hover:bg-chart-4/90"
                  title="Session control wiring coming soon"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Start Session
                </Button>
              )}
              {session.status === "PAUSED" && (
                <Button
                  disabled
                  className="gap-2"
                  title="Session control wiring coming soon"
                >
                  Resume
                </Button>
              )}
              {isLive && (
                <Button
                  disabled
                  variant="destructive"
                  className="gap-2"
                  title="Session control wiring coming soon"
                >
                  <X className="w-4 h-4" />
                  End Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 space-y-6">
        {/* Player Access Codes Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Player Access Codes</CardTitle>
            <CardDescription>
              Share these codes with each team. Codes lock to their IP on first
              use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.players.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No players assigned yet
                </p>
              </div>
            ) : (
              session.players.map((player) => (
                <div
                  key={player._id}
                  className="flex flex-col gap-3 p-4 rounded-lg border border-border/50 bg-background/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {player.teamName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPlayerRole(player.role, session.format)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Input
                        value={player.token}
                        readOnly
                        className="w-28 font-mono text-center text-sm bg-muted border-border/50"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyToken(player.token)}
                        className="shrink-0"
                      >
                        {copiedToken === player.token ? (
                          <CheckCircle2 className="w-4 h-4 text-chart-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {player.ipAddress ? (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-chart-4/20 text-chart-4 border-chart-4/30"
                      >
                        <Lock className="w-3 h-3" />
                        <span className="hidden sm:inline">Locked to </span>
                        {player.ipAddress}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-border"
                      >
                        Not activated
                      </Badge>
                    )}
                    {player.isConnected && (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-green-500/20 text-green-600 border-green-500/30"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Connected
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Live Status / Maps Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {isLive ? "Live Status" : "Session Maps"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session.maps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  No maps assigned
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Maps will appear here once the session is finalized
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Turn Banner (only when live) */}
                {isLive && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Current Turn
                        </p>
                        <p className="font-semibold text-foreground">
                          Turn {(session.currentTurn ?? 0) + 1}, Round{" "}
                          {(session.currentRound ?? 0) + 1}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-background/50 border border-border/50">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-mono text-lg font-bold text-foreground">
                        {session.turnTimerSeconds}s
                      </span>
                    </div>
                  </div>
                )}

                {/* Maps Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {session.maps.map((map) => (
                    <div
                      key={map._id}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        map.state === "BANNED"
                          ? "border-destructive/50 opacity-40"
                          : map.state === "WINNER"
                            ? "border-green-500/50 shadow-lg shadow-green-500/10"
                            : "border-border/50 hover:border-primary/50 shadow-lg"
                      }`}
                    >
                      <img
                        src={map.imageUrl || "/placeholder.svg"}
                        alt={map.name}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs font-semibold text-white text-center truncate">
                          {map.name}
                        </p>
                      </div>
                      {getMapStateOverlay(
                        map.state,
                        map.bannedByPlayerId
                          ? (playerTeamMap.get(map.bannedByPlayerId) ?? "Unknown")
                          : undefined
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs === undefined ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No activity yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Activity will appear here as the session progresses
                </p>
              </div>
            ) : (
              <ol
                role="log"
                aria-label="Session activity log"
                aria-live="polite"
                className="space-y-0"
              >
                {auditLogs.map((log, index) => (
                  <li
                    key={log._id}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {/* Timeline connector line */}
                    {index < auditLogs.length - 1 && (
                      <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/50" />
                    )}

                    {/* Timeline dot */}
                    <div className="relative flex-shrink-0 mt-1">
                      <div className="h-[26px] w-[26px] rounded-full bg-muted border border-border flex items-center justify-center">
                        {getActorIcon(log.actorType)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={getActorBadgeVariant(log.actorType)}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {log.actorType}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {formatActionLabel(log.action)}
                        </span>
                        <time
                          dateTime={new Date(log.timestamp).toISOString()}
                          title={new Date(log.timestamp).toLocaleString()}
                          className="text-xs text-muted-foreground ml-auto"
                        >
                          {formatRelativeTime(log.timestamp)}
                        </time>
                      </div>
                      {(log.details.mapName ||
                        log.details.teamName ||
                        log.details.round !== undefined ||
                        log.details.reason) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[
                            log.details.mapName && `Map: ${log.details.mapName}`,
                            log.details.teamName &&
                              `Team: ${log.details.teamName}`,
                            log.details.round !== undefined &&
                              `Round ${log.details.round}`,
                            log.details.reason,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
