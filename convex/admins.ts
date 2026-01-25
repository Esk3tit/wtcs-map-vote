/**
 * Admins Module
 *
 * Handles admin user queries for session creation.
 * TODO: Replace with auth context when auth is integrated (Phase 2)
 */

import { query } from "./_generated/server";

import { v } from "convex/values";

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the first admin in the database.
 * Temporary solution until auth is integrated.
 */
export const getFirstAdmin = query({
  args: {},
  returns: v.union(v.id("admins"), v.null()),
  handler: async (ctx) => {
    const admin = await ctx.db.query("admins").first();
    return admin?._id ?? null;
  },
});
