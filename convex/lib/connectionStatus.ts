/**
 * Connection Status Utilities
 *
 * Shared type and helper for 3-state connection status computation.
 */

import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from "./constants";

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive a 3-state connection status from heartbeat data.
 *
 * Note: Date.now() is not a reactive dependency in Convex queries. For other
 * players, the "reconnecting" window (HEARTBEAT_INTERVAL_MS–HEARTBEAT_TIMEOUT_MS)
 * will only appear if the query re-evaluates during that interval (e.g. from
 * another field change). In practice, other players typically jump from
 * "connected" → "disconnected" when the checkHeartbeatTimeouts cron patches
 * isConnected. The local player's own "reconnecting" state is driven
 * client-side by usePlayerAuth's missed-heartbeat tracking, which is fully
 * reactive and not affected by this limitation.
 *
 * @param isConnected - Server-authoritative connection flag
 * @param lastHeartbeat - Timestamp of last successful heartbeat
 */
export function computeConnectionStatus(
  isConnected: boolean,
  lastHeartbeat: number | undefined
): ConnectionStatus {
  if (!isConnected) return "disconnected";
  if (!lastHeartbeat) return "connected";
  const elapsed = Date.now() - lastHeartbeat;
  if (elapsed > HEARTBEAT_TIMEOUT_MS) return "disconnected";
  if (elapsed > HEARTBEAT_INTERVAL_MS) return "reconnecting";
  return "connected";
}
