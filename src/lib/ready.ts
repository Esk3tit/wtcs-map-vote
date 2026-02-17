import { READY_EXPIRY_MS } from "../../convex/lib/constants";

/**
 * Whether a player's ready signal is still active (not expired).
 */
export function isReadyActive(
  readyAt: number | undefined,
  now: number
): boolean {
  return readyAt != null && now - readyAt < READY_EXPIRY_MS;
}
