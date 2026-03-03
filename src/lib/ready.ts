/**
 * Whether a player's ready signal is active.
 * Ready is a persistent toggle — no expiry.
 */
export function isReadyActive(readyAt: number | undefined): boolean {
  return readyAt != null;
}
