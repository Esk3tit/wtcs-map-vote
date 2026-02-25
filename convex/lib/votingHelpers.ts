/**
 * Voting Helpers
 *
 * Shared execution helpers for map ban/vote operations, extracted from
 * convex/voting.ts. Used by both player-facing voting mutations and
 * the timer expiration handler (WAR-47).
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

import { ConvexError, v } from "convex/values";

import { completeSession } from "./sessionLifecycle";
import { REVEAL_DURATION_MS } from "./constants";
import { pickRandom } from "./random";
import { scheduleTimerExpiry } from "./timerScheduling";
import { logAction } from "../audit";

// ============================================================================
// Types
// ============================================================================

/** Round resolution outcome returned by resolveRound. */
export type RoundResolution = {
  outcome: "ROUND_ADVANCED" | "WINNER" | "REVOTE" | "RANDOM_WINNER";
  eliminatedMapIds: Id<"sessionMaps">[];
  remainingCount: number;
  winnerMapId?: Id<"sessionMaps">;
  winnerMapName?: string;
};

/** Validator for round resolution object in submitVote return type. */
export const roundResolutionValidator = v.object({
  outcome: v.union(
    v.literal("ROUND_ADVANCED"),
    v.literal("WINNER"),
    v.literal("REVOTE"),
    v.literal("RANDOM_WINNER")
  ),
  eliminatedMapIds: v.array(v.id("sessionMaps")),
  remainingCount: v.number(),
  winnerMapId: v.optional(v.id("sessionMaps")),
  winnerMapName: v.optional(v.string()),
});

/** Result returned by executeBan. */
export type BanResult = {
  mapName: string;
  turn: number;
  isComplete: boolean;
  winnerMapId?: Id<"sessionMaps">;
  winnerMapName?: string;
};

/** Result returned by executeVote. */
export type VoteResult = {
  mapName: string;
  round: number;
  allVotesSubmitted: boolean;
  resolution?: RoundResolution;
  isComplete: boolean;
  winnerMapId?: Id<"sessionMaps">;
  winnerMapName?: string;
};

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Validate a target map for voting/banning.
 * Checks the map exists, belongs to the session, and is available.
 */
export async function validateTargetMap(
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

/** Vote tally result with per-map vote counts and voter team names. */
interface TallyResult {
  tallies: Map<Id<"sessionMaps">, number>;
  voterTeamsByMap: Map<Id<"sessionMaps">, string[]>;
}

/**
 * Tally votes for the current round. Returns vote counts and voter team names
 * per map (used to populate bannedByTeamNames on eliminated maps).
 */
async function tallyVotes(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  round: number
): Promise<TallyResult> {
  const [votes, players] = await Promise.all([
    ctx.db
      .query("votes")
      .withIndex("by_sessionId_and_round", (q) =>
        q.eq("sessionId", sessionId).eq("round", round)
      )
      .collect(),
    ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect(),
  ]);

  const playerTeamMap = new Map(players.map((p) => [p._id.toString(), p.teamName]));

  const tallies = new Map<Id<"sessionMaps">, number>();
  const voterTeamsByMap = new Map<Id<"sessionMaps">, string[]>();
  for (const vote of votes) {
    tallies.set(vote.mapId, (tallies.get(vote.mapId) ?? 0) + 1);
    const teamName = playerTeamMap.get(vote.playerId.toString()) ?? "Unknown";
    const teams = voterTeamsByMap.get(vote.mapId) ?? [];
    teams.push(teamName);
    voterTeamsByMap.set(vote.mapId, teams);
  }
  return { tallies, voterTeamsByMap };
}

/**
 * Ban maps based on vote tallies and available map context.
 *
 * When unvoted maps exist (any available map not in tallies), ban ALL voted
 * maps to narrow the pool to only unvoted maps. When all maps have votes,
 * ban only the highest-voted map(s). Records which teams voted for each
 * banned map in bannedByTeamNames.
 *
 * @param availableMapIds - Set of all currently AVAILABLE session map IDs
 * @returns IDs of banned maps
 */
async function banHighestVotedMaps(
  ctx: MutationCtx,
  tallies: Map<Id<"sessionMaps">, number>,
  voterTeamsByMap: Map<Id<"sessionMaps">, string[]>,
  round: number,
  availableMapIds: Set<Id<"sessionMaps">>
): Promise<Id<"sessionMaps">[]> {
  if (tallies.size === 0) return [];

  // Check if any available map has zero votes (not in tallies)
  const hasUnvotedMaps = Array.from(availableMapIds).some(
    (id) => !tallies.has(id)
  );

  // If unvoted maps exist, ban ALL voted maps; otherwise ban only highest
  const maxVotes = Math.max(...tallies.values());
  const entries = Array.from(tallies.entries());
  const mapsToBan = entries.filter(
    ([, count]) => hasUnvotedMaps || count === maxVotes
  );

  await Promise.all(
    mapsToBan.map(([mapId, count]) =>
      ctx.db.patch(mapId, {
        state: "BANNED",
        voteCount: count,
        bannedAtRound: round,
        bannedByTeamNames: voterTeamsByMap.get(mapId) ?? [],
      })
    )
  );
  return mapsToBan.map(([mapId]) => mapId);
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

// ============================================================================
// Round Resolution
// ============================================================================

/**
 * Resolve the current round. Can be called after all players voted
 * or directly by the timer expiry handler with partial votes.
 *
 * Tallies votes, bans only the highest-voted map(s), then determines outcome:
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
export async function resolveRound(
  ctx: MutationCtx,
  session: Doc<"sessions">
): Promise<RoundResolution> {
  const currentRound = session.currentRound;
  const isRevote = session.isRevoteRound ?? false;

  // 1. Tally votes for the current round
  const { tallies, voterTeamsByMap } = await tallyVotes(ctx, session._id, currentRound);

  // 2. Query available maps BEFORE banning (needed to determine ban strategy)
  const availableMapsBefore = await ctx.db
    .query("sessionMaps")
    .withIndex("by_sessionId_and_state", (q) =>
      q.eq("sessionId", session._id).eq("state", "AVAILABLE")
    )
    .collect();
  const availableMapIds = new Set(availableMapsBefore.map((m) => m._id));

  // 3. Ban maps (all voted if unvoted maps exist, else highest-only)
  const bannedIds = await banHighestVotedMaps(ctx, tallies, voterTeamsByMap, currentRound, availableMapIds);

  // 4. Count remaining AVAILABLE maps
  const remainingMaps = await ctx.db
    .query("sessionMaps")
    .withIndex("by_sessionId_and_state", (q) =>
      q.eq("sessionId", session._id).eq("state", "AVAILABLE")
    )
    .collect();

  const remainingCount = remainingMaps.length;

  // 5. Determine outcome
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
      winnerMapName: winnerMap.name,
    };
  }

  if (remainingCount > 1) {
    // === ROUND_ADVANCED: multiple maps still available ===
    // NOTE: Round advancement logic also exists in sessionCleanup.ts (zero-vote timer path)
    // If you change this, update the other location too.
    const now = Date.now();
    // Offset timer start by reveal duration so players get the full
    // configured timer for voting after the client-side reveal phase.
    const timerStart = now + REVEAL_DURATION_MS;
    await ctx.db.patch(session._id, {
      currentRound: currentRound + 1,
      isRevoteRound: false,
      updatedAt: now,
      timerStartedAt: timerStart,
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

    // Schedule timer expiry for next round (WAR-47)
    await scheduleTimerExpiry(
      ctx,
      session._id,
      timerStart,
      session.turnTimerSeconds,
      session.format as "ABBA" | "MULTIPLAYER"
    );

    return {
      outcome: "ROUND_ADVANCED",
      eliminatedMapIds: bannedIds,
      remainingCount,
    };
  }

  // === 0 maps left: deadlock ===
  if (!isRevote) {
    // === REVOTE: first deadlock -- reset maps and try again ===
    // NOTE: Round advancement logic also exists in sessionCleanup.ts (zero-vote timer path)
    // If you change this, update the other location too.

    // Reset maps that were banned THIS round back to AVAILABLE
    // bannedIds already contains exactly the maps banned this round
    await Promise.all(
      bannedIds.map((mapId) =>
        ctx.db.patch(mapId, {
          state: "AVAILABLE",
          voteCount: undefined,
          bannedAtRound: undefined,
          bannedByPlayerId: undefined,
          bannedByTeamNames: undefined,
        })
      )
    );

    const now = Date.now();
    // Offset timer start by reveal duration for deadlock reveal
    const timerStart = now + REVEAL_DURATION_MS;
    await ctx.db.patch(session._id, {
      currentRound: currentRound + 1,
      isRevoteRound: true,
      updatedAt: now,
      timerStartedAt: timerStart,
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

    // Schedule timer expiry for revote round (WAR-47)
    await scheduleTimerExpiry(
      ctx,
      session._id,
      timerStart,
      session.turnTimerSeconds,
      session.format as "ABBA" | "MULTIPLAYER"
    );

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
    winnerMapName: winnerMap.name,
  };
}

// ============================================================================
// Shared Execution Helpers
// ============================================================================

/**
 * Execute an ABBA ban. Shared logic for player, admin, and system paths.
 *
 * Bans the target map, advances the turn counter, and auto-declares a winner
 * when all bans are complete (mapPoolSize - 1 bans).
 *
 * @param ctx - Mutation context
 * @param args - Ban parameters including actor context
 */
export async function executeBan(
  ctx: MutationCtx,
  args: {
    session: Doc<"sessions">;
    player: Doc<"sessionPlayers">;
    targetMap: Doc<"sessionMaps">;
    submittedByAdmin: boolean;
    actorType: "PLAYER" | "ADMIN" | "SYSTEM";
    actorId?: Id<"sessionPlayers"> | Id<"admins">;
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
    actorId: actorId as string | undefined,
    details: {
      mapId: targetMap._id,
      mapName: targetMap.name,
      teamName: player.teamName,
      turn: currentTurn,
      reason: actorType === "SYSTEM"
        ? "TIMER_EXPIRED"
        : submittedByAdmin
          ? "ADMIN_VOTE_ON_BEHALF"
          : undefined,
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

  // Schedule timer expiry for next turn (WAR-47)
  await scheduleTimerExpiry(
    ctx,
    session._id,
    now,
    session.turnTimerSeconds,
    "ABBA"
  );

  return {
    mapName: targetMap.name,
    turn: currentTurn,
    isComplete: false,
  };
}

/**
 * Execute a multiplayer vote. Shared logic for player, admin, and system paths.
 *
 * Inserts a vote record, marks the player as voted, and resolves the round
 * if all players have now voted.
 *
 * @param ctx - Mutation context
 * @param args - Vote parameters including actor context
 */
export async function executeVote(
  ctx: MutationCtx,
  args: {
    session: Doc<"sessions">;
    player: Doc<"sessionPlayers">;
    targetMap: Doc<"sessionMaps">;
    submittedByAdmin: boolean;
    actorType: "PLAYER" | "ADMIN" | "SYSTEM";
    actorId?: Id<"sessionPlayers"> | Id<"admins">;
  }
): Promise<VoteResult> {
  const { session, player, targetMap, submittedByAdmin, actorType, actorId } =
    args;

  // Defense-in-depth: prevent duplicate votes
  if (player.hasVotedThisRound) {
    throw new ConvexError("Player has already voted this round");
  }

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
    actorId: actorId as string | undefined,
    details: {
      mapId: targetMap._id,
      mapName: targetMap.name,
      teamName: player.teamName,
      round: currentRound,
      reason: actorType === "SYSTEM"
        ? "TIMER_EXPIRED"
        : submittedByAdmin
          ? "ADMIN_VOTE_ON_BEHALF"
          : undefined,
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

    return {
      mapName: targetMap.name,
      round: currentRound,
      allVotesSubmitted: true,
      resolution,
      isComplete,
      winnerMapId: resolution.winnerMapId,
      winnerMapName: resolution.winnerMapName,
    };
  }

  return {
    mapName: targetMap.name,
    round: currentRound,
    allVotesSubmitted: false,
    isComplete: false,
  };
}
