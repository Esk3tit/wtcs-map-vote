import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ActorType } from "../../../convex/lib/types";
import {
  getActivePlayerIndex,
  sortPlayersByJoinOrder,
} from "../../../convex/lib/constants";
import { isReadyActive } from "@/lib/ready";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Play,
  Pause,
  Shuffle,
  RotateCcw,
  ExternalLink,
  Hand,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  getStatusColor,
  formatStatus,
  formatRelativeTime,
} from "@/components/session/utils";
import { ConnectionStatusBadge, STATUS_CONFIG } from "@/components/session/ConnectionStatusBadge";
import type { ConnectionStatus } from "../../../convex/lib/connectionStatus";
import { useConnectionToasts } from "@/hooks/useConnectionToasts";
import { TeamAvatar } from "@/components/session/team-avatar";
import { EmptyState } from "@/components/ui/empty-state";

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
    if (role === "Player A") return "Player A — Bans 1st & 4th";
    if (role === "Player B") return "Player B — Bans 2nd & 3rd";
  }
  // Already human-readable (e.g., "Player 1", "Player A")
  return role;
};

// ============================================================================
// Admin Connection Badge
// ============================================================================

const ADMIN_CONNECTION_BADGE_STYLES = {
  connected: "gap-1 bg-green-500/20 text-green-600 border-green-500/30",
  reconnecting: "gap-1 bg-amber-500/20 text-amber-600 border-amber-500/30",
  disconnected: "gap-1 bg-red-500/20 text-red-600 border-red-500/30",
} as const;

function AdminConnectionBadge({
  status,
}: {
  status: ConnectionStatus;
}) {
  return (
    <Badge variant="outline" className={ADMIN_CONNECTION_BADGE_STYLES[status]}>
      <ConnectionStatusBadge status={status} showLabel={false} />
      {STATUS_CONFIG[status].label}
    </Badge>
  );
}

// ============================================================================
// Player Ready Badge
// ============================================================================

/**
 * Displays a persistent ready/not-ready badge for a player in the WAITING state.
 * Ready is a toggle with no expiry — stays active until manually cancelled.
 */
function PlayerReadyBadge({ readyAt }: { readyAt?: number }) {
  const isPlayerReady = isReadyActive(readyAt);

  if (isPlayerReady) {
    return (
      <Badge
        variant="outline"
        className="gap-1 bg-green-500/20 text-green-600 border-green-500/30"
      >
        <CheckCircle2 className="w-3 h-3" />
        Ready
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-muted text-muted-foreground border-border"
    >
      Not ready
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Lightweight check for session ID - Convex IDs are opaque strings
// We only check that it's a non-empty string; Convex's runtime handles actual validation
const isValidSessionId = (id: string): boolean => {
  return typeof id === "string" && id.length > 0;
};

// ============================================================================
// Confirmation Dialog Config
// ============================================================================

type ActionName = "finalize" | "start" | "pause" | "resume" | "end" | "forceRandom" | "reset" | "clone" | "voteOnBehalf" | "delete";

type ConfirmAction = "end" | "forceRandom" | "reset" | "delete" | "startNotReady";

const CONFIRM_DIALOG_CONFIG: Record<
  ConfirmAction,
  { title: string; description: string; confirmLabel: string; destructive: boolean }
> = {
  end: {
    title: "End Session?",
    description:
      "This will force-end the session without declaring a winner. This action cannot be undone.",
    confirmLabel: "End Session",
    destructive: true,
  },
  forceRandom: {
    title: "Force Random Selection?",
    description:
      "This will randomly select a winning map and immediately complete the session.",
    confirmLabel: "Force Random",
    destructive: true,
  },
  reset: {
    title: "Reset Session?",
    description:
      "All votes and results will be cleared. Players and maps will be preserved. The session will return to WAITING state.",
    confirmLabel: "Reset Session",
    destructive: false,
  },
  delete: {
    title: "Delete Session?",
    description:
      "This will permanently delete the session and all associated data (players, maps, votes). This action cannot be undone.",
    confirmLabel: "Delete Session",
    destructive: true,
  },
  startNotReady: {
    title: "Not All Players Ready",
    description:
      "Some players haven't clicked Ready Up yet. Their audio alerts may not work for the first turn. Start anyway?",
    confirmLabel: "Start Session",
    destructive: false,
  },
};

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const isValidId = isValidSessionId(sessionId);
  const typedSessionId = sessionId as Id<"sessions">;
  const [lastCopied, setLastCopied] = useState<"all" | string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lifecycle mutation hooks
  const finalizeMutation = useMutation(api.sessions.finalizeSession);
  const startMutation = useMutation(api.sessions.startSession);
  const pauseMutation = useMutation(api.sessions.pauseSession);
  const resumeMutation = useMutation(api.sessions.resumeSession);
  const endMutation = useMutation(api.sessions.endSession);
  const forceRandomMutation = useMutation(api.sessions.forceRandomSelection);
  const resetMutation = useMutation(api.sessions.resetSession);
  const cloneMutation = useMutation(api.sessions.cloneSession);
  const deleteMutation = useMutation(api.sessions.deleteSession);
  const regenerateTokenMutation = useMutation(api.sessions.regeneratePlayerToken);
  const voteOnBehalfMutation = useMutation(api.voting.adminVoteOnBehalf);

  // Loading state: tracks which action is in progress
  const [actionLoading, setActionLoading] = useState<ActionName | null>(null);
  const isAnyLoading = actionLoading !== null;

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Per-player regenerate spinner (tracks which player's token is being regenerated)
  const [regeneratingPlayerId, setRegeneratingPlayerId] = useState<Id<"sessionPlayers"> | null>(null);

  // Vote on behalf dialog state
  const [voteOnBehalfPlayer, setVoteOnBehalfPlayer] = useState<{
    _id: Id<"sessionPlayers">;
    teamName: string;
  } | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<Id<"sessionMaps"> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const buildLobbyUrl = (token: string) =>
    `${window.location.origin}/lobby/${token}`;

  const handleCopy = async (text: string, id: "all" | string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLastCopied(id);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setLastCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyAllLinks = async (
    players: { teamName: string; token: string }[]
  ) => {
    const text = players
      .map((p) => `${p.teamName}: ${buildLobbyUrl(p.token)}`)
      .join("\n");
    await handleCopy(text, "all");
  };

  // Reusable action handler with loading + toast pattern
  const handleAction = async <T,>(
    actionName: ActionName,
    mutation: () => Promise<T>,
    onSuccess: (result: T) => void | Promise<void>,
  ) => {
    setActionLoading(actionName);
    try {
      const result = await mutation();
      await onSuccess(result);
    } catch (error) {
      toast.error(getMutationErrorMessage(error, `Failed to ${actionName}`));
    } finally {
      setActionLoading(null);
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

  // Pre-sort players for ABBA turn order (computed once, not per-player)
  const sortedPlayers = useMemo(
    () => sortPlayersByJoinOrder(session?.players ?? []),
    [session?.players]
  );

  // Active ABBA player (computed once, not per-player)
  const sessionFormat = session?.format;
  const sessionStatus = session?.status;
  const sessionCurrentTurn = session?.currentTurn;
  const activeAbbaPlayerId = useMemo(() => {
    if (sessionFormat !== "ABBA" || sessionStatus !== "IN_PROGRESS") return null;
    const activeIdx = getActivePlayerIndex(sessionCurrentTurn ?? 0);
    return sortedPlayers[activeIdx]?._id ?? null;
  }, [sessionFormat, sessionStatus, sessionCurrentTurn, sortedPlayers]);

  // Memoize available maps for vote-on-behalf dialog
  const availableMaps = useMemo(
    () => (session?.maps ?? []).filter((m) => m.state === "AVAILABLE"),
    [session?.maps]
  );

  const isWaiting = session?.status === "WAITING";

  // ============================================================================
  // Connection Toast Notifications
  // ============================================================================

  const { markManualPause } = useConnectionToasts({
    players: session?.players ?? [],
    sessionStatus: session?.status,
    isActive:
      session?.status === "IN_PROGRESS" || session?.status === "PAUSED",
  });

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
  const isPaused = session.status === "PAUSED";
  const isLiveOrPaused = isLive || isPaused;
  const isDeletable = session.status !== "IN_PROGRESS";
  const canRegenToken = session.status === "DRAFT" || session.status === "WAITING" || isPaused;
  const allConnected = session.players.every((p) => p.isConnected);

  // Confirmation dialog handler
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const actionName = confirmAction;
    switch (actionName) {
      case "end":
        await handleAction(
          actionName,
          () => endMutation({ sessionId: typedSessionId }),
          () => {
            toast.success("Session ended");
            setConfirmAction(null);
          },
        );
        break;
      case "forceRandom":
        await handleAction(
          actionName,
          () => forceRandomMutation({ sessionId: typedSessionId }),
          (result) => {
            toast.success(`Winner selected: ${result.winnerMapName}`);
            setConfirmAction(null);
          },
        );
        break;
      case "reset":
        await handleAction(
          actionName,
          () => resetMutation({ sessionId: typedSessionId }),
          () => {
            toast.success("Session reset");
            setConfirmAction(null);
          },
        );
        break;
      case "delete":
        await handleAction(
          actionName,
          () => deleteMutation({ sessionId: typedSessionId }),
          async () => {
            toast.success("Session deleted");
            setConfirmAction(null);
            await navigate({ to: "/admin/dashboard" });
          },
        );
        break;
      case "startNotReady":
        await handleAction(
          "start",
          () => startMutation({ sessionId: typedSessionId }),
          () => {
            toast.success("Session started");
            setConfirmAction(null);
          },
        );
        break;
      default: {
        const _exhaustive: never = actionName;
        throw new Error(`Unhandled confirm action: ${_exhaustive}`);
      }
    }
  };

  // Vote on behalf handler
  const handleVoteOnBehalf = async () => {
    if (!voteOnBehalfPlayer || !selectedMapId) return;
    const teamName = voteOnBehalfPlayer.teamName;
    await handleAction(
      "voteOnBehalf",
      () =>
        voteOnBehalfMutation({
          sessionId: typedSessionId,
          playerId: voteOnBehalfPlayer._id,
          mapId: selectedMapId,
        }),
      () => {
        toast.success(`Vote submitted for ${teamName}`);
        setVoteOnBehalfPlayer(null);
        setSelectedMapId(null);
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-4 py-4 md:px-8 space-y-4">
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

            <div className="flex gap-2 flex-wrap">
              {/* Finalize: DRAFT only */}
              {session.status === "DRAFT" && (
                <Button
                  disabled={isAnyLoading}
                  className="gap-2 bg-chart-4 hover:bg-chart-4/90"
                  onClick={() =>
                    handleAction(
                      "finalize",
                      () => finalizeMutation({ sessionId: typedSessionId }),
                      () => { toast.success("Session finalized"); },
                    )
                  }
                >
                  {actionLoading === "finalize" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {actionLoading === "finalize" ? "Finalizing..." : "Finalize"}
                </Button>
              )}

              {/* Start: WAITING only */}
              {session.status === "WAITING" && (
                <Button
                  disabled={isAnyLoading || !allConnected}
                  className="gap-2 bg-chart-4 hover:bg-chart-4/90"
                  title={
                    !allConnected
                      ? "Waiting for all players to connect"
                      : undefined
                  }
                  onClick={() => {
                    const allReady = session.players.every(
                      (p) => isReadyActive(p.readyAt)
                    );
                    if (allReady) {
                      handleAction(
                        "start",
                        () => startMutation({ sessionId: typedSessionId }),
                        () => { toast.success("Session started"); },
                      );
                    } else {
                      setConfirmAction("startNotReady");
                    }
                  }}
                >
                  {actionLoading === "start" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {actionLoading === "start" ? "Starting..." : "Start Session"}
                </Button>
              )}

              {/* Pause: IN_PROGRESS only */}
              {isLive && (
                <Button
                  variant="secondary"
                  disabled={isAnyLoading}
                  className="gap-2"
                  onClick={() => {
                    markManualPause();
                    handleAction(
                      "pause",
                      () => pauseMutation({ sessionId: typedSessionId }),
                      () => { toast.success("Session paused"); },
                    );
                  }}
                >
                  {actionLoading === "pause" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  {actionLoading === "pause" ? "Pausing..." : "Pause"}
                </Button>
              )}

              {/* Resume: PAUSED only */}
              {isPaused && (
                <Button
                  disabled={isAnyLoading}
                  className="gap-2 bg-chart-4 hover:bg-chart-4/90"
                  onClick={() =>
                    handleAction(
                      "resume",
                      () => resumeMutation({ sessionId: typedSessionId }),
                      () => { toast.success("Session resumed"); },
                    )
                  }
                >
                  {actionLoading === "resume" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {actionLoading === "resume" ? "Resuming..." : "Resume"}
                </Button>
              )}

              {/* End Session: IN_PROGRESS or PAUSED */}
              {isLiveOrPaused && (
                <Button
                  variant="destructive"
                  disabled={isAnyLoading}
                  className="gap-2"
                  onClick={() => setConfirmAction("end")}
                >
                  <X className="w-4 h-4" />
                  End Session
                </Button>
              )}

              {/* Force Random: IN_PROGRESS or PAUSED */}
              {isLiveOrPaused && (
                <Button
                  variant="destructive"
                  disabled={isAnyLoading}
                  className="gap-2"
                  onClick={() => setConfirmAction("forceRandom")}
                >
                  <Shuffle className="w-4 h-4" />
                  Force Random
                </Button>
              )}

              {/* Reset: COMPLETE only */}
              {session.status === "COMPLETE" && (
                <Button
                  variant="secondary"
                  disabled={isAnyLoading}
                  className="gap-2"
                  onClick={() => setConfirmAction("reset")}
                >
                  {actionLoading === "reset" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  {actionLoading === "reset" ? "Resetting..." : "Reset"}
                </Button>
              )}

              {/* Clone: all states */}
              <Button
                variant="secondary"
                disabled={isAnyLoading}
                className="gap-2"
                onClick={() =>
                  handleAction(
                    "clone",
                    () => cloneMutation({ sessionId: typedSessionId }),
                    async ({ newSessionId }) => {
                      toast.success("Session cloned");
                      await navigate({
                        to: "/admin/session/$sessionId",
                        params: { sessionId: newSessionId },
                      });
                    },
                  )
                }
              >
                {actionLoading === "clone" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {actionLoading === "clone" ? "Cloning..." : "Clone"}
              </Button>

              {/* Delete: all states except IN_PROGRESS */}
              {isDeletable && (
                <Button
                  variant="destructive"
                  disabled={isAnyLoading}
                  className="gap-2"
                  onClick={() => setConfirmAction("delete")}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}

              {/* View Results: COMPLETE only */}
              {session.status === "COMPLETE" && (
                <Button
                  variant="outline"
                  className="gap-2"
                  render={
                    <Link
                      to="/results/$sessionId"
                      params={{ sessionId }}
                    />
                  }
                >
                  <ExternalLink className="w-4 h-4" />
                  View Results
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmActionDialog
        confirmAction={confirmAction}
        isLoading={isAnyLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      <VoteOnBehalfDialog
        voteOnBehalfPlayer={voteOnBehalfPlayer}
        isLoading={isAnyLoading}
        actionLoading={actionLoading}
        availableMaps={availableMaps}
        selectedMapId={selectedMapId}
        format={session.format}
        onSelectMap={setSelectedMapId}
        onConfirm={handleVoteOnBehalf}
        onCancel={() => {
          setVoteOnBehalfPlayer(null);
          setSelectedMapId(null);
        }}
      />

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 space-y-6">
        {/* Player Lobby Links Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>Player Lobby Links</CardTitle>
                <CardDescription>
                  Share these links with each team. Links lock to their IP on
                  first use.
                </CardDescription>
              </div>
              {session.players.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyAllLinks(session.players)}
                  className="shrink-0 gap-2"
                >
                  {lastCopied === "all" ? (
                    <CheckCircle2 className="w-4 h-4 text-chart-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {lastCopied === "all" ? "Copied!" : "Copy All Links"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.players.length === 0 ? (
              <EmptyState
                variant="card"
                icon={<User className="w-10 h-10" />}
                title="No players assigned yet"
                description="Players will appear here once assigned to the session"
              />
            ) : (
              session.players.map((player) => {
                const lobbyUrl = buildLobbyUrl(player.token);
                // Determine if this player is eligible for vote-on-behalf
                const canVoteOnBehalf =
                  isLive &&
                  (session.format === "MULTIPLAYER"
                    ? !player.hasVotedThisRound
                    : player._id === activeAbbaPlayerId);

                return (
                  <div
                    key={player._id}
                    className="flex flex-col gap-3 p-4 rounded-lg border border-border/50 bg-background/50 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <TeamAvatar
                        name={player.teamName}
                        logoUrl={player.teamLogoUrl}
                      />
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {player.teamName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatPlayerRole(player.role, session.format)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 sm:min-w-[320px] md:min-w-[400px]">
                        <Input
                          value={lobbyUrl}
                          readOnly
                          className="ph-no-capture min-w-0 flex-1 font-mono text-sm bg-muted border-border/50"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopy(lobbyUrl, lobbyUrl)}
                          className="shrink-0"
                          aria-label="Copy lobby link"
                          title="Copy lobby link"
                        >
                          {lastCopied === lobbyUrl ? (
                            <CheckCircle2 className="w-4 h-4 text-chart-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        {canRegenToken && (
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={isAnyLoading || regeneratingPlayerId !== null}
                            className="shrink-0"
                            aria-label="Regenerate link"
                            title="Regenerate link"
                            onClick={async () => {
                              setRegeneratingPlayerId(player._id);
                              try {
                                await regenerateTokenMutation({ playerId: player._id });
                                toast.success(`Link regenerated for ${player.teamName}`);
                              } catch (error) {
                                toast.error(getMutationErrorMessage(error, "Failed to regenerate link"));
                              } finally {
                                setRegeneratingPlayerId(null);
                              }
                            }}
                          >
                            {regeneratingPlayerId === player._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {player.isIpLocked ? (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-chart-4/20 text-chart-4 border-chart-4/30"
                        >
                          <Lock className="w-3 h-3" />
                          IP Locked
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-muted text-muted-foreground border-border"
                        >
                          Not activated
                        </Badge>
                      )}
                      {player.isIpLocked && (
                        <AdminConnectionBadge status={player.connectionStatus} />
                      )}
                      {isWaiting && (
                        <PlayerReadyBadge readyAt={player.readyAt} />
                      )}
                      {isLiveOrPaused && player.hasVotedThisRound && (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-blue-500/20 text-blue-600 border-blue-500/30"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Voted
                        </Badge>
                      )}
                      {canVoteOnBehalf && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isAnyLoading}
                          className="gap-1 shrink-0"
                          onClick={() => {
                            setSelectedMapId(null);
                            setVoteOnBehalfPlayer({
                              _id: player._id,
                              teamName: player.teamName,
                            });
                          }}
                        >
                          <Hand className="w-3 h-3" />
                          {session.format === "ABBA"
                            ? "Ban on Behalf"
                            : "Vote on Behalf"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
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
              <EmptyState
                variant="card"
                icon={<Clock className="w-12 h-12" />}
                title="No maps assigned"
                description="Maps will appear here once the session is finalized"
              />
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
                        session.format === "MULTIPLAYER"
                          ? (map.bannedByTeamNames?.length
                              ? map.bannedByTeamNames.join(", ")
                              : map.bannedByPlayerId
                                ? (playerTeamMap.get(map.bannedByPlayerId) ?? "Unknown")
                                : undefined)
                          : map.bannedByPlayerId
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
              <EmptyState
                variant="card"
                icon={<Activity className="w-10 h-10" />}
                title="No activity yet"
                description="Activity will appear here as the session progresses"
              />
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

// ============================================================================
// Extracted Dialog Components
// ============================================================================

function ConfirmActionDialog({
  confirmAction,
  isLoading,
  onConfirm,
  onCancel,
}: {
  confirmAction: ConfirmAction | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Use fallback so content exists during close animation (fading out)
  const config = CONFIRM_DIALOG_CONFIG[confirmAction ?? "end"];

  return (
    <AlertDialog
      open={confirmAction !== null}
      onOpenChange={(open) => {
        if (!open && !isLoading) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            variant={config.destructive ? "destructive" : "default"}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              config.confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VoteOnBehalfDialog({
  voteOnBehalfPlayer,
  isLoading,
  actionLoading,
  availableMaps,
  selectedMapId,
  format,
  onSelectMap,
  onConfirm,
  onCancel,
}: {
  voteOnBehalfPlayer: { _id: Id<"sessionPlayers">; teamName: string } | null;
  isLoading: boolean;
  actionLoading: ActionName | null;
  availableMaps: { _id: Id<"sessionMaps">; name: string; imageUrl: string }[];
  selectedMapId: Id<"sessionMaps"> | null;
  format: "ABBA" | "MULTIPLAYER";
  onSelectMap: (id: Id<"sessionMaps">) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Use fallback so content exists during close animation (fading out)
  const player = voteOnBehalfPlayer ?? { teamName: "" };

  return (
    <Dialog
      open={voteOnBehalfPlayer !== null}
      onOpenChange={(open) => {
        if (!open && !isLoading) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {format === "ABBA" ? "Ban" : "Vote"} on Behalf of{" "}
            {player.teamName}
          </DialogTitle>
          <DialogDescription>
            Select a map to{" "}
            {format === "ABBA" ? "ban" : "vote for"} on behalf of
            this player.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {availableMaps.length === 0 && (
            <p className="col-span-3 text-center text-sm text-muted-foreground py-4">
              No maps available
            </p>
          )}
          {availableMaps.map((map) => (
            <button
              key={map._id}
              type="button"
              className={cn(
                "relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
                selectedMapId === map._id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border/50 hover:border-primary/50",
              )}
              onClick={() => onSelectMap(map._id)}
            >
              <img
                src={map.imageUrl || "/placeholder.svg"}
                alt={map.name}
                className="w-full aspect-[3/4] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <p className="text-[10px] font-semibold text-white text-center truncate">
                  {map.name}
                </p>
              </div>
              {selectedMapId === map._id && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedMapId || isLoading}
            onClick={onConfirm}
          >
            {actionLoading === "voteOnBehalf" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit ${format === "ABBA" ? "Ban" : "Vote"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
