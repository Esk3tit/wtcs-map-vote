import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "../../../convex/lib/connectionStatus";

export const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    dotColor: "bg-green-500",
    textColor: "text-green-600",
  },
  reconnecting: {
    label: "Reconnecting...",
    dotColor: "bg-amber-500",
    pingColor: "bg-amber-400",
    textColor: "text-amber-600",
  },
  disconnected: {
    label: "Disconnected",
    dotColor: "bg-red-500",
    textColor: "text-red-600",
  },
} as const;

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  /** Show text label alongside dot. Default: true */
  showLabel?: boolean;
  className?: string;
}

/**
 * 3-state connection status indicator with dot and optional label.
 * Connected (green), Reconnecting (amber with ping animation), Disconnected (red).
 */
export function ConnectionStatusBadge({
  status,
  showLabel = true,
  className,
}: ConnectionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      {status === "reconnecting" ? (
        <span className={cn("relative flex h-2 w-2")}>
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              STATUS_CONFIG.reconnecting.pingColor
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              config.dotColor
            )}
          />
        </span>
      ) : (
        <span className={cn("rounded-full h-2 w-2", config.dotColor)} />
      )}
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
      )}
    </span>
  );
}
