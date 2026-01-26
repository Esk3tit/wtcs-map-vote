/**
 * Admins Module
 *
 * Handles admin user queries for authentication and session creation.
 */

import { query } from "./_generated/server";

import { v } from "convex/values";

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the currently authenticated user's info.
 * Returns null if not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      name: v.string(),
      email: v.optional(v.string()),
      picture: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      name: identity.name ?? "Admin",
      email: identity.email ?? undefined,
      picture: identity.pictureUrl ?? undefined,
    };
  },
});

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
