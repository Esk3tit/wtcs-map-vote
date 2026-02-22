import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

const STATUS_CONFIG = {
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

const SIZE_CLASSES = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
} as const;

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  /** Show text label alongside dot. Default: true */
  showLabel?: boolean;
  /** Size variant. Default: "sm" */
  size?: "sm" | "md";
  className?: string;
}

/**
 * 3-state connection status indicator with dot and optional label.
 * Connected (green), Reconnecting (amber with ping animation), Disconnected (red).
 */
export function ConnectionStatusBadge({
  status,
  showLabel = true,
  size = "sm",
  className,
}: ConnectionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const dotSize = SIZE_CLASSES[size];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="status"
      aria-label={`Connection status: ${config.label}`}
    >
      {status === "reconnecting" ? (
        <span className={cn("relative flex", dotSize)}>
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              STATUS_CONFIG.reconnecting.pingColor
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full",
              dotSize,
              config.dotColor
            )}
          />
        </span>
      ) : (
        <span className={cn("rounded-full", dotSize, config.dotColor)} />
      )}
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
      )}
    </span>
  );
}
