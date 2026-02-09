/**
 * Auth Module
 *
 * Authentication and authorization helpers for admin and player functions.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================================
// Player Token Validation
// ============================================================================

/** Error codes shared across player token validation callers. */
export type PlayerLookupError =
  | "INVALID_IP"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND";

type PlayerLookupSuccess = {
  status: "ok";
  player: Doc<"sessionPlayers">;
  session: Doc<"sessions">;
};

type PlayerLookupFailure = {
  status: "error";
  error: PlayerLookupError;
};

export type PlayerLookupResult = PlayerLookupSuccess | PlayerLookupFailure;

/**
 * Look up and validate a player token with common read-only checks.
 *
 * Performs the shared validation steps used by both token activation
 * (playerAuth) and voting (voting). Callers add their own logic on top
 * (e.g. IP locking, session-status checks, ban logic).
 *
 * Checks performed:
 * 1. IP address is present and not "unknown"
 * 2. Token exists in sessionPlayers
 * 3. Token has not expired
 * 4. Session exists
 *
 * @param ctx - Query or mutation context
 * @param token - Player access token
 * @param ipAddress - Client IP (already trimmed by caller)
 */
export async function lookupAndValidatePlayer(
  ctx: QueryCtx | MutationCtx,
  token: string,
  ipAddress: string
): Promise<PlayerLookupResult> {
  // Reject empty or unresolved IP
  if (!ipAddress || ipAddress === "unknown") {
    return { status: "error", error: "INVALID_IP" };
  }

  // Look up player by token
  const player = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();

  if (!player) {
    return { status: "error", error: "INVALID_TOKEN" };
  }

  // Check token expiration
  if (player.tokenExpiresAt < Date.now()) {
    return { status: "error", error: "TOKEN_EXPIRED" };
  }

  // Get session
  const session = await ctx.db.get(player.sessionId);
  if (!session) {
    return { status: "error", error: "SESSION_NOT_FOUND" };
  }

  return { status: "ok", player, session };
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Get the current admin from auth identity.
 * Uses getAuthUserId to extract userId from the JWT subject claim,
 * then looks up the user's email to find the matching admin.
 * Returns null if not authenticated or admin not found in whitelist.
 */
export async function getCurrentAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"admins"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get(userId);
  if (!user?.email) return null;

  const normalizedEmail = normalizeEmail(user.email);
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
    throw new ConvexError("Authentication required");
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
    throw new ConvexError("Root admin access required");
  }
  return admin;
}

/**
 * Normalize email for storage and comparison.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
