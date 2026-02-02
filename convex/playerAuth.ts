/**
 * Player Authentication Module
 *
 * Handles player token validation with IP locking.
 * Players authenticate via token URLs; on first use the token is
 * locked to the client's IP address to prevent sharing.
 */

import { internalMutation } from "./_generated/server";

import { v } from "convex/values";

import { ACTIVE_SESSION_STATUSES, HEARTBEAT_SKIP_MS } from "./lib/constants";

import { logAction } from "./audit";

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
        v.literal("INVALID_IP"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_ACTIVE"),
        v.literal("IP_MISMATCH")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { token } = args;
    const ipAddress = args.ipAddress.trim();
    const now = Date.now();

    // Reject empty or whitespace-only IP addresses
    if (!ipAddress) {
      return { status: "error" as const, error: "INVALID_IP" as const };
    }

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
            reason: `IP mismatch detected for player ${player.teamName}`,
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
          reason: `Token activated for player ${player.teamName}`,
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
        v.literal("INVALID_IP"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("IP_MISMATCH"),
        v.literal("TOKEN_NOT_ACTIVATED")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { token } = args;
    const ipAddress = args.ipAddress.trim();
    const now = Date.now();

    // Reject empty or whitespace-only IP addresses
    if (!ipAddress) {
      return { status: "error" as const, error: "INVALID_IP" as const };
    }

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

    // Require token to be activated first
    if (!player.ipAddress) {
      return { status: "error" as const, error: "TOKEN_NOT_ACTIVATED" as const };
    }

    // Verify IP matches
    if (player.ipAddress !== ipAddress) {
      return { status: "error" as const, error: "IP_MISMATCH" as const };
    }

    // Skip write if heartbeat is still fresh (reduces reactive query churn)
    if (
      player.isConnected &&
      player.lastHeartbeat &&
      now - player.lastHeartbeat < HEARTBEAT_SKIP_MS
    ) {
      return { status: "ok" as const };
    }

    // Update heartbeat
    await ctx.db.patch(player._id, {
      isConnected: true,
      lastHeartbeat: now,
    });

    return { status: "ok" as const };
  },
});
