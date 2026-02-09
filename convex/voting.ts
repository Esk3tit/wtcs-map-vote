/**
 * Voting Module
 *
 * Handles map ban/vote submissions for active sessions.
 * ABBA format: alternating ban pattern [A, B, B, A] with auto-winner.
 */

import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

import { v } from "convex/values";

import { getActivePlayerIndex } from "./lib/constants";
import { logAction } from "./audit";

// ============================================================================
// Types
// ============================================================================

type SubmitBanSuccess = {
  status: "ok";
  banned: {
    mapId: Id<"sessionMaps">;
    mapName: string;
    turn: number;
  };
  isComplete: boolean;
  winnerMapId?: Id<"sessionMaps">;
};

type SubmitBanError = {
  status: "error";
  error:
    | "INVALID_TOKEN"
    | "INVALID_IP"
    | "TOKEN_EXPIRED"
    | "SESSION_NOT_FOUND"
    | "SESSION_NOT_IN_PROGRESS"
    | "FORMAT_NOT_ABBA"
    | "NOT_YOUR_TURN"
    | "MAP_UNAVAILABLE"
    | "IP_MISMATCH";
};

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Validate a player token and IP for voting actions.
 * Similar to playerAuth.validateAndLockToken but does NOT lock IP
 * or update heartbeat — assumes token is already activated.
 *
 * @param ctx - Mutation context
 * @param token - Player access token
 * @param ipAddress - Client IP from HTTP headers
 */
async function validatePlayerForVoting(
  ctx: MutationCtx,
  token: string,
  ipAddress: string
): Promise<
  | { status: "ok"; player: Doc<"sessionPlayers">; session: Doc<"sessions"> }
  | SubmitBanError
> {
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

  // Verify IP matches (token must already be activated)
  if (!player.ipAddress || player.ipAddress !== ipAddress) {
    return { status: "error", error: "IP_MISMATCH" };
  }

  // Get session
  const session = await ctx.db.get(player.sessionId);
  if (!session) {
    return { status: "error", error: "SESSION_NOT_FOUND" };
  }

  return { status: "ok", player, session };
}

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Submit a map ban during ABBA voting.
 *
 * Validates the player's token/IP, checks it's their turn per the ABBA pattern,
 * bans the target map, advances the turn counter, and auto-declares a winner
 * when all bans are complete (mapPoolSize - 1 bans).
 *
 * Called by the HTTP action POST /api/player/submit-ban.
 *
 * @param token - Player access token from URL
 * @param mapId - Session map to ban
 * @param ipAddress - Client IP extracted from HTTP headers
 */
export const submitBan = internalMutation({
  args: {
    token: v.string(),
    mapId: v.id("sessionMaps"),
    ipAddress: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      banned: v.object({
        mapId: v.id("sessionMaps"),
        mapName: v.string(),
        turn: v.number(),
      }),
      isComplete: v.boolean(),
      winnerMapId: v.optional(v.id("sessionMaps")),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("INVALID_IP"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_IN_PROGRESS"),
        v.literal("FORMAT_NOT_ABBA"),
        v.literal("NOT_YOUR_TURN"),
        v.literal("MAP_UNAVAILABLE"),
        v.literal("IP_MISMATCH")
      ),
    })
  ),
  handler: async (ctx, args): Promise<SubmitBanSuccess | SubmitBanError> => {
    const { token, mapId } = args;
    const ipAddress = args.ipAddress.trim();

    // Step 1-3: Validate token and IP
    const authResult = await validatePlayerForVoting(ctx, token, ipAddress);
    if (authResult.status === "error") {
      return authResult;
    }
    const { player, session } = authResult;

    // Step 5: Check session is IN_PROGRESS
    if (session.status !== "IN_PROGRESS") {
      return { status: "error", error: "SESSION_NOT_IN_PROGRESS" };
    }

    // Step 6: Check session format is ABBA
    if (session.format !== "ABBA") {
      return { status: "error", error: "FORMAT_NOT_ABBA" };
    }

    // Step 7: Get all players, sort by creation time for consistent ordering
    const allPlayers = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect();

    const sortedPlayers = [...allPlayers].sort(
      (a, b) => a._creationTime - b._creationTime
    );

    // Step 8: Find this player's index and compute active player
    const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
    const activePlayerIndex = getActivePlayerIndex(session.currentTurn);

    // Step 9: Check it's this player's turn
    if (playerIndex !== activePlayerIndex) {
      return { status: "error", error: "NOT_YOUR_TURN" };
    }

    // Step 10: Get target map, verify it belongs to this session and is AVAILABLE
    const targetMap = await ctx.db.get(mapId);
    if (
      !targetMap ||
      targetMap.sessionId !== player.sessionId ||
      targetMap.state !== "AVAILABLE"
    ) {
      return { status: "error", error: "MAP_UNAVAILABLE" };
    }

    // === Success: execute the ban ===

    const currentTurn = session.currentTurn;

    // Ban the map
    await ctx.db.patch(mapId, {
      state: "BANNED",
      bannedByPlayerId: player._id,
      bannedAtTurn: currentTurn,
    });

    // Increment turn
    const newCurrentTurn = currentTurn + 1;
    await ctx.db.patch(session._id, {
      currentTurn: newCurrentTurn,
      updatedAt: Date.now(),
    });

    // Audit log: MAP_BANNED
    await logAction(ctx, {
      sessionId: session._id,
      action: "MAP_BANNED",
      actorType: "PLAYER",
      actorId: player._id,
      details: {
        mapId,
        mapName: targetMap.name,
        teamName: player.teamName,
        turn: currentTurn,
      },
    });

    // Check if all bans are complete
    const bansNeeded = session.mapPoolSize - 1;
    if (newCurrentTurn >= bansNeeded) {
      // Find the remaining AVAILABLE map
      const remainingMaps = await ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId_and_state", (q) =>
          q.eq("sessionId", session._id).eq("state", "AVAILABLE")
        )
        .collect();

      if (remainingMaps.length !== 1) {
        throw new Error(
          `Data integrity error: expected 1 available map after ${bansNeeded} bans, found ${remainingMaps.length}`
        );
      }

      const winnerMap = remainingMaps[0];

      // Mark winner
      await ctx.db.patch(winnerMap._id, { state: "WINNER" });

      // Complete session
      await ctx.db.patch(session._id, {
        winnerMapId: winnerMap._id,
        status: "COMPLETE",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Audit log: WINNER_DECLARED
      await logAction(ctx, {
        sessionId: session._id,
        action: "WINNER_DECLARED",
        actorType: "SYSTEM",
        details: {
          mapId: winnerMap._id,
          mapName: winnerMap.name,
        },
      });

      return {
        status: "ok",
        banned: { mapId, mapName: targetMap.name, turn: currentTurn },
        isComplete: true,
        winnerMapId: winnerMap._id,
      };
    }

    return {
      status: "ok",
      banned: { mapId, mapName: targetMap.name, turn: currentTurn },
      isComplete: false,
    };
  },
});
