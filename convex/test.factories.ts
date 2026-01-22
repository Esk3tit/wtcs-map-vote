/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data consistently.
 */

import { convexTest } from "convex-test";

import { Id, TableNames, DataModel } from "./_generated/dataModel";
import { GenericMutationCtx } from "convex/server";

// ============================================================================
// Constants
// ============================================================================

/** One day in milliseconds (24 hours) */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Factories
// ============================================================================

/**
 * Factory for admin test data.
 *
 * @param overrides - Optional field overrides
 */
export const adminFactory = (
  overrides: Partial<{
    email: string;
    name: string;
    avatarUrl: string;
    isRootAdmin: boolean;
    lastLoginAt: number;
  }> = {}
) => ({
  email: overrides.email ?? "admin@test.com",
  name: overrides.name ?? "Test Admin",
  avatarUrl: overrides.avatarUrl,
  isRootAdmin: overrides.isRootAdmin ?? false,
  lastLoginAt: overrides.lastLoginAt ?? Date.now(),
});

/**
 * Factory for team test data.
 *
 * @param overrides - Optional field overrides
 */
export const teamFactory = (
  overrides: Partial<{
    name: string;
    logoUrl: string;
    updatedAt: number;
  }> = {}
) => ({
  name: overrides.name ?? "Test Team",
  logoUrl: overrides.logoUrl,
  updatedAt: overrides.updatedAt ?? Date.now(),
});

/**
 * Factory for map test data.
 *
 * @param overrides - Optional field overrides
 */
export const mapFactory = (
  overrides: Partial<{
    name: string;
    imageUrl: string;
    isActive: boolean;
    updatedAt: number;
  }> = {}
) => ({
  name: overrides.name ?? "Test Map",
  imageUrl: overrides.imageUrl,
  isActive: overrides.isActive ?? true,
  updatedAt: overrides.updatedAt ?? Date.now(),
});

/**
 * Factory for session test data.
 *
 * @param createdBy - Admin ID (required, must be provided by test)
 * @param overrides - Optional field overrides
 */
export const sessionFactory = (
  createdBy: Id<"admins">,
  overrides: Partial<{
    matchName: string;
    format: "ABBA" | "MULTIPLAYER";
    status:
      | "DRAFT"
      | "WAITING"
      | "IN_PROGRESS"
      | "PAUSED"
      | "COMPLETE"
      | "EXPIRED";
    turnTimerSeconds: number;
    mapPoolSize: number;
    playerCount: number;
    currentTurn: number;
    currentRound: number;
    updatedAt: number;
    expiresAt: number;
    isActive: boolean;
  }> = {}
) => {
  const now = Date.now();
  const status = overrides.status ?? "DRAFT";
  const ACTIVE_STATUSES = new Set(["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"]);
  return {
    matchName: overrides.matchName ?? "Test Match",
    format: overrides.format ?? "ABBA",
    status,
    turnTimerSeconds: overrides.turnTimerSeconds ?? 30,
    mapPoolSize: overrides.mapPoolSize ?? 7,
    playerCount: overrides.playerCount ?? 2,
    currentTurn: overrides.currentTurn ?? 0,
    currentRound: overrides.currentRound ?? 0,
    createdBy,
    updatedAt: overrides.updatedAt ?? now,
    expiresAt: overrides.expiresAt ?? now + ONE_DAY_MS,
    isActive: overrides.isActive ?? ACTIVE_STATUSES.has(status),
  };
};

/**
 * Factory for session player test data.
 *
 * @param sessionId - Session ID (required, must be provided by test)
 * @param overrides - Optional field overrides
 */
export const sessionPlayerFactory = (
  sessionId: Id<"sessions">,
  overrides: Partial<{
    role: string;
    teamName: string;
    token: string;
    tokenExpiresAt: number;
    ipAddress: string;
    isConnected: boolean;
    lastHeartbeat: number;
    hasVotedThisRound: boolean;
  }> = {}
) => {
  const now = Date.now();
  return {
    sessionId,
    role: overrides.role ?? "captain",
    teamName: overrides.teamName ?? "Test Team",
    token: overrides.token ?? crypto.randomUUID(),
    tokenExpiresAt: overrides.tokenExpiresAt ?? now + ONE_DAY_MS,
    ipAddress: overrides.ipAddress,
    isConnected: overrides.isConnected ?? false,
    lastHeartbeat: overrides.lastHeartbeat,
    hasVotedThisRound: overrides.hasVotedThisRound ?? false,
  };
};

/**
 * Factory for session map test data.
 *
 * @param sessionId - Session ID (required, must be provided by test)
 * @param mapId - Map ID (required, must be provided by test)
 * @param overrides - Optional field overrides
 */
export const sessionMapFactory = (
  sessionId: Id<"sessions">,
  mapId: Id<"maps">,
  overrides: Partial<{
    name: string;
    imageUrl: string;
    state: "AVAILABLE" | "BANNED" | "WINNER";
    bannedByPlayerId: Id<"sessionPlayers">;
    bannedAtTurn: number;
    bannedAtRound: number;
    voteCount: number;
  }> = {}
) => ({
  sessionId,
  mapId,
  name: overrides.name ?? "Test Map",
  imageUrl: overrides.imageUrl ?? "https://example.com/map.png",
  state: overrides.state ?? "AVAILABLE",
  bannedByPlayerId: overrides.bannedByPlayerId,
  bannedAtTurn: overrides.bannedAtTurn,
  bannedAtRound: overrides.bannedAtRound,
  voteCount: overrides.voteCount,
});

/**
 * Factory for vote test data.
 *
 * @param sessionId - Session ID (required, must be provided by test)
 * @param playerId - Session player ID (required, must be provided by test)
 * @param mapId - Session map ID (required, must be provided by test)
 * @param overrides - Optional field overrides
 */
export const voteFactory = (
  sessionId: Id<"sessions">,
  playerId: Id<"sessionPlayers">,
  mapId: Id<"sessionMaps">,
  overrides: Partial<{
    round: number;
    submittedAt: number;
    submittedByAdmin: boolean;
  }> = {}
) => ({
  sessionId,
  round: overrides.round ?? 1,
  playerId,
  mapId,
  submittedAt: overrides.submittedAt ?? Date.now(),
  submittedByAdmin: overrides.submittedByAdmin ?? false,
});

/**
 * Factory for audit log test data.
 *
 * @param sessionId - Session ID (required, must be provided by test)
 * @param overrides - Optional field overrides
 */
export const auditLogFactory = (
  sessionId: Id<"sessions">,
  overrides: Partial<{
    action: string;
    actorType: "ADMIN" | "PLAYER" | "SYSTEM";
    actorId: string;
    details: {
      mapId?: Id<"sessionMaps">;
      mapName?: string;
      teamName?: string;
      turn?: number;
      round?: number;
      reason?: string;
    };
    timestamp: number;
  }> = {}
) => ({
  sessionId,
  action: overrides.action ?? "SESSION_CREATED",
  actorType: overrides.actorType ?? "SYSTEM",
  actorId: overrides.actorId,
  details: overrides.details ?? {},
  timestamp: overrides.timestamp ?? Date.now(),
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Mutation context type for test setup functions.
 */
type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * Test context type from convex-test.
 */
type TestContext = ReturnType<typeof convexTest>;

/**
 * Creates an entity, deletes it, and returns the deleted ID.
 * Useful for testing "not found" scenarios with valid but non-existent IDs.
 *
 * @param t - Test context from createTestContext()
 * @param setup - Function that creates the entity and returns its ID
 */
export async function createDeletedId<T extends TableNames>(
  t: TestContext,
  setup: (ctx: MutationCtx) => Promise<Id<T>>
): Promise<Id<T>> {
  return await t.run(async (ctx) => {
    const id = await setup(ctx);
    await ctx.db.delete(id);
    return id;
  });
}

/**
 * Creates a deleted admin ID for testing non-existent admin scenarios.
 *
 * @param t - Test context from createTestContext()
 */
export async function createDeletedAdminId(
  t: TestContext
): Promise<Id<"admins">> {
  return createDeletedId(t, async (ctx) =>
    ctx.db.insert("admins", adminFactory())
  );
}

/**
 * Creates a deleted session ID for testing non-existent session scenarios.
 * Automatically creates the required admin first.
 *
 * @param t - Test context from createTestContext()
 * @param sessionOverrides - Optional session factory overrides
 */
export async function createDeletedSessionId(
  t: TestContext,
  sessionOverrides: Parameters<typeof sessionFactory>[1] = {}
): Promise<Id<"sessions">> {
  return createDeletedId(t, async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    return ctx.db.insert("sessions", sessionFactory(adminId, sessionOverrides));
  });
}
