/**
 * Token Generation
 *
 * Shared helper for generating unique player tokens.
 * Used by assignPlayer, createSessionFull, and cloneSession.
 */

import type { MutationCtx } from "../_generated/server";

import { ConvexError } from "convex/values";

/**
 * Generate a unique player token with batch and database deduplication.
 * Uses crypto.randomUUID() with dashes stripped (32 hex chars).
 *
 * @param ctx - Mutation context for database access
 * @param generatedTokens - Set tracking tokens generated in this transaction
 */
export async function generateUniqueToken(
  ctx: MutationCtx,
  generatedTokens: Set<string>
): Promise<string> {
  let token = crypto.randomUUID().replace(/-/g, "");

  // Ensure no collision within this batch
  while (generatedTokens.has(token)) {
    token = crypto.randomUUID().replace(/-/g, "");
  }
  generatedTokens.add(token);

  // Check token uniqueness in database (indexes don't enforce uniqueness)
  const existing = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (existing) {
    throw new ConvexError("Token collision - please retry");
  }

  return token;
}
