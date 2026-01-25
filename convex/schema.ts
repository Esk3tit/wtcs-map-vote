import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables (7 tables)
  ...authTables,

  // Admin users (Google OAuth)
  admins: defineTable({
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    isRootAdmin: v.boolean(),
    lastLoginAt: v.number(),
  }).index("by_email", ["email"]),

  // Registered teams (reusable across sessions)
  teams: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Master map pool (CMS-managed)
  maps: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_isActive_and_name", ["isActive", "name"]),

  // Voting sessions
  sessions: defineTable({
    matchName: v.string(),
    format: v.union(v.literal("ABBA"), v.literal("MULTIPLAYER")),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("WAITING"),
      v.literal("IN_PROGRESS"),
      v.literal("PAUSED"),
      v.literal("COMPLETE"),
      v.literal("EXPIRED")
    ),

    // Configuration
    turnTimerSeconds: v.number(),
    mapPoolSize: v.number(),
    playerCount: v.number(),

    // State
    currentTurn: v.number(),
    currentRound: v.number(),
    timerStartedAt: v.optional(v.number()),
    timerPausedAt: v.optional(v.number()),
    winnerMapId: v.optional(v.id("sessionMaps")),

    // Metadata
    createdBy: v.id("admins"),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"])
    .index("by_expiresAt", ["expiresAt"]),

  // Player slots in a session
  sessionPlayers: defineTable({
    sessionId: v.id("sessions"),
    role: v.string(),
    teamName: v.string(),
    token: v.string(),
    tokenExpiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    isConnected: v.boolean(),
    lastHeartbeat: v.optional(v.number()),
    hasVotedThisRound: v.boolean(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_token", ["token"])
    .index("by_teamName", ["teamName"])
    .index("by_tokenExpiresAt", ["tokenExpiresAt"])
    .index("by_lastHeartbeat", ["lastHeartbeat"]),

  // Maps assigned to a session (snapshot from master pool)
  sessionMaps: defineTable({
    sessionId: v.id("sessions"),
    mapId: v.id("maps"),
    name: v.string(),
    imageUrl: v.string(),
    state: v.union(
      v.literal("AVAILABLE"),
      v.literal("BANNED"),
      v.literal("WINNER")
    ),
    bannedByPlayerId: v.optional(v.id("sessionPlayers")),
    bannedAtTurn: v.optional(v.number()),
    bannedAtRound: v.optional(v.number()),
    voteCount: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_state", ["sessionId", "state"])
    .index("by_mapId", ["mapId"]),

  // Individual votes (for MULTIPLAYER rounds)
  votes: defineTable({
    sessionId: v.id("sessions"),
    round: v.number(),
    playerId: v.id("sessionPlayers"),
    mapId: v.id("sessionMaps"),
    submittedAt: v.number(),
    submittedByAdmin: v.boolean(),
  })
    .index("by_sessionId_and_round", ["sessionId", "round"])
    .index("by_playerId_and_round", ["playerId", "round"])
    .index("by_sessionId_and_playerId", ["sessionId", "playerId"]),

  // Audit log
  auditLogs: defineTable({
    sessionId: v.id("sessions"),
    action: v.string(),
    actorType: v.union(
      v.literal("ADMIN"),
      v.literal("PLAYER"),
      v.literal("SYSTEM")
    ),
    actorId: v.optional(v.string()),
    details: v.object({
      mapId: v.optional(v.id("sessionMaps")),
      mapName: v.optional(v.string()),
      teamName: v.optional(v.string()),
      turn: v.optional(v.number()),
      round: v.optional(v.number()),
      reason: v.optional(v.string()),
    }),
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_sessionId_and_timestamp", ["sessionId", "timestamp"]),
});
