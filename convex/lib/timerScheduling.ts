/**
 * Timer Scheduling Helpers
 *
 * Provides per-session timer scheduling via ctx.scheduler.runAt().
 * Each timer start point schedules a handleTimerExpiry function that
 * fires at the exact expiration moment. Uses guard-based no-op pattern
 * to handle race conditions (WAR-47).
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

import { internal } from "../_generated/api";

/**
 * Schedule a timer expiry handler for a session.
 *
 * The scheduled function will fire at the exact moment the timer expires
 * (timerStartedAt + turnTimerSeconds * 1000). It uses guard-based no-op
 * to self-cancel if the player acts before it fires.
 *
 * @param ctx - Mutation context (must have scheduler access)
 * @param sessionId - Session to schedule for
 * @param timerStartedAt - When the timer started (ms since epoch)
 * @param turnTimerSeconds - Timer duration in seconds
 * @param format - Session format (ABBA or MULTIPLAYER)
 */
export async function scheduleTimerExpiry(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  timerStartedAt: number,
  turnTimerSeconds: number,
  format: "ABBA" | "MULTIPLAYER"
): Promise<void> {
  const expiresAt = timerStartedAt + turnTimerSeconds * 1000;
  await ctx.scheduler.runAt(
    expiresAt,
    internal.sessionCleanup.handleTimerExpiry,
    {
      sessionId,
      expectedTimerStartedAt: timerStartedAt,
      format,
    }
  );
}
