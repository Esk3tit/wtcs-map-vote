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
import { advanceRound, executeBan, resolveRound } from "./lib/votingHelpers";
import { completeSession, transitionSession } from "./lib/sessionLifecycle";
import { pickRandom } from "./lib/random";
import { createWideEvent } from "./lib/wideEvent";

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
    const ev = createWideEvent("sessionCleanup", "clearSessionIpAddresses", "internalMutation");
    const startTime = Date.now();
    try {
      const { sessionId } = args;
      ev.set("sessionId", sessionId);

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

      ev.set("clearedCount", clearedCount);
      ev.setOutcome(clearedCount > 0 ? "ok" : "noop");
      return { clearedCount };
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
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
    const ev = createWideEvent("sessionCleanup", "expireStaleSessions", "internalMutation");
    const startTime = Date.now();
    try {
      const now = Date.now();

      // Find sessions that have passed their expiration time
      // Only expire sessions in DRAFT or WAITING status
      const staleSessions = await ctx.db
        .query("sessions")
        .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
        .collect();

      // Filter to only DRAFT and WAITING sessions (others shouldn't auto-expire)
      ev.set("staleSessionsFound", staleSessions.length);
      const sessionsToExpire = staleSessions.filter(
        (s) => s.status === "DRAFT" || s.status === "WAITING"
      );
      ev.set("filteredToExpire", sessionsToExpire.length);

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

        await logAction(ctx, {
          sessionId: session._id,
          action: "SESSION_EXPIRED",
          actorType: "SYSTEM",
          details: {},
        });

        expiredCount++;
      }

      ev.set("expiredCount", expiredCount);
      ev.set("ipsClearedCount", totalIpsCleared);
      ev.setOutcome(expiredCount > 0 ? "ok" : "noop");
      return {
        expiredCount,
        ipsClearedCount: totalIpsCleared,
      };
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
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
    const ev = createWideEvent("sessionCleanup", "clearCompletedSessionIps", "internalMutation");
    const startTime = Date.now();
    try {
      // Find completed sessions that may still have IP addresses stored
      const completedSessions = await ctx.db
        .query("sessions")
        .withIndex("by_status", (q) => q.eq("status", "COMPLETE"))
        .collect();
      ev.set("completedSessionsFound", completedSessions.length);

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

      ev.set("sessionsProcessed", sessionsProcessed);
      ev.set("ipsClearedCount", totalIpsCleared);
      ev.setOutcome(totalIpsCleared > 0 ? "ok" : "noop");
      return {
        sessionsProcessed,
        ipsClearedCount: totalIpsCleared,
      };
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
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
 * MULTIPLAYER: resolves with submitted votes only (ignores non-voters).
 *   Zero votes → random single map elimination. Partial votes → resolveRound().
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
    const ev = createWideEvent("sessionCleanup", "handleTimerExpiry", "internalMutation");
    const startTime = Date.now();
    try {
      ev.set("sessionId", args.sessionId);
      ev.set("format", args.format);

      // Guard: re-read session and verify timer is still expired
      const session = await ctx.db.get(args.sessionId);
      if (!session) {
        ev.set("noopReason", "session_not_found");
        ev.setOutcome("noop");
        return { processed: false };
      }
      ev.setSession(session);
      if (session.status !== "IN_PROGRESS") {
        ev.set("noopReason", `status_${session.status}`);
        ev.setOutcome("noop");
        return { processed: false };
      }
      if (session.timerStartedAt !== args.expectedTimerStartedAt) {
        ev.set("noopReason", "timer_changed");
        ev.setOutcome("noop");
        return { processed: false };
      }
      if (session.timerPausedAt !== undefined) {
        ev.set("noopReason", "timer_paused");
        ev.setOutcome("noop");
        return { processed: false };
      }

      if (args.format === "ABBA") {
        // --- ABBA: auto-ban a random map for the active player ---
        const allPlayers = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        const sortedPlayers = sortPlayersByJoinOrder(allPlayers);
        const activePlayerIndex = getActivePlayerIndex(session.currentTurn);
        const activePlayer = sortedPlayers[activePlayerIndex];

        if (!activePlayer) {
          // Log error but don't throw — timer jobs should complete even with data inconsistencies
          ev.set("errorReason", "no_active_player");
          ev.setError(`No active player at index ${activePlayerIndex}`);
          return { processed: false };
        }

        const availableMaps = await ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", session._id).eq("state", "AVAILABLE")
          )
          .collect();

        if (availableMaps.length === 0) {
          // Log error but don't throw — timer jobs should complete even with data inconsistencies
          ev.set("errorReason", "no_available_maps");
          ev.setError("No available maps");
          return { processed: false };
        }

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

        if (availableMaps.length === 1) {
          await completeSession(ctx, session, availableMaps[0], {
            turn: session.currentTurn,
            reason: "Last map standing (timer expired, auto-completed)",
          });
          ev.setOutcome("ok");
          return { processed: true };
        }

        const targetMap = pickRandom(availableMaps);
        ev.setMap(targetMap);
        await executeBan(ctx, {
          session,
          player: activePlayer,
          targetMap,
          submittedByAdmin: false,
          actorType: "SYSTEM",
        });

        ev.setOutcome("ok");
        return { processed: true };
      }

      // --- MULTIPLAYER: resolve with submitted votes only ---
      const allPlayers = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      const unvotedPlayers = allPlayers.filter((p) => !p.hasVotedThisRound);

      if (unvotedPlayers.length === 0) {
        ev.set("noopReason", "all_voted");
        ev.setOutcome("noop");
        return { processed: false };
      }

      const votedCount = allPlayers.length - unvotedPlayers.length;
      ev.set("votedCount", votedCount);
      ev.set("unvotedCount", unvotedPlayers.length);

      await logAction(ctx, {
        sessionId: session._id,
        action: "TIMER_EXPIRED",
        actorType: "SYSTEM",
        details: {
          round: session.currentRound,
          reason: `AUTO_EXPIRED (${unvotedPlayers.length} unvoted)`,
        },
      });

      if (votedCount === 0) {
        const availableMaps = await ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", session._id).eq("state", "AVAILABLE")
          )
          .collect();

        if (availableMaps.length === 0) {
          // Log error but don't throw — timer jobs should complete even with data inconsistencies
          ev.set("errorReason", "no_available_maps");
          ev.setError("No available maps");
          return { processed: false };
        }

        if (availableMaps.length === 1) {
          await completeSession(ctx, session, availableMaps[0], {
            round: session.currentRound,
            reason: "Last map standing (no votes, auto-completed)",
          });
          ev.setOutcome("ok");
          return { processed: true };
        }

        const targetMap = pickRandom(availableMaps);
        ev.setMap(targetMap);
        await ctx.db.patch(targetMap._id, {
          state: "BANNED",
          voteCount: 0,
          bannedAtRound: session.currentRound,
          bannedByTeamNames: [],
        });

        await logAction(ctx, {
          sessionId: session._id,
          action: "MAP_BANNED",
          actorType: "SYSTEM",
          details: {
            mapId: targetMap._id,
            mapName: targetMap.name,
            round: session.currentRound,
            reason: "NO_VOTES_RANDOM",
          },
        });

        const remainingMaps = availableMaps.filter(
          (m) => m._id !== targetMap._id
        );

        if (remainingMaps.length === 1) {
          await completeSession(ctx, session, remainingMaps[0], {
            round: session.currentRound,
            reason: "Last map standing after no-vote random elimination",
          });
        } else {
          await advanceRound(
            ctx,
            session,
            `1 map randomly eliminated (no votes), ${remainingMaps.length} remain`
          );
        }
      } else {
        await resolveRound(ctx, session);
      }

      ev.setOutcome("ok");
      return { processed: true };
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

// ============================================================================
// Disconnect Detection (WAR-49)
// ============================================================================

/**
 * Check for player heartbeat timeouts and auto-pause sessions.
 *
 * Scans IN_PROGRESS and WAITING sessions for players whose heartbeat has gone
 * stale (older than HEARTBEAT_TIMEOUT_MS). Marks them as disconnected.
 * Auto-pauses only IN_PROGRESS sessions when a critical player disconnects:
 * - ABBA: any player disconnect pauses (both must be present)
 * - MULTIPLAYER: only unvoted player disconnect pauses
 * WAITING sessions only update player status (no auto-pause, no audit log).
 *
 * Designed to be called by a 30-second interval cron.
 * Worst-case detection latency: ~90 seconds (60s timeout + 30s cron interval).
 */
export const checkHeartbeatTimeouts = internalMutation({
  args: {},
  returns: v.object({
    checkedSessionCount: v.number(),
    disconnectedPlayerCount: v.number(),
    pausedSessionCount: v.number(),
  }),
  handler: async (ctx) => {
    const ev = createWideEvent("sessionCleanup", "checkHeartbeatTimeouts", "internalMutation");
    const startTime = Date.now();
    try {
      const now = Date.now();
      let disconnectedPlayerCount = 0;
      let pausedSessionCount = 0;

      // Collect IN_PROGRESS and WAITING sessions.
      const [inProgressSessions, waitingSessions] = await Promise.all([
        ctx.db
          .query("sessions")
          .withIndex("by_status", (q) => q.eq("status", "IN_PROGRESS"))
          .collect(),
        ctx.db
          .query("sessions")
          .withIndex("by_status", (q) => q.eq("status", "WAITING"))
          .collect(),
      ]);
      ev.set("inProgressChecked", inProgressSessions.length);
      ev.set("waitingChecked", waitingSessions.length);
      const sessions = [...inProgressSessions, ...waitingSessions];

      for (const session of sessions) {
        const players = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();

        let sessionNeedsPause = false;
        const isInProgress = session.status === "IN_PROGRESS";

        // Mark stale connected players as disconnected
        for (const player of players) {
          if (!player.isConnected) continue;

          // Skip players that haven't completed a heartbeat cycle yet
          if (player.lastHeartbeat === undefined) continue;
          if (player.lastHeartbeat >= now - HEARTBEAT_TIMEOUT_MS) continue;

          await ctx.db.patch(player._id, {
            isConnected: false,
            readyAt: undefined,
          });
          disconnectedPlayerCount++;

          // Only log audit events and auto-pause for IN_PROGRESS sessions
          if (isInProgress) {
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
        }

        // Re-read session to see this mutation's own writes
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

      ev.set("checkedSessionCount", sessions.length);
      ev.set("disconnectedPlayerCount", disconnectedPlayerCount);
      ev.set("pausedSessionCount", pausedSessionCount);
      ev.setOutcome(disconnectedPlayerCount > 0 ? "ok" : "noop");
      return {
        checkedSessionCount: sessions.length,
        disconnectedPlayerCount,
        pausedSessionCount,
      };
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});
