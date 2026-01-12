import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Deletes a session and all related records (cascade delete).
 *
 * Order matters for referential integrity:
 * 1. Delete votes (references sessionPlayers and sessionMaps)
 * 2. Delete sessionPlayers
 * 3. Delete sessionMaps
 * 4. Delete auditLogs (unless preserved for historical record)
 * 5. Delete session
 *
 * Convex mutations are atomic - if any step fails, all changes roll back.
 */
export const deleteSessionWithCascade = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    preserveAuditLogs: v.optional(v.boolean()), // Default: false (delete logs)
  },
  returns: v.object({
    deleted: v.object({
      votes: v.number(),
      players: v.number(),
      maps: v.number(),
      auditLogs: v.number(),
      session: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const { sessionId, preserveAuditLogs = false } = args;

    // Verify session exists
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Collect all related records first (before any deletions)
    // Using by_sessionId_and_round compound index - querying by first field works
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_sessionId_and_round", (q) => q.eq("sessionId", sessionId))
      .collect();

    const players = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();

    const maps = await ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();

    const logs = preserveAuditLogs
      ? []
      : await ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect();

    // Delete in order: votes -> players -> maps -> logs -> session
    // (children before parents to maintain referential integrity)
    await Promise.all(votes.map((vote) => ctx.db.delete(vote._id)));
    await Promise.all(players.map((player) => ctx.db.delete(player._id)));
    await Promise.all(maps.map((map) => ctx.db.delete(map._id)));
    if (!preserveAuditLogs) {
      await Promise.all(logs.map((log) => ctx.db.delete(log._id)));
    }
    await ctx.db.delete(sessionId);

    return {
      deleted: {
        votes: votes.length,
        players: players.length,
        maps: maps.length,
        auditLogs: logs.length,
        session: 1,
      },
    };
  },
});
