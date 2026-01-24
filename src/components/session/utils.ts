// ============================================================================
// Types
// ============================================================================

export type SessionStatus =
  | "DRAFT"
  | "WAITING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETE"
  | "EXPIRED";

// ============================================================================
// Status Helpers
// ============================================================================

const STATUS_COLORS: Record<SessionStatus, string> = {
  DRAFT: "bg-muted/50 text-muted-foreground border-border",
  WAITING: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  IN_PROGRESS: "bg-primary/20 text-primary border-primary/30",
  PAUSED: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  COMPLETE: "bg-green-500/20 text-green-600 border-green-500/30",
  EXPIRED: "bg-red-500/20 text-red-600 border-red-500/30",
};

export const getStatusColor = (status: SessionStatus) => {
  return STATUS_COLORS[status];
};

export const formatStatus = (status: SessionStatus) => {
  return status.replace(/_/g, " ");
};

// ============================================================================
// Time Formatting
// ============================================================================

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

// ============================================================================
// Team Display
// ============================================================================

/**
 * Format team names for display.
 */
export function formatTeamDisplay(teams: string[]): string {
  if (teams.length >= 2) return `${teams[0]} vs ${teams[1]}`;
  if (teams.length === 1) return teams[0];
  return "No teams assigned";
}
