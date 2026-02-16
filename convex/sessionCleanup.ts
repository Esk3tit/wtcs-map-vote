/**
 * Session Cleanup Module
 *
 * Handles session lifecycle cleanup tasks including IP address clearing for privacy
 * compliance, stale session expiration, timer expiry handling (WAR-47), and
 * disconnect detection with auto-pause (WAR-49).
 * Contains internal mutations designed to be called by cron jobs, schedulers,
 * or other internal processes.
 */

import { internalMutation } from "./_generated/server";

import { v } from "convex/values";

import { getActivePlayerIndex, sortPlayersByJoinOrder, HEARTBEAT_TIMEOUT_MS } from "./lib/constants";
import { executeBan, executeVote } from "./lib/votingHelpers";
import { transitionSession } from "./lib/sessionLifecycle";
import { pickRandom } from "./lib/random";
import { logAction } from "./audit";

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Clear IP addresses from all players in a session.
 *
 * This is called when sessions reach terminal states (COMPLETE or EXPIRED)
 * to comply with GDPR/privacy requirements. IP addresses are only stored
 * for the duration of an active session.
 *
 * @see docs/SPECIFICATION.md Section 12.4 (Data Protection)
 */
export const clearSessionIpAddresses = internalMutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.object({
    clearedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { sessionId } = args;

    // Get all players in the session
    const players = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();

    let clearedCount = 0;
    const now = Date.now();

    // Clear IP addresses and invalidate tokens for players
    for (const player of players) {
      if (player.ipAddress || player.tokenExpiresAt > now) {
        await ctx.db.patch(player._id, {
          ipAddress: undefined,
          tokenExpiresAt: Math.min(player.tokenExpiresAt, now),
        });
        if (player.ipAddress) {
          clearedCount++;
        }
      }
    }

    if (clearedCount > 0) {
      console.log(
        `Cleared ${clearedCount} IP address(es) from session ${sessionId}`
      );
    }

    return { clearedCount };
  },
});

/**
 * Expires stale sessions that have been in DRAFT or WAITING status
 * for longer than 2 weeks.
 *
 * When a session expires:
 * 1. Status is changed to EXPIRED
 * 2. IP addresses are cleared for privacy compliance
 *
 * This function is designed to be called by a cron job.
 *
 * @see docs/SPECIFICATION.md Section 3.5 (Session Expiration)
 */
export const expireStaleSessions = internalMutation({
  args: {},
  returns: v.object({
    expiredCount: v.number(),
    ipsClearedCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Find sessions that have passed their expiration time
    // Only expire sessions in DRAFT or WAITING status
    const staleSessions = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    // Filter to only DRAFT and WAITING sessions (others shouldn't auto-expire)
    const sessionsToExpire = staleSessions.filter(
      (s) => s.status === "DRAFT" || s.status === "WAITING"
    );

    let expiredCount = 0;
    let totalIpsCleared = 0;

    for (const session of sessionsToExpire) {
      // Update session status to EXPIRED
      await ctx.db.patch(session._id, {
        status: "EXPIRED" as const,
        updatedAt: now,
      });

      // Clear IP addresses for privacy compliance
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const player of players) {
        if (player.ipAddress || player.tokenExpiresAt > now) {
          await ctx.db.patch(player._id, {
            ipAddress: undefined,
            tokenExpiresAt: Math.min(player.tokenExpiresAt, now),
          });
          if (player.ipAddress) {
            totalIpsCleared++;
          }
        }
      }

      // Create audit log entry for expiration
      await ctx.db.insert("auditLogs", {
        sessionId: session._id,
        action: "SESSION_EXPIRED",
        actorType: "SYSTEM",
        details: {},
        timestamp: now,
      });

      expiredCount++;
    }

    if (expiredCount > 0) {
      console.log(
        `Expired ${expiredCount} stale session(s), cleared ${totalIpsCleared} IP address(es)`
      );
    }

    return {
      expiredCount,
      ipsClearedCount: totalIpsCleared,
    };
  },
});

/**
 * Clears IP addresses from completed sessions.
 *
 * This should be called when a session transitions to COMPLETE status
 * to ensure IP addresses are not retained after the session ends.
 *
 * This is a separate function from expireStaleSessions because session
 * completion is triggered by voting logic, not by the expiration cron.
 */
export const clearCompletedSessionIps = internalMutation({
  args: {},
  returns: v.object({
    sessionsProcessed: v.number(),
    ipsClearedCount: v.number(),
  }),
  handler: async (ctx) => {
    // Find completed sessions that may still have IP addresses stored
    const completedSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
      .collect();

    let sessionsProcessed = 0;
    let totalIpsCleared = 0;

    for (const session of completedSessions) {
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      const now = Date.now();

      // Skip sessions where all players are already cleaned
      const hasDataToClean = players.some(
        (p) => p.ipAddress || p.tokenExpiresAt > now
      );
      if (!hasDataToClean) continue;

      let sessionHadIps = false;
      for (const player of players) {
        if (player.ipAddress || player.tokenExpiresAt > now) {
          await ctx.db.patch(player._id, {
            ipAddress: undefined,
            tokenExpiresAt: Math.min(player.tokenExpiresAt, now),
          });
          if (player.ipAddress) {
            totalIpsCleared++;
            sessionHadIps = true;
          }
        }
      }

      if (sessionHadIps) {
        sessionsProcessed++;
      }
    }

    if (totalIpsCleared > 0) {
      console.log(
        `Cleared ${totalIpsCleared} IP address(es) from ${sessionsProcessed} completed session(s)`
      );
    }

    return {
      sessionsProcessed,
      ipsClearedCount: totalIpsCleared,
    };
  },
});

// ============================================================================
// Timer Expiration (WAR-47)
// ============================================================================

/**
 * Handle timer expiration for a specific session.
 *
 * Scheduled via ctx.scheduler.runAt() when a timer starts. Uses guard-based
 * no-op pattern to handle race conditions — if the player acted before this
 * fires, the guard detects the changed timerStartedAt and exits cleanly.
 *
 * ABBA: auto-bans a random available map for the active player.
 * MULTIPLAYER: auto-votes a random available map for each unvoted player.
 *
 * @param sessionId - Session whose timer expired
 * @param expectedTimerStartedAt - The timerStartedAt value at scheduling time
 * @param format - Session format (ABBA or MULTIPLAYER)
 */
export const handleTimerExpiry = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    expectedTimerStartedAt: v.number(),
    format: v.union(v.literal("ABBA"), v.literal("MULTIPLAYER")),
  },
  returns: v.object({ processed: v.boolean() }),
  handler: async (ctx, args) => {
    // Guard: re-read session and verify timer is still expired
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      console.log(`Timer expiry no-op: session ${args.sessionId} not found`);
      return { processed: false };
    }
    if (session.status !== "IN_PROGRESS") {
      console.log(`Timer expiry no-op: session ${args.sessionId} status is ${session.status}`);
      return { processed: false };
    }
    if (session.timerStartedAt !== args.expectedTimerStartedAt) {
      console.log(`Timer expiry no-op: session ${args.sessionId} timerStartedAt changed (expected ${args.expectedTimerStartedAt}, got ${session.timerStartedAt})`);
      return { processed: false };
    }
    if (session.timerPausedAt !== undefined) {
      console.log(`Timer expiry no-op: session ${args.sessionId} timer is paused`);
      return { processed: false };
    }

    if (args.format === "ABBA") {
      // --- ABBA: auto-ban a random map for the active player ---

      // Get players sorted by join order to determine active player
      const allPlayers = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      const sortedPlayers = sortPlayersByJoinOrder(allPlayers);
      const activePlayerIndex = getActivePlayerIndex(session.currentTurn);
      const activePlayer = sortedPlayers[activePlayerIndex];

      if (!activePlayer) {
        console.error(
          `Timer expiry: no active player at index ${activePlayerIndex} for session ${session._id}`
        );
        return { processed: false };
      }

      // Get available maps
      const availableMaps = await ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId_and_state", (q) =>
          q.eq("sessionId", session._id).eq("state", "AVAILABLE")
        )
        .collect();

      if (availableMaps.length === 0) {
        console.error(
          `Timer expiry: no available maps for session ${session._id}`
        );
        return { processed: false };
      }

      // Log timer expiry audit event
      await logAction(ctx, {
        sessionId: session._id,
        action: "TIMER_EXPIRED",
        actorType: "SYSTEM",
        details: {
          turn: session.currentTurn,
          teamName: activePlayer.teamName,
          reason: "AUTO_EXPIRED",
        },
      });

      // Pick random map and execute ban
      // executeBan handles scheduling the next timer internally
      const targetMap = pickRandom(availableMaps);
      await executeBan(ctx, {
        session,
        player: activePlayer,
        targetMap,
        submittedByAdmin: false,
        actorType: "SYSTEM",
      });

      return { processed: true };
    }

    // --- MULTIPLAYER: auto-vote for all unvoted players ---

    const allPlayers = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect();

    const unvotedPlayers = allPlayers.filter((p) => !p.hasVotedThisRound);

    if (unvotedPlayers.length === 0) {
      // All players already voted — round should have resolved
      return { processed: false };
    }

    // Log timer expiry audit event
    await logAction(ctx, {
      sessionId: session._id,
      action: "TIMER_EXPIRED",
      actorType: "SYSTEM",
      details: {
        round: session.currentRound,
        reason: `AUTO_EXPIRED (${unvotedPlayers.length} unvoted)`,
      },
    });

    // Query available maps once — executeVote only inserts votes and marks players,
    // it does not ban maps. Maps only change when resolveRound fires on the last vote.
    const availableMaps = await ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId_and_state", (q) =>
        q.eq("sessionId", session._id).eq("state", "AVAILABLE")
      )
      .collect();

    if (availableMaps.length === 0) {
      console.error(
        `Timer expiry: no available maps for auto-vote in session ${session._id}`
      );
      return { processed: false };
    }

    // Auto-vote for each unvoted player sequentially
    // The last executeVote triggers resolveRound automatically
    for (const player of unvotedPlayers) {
      const targetMap = pickRandom(availableMaps);
      await executeVote(ctx, {
        session,
        player,
        targetMap,
        submittedByAdmin: false,
        actorType: "SYSTEM",
      });
    }

    // resolveRound (called by the last executeVote) handles scheduling
    // the next timer if the round advances or a revote is triggered

    return { processed: true };
  },
});

// ============================================================================
// Disconnect Detection (WAR-49)
// ============================================================================

/**
 * Check for player heartbeat timeouts and auto-pause sessions.
 *
 * Scans all IN_PROGRESS sessions for players whose heartbeat has gone stale
 * (older than HEARTBEAT_TIMEOUT_MS). Marks them as disconnected and auto-pauses
 * the session when a critical player disconnects:
 * - ABBA: any player disconnect pauses (both must be present)
 * - MULTIPLAYER: only unvoted player disconnect pauses
 *
 * Designed to be called by a 30-second interval cron.
 * Worst-case detection latency: ~60 seconds (30s timeout + 30s cron interval).
 */
export const checkHeartbeatTimeouts = internalMutation({
  args: {},
  returns: v.object({
    checkedSessionCount: v.number(),
    disconnectedPlayerCount: v.number(),
    pausedSessionCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let disconnectedPlayerCount = 0;
    let pausedSessionCount = 0;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
      .collect();

    for (const session of sessions) {
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      let sessionNeedsPause = false;

      // Mark stale connected players as disconnected
      for (const player of players) {
        if (!player.isConnected) continue;

        // Skip players that haven't completed a heartbeat cycle yet
        if (player.lastHeartbeat === undefined) continue;
        if (player.lastHeartbeat >= now - HEARTBEAT_TIMEOUT_MS) continue;

        await ctx.db.patch(player._id, { isConnected: false });
        disconnectedPlayerCount++;

        await logAction(ctx, {
          sessionId: session._id,
          action: "PLAYER_DISCONNECTED",
          actorType: "SYSTEM",
          details: { teamName: player.teamName },
        });

        // ABBA: pause for any disconnect (both players must be present)
        // MULTIPLAYER: pause only if disconnected player hasn't voted this round
        if (session.format === "ABBA") {
          sessionNeedsPause = true;
        } else if (session.format === "MULTIPLAYER" && !player.hasVotedThisRound) {
          sessionNeedsPause = true;
        }
      }

      // Auto-pause with fresh session read to prevent stale-state rollback
      if (sessionNeedsPause) {
        const freshSession = await ctx.db.get(session._id);
        if (freshSession && freshSession.status === "IN_PROGRESS") {
          await transitionSession(ctx, freshSession, "PAUSED", {
            auditAction: "SESSION_PAUSED",
            actorType: "SYSTEM",
            patches: { timerPausedAt: now },
            auditDetails: { reason: "PLAYER_DISCONNECT" },
          });
          pausedSessionCount++;
        }
      }
    }

    if (disconnectedPlayerCount > 0) {
      console.log(
        `Heartbeat check: ${disconnectedPlayerCount} player(s) disconnected, ${pausedSessionCount} session(s) paused`
      );
    }

    return {
      checkedSessionCount: sessions.length,
      disconnectedPlayerCount,
      pausedSessionCount,
    };
  },
});
