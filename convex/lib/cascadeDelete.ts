import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";

// ============================================================================
// Shared Helper
// ============================================================================

/**
 * Delete all records related to a session (players, maps, votes).
 * Does NOT delete the session itself or audit logs.
 * Call this from within a mutation for transactional atomicity.
 *
 * @param ctx - Mutation context
 * @param sessionId - The session whose related records should be deleted
 */
export async function cascadeDeleteSessionRecords(
  ctx: MutationCtx,
  sessionId: Id<"sessions">
): Promise<{ players: number; maps: number; votes: number }> {
  const [players, maps, votes] = await Promise.all([
    ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect(),
    ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect(),
    ctx.db
      .query("votes")
      .withIndex("by_sessionId_and_round", (q) => q.eq("sessionId", sessionId))
      .collect(),
  ]);

  await Promise.all([
    ...players.map((p) => ctx.db.delete(p._id)),
    ...maps.map((m) => ctx.db.delete(m._id)),
    ...votes.map((v) => ctx.db.delete(v._id)),
  ]);

  return { players: players.length, maps: maps.length, votes: votes.length };
}

// ============================================================================
// Internal Mutation
// ============================================================================

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
      throw new ConvexError(`Session ${sessionId} not found`);
    }

    // Delete players, maps, and votes via shared helper
    const { players, maps, votes } = await cascadeDeleteSessionRecords(
      ctx,
      sessionId
    );

    // Handle audit logs separately (controlled by preserveAuditLogs flag)
    const logs = preserveAuditLogs
      ? []
      : await ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect();

    if (!preserveAuditLogs) {
      await Promise.all(logs.map((log) => ctx.db.delete(log._id)));
    }

    // Delete the session itself
    await ctx.db.delete(sessionId);

    return {
      deleted: {
        votes,
        players,
        maps,
        auditLogs: logs.length,
        session: 1,
      },
    };
  },
});
