import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clears IP addresses from all players in a session.
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

    // Clear IP addresses from players that have them
    for (const player of players) {
      if (player.ipAddress) {
        await ctx.db.patch(player._id, { ipAddress: undefined });
        clearedCount++;
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
        if (player.ipAddress) {
          await ctx.db.patch(player._id, { ipAddress: undefined });
          totalIpsCleared++;
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

      let sessionHadIps = false;
      for (const player of players) {
        if (player.ipAddress) {
          await ctx.db.patch(player._id, { ipAddress: undefined });
          totalIpsCleared++;
          sessionHadIps = true;
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
