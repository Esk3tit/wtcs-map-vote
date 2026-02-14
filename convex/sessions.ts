/**
 * Sessions Module
 *
 * Handles voting session lifecycle: creation, configuration, player assignment,
 * map pool setup, and session state management.
 */

import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";

import {
  SESSION_EXPIRY_MS,
  SESSION_RESET_PATCHES,
  TOKEN_EXPIRY_MS,
  DEFAULT_TURN_TIMER_SECONDS,
  DEFAULT_MAP_POOL_SIZE,
  MIN_PLAYER_COUNT,
  MAX_PLAYER_COUNT,
  MIN_TURN_TIMER_SECONDS,
  MAX_TURN_TIMER_SECONDS,
  MIN_MAP_POOL_SIZE,
  MAX_MAP_POOL_SIZE,
  MAX_NAME_LENGTH,
  MAX_REASON_LENGTH,
  getActivePlayerIndex,
  sortPlayersByJoinOrder,
} from "./lib/constants";
import { validateName, validateRange } from "./lib/validation";
import {
  sessionStatusValidator,
  sessionFormatValidator,
  mapStateValidator,
} from "./lib/validators";
import { requireAdmin } from "./lib/auth";
import {
  completeSession,
  guardFinalize,
  guardStart,
  transitionSession,
  validateTransition,
} from "./lib/sessionLifecycle";
import { pickRandom } from "./lib/random";

import { logAction } from "./audit";

const validateMatchName = (name: string) => validateName(name, "Match");

// ============================================================================
// Reusable Object Validators
// ============================================================================

/**
 * Validator for admin-facing session player objects.
 * Exposes tokens for lobby link generation but redacts ipAddress
 * to a boolean isIpLocked flag for GDPR compliance.
 */
const adminPlayerObjectValidator = v.object({
  _id: v.id("sessionPlayers"),
  _creationTime: v.number(),
  sessionId: v.id("sessions"),
  role: v.string(),
  teamName: v.string(),
  token: v.string(),
  tokenExpiresAt: v.number(),
  isIpLocked: v.boolean(),
  isConnected: v.boolean(),
  lastHeartbeat: v.optional(v.number()),
  hasVotedThisRound: v.boolean(),
});

/**
 * Validator for session map objects.
 * Used by both admin and player-facing queries.
 */
const sessionMapObjectValidator = v.object({
  _id: v.id("sessionMaps"),
  _creationTime: v.number(),
  sessionId: v.id("sessions"),
  mapId: v.id("maps"),
  name: v.string(),
  imageUrl: v.string(),
  state: mapStateValidator,
  bannedByPlayerId: v.optional(v.id("sessionPlayers")),
  bannedAtTurn: v.optional(v.number()),
  bannedAtRound: v.optional(v.number()),
  voteCount: v.optional(v.number()),
});

/**
 * Validator for session with related players and maps.
 * Uses admin player validator (redacted IPs).
 */
const sessionWithRelationsValidator = v.object({
  _id: v.id("sessions"),
  _creationTime: v.number(),
  matchName: v.string(),
  format: sessionFormatValidator,
  status: sessionStatusValidator,
  turnTimerSeconds: v.number(),
  mapPoolSize: v.number(),
  playerCount: v.number(),
  currentTurn: v.number(),
  currentRound: v.number(),
  timerStartedAt: v.optional(v.number()),
  timerPausedAt: v.optional(v.number()),
  winnerMapId: v.optional(v.id("sessionMaps")),
  isRevoteRound: v.optional(v.boolean()),
  createdBy: v.id("admins"),
  updatedAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  expiresAt: v.number(),
  players: v.array(adminPlayerObjectValidator),
  maps: v.array(sessionMapObjectValidator),
});

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Transform a player document for admin-facing queries.
 * Strips ipAddress (GDPR) and replaces with isIpLocked boolean.
 */
function toAdminPlayer(player: Doc<"sessionPlayers">) {
  const { ipAddress, ...rest } = player;
  return { ...rest, isIpLocked: !!ipAddress };
}

/**
 * Transform a player document for player-facing queries.
 * Allowlist pattern — only includes safe, non-sensitive fields.
 */
function toSanitizedPlayer(player: Doc<"sessionPlayers">) {
  return {
    _id: player._id,
    role: player.role,
    teamName: player.teamName,
    isConnected: player.isConnected,
    hasVotedThisRound: player.hasVotedThisRound,
  };
}

/**
 * Compute whether it's the given player's turn to act.
 * Server-authoritative turn detection to prevent client-server drift.
 *
 * @param session - Session with format, currentTurn, and status
 * @param hasVotedThisRound - Whether the player has voted this round
 * @param playerIndex - Player's index in creation-time sorted order
 */
function computeIsYourTurn(
  session: { format: string; currentTurn: number; status: string },
  hasVotedThisRound: boolean,
  playerIndex: number
): boolean {
  // Only allow turns during active session
  if (session.status !== "IN_PROGRESS") return false;

  if (session.format === "MULTIPLAYER") {
    return !hasVotedThisRound;
  }
  if (session.format === "ABBA") {
    return playerIndex === getActivePlayerIndex(session.currentTurn);
  }
  return false;
}

/**
 * Build structured round history from session maps.
 * Groups banned maps by round (MULTIPLAYER) or turn (ABBA).
 * Works for both active and completed sessions.
 *
 * @param sessionMaps - All maps in the session
 * @param players - All players in the session
 * @param format - Session format (ABBA or MULTIPLAYER)
 */
function buildRoundHistory(
  sessionMaps: Doc<"sessionMaps">[],
  players: Doc<"sessionPlayers">[],
  format: "ABBA" | "MULTIPLAYER"
): Array<{
  round: number;
  bans: Array<{
    mapId: Id<"sessionMaps">;
    mapName: string;
    bannedByTeam: string;
  }>;
}> {
  const playerMap = new Map(players.map((p) => [p._id.toString(), p]));

  const bannedMaps = sessionMaps
    .filter((m) => m.state === "BANNED")
    .sort((a, b) => {
      if (format === "ABBA") {
        return (a.bannedAtTurn ?? 0) - (b.bannedAtTurn ?? 0);
      }
      const roundDiff = (a.bannedAtRound ?? 0) - (b.bannedAtRound ?? 0);
      if (roundDiff !== 0) return roundDiff;
      return a._creationTime - b._creationTime;
    });

  const result: Array<{
    round: number;
    bans: Array<{
      mapId: Id<"sessionMaps">;
      mapName: string;
      bannedByTeam: string;
    }>;
  }> = [];

  for (const m of bannedMaps) {
    const round =
      format === "ABBA" ? (m.bannedAtTurn ?? 0) + 1 : (m.bannedAtRound ?? 1);
    const bannedBy = m.bannedByPlayerId
      ? playerMap.get(m.bannedByPlayerId.toString())
      : undefined;
    const entry = {
      mapId: m._id,
      mapName: m.name,
      bannedByTeam: bannedBy?.teamName ?? "Unknown",
    };

    const last = result[result.length - 1];
    if (last?.round === round) {
      last.bans.push(entry);
    } else {
      result.push({ round, bans: [entry] });
    }
  }

  return result;
}

/**
 * Private helper to build session results data.
 * Used by both getSessionResultsByToken and getSessionResults queries.
 *
 * @param ctx - Query context
 * @param session - The session document
 */
async function buildSessionResults(ctx: QueryCtx, session: Doc<"sessions">) {
  const [players, maps] = await Promise.all([
    ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
    ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
  ]);

  const teams = [...new Set(players.map((p) => p.teamName))];
  const winnerMap = maps.find((m) => m.state === "WINNER");

  // Derive flat banHistory from roundHistory for backwards compatibility
  const roundHistory = buildRoundHistory(maps, players, session.format);
  const mapImageLookup = new Map(maps.map((m) => [m._id.toString(), m.imageUrl]));
  let order = 0;
  const banHistory = roundHistory.flatMap((entry) =>
    entry.bans.map((ban) => ({
      order: ++order,
      teamName: ban.bannedByTeam,
      mapName: ban.mapName,
      mapImage: mapImageLookup.get(ban.mapId.toString()) ?? "",
    }))
  );

  return { maps, teams, winnerMap, banHistory };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List sessions with optional status filtering and pagination.
 * Returns sessions sorted by creation time (newest first).
 *
 * Uses Convex's standard pagination pattern with paginationOptsValidator for:
 * - Gapless reactive pagination (pages adjust when data changes)
 * - Compatibility with usePaginatedQuery hook on frontend
 * - Proper endCursor tracking via QueryJournal
 *
 * For single-status filtering, uses an index for efficient queries.
 * For multi-status filtering, omit the status param and filter on the frontend.
 *
 * @param paginationOpts - Standard Convex pagination options (numItems, cursor, etc.)
 * @param status - Optional single status to filter by (uses index)
 */
export const listSessions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(sessionStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Single status filter: use index for efficient query
    if (args.status) {
      return await ctx.db
        .query("sessions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    // No filter: return all sessions (frontend can filter for multi-status)
    return await ctx.db
      .query("sessions")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get a single session with its players and maps.
 * Returns null if session doesn't exist.
 *
 * @param sessionId - The session ID to fetch
 */
export const getSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(sessionWithRelationsValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Fetch related data in parallel for performance
    const [rawPlayers, maps] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

    // Redact ipAddress → isIpLocked for GDPR compliance
    const players = rawPlayers.map(toAdminPlayer);

    return {
      ...session,
      players,
      maps,
    };
  },
});

/**
 * List sessions for dashboard display with player summary.
 * Returns paginated sessions enriched with assignedPlayerCount and teams.
 *
 * Uses Convex cursor-based pagination with optional single-status filtering.
 * Each session is enriched with player data for display in session cards.
 *
 * @param paginationOpts - Standard Convex pagination options
 * @param status - Optional single status filter (uses by_status index)
 */
export const listSessionsForDashboard = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(sessionStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { status } = args;
    const sessionsQuery = status
      ? ctx.db
          .query("sessions")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
      : ctx.db
          .query("sessions")
          .order("desc")
          .filter((q) =>
            q.and(
              q.neq(q.field("status"), "COMPLETE"),
              q.neq(q.field("status"), "EXPIRED")
            )
          );

    const paginatedResult = await sessionsQuery.paginate(args.paginationOpts);

    // Enrich each session with player summary
    const enrichedPage = await Promise.all(
      paginatedResult.page.map(async (session) => {
        const players = await ctx.db
          .query("sessionPlayers")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .collect();

        const teams = [...new Set(players.map((p) => p.teamName))];

        return {
          _id: session._id,
          _creationTime: session._creationTime,
          matchName: session.matchName,
          format: session.format,
          status: session.status,
          playerCount: session.playerCount,
          assignedPlayerCount: players.length,
          teams,
        };
      })
    );

    return {
      ...paginatedResult,
      page: enrichedPage,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new voting session in DRAFT status.
 *
 * The session is created with default values and will expire in 2 weeks
 * if not finalized. Players and maps must be assigned separately.
 *
 * @param matchName - Display name for the match
 * @param format - Voting format: "ABBA" (1v1) or "MULTIPLAYER"
 * @param playerCount - Number of players expected (2-8)
 * @param turnTimerSeconds - Seconds per turn (default: 30)
 * @param mapPoolSize - Number of maps in pool (default: 5)
 */
export const createSession = mutation({
  args: {
    matchName: v.string(),
    format: sessionFormatValidator,
    playerCount: v.number(),
    turnTimerSeconds: v.optional(v.number()),
    mapPoolSize: v.optional(v.number()),
  },
  returns: v.object({ sessionId: v.id("sessions") }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate match name
    const trimmedName = validateMatchName(args.matchName);

    // Validate player count
    validateRange(
      args.playerCount,
      MIN_PLAYER_COUNT,
      MAX_PLAYER_COUNT,
      "Player count"
    );

    // Enforce format-specific player count
    if (args.format === "ABBA" && args.playerCount !== 2) {
      throw new ConvexError("ABBA format requires exactly 2 players");
    }

    // Validate turn timer
    const turnTimerSeconds = args.turnTimerSeconds ?? DEFAULT_TURN_TIMER_SECONDS;
    validateRange(
      turnTimerSeconds,
      MIN_TURN_TIMER_SECONDS,
      MAX_TURN_TIMER_SECONDS,
      "Turn timer",
      "seconds"
    );

    // Validate map pool size
    const mapPoolSize = args.mapPoolSize ?? DEFAULT_MAP_POOL_SIZE;
    validateRange(
      mapPoolSize,
      MIN_MAP_POOL_SIZE,
      MAX_MAP_POOL_SIZE,
      "Map pool size"
    );

    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      matchName: trimmedName,
      format: args.format,
      status: "DRAFT",
      turnTimerSeconds,
      mapPoolSize,
      playerCount: args.playerCount,
      currentTurn: 0,
      currentRound: 1,
      createdBy: admin._id,
      updatedAt: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    // Create audit log
    await logAction(ctx, {
      sessionId,
      action: "SESSION_CREATED",
      actorType: "ADMIN",
      actorId: admin._id,
    });

    return { sessionId };
  },
});

/**
 * Update session configuration.
 * Only allowed in DRAFT or WAITING states.
 *
 * @param sessionId - The session to update
 * @param matchName - New match name (optional)
 * @param turnTimerSeconds - New turn timer (optional)
 */
export const updateSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    matchName: v.optional(v.string()),
    turnTimerSeconds: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Only allow updates in DRAFT or WAITING states
    if (session.status !== "DRAFT" && session.status !== "WAITING") {
      throw new ConvexError(
        `Cannot update session in ${session.status} state. Only DRAFT and WAITING sessions can be modified.`
      );
    }

    const updates: Partial<Doc<"sessions">> = {
      updatedAt: Date.now(),
    };

    // Validate and apply match name update
    if (args.matchName !== undefined) {
      updates.matchName = validateMatchName(args.matchName);
    }

    // Validate and apply turn timer update
    if (args.turnTimerSeconds !== undefined) {
      validateRange(
        args.turnTimerSeconds,
        MIN_TURN_TIMER_SECONDS,
        MAX_TURN_TIMER_SECONDS,
        "Turn timer",
        "seconds"
      );
      updates.turnTimerSeconds = args.turnTimerSeconds;
    }

    await ctx.db.patch(args.sessionId, updates);

    // Create audit log for session update
    // Derive changedFields from updates object for maintainability
    const changedFields = Object.keys(updates).filter(
      (key) => key !== "updatedAt"
    );
    await logAction(ctx, {
      sessionId: args.sessionId,
      action: "SESSION_UPDATED",
      actorType: "ADMIN",
      details: { reason: `Updated: ${changedFields.join(", ")}` },
    });

    return { success: true };
  },
});

/**
 * Delete a session and all related records.
 * Only allowed in DRAFT state. Cascade deletes players and maps,
 * but preserves audit logs for history.
 *
 * @param sessionId - The session to delete
 */
export const deleteSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Only allow deletion in DRAFT state
    if (session.status !== "DRAFT") {
      throw new ConvexError(
        `Cannot delete session in ${session.status} state. Only DRAFT sessions can be deleted.`
      );
    }

    // Fetch related records (include votes for complete cascade delete)
    const [players, maps, votes] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("votes")
        .withIndex("by_sessionId_and_round", (q) =>
          q.eq("sessionId", args.sessionId)
        )
        .collect(),
    ]);

    // Delete related records in parallel
    await Promise.all([
      ...players.map((p) => ctx.db.delete(p._id)),
      ...maps.map((m) => ctx.db.delete(m._id)),
      ...votes.map((v) => ctx.db.delete(v._id)),
    ]);

    // Delete the session
    await ctx.db.delete(args.sessionId);

    // Create audit log (preserve for history - note: sessionId will be orphaned reference)
    await logAction(ctx, {
      sessionId: args.sessionId,
      action: "SESSION_DELETED",
      actorType: "ADMIN",
    });

    return { success: true };
  },
});

/**
 * Assign a player to a session with a unique access token.
 * Only allowed in DRAFT or WAITING states.
 *
 * Token is valid for 24 hours and grants access to the player lobby/voting interface.
 *
 * @param sessionId - The session to assign player to
 * @param role - Player role (e.g., "Team A Captain", "Player 1")
 * @param teamName - Name of the team (must exist in teams table)
 */
export const assignPlayer = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.string(),
    teamName: v.string(),
  },
  returns: v.object({
    playerId: v.id("sessionPlayers"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Only allow in DRAFT or WAITING states
    if (session.status !== "DRAFT" && session.status !== "WAITING") {
      throw new ConvexError(
        `Cannot assign players in ${session.status} state. Only DRAFT and WAITING sessions allow player assignment.`
      );
    }

    // Check player count limit
    const existingPlayers = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    if (existingPlayers.length >= session.playerCount) {
      throw new ConvexError(
        `Session already has the maximum ${session.playerCount} players`
      );
    }

    // Validate role input (trimming, length limit) - do this early for duplicate check
    const validatedRole = validateName(args.role, "Role");

    // Check for duplicate role in session (use validated role for accurate comparison)
    const duplicateRole = existingPlayers.find((p) => p.role === validatedRole);
    if (duplicateRole) {
      throw new ConvexError(
        `Role "${validatedRole}" is already assigned in this session`
      );
    }

    // Validate team exists
    const team = await ctx.db
      .query("teams")
      .withIndex("by_name", (q) => q.eq("name", args.teamName))
      .first();
    if (!team) {
      throw new ConvexError(`Team "${args.teamName}" not found`);
    }

    // Generate unique token (UUID without dashes)
    const token = crypto.randomUUID().replace(/-/g, "");

    // Check token uniqueness (Convex indexes don't enforce uniqueness)
    const existingToken = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (existingToken) {
      // Extremely unlikely with UUID, but handle gracefully
      throw new ConvexError("Token collision - please retry");
    }

    const now = Date.now();
    const playerId = await ctx.db.insert("sessionPlayers", {
      sessionId: args.sessionId,
      role: validatedRole,
      teamName: args.teamName,
      token,
      tokenExpiresAt: now + TOKEN_EXPIRY_MS,
      isConnected: false,
      hasVotedThisRound: false,
    });

    // Create audit log
    await logAction(ctx, {
      sessionId: args.sessionId,
      action: "PLAYER_ASSIGNED",
      actorType: "ADMIN",
      details: { teamName: args.teamName },
    });

    return { playerId, token };
  },
});

/**
 * Set the map pool for a session by copying from master maps.
 * Only allowed in DRAFT state. Replaces any existing session maps.
 *
 * This implements the "snapshot pattern" - map data is copied at assignment time
 * so changes to master maps don't affect active sessions.
 *
 * @param sessionId - The session to set maps for
 * @param mapIds - Array of map IDs from the master maps table
 */
export const setSessionMaps = mutation({
  args: {
    sessionId: v.id("sessions"),
    mapIds: v.array(v.id("maps")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError("Session not found");
    }

    // Only allow in DRAFT state
    if (session.status !== "DRAFT") {
      throw new ConvexError(
        `Cannot set maps in ${session.status} state. Maps can only be set while session is in DRAFT.`
      );
    }

    // Validate map count matches session config
    if (args.mapIds.length !== session.mapPoolSize) {
      throw new ConvexError(
        `Expected ${session.mapPoolSize} maps, received ${args.mapIds.length}`
      );
    }

    // Check for duplicates in input
    const uniqueMapIds = new Set(args.mapIds);
    if (uniqueMapIds.size !== args.mapIds.length) {
      throw new ConvexError("Duplicate maps not allowed in the same session");
    }

    // Validate all maps exist and are active (batch fetch for performance)
    const maps = await Promise.all(args.mapIds.map((id) => ctx.db.get(id)));
    for (let i = 0; i < maps.length; i++) {
      const map = maps[i];
      if (!map) {
        throw new ConvexError(`Map not found: ${args.mapIds[i]}`);
      }
      if (!map.isActive) {
        throw new ConvexError(`Map "${map.name}" is not active`);
      }
    }

    // Delete existing session maps (replace behavior)
    const existingMaps = await ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    await Promise.all(existingMaps.map((m) => ctx.db.delete(m._id)));

    // Create snapshots from master maps (parallelized for performance)
    await Promise.all(
      maps.map(async (map) => {
        // Resolve image URL (storage takes precedence over external URL)
        let imageUrl = map!.imageUrl ?? "";
        if (map!.imageStorageId) {
          const storageUrl = await ctx.storage.getUrl(map!.imageStorageId);
          if (storageUrl) {
            imageUrl = storageUrl;
          }
        }

        return ctx.db.insert("sessionMaps", {
          sessionId: args.sessionId,
          mapId: map!._id,
          name: map!.name,
          imageUrl,
          state: "AVAILABLE",
        });
      })
    );

    // Update session timestamp
    await ctx.db.patch(args.sessionId, {
      updatedAt: Date.now(),
    });

    // Create audit log
    await logAction(ctx, {
      sessionId: args.sessionId,
      action: "MAPS_ASSIGNED",
      actorType: "ADMIN",
    });

    return { success: true };
  },
});

/**
 * Create a complete session atomically with players and maps.
 * Single transaction ensures no partial sessions are created.
 *
 * Combines createSession, assignPlayer, and setSessionMaps into one atomic operation.
 * If any validation fails, the entire operation is rolled back.
 *
 * @param matchName - Display name for the match
 * @param format - Voting format: "ABBA" (1v1) or "MULTIPLAYER"
 * @param turnTimerSeconds - Seconds per turn (default: 30)
 * @param mapPoolSize - Number of maps in pool (default: 5)
 * @param players - Array of player assignments with role and teamName
 * @param mapIds - Array of map IDs from the master maps table
 */
export const createSessionFull = mutation({
  args: {
    matchName: v.string(),
    format: sessionFormatValidator,
    turnTimerSeconds: v.optional(v.number()),
    mapPoolSize: v.optional(v.number()),
    players: v.array(
      v.object({
        role: v.string(),
        teamName: v.string(),
      })
    ),
    mapIds: v.array(v.id("maps")),
  },
  returns: v.object({
    sessionId: v.id("sessions"),
    playerTokens: v.array(
      v.object({
        role: v.string(),
        token: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // ========================================================================
    // 1. Validate all inputs upfront before any DB writes
    // ========================================================================

    // Validate match name
    const trimmedName = validateMatchName(args.matchName);

    // Validate turn timer
    const turnTimerSeconds = args.turnTimerSeconds ?? DEFAULT_TURN_TIMER_SECONDS;
    validateRange(
      turnTimerSeconds,
      MIN_TURN_TIMER_SECONDS,
      MAX_TURN_TIMER_SECONDS,
      "Turn timer",
      "seconds"
    );

    // Validate map pool size
    const mapPoolSize = args.mapPoolSize ?? DEFAULT_MAP_POOL_SIZE;
    validateRange(
      mapPoolSize,
      MIN_MAP_POOL_SIZE,
      MAX_MAP_POOL_SIZE,
      "Map pool size"
    );

    // Validate player count matches format expectations
    const expectedPlayerCount = args.format === "ABBA" ? 2 : 4;
    if (args.players.length !== expectedPlayerCount) {
      throw new ConvexError(
        `${args.format} format requires exactly ${expectedPlayerCount} players, received ${args.players.length}`
      );
    }

    // Validate player count range
    validateRange(
      args.players.length,
      MIN_PLAYER_COUNT,
      MAX_PLAYER_COUNT,
      "Player count"
    );

    // Validate and collect player roles (check for duplicates)
    const validatedPlayers: Array<{ role: string; teamName: string }> = [];
    const seenRoles = new Set<string>();
    for (const player of args.players) {
      const validatedRole = validateName(player.role, "Role");
      if (seenRoles.has(validatedRole)) {
        throw new ConvexError(
          `Duplicate role "${validatedRole}" in player list`
        );
      }
      seenRoles.add(validatedRole);
      validatedPlayers.push({ role: validatedRole, teamName: player.teamName });
    }

    // Validate all teams exist
    const teamNames = [...new Set(args.players.map((p) => p.teamName))];
    for (const teamName of teamNames) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_name", (q) => q.eq("name", teamName))
        .first();
      if (!team) {
        throw new ConvexError(`Team "${teamName}" not found`);
      }
    }

    // Validate map count matches pool size
    if (args.mapIds.length !== mapPoolSize) {
      throw new ConvexError(
        `Expected ${mapPoolSize} maps, received ${args.mapIds.length}`
      );
    }

    // Check for duplicate maps
    const uniqueMapIds = new Set(args.mapIds);
    if (uniqueMapIds.size !== args.mapIds.length) {
      throw new ConvexError("Duplicate maps not allowed in the same session");
    }

    // Validate all maps exist and are active
    const maps = await Promise.all(args.mapIds.map((id) => ctx.db.get(id)));
    for (let i = 0; i < maps.length; i++) {
      const map = maps[i];
      if (!map) {
        throw new ConvexError(`Map not found: ${args.mapIds[i]}`);
      }
      if (!map.isActive) {
        throw new ConvexError(`Map "${map.name}" is not active`);
      }
    }

    // ========================================================================
    // 2. Create session
    // ========================================================================

    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      matchName: trimmedName,
      format: args.format,
      status: "DRAFT",
      turnTimerSeconds,
      mapPoolSize,
      playerCount: args.players.length,
      currentTurn: 0,
      currentRound: 1,
      createdBy: admin._id,
      updatedAt: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    // ========================================================================
    // 3. Create players with tokens
    // ========================================================================

    const playerTokens: Array<{ role: string; token: string }> = [];
    const generatedTokens = new Set<string>();

    for (const player of validatedPlayers) {
      // Generate unique token (UUID without dashes)
      let token = crypto.randomUUID().replace(/-/g, "");

      // Ensure no collision within this batch
      while (generatedTokens.has(token)) {
        token = crypto.randomUUID().replace(/-/g, "");
      }
      generatedTokens.add(token);

      // Check token uniqueness in database (extremely unlikely with UUID)
      const existingToken = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
      if (existingToken) {
        throw new ConvexError("Token collision - please retry");
      }

      await ctx.db.insert("sessionPlayers", {
        sessionId,
        role: player.role,
        teamName: player.teamName,
        token,
        tokenExpiresAt: now + TOKEN_EXPIRY_MS,
        isConnected: false,
        hasVotedThisRound: false,
      });

      playerTokens.push({ role: player.role, token });
    }

    // ========================================================================
    // 4. Create session maps (snapshots from master maps)
    // ========================================================================

    await Promise.all(
      maps.map(async (map) => {
        // Resolve image URL (storage takes precedence over external URL)
        let imageUrl = map!.imageUrl ?? "";
        if (map!.imageStorageId) {
          const storageUrl = await ctx.storage.getUrl(map!.imageStorageId);
          if (storageUrl) {
            imageUrl = storageUrl;
          }
        }

        return ctx.db.insert("sessionMaps", {
          sessionId,
          mapId: map!._id,
          name: map!.name,
          imageUrl,
          state: "AVAILABLE",
        });
      })
    );

    // ========================================================================
    // 5. Create audit log
    // ========================================================================

    await logAction(ctx, {
      sessionId,
      action: "SESSION_CREATED",
      actorType: "ADMIN",
      actorId: admin._id,
      details: {
        reason: `Created with ${args.players.length} players and ${args.mapIds.length} maps`,
      },
    });

    return { sessionId, playerTokens };
  },
});

// ============================================================================
// Lifecycle Mutations
// ============================================================================

/**
 * Finalize a session, transitioning DRAFT → WAITING.
 * Validates that the correct number of players and maps are assigned.
 *
 * @param sessionId - Session to finalize
 * @returns success flag
 */
export const finalizeSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    // Fail-fast before expensive guard queries
    validateTransition(session.status, "WAITING");
    await guardFinalize(ctx, session);
    await transitionSession(ctx, session, "WAITING", {
      auditAction: "SESSION_FINALIZED",
      actorType: "ADMIN",
      actorId: admin._id,
    });

    return { success: true };
  },
});

/**
 * Start a session, transitioning WAITING → IN_PROGRESS.
 * Validates that all players are connected before starting.
 *
 * @param sessionId - Session to start
 * @returns success flag
 */
export const startSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    // Fail-fast before expensive guard queries
    validateTransition(session.status, "IN_PROGRESS");
    await guardStart(ctx, session);

    const now = Date.now();
    await transitionSession(ctx, session, "IN_PROGRESS", {
      auditAction: "SESSION_STARTED",
      actorType: "ADMIN",
      actorId: admin._id,
      patches: {
        startedAt: now,
        timerStartedAt: now,
        currentTurn: 0,
        currentRound: 1,
      },
    });

    return { success: true };
  },
});

/**
 * Pause a session, transitioning IN_PROGRESS → PAUSED.
 * Preserves timer state via timerPausedAt for later resume.
 *
 * @param sessionId - Session to pause
 * @param reason - Optional pause reason for audit log
 * @returns success flag
 */
export const pauseSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    if (args.reason && args.reason.length > MAX_REASON_LENGTH) {
      throw new ConvexError("Reason must be 500 characters or fewer");
    }

    await transitionSession(ctx, session, "PAUSED", {
      auditAction: "SESSION_PAUSED",
      actorType: "ADMIN",
      actorId: admin._id,
      patches: { timerPausedAt: Date.now() },
      auditDetails: args.reason ? { reason: args.reason } : undefined,
    });

    return { success: true };
  },
});

/**
 * Resume a paused session, transitioning PAUSED → IN_PROGRESS.
 * Timer arithmetic preserves remaining time from before pause.
 * Clears isRevoteRound per schema.ts TODO (line 69-72).
 *
 * @param sessionId - Session to resume
 * @returns success flag
 */
export const resumeSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    // Calculate elapsed time to preserve remaining timer
    const now = Date.now();
    const elapsed =
      (session.timerPausedAt ?? now) - (session.timerStartedAt ?? now);
    const adjustedTimerStart = now - elapsed;

    await transitionSession(ctx, session, "IN_PROGRESS", {
      auditAction: "SESSION_RESUMED",
      actorType: "ADMIN",
      actorId: admin._id,
      patches: {
        timerStartedAt: adjustedTimerStart,
        timerPausedAt: undefined,
        isRevoteRound: false,
      },
    });

    return { success: true };
  },
});

/**
 * Force-end a session from any active state → COMPLETE.
 * Does not set winnerMapId. IP cleanup deferred to hourly cron.
 *
 * @param sessionId - Session to end
 * @returns success flag
 */
export const endSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    await transitionSession(ctx, session, "COMPLETE", {
      auditAction: "SESSION_ENDED",
      actorType: "ADMIN",
      actorId: admin._id,
      patches: {
        completedAt: Date.now(),
        timerStartedAt: undefined,
        timerPausedAt: undefined,
        isRevoteRound: false,
      },
      auditDetails: { reason: "ADMIN_FORCE_END" },
    });

    // IP cleanup handled by hourly cron clearCompletedSessionIps (convex/crons.ts)
    // TODO: Add immediate IP cleanup scheduling via ctx.scheduler.runAfter (Phase 2)

    return { success: true };
  },
});

/**
 * Reset a completed session for replay. COMPLETE → WAITING.
 * Clears all voting data, resets maps and players, extends expiration.
 * Preserves session configuration and player assignments.
 *
 * @param sessionId - Session to reset
 * @returns success flag
 */
export const resetSession = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    // Only COMPLETE sessions can be reset
    if (session.status !== "COMPLETE") {
      throw new ConvexError(
        `Cannot reset session in ${session.status} state. Only COMPLETE sessions can be reset.`
      );
    }

    // 1. Fetch all related data in parallel
    const [votes, sessionMaps, players] = await Promise.all([
      ctx.db
        .query("votes")
        .withIndex("by_sessionId_and_round", (q) =>
          q.eq("sessionId", args.sessionId)
        )
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

    // 2. Delete votes, reset maps, and reset players in parallel
    const now = Date.now();
    await Promise.all([
      ...votes.map((vote) => ctx.db.delete(vote._id)),
      ...sessionMaps.map((m) =>
        ctx.db.patch(m._id, {
          state: "AVAILABLE",
          bannedByPlayerId: undefined,
          bannedAtTurn: undefined,
          bannedAtRound: undefined,
          voteCount: undefined,
          submittedByAdmin: undefined,
        })
      ),
      ...players.map((p) =>
        ctx.db.patch(p._id, {
          hasVotedThisRound: false,
          tokenExpiresAt: now + TOKEN_EXPIRY_MS,
        })
      ),
    ]);

    // 3. Transition session: COMPLETE → WAITING with standard reset patches
    await transitionSession(ctx, session, "WAITING", {
      auditAction: "SESSION_RESET",
      actorType: "ADMIN",
      actorId: admin._id,
      patches: SESSION_RESET_PATCHES,
    });

    // 4. Extend expiresAt by 2 weeks (not in SessionStatePatches type)
    await ctx.db.patch(args.sessionId, {
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    return { success: true };
  },
});

/**
 * Clone a session into a new DRAFT copy. Source can be in any state.
 * Copies config, players (new tokens), and maps (reset to AVAILABLE).
 * Does NOT copy votes, audit logs, or timer state.
 *
 * @param sessionId - Source session to clone
 */
export const cloneSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.object({ newSessionId: v.id("sessions") }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // 1. Read source session
    const source = await ctx.db.get(args.sessionId);
    if (!source) throw new ConvexError("Session not found");

    // 2. Read related data in parallel
    const [sourcePlayers, sourceMaps] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

    // 3. Build cloned matchName (truncate if needed to fit MAX_NAME_LENGTH)
    const suffix = " (Copy)";
    const maxBase = MAX_NAME_LENGTH - suffix.length;
    const baseName =
      source.matchName.length > maxBase
        ? source.matchName.slice(0, maxBase)
        : source.matchName;
    const clonedName = baseName + suffix;

    // 4. Create new session
    const now = Date.now();
    const newSessionId = await ctx.db.insert("sessions", {
      matchName: clonedName,
      format: source.format,
      status: "DRAFT",
      turnTimerSeconds: source.turnTimerSeconds,
      mapPoolSize: source.mapPoolSize,
      playerCount: source.playerCount,
      currentTurn: 0,
      currentRound: 1,
      createdBy: admin._id,
      updatedAt: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    // 5. Clone players with fresh tokens (follows createSessionFull pattern)
    const generatedTokens = new Set<string>();
    for (const player of sourcePlayers) {
      let token = crypto.randomUUID().replace(/-/g, "");
      while (generatedTokens.has(token)) {
        token = crypto.randomUUID().replace(/-/g, "");
      }
      generatedTokens.add(token);

      // DB uniqueness check (indexes don't enforce uniqueness)
      const existing = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
      if (existing) {
        throw new ConvexError("Token collision - please retry");
      }

      await ctx.db.insert("sessionPlayers", {
        sessionId: newSessionId,
        role: player.role,
        teamName: player.teamName,
        token,
        tokenExpiresAt: now + TOKEN_EXPIRY_MS,
        isConnected: false,
        hasVotedThisRound: false,
      });
    }

    // 6. Clone maps from source snapshots (all reset to AVAILABLE)
    for (const map of sourceMaps) {
      await ctx.db.insert("sessionMaps", {
        sessionId: newSessionId,
        mapId: map.mapId,
        name: map.name,
        imageUrl: map.imageUrl,
        state: "AVAILABLE",
      });
    }

    // 7. Audit log on BOTH sessions
    await logAction(ctx, {
      sessionId: args.sessionId,
      action: "SESSION_CLONED",
      actorType: "ADMIN",
      actorId: admin._id,
      details: { reason: `Cloned to ${newSessionId}` },
    });

    await logAction(ctx, {
      sessionId: newSessionId,
      action: "SESSION_CLONED",
      actorType: "ADMIN",
      actorId: admin._id,
      details: { reason: `Cloned from ${args.sessionId}` },
    });

    return { newSessionId };
  },
});

/**
 * Force-select a random winner from available maps and complete the session.
 * Admin-only action for immediately ending an active session.
 *
 * @param sessionId - Session to force-complete
 * @returns Success flag and selected winner map name
 */
export const forceRandomSelection = mutation({
  args: { sessionId: v.id("sessions") },
  returns: v.object({ success: v.boolean(), winnerMapName: v.string() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");

    // Validate IN_PROGRESS or PAUSED → COMPLETE is allowed
    validateTransition(session.status, "COMPLETE");

    // Get all available maps
    const availableMaps = await ctx.db
      .query("sessionMaps")
      .withIndex("by_sessionId_and_state", (q) =>
        q.eq("sessionId", session._id).eq("state", "AVAILABLE")
      )
      .collect();

    if (availableMaps.length === 0) {
      throw new ConvexError("No available maps to select from");
    }

    // CSPRNG selection (matching resolveRound pattern)
    const winnerMap = pickRandom(availableMaps);

    // Ban all other available maps (with metadata so buildRoundHistory sorts correctly)
    const otherMaps = availableMaps.filter((m) => m._id !== winnerMap._id);
    const banPatch =
      session.format === "ABBA"
        ? { state: "BANNED" as const, bannedAtTurn: session.currentTurn }
        : { state: "BANNED" as const, bannedAtRound: session.currentRound };
    await Promise.all(otherMaps.map((m) => ctx.db.patch(m._id, banPatch)));

    // Log RANDOM_SELECTION audit event
    await logAction(ctx, {
      sessionId: session._id,
      action: "RANDOM_SELECTION",
      actorType: "ADMIN",
      actorId: admin._id,
      details: {
        mapId: winnerMap._id,
        mapName: winnerMap.name,
        reason: "ADMIN_FORCE",
      },
    });

    // Complete session (marks winner, patches status, logs WINNER_DECLARED)
    await completeSession(ctx, session, winnerMap, { reason: "ADMIN_FORCE" });

    return { success: true, winnerMapName: winnerMap.name };
  },
});

// ============================================================================
// Player-Facing Queries
// ============================================================================

/**
 * Validator for sanitized player data (no tokens exposed).
 */
const sanitizedPlayerValidator = v.object({
  _id: v.id("sessionPlayers"),
  role: v.string(),
  teamName: v.string(),
  isConnected: v.boolean(),
  hasVotedThisRound: v.boolean(),
});

/**
 * Validator for round history entries returned by player queries.
 */
const roundHistoryEntryValidator = v.object({
  round: v.number(),
  bans: v.array(
    v.object({
      mapId: v.id("sessionMaps"),
      mapName: v.string(),
      bannedByTeam: v.string(),
    })
  ),
});

/**
 * Validator for MULTIPLAYER vote progress.
 */
const voteProgressValidator = v.object({
  totalPlayers: v.number(),
  votedCount: v.number(),
  allVoted: v.boolean(),
});

/**
 * Get session data for player-facing pages by access token.
 * Returns sanitized data with voting context for the UI.
 *
 * Includes:
 * - Round history (completed bans organized by round)
 * - Vote progress for MULTIPLAYER (aggregate count, no individual choices)
 * - isRevoteRound flag for deadlock revote state
 * - completedRounds count for progress tracking
 *
 * @param token - Player access token from URL
 */
export const getSessionByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal("valid"),
      player: sanitizedPlayerValidator,
      session: v.object({
        _id: v.id("sessions"),
        matchName: v.string(),
        format: sessionFormatValidator,
        status: sessionStatusValidator,
        turnTimerSeconds: v.number(),
        currentTurn: v.number(),
        currentRound: v.number(),
        isRevoteRound: v.boolean(),
        completedRounds: v.number(),
        timerStartedAt: v.optional(v.number()),
        timerPausedAt: v.optional(v.number()),
        winnerMapId: v.optional(v.id("sessionMaps")),
      }),
      maps: v.array(sessionMapObjectValidator),
      otherPlayers: v.array(sanitizedPlayerValidator),
      isYourTurn: v.boolean(),
      roundHistory: v.array(roundHistoryEntryValidator),
      voteProgress: v.optional(voteProgressValidator),
      playerVotedMapId: v.optional(v.id("sessionMaps")),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("TOKEN_NOT_ACTIVATED")
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Look up player by token using by_token index
    const player = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!player) {
      return { status: "error" as const, error: "INVALID_TOKEN" as const };
    }

    // Check token expiration
    if (player.tokenExpiresAt < Date.now()) {
      return { status: "error" as const, error: "TOKEN_EXPIRED" as const };
    }

    // Get session
    const session = await ctx.db.get(player.sessionId);
    if (!session) {
      return { status: "error" as const, error: "SESSION_NOT_FOUND" as const };
    }

    // Check that token has been activated via HTTP action (IP locked)
    if (!player.ipAddress) {
      return {
        status: "error" as const,
        error: "TOKEN_NOT_ACTIVATED" as const,
      };
    }

    // Get all players, maps, and current player's vote in parallel
    const [allPlayers, maps, playerVote] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect(),
      session.format === "MULTIPLAYER" && player.hasVotedThisRound
        ? ctx.db
            .query("votes")
            .withIndex("by_playerId_and_round", (q) =>
              q.eq("playerId", player._id).eq("round", session.currentRound)
            )
            .first()
        : Promise.resolve(null),
    ]);

    // Sanitize player data (exclude tokens, IPs)
    const otherPlayers = allPlayers
      .filter((p) => p._id !== player._id)
      .map(toSanitizedPlayer);

    // Sort players by creation time to get consistent ordering for turn calculation
    const sortedPlayers = sortPlayersByJoinOrder(allPlayers);
    const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
    const isYourTurn = computeIsYourTurn(
      session,
      player.hasVotedThisRound,
      playerIndex
    );

    // Build round history from completed bans
    const roundHistory = buildRoundHistory(maps, allPlayers, session.format);

    // completedRounds semantics differ by format:
    // - ABBA: count of banned maps (each ban = 1 round)
    // - MULTIPLAYER: number of resolved voting rounds (currentRound - 1)
    const completedRounds =
      session.format === "ABBA"
        ? maps.filter((m) => m.state === "BANNED").length
        : Math.max(0, session.currentRound - 1);

    // Compute vote progress for MULTIPLAYER IN_PROGRESS sessions
    // Derive allVoted from votedCount to avoid redundant iteration
    const activePlayers = allPlayers;
    const votedCount = activePlayers.filter(
      (p) => p.hasVotedThisRound
    ).length;
    const voteProgress =
      session.format === "MULTIPLAYER" && session.status === "IN_PROGRESS"
        ? {
            totalPlayers: activePlayers.length,
            votedCount,
            allVoted: votedCount === activePlayers.length,
          }
        : undefined;

    const playerVotedMapId = playerVote?.mapId ?? undefined;

    return {
      status: "valid" as const,
      player: toSanitizedPlayer(player),
      session: {
        _id: session._id,
        matchName: session.matchName,
        format: session.format,
        status: session.status,
        turnTimerSeconds: session.turnTimerSeconds,
        currentTurn: session.currentTurn,
        currentRound: session.currentRound,
        isRevoteRound: session.isRevoteRound ?? false,
        completedRounds,
        timerStartedAt: session.timerStartedAt,
        timerPausedAt: session.timerPausedAt,
        winnerMapId: session.winnerMapId,
      },
      maps,
      otherPlayers,
      isYourTurn,
      roundHistory,
      voteProgress,
      playerVotedMapId,
    };
  },
});

/**
 * Get session results for display on results page.
 * Requires valid token authentication.
 *
 * @param token - Player access token
 */
export const getSessionResultsByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal("valid"),
      session: v.object({
        _id: v.id("sessions"),
        matchName: v.string(),
        format: sessionFormatValidator,
        status: sessionStatusValidator,
        completedAt: v.optional(v.number()),
      }),
      teams: v.array(v.string()),
      winnerMap: v.optional(
        v.object({
          _id: v.id("sessionMaps"),
          name: v.string(),
          imageUrl: v.string(),
        })
      ),
      maps: v.array(sessionMapObjectValidator),
      banHistory: v.array(
        v.object({
          order: v.number(),
          teamName: v.string(),
          mapName: v.string(),
          mapImage: v.string(),
        })
      ),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_COMPLETE")
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Validate token
    const player = await ctx.db
      .query("sessionPlayers")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!player) {
      return { status: "error" as const, error: "INVALID_TOKEN" as const };
    }

    if (player.tokenExpiresAt < Date.now()) {
      return { status: "error" as const, error: "TOKEN_EXPIRED" as const };
    }

    const session = await ctx.db.get(player.sessionId);
    if (!session) {
      return { status: "error" as const, error: "SESSION_NOT_FOUND" as const };
    }

    // Allow viewing results only for COMPLETE sessions
    if (session.status !== "COMPLETE") {
      return {
        status: "error" as const,
        error: "SESSION_NOT_COMPLETE" as const,
      };
    }

    const { maps, teams, winnerMap, banHistory } = await buildSessionResults(
      ctx,
      session
    );

    return {
      status: "valid" as const,
      session: {
        _id: session._id,
        matchName: session.matchName,
        format: session.format,
        status: session.status,
        completedAt: session.completedAt,
      },
      teams,
      winnerMap: winnerMap
        ? {
            _id: winnerMap._id,
            name: winnerMap.name,
            imageUrl: winnerMap.imageUrl,
          }
        : undefined,
      maps,
      banHistory,
    };
  },
});

/**
 * Get session results for public display on results page.
 *
 * DESIGN DECISION: This query is intentionally unauthenticated.
 * Results are considered public information once a session completes,
 * allowing players to share result URLs with others.
 *
 * Security considerations:
 * - Session IDs are opaque Convex IDs (not enumerable/sequential)
 * - Only COMPLETE sessions return data (in-progress sessions are protected)
 * - No PII exposed (team names are public by nature of esports)
 *
 * @param sessionId - The session to get results for
 * @returns Session results with winner, ban history, and map summary, or error
 */
export const getSessionResults = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      status: v.literal("valid"),
      session: v.object({
        _id: v.id("sessions"),
        matchName: v.string(),
        format: sessionFormatValidator,
        status: sessionStatusValidator,
        completedAt: v.optional(v.number()),
      }),
      teams: v.array(v.string()),
      winnerMap: v.optional(
        v.object({
          _id: v.id("sessionMaps"),
          name: v.string(),
          imageUrl: v.string(),
        })
      ),
      maps: v.array(sessionMapObjectValidator),
      banHistory: v.array(
        v.object({
          order: v.number(),
          teamName: v.string(),
          mapName: v.string(),
          mapImage: v.string(),
        })
      ),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("SESSION_NOT_FOUND"),
        v.literal("SESSION_NOT_COMPLETE")
      ),
    })
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { status: "error" as const, error: "SESSION_NOT_FOUND" as const };
    }

    // Allow viewing results only for COMPLETE sessions
    if (session.status !== "COMPLETE") {
      return {
        status: "error" as const,
        error: "SESSION_NOT_COMPLETE" as const,
      };
    }

    const { maps, teams, winnerMap, banHistory } = await buildSessionResults(
      ctx,
      session
    );

    return {
      status: "valid" as const,
      session: {
        _id: session._id,
        matchName: session.matchName,
        format: session.format,
        status: session.status,
        completedAt: session.completedAt,
      },
      teams,
      winnerMap: winnerMap
        ? {
            _id: winnerMap._id,
            name: winnerMap.name,
            imageUrl: winnerMap.imageUrl,
          }
        : undefined,
      maps,
      banHistory,
    };
  },
});
