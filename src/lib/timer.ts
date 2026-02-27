/**
 * Shared timer calculation utility.
 *
 * Extracted from CountdownTimer so both the display component and
 * the audio alerts hook use the exact same remaining-time logic.
 */

/**
 * Calculate remaining seconds from server-authoritative timestamps.
 * When paused, freezes elapsed time at the pause moment instead of using Date.now().
 * Handles timerStartedAt being in the future (MULTIPLAYER reveal offset).
 */
export function calculateRemainingTime(
  turnTimerSeconds: number,
  timerStartedAt: number | undefined,
  timerPausedAt: number | undefined
): number {
  if (!timerStartedAt) return turnTimerSeconds;
  const now = timerPausedAt ?? Date.now();
  // Clamp: if timer hasn't started yet (future timerStartedAt from reveal offset),
  // show full duration instead of inflated time from negative elapsed
  if (timerStartedAt > now) return turnTimerSeconds;
  const elapsed = Math.floor((now - timerStartedAt) / 1000);
  return Math.max(0, turnTimerSeconds - elapsed);
}
