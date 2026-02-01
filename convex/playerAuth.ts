/**
 * Player Authentication Module
 *
 * Handles player token validation with IP locking.
 * Players authenticate via token URLs; on first use the token is
 * locked to the client's IP address to prevent sharing.
 */

import { internalMutation } from "./_generated/server";

import { v } from "convex/values";

import { ACTIVE_SESSION_STATUSES } from "./lib/constants";
import { logAction } from "./audit";

// ============================================================================
// Token Validation Error Types
// ============================================================================

/**
 * Error codes returned by token validation.
 * These map to user-facing messages in TokenErrorPage.
 */
export type TokenValidationError =
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "IP_MISMATCH";

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Validate a player token and lock it to the client's IP address.
 *
 * On first use: stores the IP address, marks player connected, logs activation.
 * On subsequent use: verifies IP matches the stored address.
 * On IP mismatch: returns error and logs the attempt.
 *
 * Called by the HTTP action POST /api/player/validate-token.
 *
 * @param token - Player access token from URL
 * @param ipAddress - Client IP extracted from HTTP headers
 */
export const validateAndLockToken = internalMutation({
  args: {
    token: v.string(),
    ipAddress: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      playerId: v.id("sessionPlayers"),
      sessionId: v.id("sessions"),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_ACTIVE"),
        v.literal("IP_MISMATCH")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { token, ipAddress } = args;
    const now = Date.now();

    // Look up player by token
    const player = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!player) {
      // No session to log against for invalid tokens
      return { status: "error" as const, error: "INVALID_TOKEN" as const };
    }

    // Check token expiration
    if (player.tokenExpiresAt < now) {
      return { status: "error" as const, error: "TOKEN_EXPIRED" as const };
    }

    // Get session
    const session = await ctx.db.get(player.sessionId);
    if (!session) {
      return { status: "error" as const, error: "SESSION_NOT_FOUND" as const };
    }

    // Check session is in an active state
    if (!ACTIVE_SESSION_STATUSES.has(session.status)) {
      return {
        status: "error" as const,
        error: "SESSION_NOT_ACTIVE" as const,
      };
    }

    // IP locking logic
    if (player.ipAddress) {
      // Subsequent use: verify IP matches
      if (player.ipAddress !== ipAddress) {
        await logAction(ctx, {
          sessionId: session._id,
          action: "TOKEN_IP_BLOCKED",
          actorType: "SYSTEM",
          details: {
            teamName: player.teamName,
            reason: `IP mismatch: expected ${player.ipAddress}, got ${ipAddress}`,
          },
        });

        return { status: "error" as const, error: "IP_MISMATCH" as const };
      }

      // IP matches, update heartbeat
      await ctx.db.patch(player._id, {
        isConnected: true,
        lastHeartbeat: now,
      });
    } else {
      // First use: lock IP to token
      await ctx.db.patch(player._id, {
        ipAddress,
        isConnected: true,
        lastHeartbeat: now,
      });

      await logAction(ctx, {
        sessionId: session._id,
        action: "TOKEN_ACTIVATED",
        actorType: "PLAYER",
        actorId: player._id,
        details: {
          teamName: player.teamName,
          reason: `Token activated from IP ${ipAddress}`,
        },
      });
    }

    return {
      status: "ok" as const,
      playerId: player._id,
      sessionId: session._id,
    };
  },
});

/**
 * Player heartbeat to maintain connection status and verify IP.
 *
 * Called periodically by the frontend via HTTP action POST /api/player/heartbeat.
 * Verifies the token is still valid and IP still matches.
 *
 * @param token - Player access token
 * @param ipAddress - Client IP from HTTP headers
 */
export const playerHeartbeat = internalMutation({
  args: {
    token: v.string(),
    ipAddress: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("ok") }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("IP_MISMATCH")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { token, ipAddress } = args;
    const now = Date.now();

    const player = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!player) {
      return { status: "error" as const, error: "INVALID_TOKEN" as const };
    }

    if (player.tokenExpiresAt < now) {
      return { status: "error" as const, error: "TOKEN_EXPIRED" as const };
    }

    // Verify IP matches (token must have been activated first)
    if (player.ipAddress && player.ipAddress !== ipAddress) {
      return { status: "error" as const, error: "IP_MISMATCH" as const };
    }

    // Update heartbeat
    await ctx.db.patch(player._id, {
      isConnected: true,
      lastHeartbeat: now,
    });

    return { status: "ok" as const };
  },
});
