/**
 * Auth Module
 *
 * Authentication and authorization helpers for admin functions.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Get the current admin from auth identity.
 * Returns null if not authenticated or admin not found in whitelist.
 */
export async function getCurrentAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"admins"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) return null;

  const normalizedEmail = normalizeEmail(identity.email);
  return await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .first();
}

/**
 * Require authenticated admin. Throws if not authenticated.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"admins">> {
  const admin = await getCurrentAdmin(ctx);
  if (!admin) {
    throw new Error("Authentication required");
  }
  return admin;
}

/**
 * Require root admin. Throws if not root admin.
 */
export async function requireRootAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"admins">> {
  const admin = await requireAdmin(ctx);
  if (!admin.isRootAdmin) {
    throw new Error("Root admin access required");
  }
  return admin;
}

/**
 * Normalize email for storage and comparison.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
