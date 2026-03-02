/**
 * Voting Module
 *
 * Handles map ban/vote submissions for active sessions.
 * ABBA format: alternating ban pattern [A, B, B, A] with auto-winner.
 * MULTIPLAYER format: simultaneous voting with per-round elimination
 * and automatic round resolution (WAR-34).
 * Admin vote-on-behalf for disconnected/timed-out players (WAR-44).
 */

import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { getActivePlayerIndex, sortPlayersByJoinOrder } from "./lib/constants";
import {
  lookupAndValidatePlayer,
  requireAdmin,
  type PlayerLookupError,
} from "./lib/auth";
import { rateLimiter } from "./lib/rateLimits";
import {
  executeBan,
  executeVote,
  validateTargetMap,
  roundResolutionValidator,
} from "./lib/votingHelpers";
import { createWideEvent } from "./lib/wideEvent";

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Validate a player token and IP for voting actions.
 * Uses shared lookupAndValidatePlayer for common checks, then adds
 * IP match verification. Does NOT lock IP or update heartbeat —
 * assumes token is already activated.
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
  | {
      status: "error";
      error: PlayerLookupError | "IP_MISMATCH" | "SESSION_NOT_IN_PROGRESS";
    }
> {
  const result = await lookupAndValidatePlayer(ctx, token, ipAddress);
  if (result.status === "error") {
    return result;
  }

  const { player, session } = result;

  // Verify IP matches (token must already be activated)
  if (!player.ipAddress || player.ipAddress !== ipAddress) {
    return { status: "error", error: "IP_MISMATCH" };
  }

  // Reject if session has expired (closes window between expiresAt and cron cleanup)
  if (session.expiresAt < Date.now()) {
    return {
      status: "error" as const,
      error: "SESSION_NOT_IN_PROGRESS" as const,
    };
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
        v.literal("IP_MISMATCH"),
        v.literal("RATE_LIMITED")
      ),
      retryAfter: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const ev = createWideEvent("voting", "submitBan", "internalMutation");
    const startTime = Date.now();
    try {
      const { token, mapId } = args;
      const ipAddress = args.ipAddress.trim();
      ev.setIp(ipAddress);

      // Rate limit by player token (shared with submitVote — bans and votes use the same action budget)
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "submitVote", {
        key: token,
      });
      ev.set("rateLimited", !ok);
      if (!ok) {
        ev.returnError("RATE_LIMITED");
        return {
          status: "error" as const,
          error: "RATE_LIMITED" as const,
          retryAfter,
        };
      }

      const authResult = await validatePlayerForVoting(ctx, token, ipAddress);
      if (authResult.status === "error") {
        ev.returnError(authResult.error);
        return authResult;
      }
      const { player, session } = authResult;
      ev.setPlayer(token, player);
      ev.setSession(session);

      if (session.status !== "IN_PROGRESS") {
        ev.returnError("SESSION_NOT_IN_PROGRESS");
        return { status: "error" as const, error: "SESSION_NOT_IN_PROGRESS" as const };
      }

      if (session.format !== "ABBA") {
        ev.returnError("FORMAT_NOT_ABBA");
        return { status: "error" as const, error: "FORMAT_NOT_ABBA" as const };
      }

      const allPlayers = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();

      const sortedPlayers = sortPlayersByJoinOrder(allPlayers);

      const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
      if (playerIndex === -1) {
        throw new Error("Data integrity error: player not in session");
      }

      const activePlayerIndex = getActivePlayerIndex(session.currentTurn);

      if (playerIndex !== activePlayerIndex) {
        ev.returnError("NOT_YOUR_TURN");
        return { status: "error" as const, error: "NOT_YOUR_TURN" as const };
      }

      const targetMap = await validateTargetMap(ctx, mapId, player.sessionId);
      if (!targetMap) {
        ev.returnError("MAP_UNAVAILABLE");
        return { status: "error" as const, error: "MAP_UNAVAILABLE" as const };
      }

      ev.setMap(targetMap);
      ev.set("turnNumber", session.currentTurn);
      ev.set("activePlayerIndex", activePlayerIndex);
      ev.set("bannedMapName", targetMap.name);

      // === Execute ban via shared helper ===

      const result = await executeBan(ctx, {
        session,
        player,
        targetMap,
        submittedByAdmin: false,
        actorType: "PLAYER",
        actorId: player._id,
      });

      ev.setOutcome("ok");
      ev.set("isComplete", result.isComplete);
      return {
        status: "ok" as const,
        banned: { mapId, mapName: result.mapName, turn: result.turn },
        isComplete: result.isComplete,
        winnerMapId: result.winnerMapId,
      };
    } catch (err) {
      ev.setOutcome("error");
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

/**
 * Submit a vote during MULTIPLAYER voting.
 *
 * Validates the player's token/IP, checks the session is a multiplayer
 * session in progress, ensures the player hasn't already voted this round,
 * and that the target map is available. Inserts a vote record and signals
 * whether all players have now voted (for round resolution by WAR-34).
 *
 * Called by the HTTP action POST /api/player/submit-vote.
 *
 * @param token - Player access token from URL
 * @param mapId - Session map to vote to eliminate
 * @param ipAddress - Client IP extracted from HTTP headers
 */
export const submitVote = internalMutation({
  args: {
    token: v.string(),
    mapId: v.id("sessionMaps"),
    ipAddress: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      vote: v.object({
        mapId: v.id("sessionMaps"),
        mapName: v.string(),
        round: v.number(),
      }),
      allVotesSubmitted: v.boolean(),
      resolution: v.optional(roundResolutionValidator),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("INVALID_IP"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_IN_PROGRESS"),
        v.literal("FORMAT_NOT_MULTIPLAYER"),
        v.literal("ALREADY_VOTED"),
        v.literal("MAP_UNAVAILABLE"),
        v.literal("IP_MISMATCH"),
        v.literal("RATE_LIMITED")
      ),
      retryAfter: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const ev = createWideEvent("voting", "submitVote", "internalMutation");
    const startTime = Date.now();
    try {
      const { token, mapId } = args;
      const ipAddress = args.ipAddress.trim();
      ev.setIp(ipAddress);

      // Rate limit by player token (shared with submitBan — bans and votes use the same action budget)
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "submitVote", {
        key: token,
      });
      ev.set("rateLimited", !ok);
      if (!ok) {
        ev.returnError("RATE_LIMITED");
        return {
          status: "error" as const,
          error: "RATE_LIMITED" as const,
          retryAfter,
        };
      }

      const authResult = await validatePlayerForVoting(ctx, token, ipAddress);
      if (authResult.status === "error") {
        ev.returnError(authResult.error);
        return authResult;
      }
      const { player, session } = authResult;
      ev.setPlayer(token, player);
      ev.setSession(session);

      if (session.status !== "IN_PROGRESS") {
        ev.returnError("SESSION_NOT_IN_PROGRESS");
        return { status: "error" as const, error: "SESSION_NOT_IN_PROGRESS" as const };
      }

      if (session.format !== "MULTIPLAYER") {
        ev.returnError("FORMAT_NOT_MULTIPLAYER");
        return { status: "error" as const, error: "FORMAT_NOT_MULTIPLAYER" as const };
      }

      if (player.hasVotedThisRound) {
        ev.returnError("ALREADY_VOTED");
        return { status: "error" as const, error: "ALREADY_VOTED" as const };
      }

      const targetMap = await validateTargetMap(ctx, mapId, player.sessionId);
      if (!targetMap) {
        ev.returnError("MAP_UNAVAILABLE");
        return { status: "error" as const, error: "MAP_UNAVAILABLE" as const };
      }

      ev.setMap(targetMap);

      // Defense-in-depth: check DB for existing vote (supplements hasVotedThisRound flag)
      const existingVote = await ctx.db
        .query("votes")
        .withIndex("by_playerId_and_round", (q) =>
          q.eq("playerId", player._id).eq("round", session.currentRound)
        )
        .first();
      if (existingVote) {
        ev.returnError("ALREADY_VOTED");
        return { status: "error" as const, error: "ALREADY_VOTED" as const };
      }

      ev.set("roundNumber", session.currentRound);
      ev.set("votedMapName", targetMap.name);

      // === Execute vote via shared helper ===

      const result = await executeVote(ctx, {
        session,
        player,
        targetMap,
        submittedByAdmin: false,
        actorType: "PLAYER",
        actorId: player._id,
      });

      ev.setOutcome("ok");
      ev.set("allVotesSubmitted", result.allVotesSubmitted);
      ev.set("roundResolved", !!result.resolution);
      return {
        status: "ok" as const,
        vote: { mapId, mapName: result.mapName, round: result.round },
        allVotesSubmitted: result.allVotesSubmitted,
        resolution: result.resolution,
      };
    } catch (err) {
      ev.setOutcome("error");
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

// ============================================================================
// Admin Mutations
// ============================================================================

/**
 * Submit a vote or ban on behalf of a player (WAR-44).
 *
 * Used when a player disconnects or their timer expires. Determines the
 * action from the session format: ABBA → ban, MULTIPLAYER → vote.
 * Reuses the same validation and completion logic as player-facing mutations
 * via executeBan/executeVote shared helpers.
 *
 * @param sessionId - Target session
 * @param playerId - Player to act on behalf of
 * @param mapId - Session map to ban/vote
 */
export const adminVoteOnBehalf = mutation({
  args: {
    sessionId: v.id("sessions"),
    playerId: v.id("sessionPlayers"),
    mapId: v.id("sessionMaps"),
  },
  returns: v.object({
    mapName: v.string(),
    isComplete: v.boolean(),
    winnerMapName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const ev = createWideEvent("voting", "adminVoteOnBehalf", "mutation");
    const startTime = Date.now();
    try {
      const admin = await requireAdmin(ctx);
      ev.setAdmin(admin);

      // Rate limit admin mutations (100/min per admin)
      await rateLimiter.limit(ctx, "adminMutation", {
        key: admin._id,
        throws: true,
      });

      // --- Shared validation ---

      const session = await ctx.db.get(args.sessionId);
      if (!session) throw new ConvexError("Session not found");
      ev.setSession(session);

      if (session.status !== "IN_PROGRESS") {
        throw new ConvexError("Session is not in progress");
      }
      if (session.expiresAt < Date.now()) {
        throw new ConvexError("Session has expired");
      }

      const player = await ctx.db.get(args.playerId);
      if (!player || player.sessionId !== session._id) {
        throw new ConvexError("Player not found in session");
      }
      ev.setPlayer(player.token?.slice(0, 8) ?? null, player);

      const targetMap = await validateTargetMap(ctx, args.mapId, session._id);
      if (!targetMap) throw new ConvexError("Map not available");
      ev.setMap(targetMap);

      // --- Format-specific logic ---
      ev.set("actionFormat", session.format);

      if (session.format === "ABBA") {
        // Validate it's this player's turn
        const allPlayers = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();

        const sortedPlayers = sortPlayersByJoinOrder(allPlayers);

        const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
        if (playerIndex === -1) {
          throw new ConvexError("Player not found in session player list");
        }

        const activePlayerIndex = getActivePlayerIndex(session.currentTurn);
        ev.set("turnNumber", session.currentTurn);
        if (playerIndex !== activePlayerIndex) {
          throw new ConvexError("Not this player's turn");
        }

        const result = await executeBan(ctx, {
          session,
          player,
          targetMap,
          submittedByAdmin: true,
          actorType: "ADMIN",
          actorId: admin._id,
        });

        ev.setOutcome("ok");
        ev.set("isComplete", result.isComplete);
        return {
          mapName: result.mapName,
          isComplete: result.isComplete,
          winnerMapName: result.winnerMapName,
        };
      }

      // MULTIPLAYER format
      ev.set("roundNumber", session.currentRound);
      if (player.hasVotedThisRound) {
        throw new ConvexError("Player has already voted this round");
      }

      // Defense-in-depth: check DB for existing vote
      const existingVote = await ctx.db
        .query("votes")
        .withIndex("by_playerId_and_round", (q) =>
          q.eq("playerId", player._id).eq("round", session.currentRound)
        )
        .first();
      if (existingVote) {
        throw new ConvexError("Player has already voted this round");
      }

      const result = await executeVote(ctx, {
        session,
        player,
        targetMap,
        submittedByAdmin: true,
        actorType: "ADMIN",
        actorId: admin._id,
      });

      ev.setOutcome("ok");
      ev.set("isComplete", result.isComplete);
      return {
        mapName: result.mapName,
        isComplete: result.isComplete,
        winnerMapName: result.winnerMapName,
      };
    } catch (err) {
      ev.setOutcome("error");
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});
