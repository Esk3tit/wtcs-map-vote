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
import type { Doc, Id } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { getActivePlayerIndex, sortPlayersByJoinOrder } from "./lib/constants";
import {
  lookupAndValidatePlayer,
  requireAdmin,
  type PlayerLookupError,
} from "./lib/auth";
import { completeSession } from "./lib/sessionLifecycle";
import { pickRandom } from "./lib/random";
import { logAction } from "./audit";

// ============================================================================
// Types
// ============================================================================

/** Round resolution outcome returned by resolveRound. */
type RoundResolution = {
  outcome: "ROUND_ADVANCED" | "WINNER" | "REVOTE" | "RANDOM_WINNER";
  eliminatedMapIds: Id<"sessionMaps">[];
  remainingCount: number;
  winnerMapId?: Id<"sessionMaps">;
};

/** Validator for round resolution object in submitVote return type. */
const roundResolutionValidator = v.object({
  outcome: v.union(
    v.literal("ROUND_ADVANCED"),
    v.literal("WINNER"),
    v.literal("REVOTE"),
    v.literal("RANDOM_WINNER")
  ),
  eliminatedMapIds: v.array(v.id("sessionMaps")),
  remainingCount: v.number(),
  winnerMapId: v.optional(v.id("sessionMaps")),
});

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

/**
 * Validate a target map for voting/banning.
 * Checks the map exists, belongs to the session, and is available.
 */
async function validateTargetMap(
  ctx: MutationCtx,
  mapId: Id<"sessionMaps">,
  sessionId: Id<"sessions">
): Promise<Doc<"sessionMaps"> | null> {
  const map = await ctx.db.get(mapId);
  if (!map || map.sessionId !== sessionId || map.state !== "AVAILABLE") {
    return null;
  }
  return map;
}

// ============================================================================
// Round Resolution Helpers (MULTIPLAYER)
// ============================================================================

/**
 * Tally votes for the current round. Returns a map of sessionMapId -> vote count.
 */
async function tallyVotes(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  round: number
): Promise<Map<Id<"sessionMaps">, number>> {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_sessionId_and_round", (q) =>
      q.eq("sessionId", sessionId).eq("round", round)
    )
    .collect();

  const tallies = new Map<Id<"sessionMaps">, number>();
  for (const vote of votes) {
    tallies.set(vote.mapId, (tallies.get(vote.mapId) ?? 0) + 1);
  }
  return tallies;
}

/**
 * Ban all maps that received >=1 vote. Sets state, voteCount, and bannedAtRound.
 * Returns the IDs of banned maps.
 */
async function banVotedMaps(
  ctx: MutationCtx,
  tallies: Map<Id<"sessionMaps">, number>,
  round: number
): Promise<Id<"sessionMaps">[]> {
  const bannedIds = Array.from(tallies.keys());
  await Promise.all(
    Array.from(tallies.entries()).map(([mapId, count]) =>
      ctx.db.patch(mapId, {
        state: "BANNED",
        voteCount: count,
        bannedAtRound: round,
      })
    )
  );
  return bannedIds;
}

/**
 * Reset hasVotedThisRound to false for all players in a session.
 */
async function resetVoteFlags(
  ctx: MutationCtx,
  sessionId: Id<"sessions">
): Promise<void> {
  const players = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();

  await Promise.all(
    players
      .filter((p) => p.hasVotedThisRound)
      .map((p) => ctx.db.patch(p._id, { hasVotedThisRound: false }))
  );
}

/**
 * Resolve the current round after all players have voted.
 *
 * Tallies votes, bans maps with >=1 vote, then determines outcome:
 * - 1 map left -> WINNER
 * - >1 maps left -> ROUND_ADVANCED (next round)
 * - 0 maps left, first deadlock -> REVOTE (reset maps, try again)
 * - 0 maps left, second deadlock -> RANDOM_WINNER (random selection)
 *
 * All operations run in the same Convex mutation transaction for atomicity.
 *
 * @param ctx - Mutation context
 * @param session - Current session document
 */
async function resolveRound(
  ctx: MutationCtx,
  session: Doc<"sessions">
): Promise<RoundResolution> {
  const currentRound = session.currentRound;
  const isRevote = session.isRevoteRound ?? false;

  // 1. Tally votes for the current round
  const tallies = await tallyVotes(ctx, session._id, currentRound);

  // 2. Ban all maps that received >=1 vote
  const bannedIds = await banVotedMaps(ctx, tallies, currentRound);

  // 3. Count remaining AVAILABLE maps
  const remainingMaps = await ctx.db
    .query("sessionMaps")
    .withIndex("by_sessionId_and_state", (q) =>
      q.eq("sessionId", session._id).eq("state", "AVAILABLE")
    )
    .collect();

  const remainingCount = remainingMaps.length;

  // 4. Determine outcome
  if (remainingCount === 1) {
    // === WINNER: exactly one map left ===
    const winnerMap = remainingMaps[0];

    await logAction(ctx, {
      sessionId: session._id,
      action: "ROUND_RESOLVED",
      actorType: "SYSTEM",
      details: {
        round: currentRound,
        reason: `${bannedIds.length} maps banned, 1 remains`,
      },
    });
    await completeSession(ctx, session, winnerMap, {
      round: currentRound,
      reason: "Last map standing",
    });

    return {
      outcome: "WINNER",
      eliminatedMapIds: bannedIds,
      remainingCount: 0,
      winnerMapId: winnerMap._id,
    };
  }

  if (remainingCount > 1) {
    // === ROUND_ADVANCED: multiple maps still available ===
    const now = Date.now();
    await ctx.db.patch(session._id, {
      currentRound: currentRound + 1,
      isRevoteRound: false,
      updatedAt: now,
      timerStartedAt: now,
      timerPausedAt: undefined,
    });
    await resetVoteFlags(ctx, session._id);

    await logAction(ctx, {
      sessionId: session._id,
      action: "ROUND_RESOLVED",
      actorType: "SYSTEM",
      details: {
        round: currentRound,
        reason: `${bannedIds.length} maps banned, ${remainingCount} remain`,
      },
    });

    return {
      outcome: "ROUND_ADVANCED",
      eliminatedMapIds: bannedIds,
      remainingCount,
    };
  }

  // === 0 maps left: deadlock ===
  if (!isRevote) {
    // === REVOTE: first deadlock -- reset maps and try again ===

    // Reset maps that were banned THIS round back to AVAILABLE
    // bannedIds already contains exactly the maps banned this round
    await Promise.all(
      bannedIds.map((mapId) =>
        ctx.db.patch(mapId, {
          state: "AVAILABLE",
          voteCount: undefined,
          bannedAtRound: undefined,
          bannedByPlayerId: undefined,
        })
      )
    );

    const now = Date.now();
    await ctx.db.patch(session._id, {
      currentRound: currentRound + 1,
      isRevoteRound: true,
      updatedAt: now,
      timerStartedAt: now,
      timerPausedAt: undefined,
    });
    await resetVoteFlags(ctx, session._id);

    await logAction(ctx, {
      sessionId: session._id,
      action: "ROUND_REVOTE_TRIGGERED",
      actorType: "SYSTEM",
      details: {
        round: currentRound,
        reason: `All ${bannedIds.length} maps eliminated (deadlock)`,
      },
    });

    return {
      outcome: "REVOTE",
      eliminatedMapIds: bannedIds,
      remainingCount: bannedIds.length,
    };
  }

  // === RANDOM_WINNER: double deadlock -- random selection from revote pool ===

  // The pool is the maps banned in THIS round -- reuse bannedIds to avoid re-querying
  const poolDocs = await Promise.all(bannedIds.map((id) => ctx.db.get(id)));
  const currentRoundPool = poolDocs.filter(
    (m): m is Doc<"sessionMaps"> => m !== null
  );

  if (currentRoundPool.length === 0) {
    console.error(
      `Data integrity error: double deadlock with no maps in revote pool for session ${session._id}`
    );
    throw new Error("Data integrity error: empty revote pool");
  }

  // Random selection (CSPRNG for competitive integrity)
  const winnerMap = pickRandom(currentRoundPool);

  await logAction(ctx, {
    sessionId: session._id,
    action: "REVOTE_DEADLOCK_RANDOM_SELECTION",
    actorType: "SYSTEM",
    details: {
      mapId: winnerMap._id,
      mapName: winnerMap.name,
      round: currentRound,
      reason: `Random selection from ${currentRoundPool.length} maps`,
    },
  });
  await completeSession(ctx, session, winnerMap, {
    round: currentRound,
    reason: "Random selection after double deadlock",
  });

  return {
    outcome: "RANDOM_WINNER",
    eliminatedMapIds: bannedIds,
    remainingCount: 0,
    winnerMapId: winnerMap._id,
  };
}

// ============================================================================
// Shared Execution Helpers
// ============================================================================

/** Result returned by executeBan. */
type BanResult = {
  mapName: string;
  turn: number;
  isComplete: boolean;
  winnerMapId?: Id<"sessionMaps">;
  winnerMapName?: string;
};

/**
 * Execute an ABBA ban. Shared logic for both player and admin paths.
 *
 * Validates it's the correct player's turn, bans the target map, advances
 * the turn counter, and auto-declares a winner when all bans are complete.
 *
 * @param ctx - Mutation context
 * @param args - Ban parameters including actor context
 */
async function executeBan(
  ctx: MutationCtx,
  args: {
    session: Doc<"sessions">;
    player: Doc<"sessionPlayers">;
    targetMap: Doc<"sessionMaps">;
    submittedByAdmin: boolean;
    actorType: "PLAYER" | "ADMIN";
    actorId: Id<"sessionPlayers"> | Id<"admins">;
  }
): Promise<BanResult> {
  const { session, player, targetMap, submittedByAdmin, actorType, actorId } =
    args;
  const currentTurn = session.currentTurn;

  // Ban the map
  await ctx.db.patch(targetMap._id, {
    state: "BANNED",
    bannedByPlayerId: player._id,
    bannedAtTurn: currentTurn,
    ...(submittedByAdmin && { submittedByAdmin: true }),
  });

  // Advance turn and reset timer
  const now = Date.now();
  const newCurrentTurn = currentTurn + 1;
  await ctx.db.patch(session._id, {
    currentTurn: newCurrentTurn,
    updatedAt: now,
    timerStartedAt: now,
    timerPausedAt: undefined,
  });

  // Audit log: MAP_BANNED
  await logAction(ctx, {
    sessionId: session._id,
    action: "MAP_BANNED",
    actorType,
    actorId,
    details: {
      mapId: targetMap._id,
      mapName: targetMap.name,
      teamName: player.teamName,
      turn: currentTurn,
      ...(submittedByAdmin && { reason: "ADMIN_VOTE_ON_BEHALF" }),
    },
  });

  // Check if all bans are complete
  const bansNeeded = session.mapPoolSize - 1;
  if (newCurrentTurn >= bansNeeded) {
    const remainingMaps = await ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId_and_state", (q) =>
        q.eq("sessionId", session._id).eq("state", "AVAILABLE")
      )
      .collect();

    if (remainingMaps.length !== 1) {
      console.error(
        `Data integrity error: expected 1 available map after ${bansNeeded} bans, found ${remainingMaps.length}`
      );
      throw new Error(
        "Data integrity error: unexpected map count after voting"
      );
    }

    const winnerMap = remainingMaps[0];
    await completeSession(ctx, session, winnerMap);

    return {
      mapName: targetMap.name,
      turn: currentTurn,
      isComplete: true,
      winnerMapId: winnerMap._id,
      winnerMapName: winnerMap.name,
    };
  }

  return {
    mapName: targetMap.name,
    turn: currentTurn,
    isComplete: false,
  };
}

/** Result returned by executeVote. */
type VoteResult = {
  mapName: string;
  round: number;
  allVotesSubmitted: boolean;
  resolution?: RoundResolution;
  isComplete: boolean;
  winnerMapId?: Id<"sessionMaps">;
  winnerMapName?: string;
};

/**
 * Execute a multiplayer vote. Shared logic for both player and admin paths.
 *
 * Inserts a vote record, marks the player as voted, and resolves the round
 * if all players have now voted.
 *
 * @param ctx - Mutation context
 * @param args - Vote parameters including actor context
 */
async function executeVote(
  ctx: MutationCtx,
  args: {
    session: Doc<"sessions">;
    player: Doc<"sessionPlayers">;
    targetMap: Doc<"sessionMaps">;
    submittedByAdmin: boolean;
    actorType: "PLAYER" | "ADMIN";
    actorId: Id<"sessionPlayers"> | Id<"admins">;
  }
): Promise<VoteResult> {
  const { session, player, targetMap, submittedByAdmin, actorType, actorId } =
    args;
  const currentRound = session.currentRound;

  // Insert vote record
  await ctx.db.insert("votes", {
    sessionId: session._id,
    round: currentRound,
    playerId: player._id,
    mapId: targetMap._id,
    submittedAt: Date.now(),
    submittedByAdmin,
  });

  // Mark player as voted this round
  await ctx.db.patch(player._id, { hasVotedThisRound: true });

  // Audit log: VOTE_SUBMITTED
  await logAction(ctx, {
    sessionId: session._id,
    action: "VOTE_SUBMITTED",
    actorType,
    actorId,
    details: {
      mapId: targetMap._id,
      mapName: targetMap.name,
      teamName: player.teamName,
      round: currentRound,
      ...(submittedByAdmin && { reason: "ADMIN_VOTE_ON_BEHALF" }),
    },
  });

  // Check if all players have voted this round
  const unvotedPlayer = await ctx.db
    .query("sessionPlayers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .filter((q) => q.eq(q.field("hasVotedThisRound"), false))
    .first();
  const allVotesSubmitted = unvotedPlayer === null;

  if (allVotesSubmitted) {
    const resolution = await resolveRound(ctx, session);
    const isComplete =
      resolution.outcome === "WINNER" ||
      resolution.outcome === "RANDOM_WINNER";

    let winnerMapName: string | undefined;
    if (resolution.winnerMapId) {
      const winnerMap = await ctx.db.get(resolution.winnerMapId);
      winnerMapName = winnerMap?.name;
    }

    return {
      mapName: targetMap.name,
      round: currentRound,
      allVotesSubmitted: true,
      resolution,
      isComplete,
      winnerMapId: resolution.winnerMapId,
      winnerMapName,
    };
  }

  return {
    mapName: targetMap.name,
    round: currentRound,
    allVotesSubmitted: false,
    isComplete: false,
  };
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
  handler: async (ctx, args) => {
    const { token, mapId } = args;
    const ipAddress = args.ipAddress.trim();

    const authResult = await validatePlayerForVoting(ctx, token, ipAddress);
    if (authResult.status === "error") {
      return authResult;
    }
    const { player, session } = authResult;

    if (session.status !== "IN_PROGRESS") {
      return { status: "error" as const, error: "SESSION_NOT_IN_PROGRESS" as const };
    }

    if (session.format !== "ABBA") {
      return { status: "error" as const, error: "FORMAT_NOT_ABBA" as const };
    }

    const allPlayers = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect();

    const sortedPlayers = sortPlayersByJoinOrder(allPlayers);

    const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
    if (playerIndex === -1) {
      console.error(
        `Data integrity error: player ${player._id} not found in session ${session._id} player list`
      );
      throw new Error("Data integrity error: player not in session");
    }

    const activePlayerIndex = getActivePlayerIndex(session.currentTurn);

    if (playerIndex !== activePlayerIndex) {
      return { status: "error" as const, error: "NOT_YOUR_TURN" as const };
    }

    const targetMap = await validateTargetMap(ctx, mapId, player.sessionId);
    if (!targetMap) {
      return { status: "error" as const, error: "MAP_UNAVAILABLE" as const };
    }

    // === Execute ban via shared helper ===

    const result = await executeBan(ctx, {
      session,
      player,
      targetMap,
      submittedByAdmin: false,
      actorType: "PLAYER",
      actorId: player._id,
    });

    return {
      status: "ok" as const,
      banned: { mapId, mapName: result.mapName, turn: result.turn },
      isComplete: result.isComplete,
      winnerMapId: result.winnerMapId,
    };
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
        v.literal("IP_MISMATCH")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { token, mapId } = args;
    const ipAddress = args.ipAddress.trim();

    const authResult = await validatePlayerForVoting(ctx, token, ipAddress);
    if (authResult.status === "error") {
      return authResult;
    }
    const { player, session } = authResult;

    if (session.status !== "IN_PROGRESS") {
      return { status: "error" as const, error: "SESSION_NOT_IN_PROGRESS" as const };
    }

    if (session.format !== "MULTIPLAYER") {
      return { status: "error" as const, error: "FORMAT_NOT_MULTIPLAYER" as const };
    }

    if (player.hasVotedThisRound) {
      return { status: "error" as const, error: "ALREADY_VOTED" as const };
    }

    const targetMap = await validateTargetMap(ctx, mapId, player.sessionId);
    if (!targetMap) {
      return { status: "error" as const, error: "MAP_UNAVAILABLE" as const };
    }

    // Defense-in-depth: check DB for existing vote (supplements hasVotedThisRound flag)
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_playerId_and_round", (q) =>
        q.eq("playerId", player._id).eq("round", session.currentRound)
      )
      .first();
    if (existingVote) {
      return { status: "error" as const, error: "ALREADY_VOTED" as const };
    }

    // === Execute vote via shared helper ===

    const result = await executeVote(ctx, {
      session,
      player,
      targetMap,
      submittedByAdmin: false,
      actorType: "PLAYER",
      actorId: player._id,
    });

    return {
      status: "ok" as const,
      vote: { mapId, mapName: result.mapName, round: result.round },
      allVotesSubmitted: result.allVotesSubmitted,
      resolution: result.resolution,
    };
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
    const admin = await requireAdmin(ctx);

    // --- Shared validation ---

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");
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

    const targetMap = await validateTargetMap(ctx, args.mapId, session._id);
    if (!targetMap) throw new ConvexError("Map not available");

    // --- Format-specific logic ---

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

      return {
        mapName: result.mapName,
        isComplete: result.isComplete,
        winnerMapName: result.winnerMapName,
      };
    }

    // MULTIPLAYER format
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

    return {
      mapName: result.mapName,
      isComplete: result.isComplete,
      winnerMapName: result.winnerMapName,
    };
  },
});
