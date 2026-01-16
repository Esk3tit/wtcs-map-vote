import { v } from "convex/values";

/**
 * Validator for session status field.
 * Matches the status union in convex/schema.ts sessions table.
 */
export const sessionStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("WAITING"),
  v.literal("IN_PROGRESS"),
  v.literal("PAUSED"),
  v.literal("COMPLETE"),
  v.literal("EXPIRED")
);

/**
 * Validator for session format field.
 * ABBA: 1v1 alternating ban format
 * MULTIPLAYER: Multi-player voting format
 */
export const sessionFormatValidator = v.union(
  v.literal("ABBA"),
  v.literal("MULTIPLAYER")
);

/**
 * Validator for session map state field.
 * Matches the state union in convex/schema.ts sessionMaps table.
 */
export const mapStateValidator = v.union(
  v.literal("AVAILABLE"),
  v.literal("BANNED"),
  v.literal("WINNER")
);

/**
 * Validator for audit action types.
 * Keep in sync with AuditAction type in types.ts
 *
 * @see docs/SPECIFICATION.md Appendix C
 */
export const auditActionValidator = v.union(
  // Session lifecycle
  v.literal("SESSION_CREATED"),
  v.literal("SESSION_UPDATED"),
  v.literal("SESSION_FINALIZED"),
  v.literal("SESSION_STARTED"),
  v.literal("SESSION_PAUSED"),
  v.literal("SESSION_RESUMED"),
  v.literal("SESSION_ENDED"),
  v.literal("SESSION_DELETED"),
  v.literal("SESSION_EXPIRED"),
  // Player events
  v.literal("PLAYER_CONNECTED"),
  v.literal("PLAYER_DISCONNECTED"),
  v.literal("PLAYER_ASSIGNED"),
  // Map events
  v.literal("MAP_BANNED"),
  v.literal("MAPS_ASSIGNED"),
  // Voting actions
  v.literal("VOTE_SUBMITTED"),
  // Round/Timer events
  v.literal("ROUND_RESOLVED"),
  v.literal("TIMER_EXPIRED"),
  v.literal("RANDOM_SELECTION"),
  v.literal("WINNER_DECLARED")
);

/**
 * Validator for audit actor type field.
 * Matches the actorType union in convex/schema.ts auditLogs table.
 */
export const actorTypeValidator = v.union(
  v.literal("ADMIN"),
  v.literal("PLAYER"),
  v.literal("SYSTEM")
);

/**
 * Validator for audit details object.
 * Matches the details object in convex/schema.ts auditLogs table.
 */
export const auditDetailsValidator = v.object({
  mapId: v.optional(v.id("sessionMaps")),
  mapName: v.optional(v.string()),
  teamName: v.optional(v.string()),
  turn: v.optional(v.number()),
  round: v.optional(v.number()),
  reason: v.optional(v.string()),
});
