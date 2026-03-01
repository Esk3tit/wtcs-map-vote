/**
 * Player Authentication Module
 *
 * Handles player token validation with IP locking and ready signalling.
 * Players authenticate via token URLs; on first use the token is
 * locked to the client's IP address to prevent sharing.
 */

import { internalMutation } from "./_generated/server";

import { v } from "convex/values";

import { ACTIVE_SESSION_STATUSES, HEARTBEAT_SKIP_MS, READY_SKIP_MS } from "./lib/constants";
import { lookupAndValidatePlayer } from "./lib/auth";
import { rateLimiter } from "./lib/rateLimits";

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
        v.literal("IP_MISMATCH"),
        v.literal("RATE_LIMITED")
      ),
      retryAfter: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const { token } = args;
    const ipAddress = args.ipAddress.trim();
    const now = Date.now();

    // Reject unresolved IPs before rate limiting to avoid a shared "unknown" bucket
    if (!ipAddress || ipAddress === "unknown") {
      return { status: "error" as const, error: "INVALID_IP" as const };
    }

    // Rate limit by IP address (brute force protection)
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "validateToken", {
      key: ipAddress,
    });
    if (!ok) {
      return {
        status: "error" as const,
        error: "RATE_LIMITED" as const,
        retryAfter,
      };
    }

    // Shared read-only validation: IP check, token lookup, expiry, session
    const result = await lookupAndValidatePlayer(ctx, token, ipAddress);
    if (result.status === "error") {
      return result;
    }

    const { player, session } = result;

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
      const wasDisconnected = !player.isConnected;
      await ctx.db.patch(player._id, {
        isConnected: true,
        lastHeartbeat: now,
      });

      if (wasDisconnected) {
        await logAction(ctx, {
          sessionId: session._id,
          action: "PLAYER_CONNECTED",
          actorType: "PLAYER",
          actorId: player._id,
          details: { teamName: player.teamName },
        });
      }
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
        v.literal("TOKEN_NOT_ACTIVATED"),
        v.literal("RATE_LIMITED")
      ),
      retryAfter: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const { token } = args;
    const ipAddress = args.ipAddress.trim();
    const now = Date.now();

    // Rate limit by player token
    const { ok, retryAfter } = await rateLimiter.limit(
      ctx,
      "playerHeartbeat",
      { key: token }
    );
    if (!ok) {
      return {
        status: "error" as const,
        error: "RATE_LIMITED" as const,
        retryAfter,
      };
    }

    // Reject empty, whitespace-only, or unresolved IP addresses
    if (!ipAddress || ipAddress === "unknown") {
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

/**
 * Signal player readiness in the lobby.
 *
 * Sets `readyAt = Date.now()` on the player record. Readiness expires
 * client-side after READY_EXPIRY_MS (60s); players can re-press to refresh.
 * Only allowed in WAITING state (ready only matters before session starts).
 *
 * Called by the HTTP action POST /api/player/ready.
 *
 * @param token - Player access token
 * @param ipAddress - Client IP from HTTP headers
 */
export const playerReady = internalMutation({
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
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_WAITING"),
        v.literal("TOKEN_NOT_ACTIVATED"),
        v.literal("IP_MISMATCH"),
        v.literal("RATE_LIMITED")
      ),
      retryAfter: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const { token } = args;
    const ipAddress = args.ipAddress.trim();

    // Rate limit by player token
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "playerReady", {
      key: token,
    });
    if (!ok) {
      return {
        status: "error" as const,
        error: "RATE_LIMITED" as const,
        retryAfter,
      };
    }

    // Shared read-only validation: IP check, token lookup, expiry, session
    const result = await lookupAndValidatePlayer(ctx, token, ipAddress);
    if (result.status === "error") {
      return result;
    }

    const { player, session } = result;

    // Ready only makes sense in WAITING state
    if (session.status !== "WAITING") {
      return {
        status: "error" as const,
        error: "SESSION_NOT_WAITING" as const,
      };
    }

    // Activation and IP-match checks are intentionally post-delegation:
    // lookupAndValidatePlayer handles token/expiry/session checks but not
    // these caller-specific guards (cf. playerHeartbeat which checks inline).
    if (!player.ipAddress) {
      return {
        status: "error" as const,
        error: "TOKEN_NOT_ACTIVATED" as const,
      };
    }

    if (player.ipAddress !== ipAddress) {
      return { status: "error" as const, error: "IP_MISMATCH" as const };
    }

    // Skip write if readyAt is still fresh (reduces reactive query churn)
    const now = Date.now();
    if (player.readyAt && now - player.readyAt < READY_SKIP_MS) {
      return { status: "ok" as const };
    }

    // Set readyAt timestamp
    await ctx.db.patch(player._id, { readyAt: now });

    return { status: "ok" as const };
  },
});
