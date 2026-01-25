/**
 * Sessions Module
 *
 * Handles voting session lifecycle: creation, configuration, player assignment,
 * map pool setup, and session state management.
 */

import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";

import {
  SESSION_EXPIRY_MS,
  TOKEN_EXPIRY_MS,
  DEFAULT_TURN_TIMER_SECONDS,
  DEFAULT_MAP_POOL_SIZE,
  MIN_PLAYER_COUNT,
  MAX_PLAYER_COUNT,
  MIN_TURN_TIMER_SECONDS,
  MAX_TURN_TIMER_SECONDS,
  MIN_MAP_POOL_SIZE,
  MAX_MAP_POOL_SIZE,
} from "./lib/constants";
import { validateName, validateRange } from "./lib/validation";
import {
  sessionStatusValidator,
  sessionFormatValidator,
  mapStateValidator,
} from "./lib/validators";

import { logAction } from "./audit";

const validateMatchName = (name: string) => validateName(name, "Match");

// ============================================================================
// Reusable Object Validators
// ============================================================================

/**
 * Validator for session player objects.
 */
const sessionPlayerObjectValidator = v.object({
  _id: v.id("sessionPlayers"),
  _creationTime: v.number(),
  sessionId: v.id("sessions"),
  role: v.string(),
  teamName: v.string(),
  token: v.string(),
  tokenExpiresAt: v.number(),
  ipAddress: v.optional(v.string()),
  isConnected: v.boolean(),
  lastHeartbeat: v.optional(v.number()),
  hasVotedThisRound: v.boolean(),
});

/**
 * Validator for session map objects.
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
  createdBy: v.id("admins"),
  updatedAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  expiresAt: v.number(),
  players: v.array(sessionPlayerObjectValidator),
  maps: v.array(sessionMapObjectValidator),
});

// ============================================================================
// Private Helpers
// ============================================================================

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
    const abbaPattern = [0, 1, 1, 0];
    const activeIndex = abbaPattern[session.currentTurn % abbaPattern.length];
    return playerIndex === activeIndex;
  }
  return false;
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

  const playerMap = new Map(players.map((p) => [p._id.toString(), p]));
  const teams = [...new Set(players.map((p) => p.teamName))];
  const winnerMap = maps.find((m) => m.state === "WINNER");

  const banHistory = maps
    .filter((m) => m.state === "BANNED" && m.bannedByPlayerId)
    .sort((a, b) => (a.bannedAtTurn ?? 0) - (b.bannedAtTurn ?? 0))
    .map((m, index) => {
      const bannedBy = m.bannedByPlayerId
        ? playerMap.get(m.bannedByPlayerId.toString())
        : undefined;
      return {
        order: index + 1,
        teamName: bannedBy?.teamName ?? "Unknown",
        mapName: m.name,
        mapImage: m.imageUrl,
      };
    });

  return { players, maps, teams, winnerMap, banHistory };
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
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Fetch related data in parallel for performance
    const [players, maps] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

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
 * @param createdBy - Admin ID who created session (required until auth is integrated)
 */
export const createSession = mutation({
  args: {
    matchName: v.string(),
    format: sessionFormatValidator,
    playerCount: v.number(),
    turnTimerSeconds: v.optional(v.number()),
    mapPoolSize: v.optional(v.number()),
    // TODO: Remove this arg when auth is integrated - will be auto-populated from ctx.auth
    createdBy: v.optional(v.id("admins")),
  },
  returns: v.object({ sessionId: v.id("sessions") }),
  handler: async (ctx, args) => {
    // Validate match name
    const trimmedName = validateMatchName(args.matchName);

    // Validate player count
    validateRange(
      args.playerCount,
      MIN_PLAYER_COUNT,
      MAX_PLAYER_COUNT,
      "Player count"
    );

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

    // TODO: Get createdBy from ctx.auth when auth is integrated
    // For now, require it to be passed explicitly
    if (!args.createdBy) {
      throw new ConvexError(
        "createdBy is required. Authentication will auto-populate this in a future update."
      );
    }

    // Verify the admin exists
    const admin = await ctx.db.get(args.createdBy);
    if (!admin) {
      throw new ConvexError("Invalid admin ID provided for createdBy");
    }

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
      createdBy: args.createdBy,
      updatedAt: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    });

    // Create audit log
    await logAction(ctx, {
      sessionId,
      action: "SESSION_CREATED",
      actorType: "ADMIN",
      actorId: args.createdBy,
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
 * Get session data for player-facing pages by access token.
 * Returns sanitized data (no other players' tokens exposed).
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
        timerStartedAt: v.optional(v.number()),
        timerPausedAt: v.optional(v.number()),
        winnerMapId: v.optional(v.id("sessionMaps")),
      }),
      maps: v.array(sessionMapObjectValidator),
      otherPlayers: v.array(sanitizedPlayerValidator),
      isYourTurn: v.boolean(),
    }),
    v.object({
      status: v.literal("error"),
      error: v.union(
        v.literal("INVALID_TOKEN"),
        v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_NOT_FOUND")
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

    // Get all players and maps in parallel
    const [allPlayers, maps] = await Promise.all([
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect(),
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect(),
    ]);

    // Sanitize player data (exclude tokens)
    const sanitizePlayer = (p: typeof player) => ({
      _id: p._id,
      role: p.role,
      teamName: p.teamName,
      isConnected: p.isConnected,
      hasVotedThisRound: p.hasVotedThisRound,
    });

    const otherPlayers = allPlayers
      .filter((p) => p._id !== player._id)
      .map(sanitizePlayer);

    // Sort players by creation time to get consistent ordering for turn calculation
    const sortedPlayers = [...allPlayers].sort(
      (a, b) => a._creationTime - b._creationTime
    );
    const playerIndex = sortedPlayers.findIndex((p) => p._id === player._id);
    const isYourTurn = computeIsYourTurn(
      session,
      player.hasVotedThisRound,
      playerIndex
    );

    return {
      status: "valid" as const,
      player: sanitizePlayer(player),
      session: {
        _id: session._id,
        matchName: session.matchName,
        format: session.format,
        status: session.status,
        turnTimerSeconds: session.turnTimerSeconds,
        currentTurn: session.currentTurn,
        currentRound: session.currentRound,
        timerStartedAt: session.timerStartedAt,
        timerPausedAt: session.timerPausedAt,
        winnerMapId: session.winnerMapId,
      },
      maps,
      otherPlayers,
      isYourTurn,
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
