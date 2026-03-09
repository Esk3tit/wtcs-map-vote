/**
 * Sessions CRUD Tests
 *
 * Tests for session management operations: create, list, get, update, delete,
 * player assignment, and map pool configuration.
 *
 * Note: convex-test cannot mock storage IDs. Tests requiring imageStorageId
 * are skipped and documented for integration testing.
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedAdmin } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  teamFactory,
  mapFactory,
  voteFactory,
  auditLogFactory,
  createDeletedSessionId,
  createDeletedId,
} from "./test.factories";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  SessionStatus,
  SESSION_EXPIRY_MS,
  MIN_MAP_POOL_SIZE,
  MAX_MAP_POOL_SIZE,
  TOKEN_EXPIRY_MS,
  MAX_NAME_LENGTH,
  MAX_REASON_LENGTH,
} from "./lib/constants";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates an admin and returns the ID for session creation.
 * @deprecated Use createAuthenticatedAdmin() instead for mutations that require auth.
 */
async function createAdmin(
  t: ReturnType<typeof createTestContext>
): Promise<Id<"admins">> {
  return await t.run(async (ctx) => ctx.db.insert("admins", adminFactory()));
}

/**
 * Creates a session in the specified status with an admin.
 * Used for testing state-dependent behavior.
 * NOTE: Uses direct DB insert, bypassing mutations. Use for state setup only.
 */
async function createSessionInStatus(
  t: ReturnType<typeof createTestContext>,
  status: SessionStatus,
  overrides: Parameters<typeof sessionFactory>[1] = {}
): Promise<{ sessionId: Id<"sessions">; adminId: Id<"admins"> }> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, ...overrides })
    );
    return { sessionId, adminId };
  });
}

/**
 * Creates a session in the specified status with an authenticated admin context.
 * Use this for tests that need to call mutations on the session.
 */
async function createAuthenticatedSessionInStatus(
  status: SessionStatus,
  overrides: Parameters<typeof sessionFactory>[1] = {}
) {
  const { t, authT, adminId } = await createAuthenticatedAdmin();
  const sessionId = await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, ...overrides })
    );
    return sessionId;
  });
  return { sessionId, adminId, authT, t };
}

/**
 * Creates a full session with players, maps, and votes for cascade delete testing.
 * @deprecated Use createAuthenticatedFullSession() for mutations that require auth.
 */
async function createFullSession(
  t: ReturnType<typeof createTestContext>,
  status: SessionStatus = "DRAFT"
): Promise<{
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
  playerIds: Id<"sessionPlayers">[];
  mapIds: Id<"sessionMaps">[];
  voteIds: Id<"votes">[];
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, playerCount: 2, mapPoolSize: 3 })
    );

    // Create teams for players
    await ctx.db.insert("teams", teamFactory({ name: "Team Alpha" }));
    await ctx.db.insert("teams", teamFactory({ name: "Team Beta" }));

    // Create master maps
    const masterMapIds = await Promise.all([
      ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
      ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
      ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
    ]);

    // Create session players
    const playerIds = await Promise.all([
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { role: "Captain", teamName: "Team Alpha" })
      ),
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          role: "Vice Captain",
          teamName: "Team Beta",
        })
      ),
    ]);

    // Create session maps
    const mapIds = await Promise.all(
      masterMapIds.map((mapId, i) =>
        ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
        )
      )
    );

    // Create votes
    const voteIds = await Promise.all([
      ctx.db.insert("votes", voteFactory(sessionId, playerIds[0], mapIds[0])),
      ctx.db.insert("votes", voteFactory(sessionId, playerIds[1], mapIds[1])),
    ]);

    return { sessionId, adminId, playerIds, mapIds, voteIds };
  });
}

/**
 * Creates a full session with authenticated context for cascade delete testing.
 * Use this for tests that need to call mutations on the session.
 */
async function createAuthenticatedFullSession(status: SessionStatus = "DRAFT") {
  const { t, authT, adminId } = await createAuthenticatedAdmin();
  const { sessionId, playerIds, mapIds, voteIds } = await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, playerCount: 2, mapPoolSize: 3 })
    );

    // Create teams for players
    await ctx.db.insert("teams", teamFactory({ name: "Team Alpha" }));
    await ctx.db.insert("teams", teamFactory({ name: "Team Beta" }));

    // Create master maps
    const masterMapIds = await Promise.all([
      ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
      ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
      ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
    ]);

    // Create session players
    const playerIds = await Promise.all([
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { role: "Captain", teamName: "Team Alpha" })
      ),
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          role: "Vice Captain",
          teamName: "Team Beta",
        })
      ),
    ]);

    // Create session maps
    const mapIds = await Promise.all(
      masterMapIds.map((mapId, i) =>
        ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
        )
      )
    );

    // Create votes
    const voteIds = await Promise.all([
      ctx.db.insert("votes", voteFactory(sessionId, playerIds[0], mapIds[0])),
      ctx.db.insert("votes", voteFactory(sessionId, playerIds[1], mapIds[1])),
    ]);

    return { sessionId, playerIds, mapIds, voteIds };
  });
  return { t, authT, adminId, sessionId, playerIds, mapIds, voteIds };
}

// ============================================================================
// createSession Tests
// ============================================================================

describe("sessions.createSession", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("creates session with required fields", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const result = await authT.mutation(api.sessions.createSession, {
        matchName: "Finals Match",
        format: "ABBA",
        playerCount: 2,
      });

      expect(result.sessionId).toBeDefined();

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session).toMatchObject({
        matchName: "Finals Match",
        format: "ABBA",
        status: "DRAFT",
        playerCount: 2,
        currentTurn: 0,
        currentRound: 1,
      });
    });

    it("creates session with MULTIPLAYER format", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const result = await authT.mutation(api.sessions.createSession, {
        matchName: "Team Battle",
        format: "MULTIPLAYER",
        playerCount: 4,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.format).toBe("MULTIPLAYER");
    });

    it("applies default turn timer (30 seconds)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(30);
    });

    it("applies default map pool size (5)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(5);
    });

    it("accepts custom turn timer", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        turnTimerSeconds: 60,

      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(60);
    });

    it("accepts custom map pool size", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        mapPoolSize: 7,

      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(7);
    });

    it("trims whitespace from match name", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "  Padded Name  ",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Padded Name");
    });

    it("sets updatedAt timestamp", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const beforeCreate = Date.now();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.updatedAt).toBeGreaterThanOrEqual(beforeCreate);
    });

    it("sets expiresAt timestamp (14 days in future)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const beforeCreate = Date.now();
      const expectedMinExpiry = beforeCreate + 14 * 24 * 60 * 60 * 1000 - 1000;

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
    });
  });

  describe("validation errors", () => {
    it("throws for empty match name", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "",
          format: "ABBA",
          playerCount: 2,
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for whitespace-only match name", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "   ",
          format: "ABBA",
          playerCount: 2,
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for match name exceeding 100 characters", async () => {
      const { authT } = await createAuthenticatedAdmin();
      const longName = "a".repeat(101);

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: longName,
          format: "ABBA",
          playerCount: 2,
        })
      ).rejects.toThrow(/100 characters/i);
    });

    it("throws for player count below minimum (2)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 1,
        })
      ).rejects.toThrow(/must be at least 2/i);
    });

    it("throws for player count above maximum (8)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 9,
        })
      ).rejects.toThrow(/cannot exceed 8/i);
    });

    it("throws for ABBA format with playerCount !== 2", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 4,
        })
      ).rejects.toThrow("ABBA format requires exactly 2 players");
    });

    it("throws for turn timer below minimum (10 seconds)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          turnTimerSeconds: 9,
        })
      ).rejects.toThrow(/must be at least 10/i);
    });

    it("throws for turn timer above maximum (3200 seconds)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          turnTimerSeconds: 3201,
        })
      ).rejects.toThrow(/cannot exceed 3200/i);
    });

    it("throws for map pool size below minimum (3)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          mapPoolSize: 2,
        })
      ).rejects.toThrow(/must be at least 3/i);
    });

    it("throws for map pool size above maximum (15)", async () => {
      const { authT } = await createAuthenticatedAdmin();

      await expect(
        authT.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          mapPoolSize: 16,
        })
      ).rejects.toThrow(/cannot exceed 15/i);
    });

    it("derives createdBy from authenticated admin", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.createdBy).toBe(adminId);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_CREATED audit log", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId } = await authT.mutation(api.sessions.createSession, {
        matchName: "Test Match",
        format: "ABBA",
        playerCount: 2,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "SESSION_CREATED",
        actorType: "ADMIN",
        actorId: adminId,
      });
    });
  });
});

// ============================================================================
// listSessions Tests
// ============================================================================

describe("sessions.listSessions", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(
        t.query(api.sessions.listSessions, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("empty state", () => {
    it("returns empty page when no sessions exist", async () => {
      const { authT } = await createAuthenticatedAdmin();

      const result = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  describe("pagination", () => {
    it("returns correct page size", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const result = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
    });

    it("continues from cursor", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        for (let i = 1; i <= 4; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const page1 = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page1.page.length).toBeGreaterThan(0);
      expect(page1.continueCursor).toBeDefined();

      const page2 = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });

      // Page 2 should have remaining sessions
      expect(page2.page.length).toBeGreaterThan(0);
      // Total across pages should be 4
      expect(page1.page.length + page2.page.length).toBeLessThanOrEqual(4);
    });

    it("returns sessions in descending order by creation time", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      // Create sessions in a single transaction - Convex assigns sequential _creationTime
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { matchName: "First" })
        );
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { matchName: "Second" })
        );
      });

      const result = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      // Descending order: newest first
      expect(result.page[0].matchName).toBe("Second");
      expect(result.page[1].matchName).toBe("First");
    });
  });

  describe("status filtering", () => {
    it("filters by DRAFT status", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "DRAFT", matchName: "Draft Session" })
        );
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "WAITING",
            matchName: "Waiting Session",
          })
        );
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "COMPLETE",
            matchName: "Complete Session",
          })
        );
      });

      const result = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "DRAFT",
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].matchName).toBe("Draft Session");
    });

    it("returns all sessions when no status filter provided", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "DRAFT" })
        );
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "WAITING" })
        );
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );
      });

      const result = await authT.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(3);
    });

    it("filters by all status values correctly", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const statuses = [
        "DRAFT",
        "WAITING",
        "IN_PROGRESS",
        "PAUSED",
        "COMPLETE",
        "EXPIRED",
      ] as const;

      // Create one session for each status in a single context
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        for (const status of statuses) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status, matchName: `${status} Session` })
          );
        }
      });

      // Test filtering for each status
      for (const status of statuses) {
        const result = await authT.query(api.sessions.listSessions, {
          paginationOpts: { numItems: 10, cursor: null },
          status,
        });

        expect(result.page.length).toBeGreaterThanOrEqual(1);
        expect(result.page.every((s) => s.status === status)).toBe(true);
      }
    });
  });
});

// ============================================================================
// listSessionsForDashboard Tests
// ============================================================================

describe("sessions.listSessionsForDashboard", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(
        t.query(api.sessions.listSessionsForDashboard, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("empty state", () => {
    it("returns empty page when no sessions exist", async () => {
      const { authT } = await createAuthenticatedAdmin();

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });
  });

  describe("enrichment", () => {
    it("includes assignedPlayerCount and teams for each session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await createSessionInStatus(t, "WAITING");

      // Add players to the session
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Team Alpha",
            role: "captain",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Team Beta",
            role: "captain",
          })
        );
      });

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(1);
      const session = result.page[0];
      expect(session.assignedPlayerCount).toBe(2);
      expect(session.teams).toHaveLength(2);
      expect(session.teams).toContain("Team Alpha");
      expect(session.teams).toContain("Team Beta");
    });

    it("returns unique team names (no duplicates)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const { sessionId } = await createSessionInStatus(t, "WAITING");

      // Add two players on the same team
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Same Team",
            role: "captain",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Same Team",
            role: "player",
          })
        );
      });

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].teams).toHaveLength(1);
      expect(result.page[0].teams[0]).toBe("Same Team");
      expect(result.page[0].assignedPlayerCount).toBe(2);
    });

    it("returns empty teams and zero count when no players assigned", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      await createSessionInStatus(t, "DRAFT");

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].assignedPlayerCount).toBe(0);
      expect(result.page[0].teams).toHaveLength(0);
    });
  });

  describe("status filtering", () => {
    it("filters by single status using index", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const adminId = await createAdmin(t);
      await t.run(async (ctx) => {
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "DRAFT" }));
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "WAITING" }));
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "COMPLETE" }));
      });

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "COMPLETE",
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].status).toBe("COMPLETE");
    });

    it("returns only active sessions when no status filter provided", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const adminId = await createAdmin(t);
      await t.run(async (ctx) => {
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "DRAFT" }));
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "WAITING" }));
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "COMPLETE" }));
        await ctx.db.insert("sessions", sessionFactory(adminId, { status: "EXPIRED" }));
      });

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      const statuses = result.page.map((s) => s.status);
      expect(statuses).toContain("DRAFT");
      expect(statuses).toContain("WAITING");
    });
  });

  describe("pagination", () => {
    it("respects numItems limit", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const adminId = await createAdmin(t);
      await t.run(async (ctx) => {
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
    });

    it("returns next page with continueCursor", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const adminId = await createAdmin(t);
      await t.run(async (ctx) => {
        for (let i = 0; i < 4; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const firstPage = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(firstPage.page).toHaveLength(2);
      expect(firstPage.isDone).toBe(false);

      const secondPage = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
      });

      expect(secondPage.page).toHaveLength(2);
      // Verify second page has different sessions than first page
      const firstPageIds = new Set(firstPage.page.map((s) => s._id));
      const secondPageIds = secondPage.page.map((s) => s._id);
      for (const id of secondPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
      }
    });

    it("enriches all pages with player data", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      const adminId = await createAdmin(t);
      const sessionIds = await t.run(async (ctx) => {
        const ids: Id<"sessions">[] = [];
        for (let i = 0; i < 3; i++) {
          const id = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
          ids.push(id);
        }
        // Add a player to the last session
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(ids[2], { teamName: "Test Team" })
        );
        return ids;
      });

      // Fetch all in one page
      const result = await authT.query(api.sessions.listSessionsForDashboard, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      // All sessions should have enrichment fields
      for (const session of result.page) {
        expect(session).toHaveProperty("assignedPlayerCount");
        expect(session).toHaveProperty("teams");
      }

      // The session with a player should reflect it
      const sessionWithPlayer = result.page.find(
        (s) => s._id === sessionIds[2]
      );
      expect(sessionWithPlayer?.assignedPlayerCount).toBe(1);
      expect(sessionWithPlayer?.teams).toContain("Test Team");
    });
  });
});

// ============================================================================
// getSession Tests
// ============================================================================

describe("sessions.getSession", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.query(api.sessions.getSession, { sessionId })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("returns session with players and maps", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { sessionId } = await createFullSession(t);

      const session = await authT.query(api.sessions.getSession, { sessionId });

      expect(session).not.toBeNull();
      expect(session?.matchName).toBe("Test Match");
      expect(session?.players).toHaveLength(2);
      expect(session?.maps).toHaveLength(3);
    });

    it("returns session without players or maps (empty relations)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const session = await authT.query(api.sessions.getSession, { sessionId });

      expect(session).not.toBeNull();
      expect(session?.players).toEqual([]);
      expect(session?.maps).toEqual([]);
    });

    it("includes player details in response", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { sessionId } = await createFullSession(t);

      const session = await authT.query(api.sessions.getSession, { sessionId });

      expect(session?.players[0]).toMatchObject({
        role: expect.any(String),
        teamName: expect.any(String),
        token: expect.any(String),
        isConnected: expect.any(Boolean),
      });
    });

    it("includes map details in response", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { sessionId } = await createFullSession(t);

      const session = await authT.query(api.sessions.getSession, { sessionId });

      expect(session?.maps[0]).toMatchObject({
        name: expect.any(String),
        imageUrl: expect.any(String),
        state: "AVAILABLE",
      });
    });
  });

  describe("not found", () => {
    it("returns null for non-existent session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const deletedSessionId = await createDeletedSessionId(t);

      const session = await authT.query(api.sessions.getSession, {
        sessionId: deletedSessionId,
      });

      expect(session).toBeNull();
    });
  });
});

// ============================================================================
// updateSession Tests
// ============================================================================

describe("sessions.updateSession", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.updateSession, {
          sessionId,
          matchName: "Updated Match Name",
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("updates match name", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      const result = await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated Match Name",
      });

      expect(result.success).toBe(true);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Updated Match Name");
    });

    it("updates turn timer", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await authT.mutation(api.sessions.updateSession, {
        sessionId,
        turnTimerSeconds: 120,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(120);
    });

    it("updates both match name and turn timer", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "New Name",
        turnTimerSeconds: 45,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("New Name");
      expect(session?.turnTimerSeconds).toBe(45);
    });

    it("allows update in WAITING state", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("WAITING");

      const result = await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated in Waiting",
      });

      expect(result.success).toBe(true);
    });

    it("trims whitespace from match name", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "  Padded  ",
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Padded");
    });

    it("updates updatedAt timestamp", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      // Capture creation time, then update and verify updatedAt >= _creationTime
      const { sessionId, creationTime } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "DRAFT" })
        );
        const session = await ctx.db.get(sessionId);
        // Floor to integer ms since Date.now() returns integer ms
        return { sessionId, creationTime: Math.floor(session!._creationTime) };
      });

      await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated",
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      // updatedAt should be at least equal to creation time (mutation sets it via Date.now())
      expect(session?.updatedAt).toBeGreaterThanOrEqual(creationTime);
    });
  });

  describe("validation errors", () => {
    it("throws for empty match name", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await expect(
        authT.mutation(api.sessions.updateSession, {
          sessionId,
          matchName: "",
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for turn timer below minimum", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await expect(
        authT.mutation(api.sessions.updateSession, {
          sessionId,
          turnTimerSeconds: 5,
        })
      ).rejects.toThrow(/must be at least 10/i);
    });

    it("throws for turn timer above maximum", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await expect(
        authT.mutation(api.sessions.updateSession, {
          sessionId,
          turnTimerSeconds: 3201,
        })
      ).rejects.toThrow(/cannot exceed 3200/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when updating session in restricted states", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const restrictedStatuses = ["IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states in a single context
      const sessionIds = await t.run(async (ctx) => {
        const ids: Record<string, Id<"sessions">> = {};
        for (const status of restrictedStatuses) {
          ids[status] = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status, matchName: `${status} Session` })
          );
        }
        return ids;
      });

      // Test each status throws the expected error
      for (const status of restrictedStatuses) {
        await expect(
          authT.mutation(api.sessions.updateSession, {
            sessionId: sessionIds[status],
            matchName: "Updated",
          })
        ).rejects.toThrow(/Cannot update session/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const deletedSessionId = await createDeletedSessionId(t);

      await expect(
        authT.mutation(api.sessions.updateSession, {
          sessionId: deletedSessionId,
          matchName: "Updated",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_UPDATED audit log with changed fields", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await authT.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated Match",
        turnTimerSeconds: 60,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .order("desc")
          .take(1)
      );

      expect(logs[0]).toMatchObject({
        action: "SESSION_UPDATED",
        actorType: "ADMIN",
      });
      expect(logs[0].details?.reason).toContain("matchName");
      expect(logs[0].details?.reason).toContain("turnTimerSeconds");
    });
  });
});

// ============================================================================
// deleteSession Tests
// ============================================================================

describe("sessions.deleteSession", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.deleteSession, { sessionId })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("deletes session", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      const result = await authT.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();
    });

    it("cascade deletes session players", async () => {
      const { t, authT, sessionId, playerIds } = await createAuthenticatedFullSession("DRAFT");

      await authT.mutation(api.sessions.deleteSession, { sessionId });

      const remainingPlayers = await t.run(async (ctx) =>
        Promise.all(playerIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingPlayers.every((p) => p === null)).toBe(true);
    });

    it("cascade deletes session maps", async () => {
      const { t, authT, sessionId, mapIds } = await createAuthenticatedFullSession("DRAFT");

      await authT.mutation(api.sessions.deleteSession, { sessionId });

      const remainingMaps = await t.run(async (ctx) =>
        Promise.all(mapIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingMaps.every((m) => m === null)).toBe(true);
    });

    it("cascade deletes votes", async () => {
      const { t, authT, sessionId, voteIds } = await createAuthenticatedFullSession("DRAFT");

      await authT.mutation(api.sessions.deleteSession, { sessionId });

      const remainingVotes = await t.run(async (ctx) =>
        Promise.all(voteIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingVotes.every((v) => v === null)).toBe(true);
    });

    it("preserves audit logs (orphaned reference)", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      // Create initial audit log
      await t.run(async (ctx) => {
        await ctx.db.insert("auditLogs", auditLogFactory(sessionId));
      });

      await authT.mutation(api.sessions.deleteSession, { sessionId });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      // Should have original log plus SESSION_DELETED log
      expect(logs).toHaveLength(2);
    });

    it("deletes WAITING session with cascade", async () => {
      const { t, authT, sessionId, playerIds, mapIds, voteIds } =
        await createAuthenticatedFullSession("WAITING");

      const result = await authT.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();

      const allRelated = await t.run(async (ctx) =>
        Promise.all([
          ...playerIds.map((id) => ctx.db.get(id)),
          ...mapIds.map((id) => ctx.db.get(id)),
          ...voteIds.map((id) => ctx.db.get(id)),
        ])
      );
      expect(allRelated.every((r) => r === null)).toBe(true);
    });

    it("deletes PAUSED session with cascade", async () => {
      const { t, authT, sessionId, playerIds, mapIds, voteIds } =
        await createAuthenticatedFullSession("PAUSED");

      const result = await authT.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();

      const allRelated = await t.run(async (ctx) =>
        Promise.all([
          ...playerIds.map((id) => ctx.db.get(id)),
          ...mapIds.map((id) => ctx.db.get(id)),
          ...voteIds.map((id) => ctx.db.get(id)),
        ])
      );
      expect(allRelated.every((r) => r === null)).toBe(true);
    });

    it("deletes COMPLETE session with cascade", async () => {
      const { t, authT, sessionId, playerIds, mapIds, voteIds } =
        await createAuthenticatedFullSession("COMPLETE");

      const result = await authT.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();

      const allRelated = await t.run(async (ctx) =>
        Promise.all([
          ...playerIds.map((id) => ctx.db.get(id)),
          ...mapIds.map((id) => ctx.db.get(id)),
          ...voteIds.map((id) => ctx.db.get(id)),
        ])
      );
      expect(allRelated.every((r) => r === null)).toBe(true);
    });

    it("deletes EXPIRED session with cascade", async () => {
      const { t, authT, sessionId, playerIds, mapIds, voteIds } =
        await createAuthenticatedFullSession("EXPIRED");

      const result = await authT.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();

      const allRelated = await t.run(async (ctx) =>
        Promise.all([
          ...playerIds.map((id) => ctx.db.get(id)),
          ...mapIds.map((id) => ctx.db.get(id)),
          ...voteIds.map((id) => ctx.db.get(id)),
        ])
      );
      expect(allRelated.every((r) => r === null)).toBe(true);
    });
  });

  describe("state restrictions", () => {
    it("throws when deleting IN_PROGRESS session", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("IN_PROGRESS");

      await expect(
        authT.mutation(api.sessions.deleteSession, { sessionId })
      ).rejects.toThrow(/Cannot delete session \(pause or end it first\) in IN_PROGRESS state/i);
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const deletedSessionId = await createDeletedSessionId(t);

      await expect(
        authT.mutation(api.sessions.deleteSession, { sessionId: deletedSessionId })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_DELETED audit log with actorId and reason", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("WAITING");

      await authT.mutation(api.sessions.deleteSession, { sessionId });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const deleteLog = logs.find((l) => l.action === "SESSION_DELETED");
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.actorType).toBe("ADMIN");
      expect(deleteLog?.actorId).toBeDefined();
      expect(deleteLog?.details?.reason).toBe("Deleted from WAITING state");
    });
  });
});

// ============================================================================
// assignPlayer Tests
// ============================================================================

describe("sessions.assignPlayer", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha Team" }));
      });

      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Captain",
          teamName: "Alpha Team",
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("assigns player with token", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      // Create team
      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha Team" }));
      });

      const result = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Alpha Team",
      });

      expect(result.playerId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(32); // UUID without dashes
    });

    it("allows assigning in WAITING state", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("WAITING", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Beta Team" }));
      });

      const result = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Beta Team",
      });

      expect(result.playerId).toBeDefined();
    });

    it("creates player record with correct fields", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { playerId } = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player).toMatchObject({
        sessionId,
        role: "Captain",
        teamName: "Test Team",
        isConnected: false,
        hasVotedThisRound: false,
      });
    });

    it("trims whitespace from role", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { playerId } = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "  Captain  ",
        teamName: "Test Team",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.role).toBe("Captain");
    });
  });

  describe("validation errors", () => {
    it("throws when team does not exist", async () => {
      const { authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT");

      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Captain",
          teamName: "Nonexistent Team",
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws for duplicate role in session", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      // First assignment
      await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      // Second assignment with same role
      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Captain",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/already assigned/i);
    });

    it("detects duplicate role after trimming", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "  Captain  ",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/already assigned/i);
    });
  });

  describe("capacity checks", () => {
    it("throws when session is at capacity", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team C" }));
      });

      // Fill to capacity
      await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Team A",
      });
      await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Team B",
      });

      // Third player should fail
      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Reserve",
          teamName: "Team C",
        })
      ).rejects.toThrow(/maximum/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when assigning in restricted states", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const restrictedStatuses = ["IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states and a team in a single context
      const sessionIds = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
        const ids: Record<string, Id<"sessions">> = {};
        for (const status of restrictedStatuses) {
          ids[status] = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status, matchName: `${status} Session` })
          );
        }
        return ids;
      });

      // Test each status throws the expected error
      for (const status of restrictedStatuses) {
        await expect(
          authT.mutation(api.sessions.assignPlayer, {
            sessionId: sessionIds[status],
            role: "Captain",
            teamName: "Test Team",
          })
        ).rejects.toThrow(/Cannot assign players/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const deletedSessionId = await createDeletedId(t, async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
        return sessionId;
      });

      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId: deletedSessionId,
          role: "Captain",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates PLAYER_ASSIGNED audit log", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .order("desc")
          .take(1)
      );

      expect(logs[0]).toMatchObject({
        action: "PLAYER_ASSIGNED",
        actorType: "ADMIN",
      });
      expect(logs[0].details?.teamName).toBe("Test Team");
    });
  });

  describe("token generation", () => {
    it("sets tokenExpiresAt following TOKEN_EXPIRY_MS constant (24 hours)", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const beforeAssign = Date.now();
      const { playerId } = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      const expectedMinExpiry = beforeAssign + TOKEN_EXPIRY_MS - 1000; // Allow 1s tolerance
      const expectedMaxExpiry = beforeAssign + TOKEN_EXPIRY_MS + 1000;
      expect(player?.tokenExpiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(player?.tokenExpiresAt).toBeLessThanOrEqual(expectedMaxExpiry);
    });

    it("generates unique tokens for each player in same session", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 3,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team C" }));
      });

      const result1 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Team A",
      });
      const result2 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Team B",
      });
      const result3 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Reserve",
        teamName: "Team C",
      });

      const tokens = [result1.token, result2.token, result3.token];
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(3);
    });

    it("generates 32-character hex token from UUID", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { token } = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[a-f0-9]+$/); // hex characters from UUID
    });
  });

  describe("team name handling", () => {
    it("allows same team with different roles in same session", async () => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 3,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha Team" }));
      });

      // First assignment
      const result1 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Alpha Team",
      });

      // Second assignment with same team but different role - should succeed
      const result2 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Alpha Team",
      });

      expect(result1.playerId).toBeDefined();
      expect(result2.playerId).toBeDefined();
      expect(result1.playerId).not.toBe(result2.playerId);
    });

    it("allows same team in different sessions", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      // Create two sessions and a team
      const { session1Id, session2Id } = await t.run(async (ctx) => {
        const session1Id = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { playerCount: 2 })
        );
        const session2Id = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { playerCount: 2 })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Shared Team" }));
        return { session1Id, session2Id };
      });

      // Assign to session 1
      const result1 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId: session1Id,
        role: "Captain",
        teamName: "Shared Team",
      });

      // Assign same team to session 2 - should succeed
      const result2 = await authT.mutation(api.sessions.assignPlayer, {
        sessionId: session2Id,
        role: "Captain",
        teamName: "Shared Team",
      });

      expect(result1.playerId).toBeDefined();
      expect(result2.playerId).toBeDefined();
    });
  });

  describe("role validation", () => {
    it.each([
      ["empty role", "", /cannot be empty/i],
      ["whitespace-only role", "   ", /cannot be empty/i],
      ["role exceeding 100 characters", "a".repeat(101), /100 characters/i],
    ])("throws for %s", async (_description, role, expectedError) => {
      const { t, authT, sessionId } = await createAuthenticatedSessionInStatus("DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await expect(
        authT.mutation(api.sessions.assignPlayer, {
          sessionId,
          role,
          teamName: "Test Team",
        })
      ).rejects.toThrow(expectedError);
    });
  });
});

// ============================================================================
// setSessionMaps Tests
// ============================================================================

describe("sessions.setSessionMaps", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      const { sessionId, masterMapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 3 })
        );

        const masterMapIds = await Promise.all([
          ctx.db.insert("maps", mapFactory({ name: "Map A" })),
        ]);

        return { sessionId, masterMapIds };
      });

      await expect(
        t.mutation(api.sessions.setSessionMaps, {
          sessionId,
          mapIds: masterMapIds,
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("creates session maps from master maps", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, masterMapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 3 })
        );

        const masterMapIds = await Promise.all([
          ctx.db.insert(
            "maps",
            mapFactory({ name: "Map A", imageUrl: "https://a.png" })
          ),
          ctx.db.insert(
            "maps",
            mapFactory({ name: "Map B", imageUrl: "https://b.png" })
          ),
          ctx.db.insert(
            "maps",
            mapFactory({ name: "Map C", imageUrl: "https://c.png" })
          ),
        ]);

        return { sessionId, masterMapIds };
      });

      const result = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: masterMapIds,
      });

      expect(result.success).toBe(true);

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(3);
      expect(sessionMaps.every((m) => m.state === "AVAILABLE")).toBe(true);
    });

    it("copies map name and imageUrl from master maps", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, masterMapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );

        const masterMapIds = [
          await ctx.db.insert(
            "maps",
            mapFactory({ name: "Special Map", imageUrl: "https://special.png" })
          ),
        ];

        return { sessionId, masterMapIds };
      });

      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: masterMapIds,
      });

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps[0]).toMatchObject({
        name: "Special Map",
        imageUrl: "https://special.png",
      });
    });

    it("replaces existing session maps", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, newMapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );

        // Create old master map and session map
        const oldMapId = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Old Map" })
        );
        await ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, oldMapId));

        // Create new maps
        const newMapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "New Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "New Map 2" })),
        ];

        return { sessionId, newMapIds };
      });

      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: newMapIds,
      });

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(2);
      expect(sessionMaps.map((m) => m.name).sort()).toEqual([
        "New Map 1",
        "New Map 2",
      ]);
    });

    it("updates session updatedAt timestamp", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      // Capture creation time, then set maps and verify updatedAt >= _creationTime
      const { sessionId, mapIds, creationTime } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        const session = await ctx.db.get(sessionId);
        // Floor to integer ms since Date.now() returns integer ms
        return { sessionId, mapIds, creationTime: Math.floor(session!._creationTime) };
      });

      await authT.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      // updatedAt should be at least equal to creation time (mutation sets it via Date.now())
      expect(session?.updatedAt).toBeGreaterThanOrEqual(creationTime);
    });
  });

  describe("validation errors", () => {
    it("throws when map count does not match mapPoolSize", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 5 })
        );
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { sessionId, mapIds };
      });

      await expect(
        authT.mutation(api.sessions.setSessionMaps, { sessionId, mapIds })
      ).rejects.toThrow(/Expected 5 maps, received 3/i);
    });

    it("throws for duplicate maps", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        return { sessionId, mapId };
      });

      await expect(
        authT.mutation(api.sessions.setSessionMaps, {
          sessionId,
          mapIds: [mapId, mapId],
        })
      ).rejects.toThrow(/Duplicate maps/i);
    });

    it("throws for non-existent map", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, deletedMapId, validMapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );
        const deletedMapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.delete(deletedMapId);
        const validMapId = await ctx.db.insert("maps", mapFactory());
        return { sessionId, deletedMapId, validMapId };
      });

      await expect(
        authT.mutation(api.sessions.setSessionMaps, {
          sessionId,
          mapIds: [validMapId, deletedMapId],
        })
      ).rejects.toThrow(/Map not found/i);
    });

    it("throws for inactive map", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );
        const mapIds = [
          await ctx.db.insert(
            "maps",
            mapFactory({ name: "Active", isActive: true })
          ),
          await ctx.db.insert(
            "maps",
            mapFactory({ name: "Inactive", isActive: false })
          ),
        ];
        return { sessionId, mapIds };
      });

      await expect(
        authT.mutation(api.sessions.setSessionMaps, { sessionId, mapIds })
      ).rejects.toThrow(/not active/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when setting maps in restricted states", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const restrictedStatuses = ["WAITING", "IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states and maps in a single context
      const { sessionIds, mapIds } = await t.run(async (ctx) => {
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        const ids: Record<string, Id<"sessions">> = {};
        for (const status of restrictedStatuses) {
          ids[status] = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status, mapPoolSize: 1, matchName: `${status} Session` })
          );
        }
        return { sessionIds: ids, mapIds };
      });

      // Test each status throws the expected error
      for (const status of restrictedStatuses) {
        await expect(
          authT.mutation(api.sessions.setSessionMaps, { sessionId: sessionIds[status], mapIds })
        ).rejects.toThrow(/Cannot set maps/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      // Create a map first (persists after session deletion)
      const mapIds = await t.run(async (ctx) => {
        return [await ctx.db.insert("maps", mapFactory())];
      });

      const deletedSessionId = await createDeletedSessionId(t, {
        mapPoolSize: 1,
      });

      await expect(
        authT.mutation(api.sessions.setSessionMaps, {
          sessionId: deletedSessionId,
          mapIds,
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("storage handling", () => {
    // These tests document scenarios that cannot be tested with convex-test
    // due to its inability to mock storage IDs.

    it.skip("resolves storage URL when map uses imageStorageId", () => {
      // Requires real storage ID - convex-test cannot mock storage IDs
      // Test in integration tests against dev deployment
    });
  });

  describe("audit logging", () => {
    it("creates MAPS_ASSIGNED audit log", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds };
      });

      await authT.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .order("desc")
          .take(1)
      );

      expect(logs[0]).toMatchObject({
        action: "MAPS_ASSIGNED",
        actorType: "ADMIN",
      });
    });

    it("creates MAPS_ASSIGNED audit log on reassignment", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, oldMapIds, newMapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );

        // Create old maps and assign them
        const oldMapIds = await Promise.all([
          ctx.db.insert("maps", mapFactory({ name: "Old Map 1" })),
          ctx.db.insert("maps", mapFactory({ name: "Old Map 2" })),
        ]);

        // Create new maps for reassignment
        const newMapIds = await Promise.all([
          ctx.db.insert("maps", mapFactory({ name: "New Map 1" })),
          ctx.db.insert("maps", mapFactory({ name: "New Map 2" })),
        ]);

        return { sessionId, oldMapIds, newMapIds };
      });

      // Initial assignment
      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: oldMapIds,
      });

      // Reassignment
      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: newMapIds,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .order("desc")
          .collect()
      );

      // Should have two MAPS_ASSIGNED logs
      const mapsAssignedLogs = logs.filter((l) => l.action === "MAPS_ASSIGNED");
      expect(mapsAssignedLogs).toHaveLength(2);

      // Verify log content structure (most recent first due to desc order)
      expect(mapsAssignedLogs[0]).toMatchObject({
        action: "MAPS_ASSIGNED",
        sessionId,
      });
      expect(mapsAssignedLogs[0].timestamp).toBeDefined();
    });
  });

  describe("boundary tests", () => {
    it(`handles minimum map pool size (${MIN_MAP_POOL_SIZE} maps)`, async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: MIN_MAP_POOL_SIZE })
        );

        const mapIds = await Promise.all(
          Array.from({ length: MIN_MAP_POOL_SIZE }, (_, i) =>
            ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
          )
        );

        return { sessionId, mapIds };
      });

      const result = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds,
      });

      expect(result.success).toBe(true);

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(MIN_MAP_POOL_SIZE);
    });

    it(`handles maximum map pool size (${MAX_MAP_POOL_SIZE} maps)`, async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: MAX_MAP_POOL_SIZE })
        );

        const mapIds = await Promise.all(
          Array.from({ length: MAX_MAP_POOL_SIZE }, (_, i) =>
            ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
          )
        );

        return { sessionId, mapIds };
      });

      const result = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds,
      });

      expect(result.success).toBe(true);

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(MAX_MAP_POOL_SIZE);
    });

    // Note: MIN/MAX_MAP_POOL_SIZE validation is enforced at session creation,
    // not at map assignment. Tests for pool size range validation belong in
    // session creation tests, not setSessionMaps tests.
  });

  describe("snapshot persistence", () => {
    it("preserves snapshot when source map is updated", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapId = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Original Name", imageUrl: "https://original.png" })
        );
        return { sessionId, mapId };
      });

      // Assign map to session
      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: [mapId],
      });

      // Update source map in master pool
      await t.run(async (ctx) => {
        await ctx.db.patch(mapId, {
          name: "Updated Name",
          imageUrl: "https://updated.png",
        });
      });

      // Verify session map snapshot still has original values
      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps[0]).toMatchObject({
        name: "Original Name",
        imageUrl: "https://original.png",
      });

      // Verify source map was actually updated
      const sourceMap = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(sourceMap?.name).toBe("Updated Name");
    });

    it("preserves snapshot when source map is deactivated", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapId = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Active Map", isActive: true })
        );
        return { sessionId, mapId };
      });

      // Assign map to session
      await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: [mapId],
      });

      // Deactivate source map
      await t.run(async (ctx) => {
        await ctx.db.patch(mapId, { isActive: false });
      });

      // Verify session map snapshot still exists
      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(1);
      expect(sessionMaps[0].name).toBe("Active Map");
      expect(sessionMaps[0].state).toBe("AVAILABLE");
    });
  });

  describe("edge cases", () => {
    it("handles maps with very long names (max 100 characters)", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const longName = "A".repeat(100);

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapId = await ctx.db.insert(
          "maps",
          mapFactory({ name: longName })
        );
        return { sessionId, mapId };
      });

      const result = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: [mapId],
      });

      expect(result.success).toBe(true);

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps[0].name).toBe(longName);
      expect(sessionMaps[0].name).toHaveLength(100);
    });

    it("handles maps with special characters in name", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const specialName = "Mäp with émojis & spëcial <chars> 中文 🗺️";

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapId = await ctx.db.insert(
          "maps",
          mapFactory({ name: specialName })
        );
        return { sessionId, mapId };
      });

      const result = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: [mapId],
      });

      expect(result.success).toBe(true);

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps[0].name).toBe(specialName);
    });

    it("maintains correct sessionId reference when multiple sessions exist", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { session1Id, session2Id, maps1, maps2 } = await t.run(
        async (ctx) => {
          const session1Id = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, {
              mapPoolSize: 2,
              matchName: "Session 1",
            })
          );

          const session2Id = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, {
              mapPoolSize: 2,
              matchName: "Session 2",
            })
          );

          // Create maps for each session
          const maps1 = await Promise.all([
            ctx.db.insert("maps", mapFactory({ name: "S1 Map A" })),
            ctx.db.insert("maps", mapFactory({ name: "S1 Map B" })),
          ]);

          const maps2 = await Promise.all([
            ctx.db.insert("maps", mapFactory({ name: "S2 Map X" })),
            ctx.db.insert("maps", mapFactory({ name: "S2 Map Y" })),
          ]);

          return { session1Id, session2Id, maps1, maps2 };
        }
      );

      // Assign maps to both sessions
      const result1 = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId: session1Id,
        mapIds: maps1,
      });

      const result2 = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId: session2Id,
        mapIds: maps2,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify session 1 maps
      const session1Maps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session1Id))
          .collect()
      );

      expect(session1Maps).toHaveLength(2);
      expect(session1Maps.map((m) => m.name).sort()).toEqual([
        "S1 Map A",
        "S1 Map B",
      ]);
      expect(session1Maps.every((m) => m.sessionId === session1Id)).toBe(true);

      // Verify session 2 maps
      const session2Maps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session2Id))
          .collect()
      );

      expect(session2Maps).toHaveLength(2);
      expect(session2Maps.map((m) => m.name).sort()).toEqual([
        "S2 Map X",
        "S2 Map Y",
      ]);
      expect(session2Maps.every((m) => m.sessionId === session2Id)).toBe(true);
    });

    it("handles rapid sequential reassignments", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapSets } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );

        // Create 3 sets of maps for sequential reassignments
        const mapSets = await Promise.all([
          Promise.all([
            ctx.db.insert("maps", mapFactory({ name: "Set1 A" })),
            ctx.db.insert("maps", mapFactory({ name: "Set1 B" })),
          ]),
          Promise.all([
            ctx.db.insert("maps", mapFactory({ name: "Set2 A" })),
            ctx.db.insert("maps", mapFactory({ name: "Set2 B" })),
          ]),
          Promise.all([
            ctx.db.insert("maps", mapFactory({ name: "Set3 A" })),
            ctx.db.insert("maps", mapFactory({ name: "Set3 B" })),
          ]),
        ]);

        return { sessionId, mapSets };
      });

      // Rapid sequential reassignments
      const result1 = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: mapSets[0],
      });

      const result2 = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: mapSets[1],
      });

      const result3 = await authT.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: mapSets[2],
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify final state has only the last set
      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps).toHaveLength(2);
      expect(sessionMaps.map((m) => m.name).sort()).toEqual([
        "Set3 A",
        "Set3 B",
      ]);
    });

    it("initializes optional fields correctly (undefined)", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds };
      });

      await authT.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(sessionMaps[0].state).toBe("AVAILABLE");
      expect(sessionMaps[0].bannedByPlayerId).toBeUndefined();
      expect(sessionMaps[0].bannedAtTurn).toBeUndefined();
      expect(sessionMaps[0].bannedAtRound).toBeUndefined();
      expect(sessionMaps[0].voteCount).toBeUndefined();
    });
  });
});

// ============================================================================
// createSessionFull Tests
// ============================================================================

describe("sessions.createSessionFull", () => {
  describe("authentication", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team Alpha" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team Beta" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        t.mutation(api.sessions.createSessionFull, {
          matchName: "Grand Final",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team Alpha" },
            { role: "Player B", teamName: "Team Beta" },
          ],
          mapIds,
        })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("creates complete session with ABBA format atomically", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { teamNames, mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team Alpha" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team Beta" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { teamNames: ["Team Alpha", "Team Beta"], mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Grand Final",
        format: "ABBA",
        turnTimerSeconds: 45,
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: teamNames[0] },
          { role: "Player B", teamName: teamNames[1] },
        ],
        mapIds,
      });

      expect(result.sessionId).toBeDefined();
      expect(result.playerTokens).toHaveLength(2);
      expect(result.playerTokens[0].role).toBe("Player A");
      expect(result.playerTokens[1].role).toBe("Player B");

      // Verify session was created with correct data
      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session).toMatchObject({
        matchName: "Grand Final",
        format: "ABBA",
        status: "DRAFT",
        turnTimerSeconds: 45,
        mapPoolSize: 3,
        playerCount: 2,
      });

      // Verify players were created
      const players = await t.run(async (ctx) =>
        ctx.db
          .query("sessionPlayers")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", result.sessionId))
          .collect()
      );
      expect(players).toHaveLength(2);
      expect(players.map((p) => p.role).sort()).toEqual(["Player A", "Player B"]);

      // Verify maps were copied to session
      const sessionMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", result.sessionId))
          .collect()
      );
      expect(sessionMaps).toHaveLength(3);
      expect(sessionMaps.every((m) => m.state === "AVAILABLE")).toBe(true);
    });

    it("creates complete session with MULTIPLAYER format atomically", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team 1" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team 2" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team 3" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team 4" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map A" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map B" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map C" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map D" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map E" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Team Battle",
        format: "MULTIPLAYER",
        mapPoolSize: 5,
        players: [
          { role: "Player 1", teamName: "Team 1" },
          { role: "Player 2", teamName: "Team 2" },
          { role: "Player 3", teamName: "Team 3" },
          { role: "Player 4", teamName: "Team 4" },
        ],
        mapIds,
      });

      expect(result.sessionId).toBeDefined();
      expect(result.playerTokens).toHaveLength(4);

      // Verify players were created with unique tokens
      const tokens = result.playerTokens.map((p) => p.token);
      expect(new Set(tokens).size).toBe(4); // All tokens unique
    });

    it("returns unique tokens for each player", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Test Match",
        format: "ABBA",
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      // Tokens should be 32 characters (UUID without dashes)
      expect(result.playerTokens[0].token).toHaveLength(32);
      expect(result.playerTokens[1].token).toHaveLength(32);
      expect(result.playerTokens[0].token).not.toBe(result.playerTokens[1].token);
    });

    it("applies default turnTimerSeconds (30)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Test",
        format: "ABBA",
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.turnTimerSeconds).toBe(30);
    });

    it("applies default mapPoolSize (5)", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 4" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 5" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Test",
        format: "ABBA",
        // mapPoolSize not specified - should default to 5
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.mapPoolSize).toBe(5);
    });

    it("creates audit log entry", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Test",
        format: "ABBA",
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      const auditLogs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", result.sessionId))
          .collect()
      );

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe("SESSION_CREATED");
      expect(auditLogs[0].actorType).toBe("ADMIN");
    });

    it("trims whitespace from match name", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "  Grand Final  ",
        format: "ABBA",
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.matchName).toBe("Grand Final");
    });

    it("derives createdBy from authenticated admin", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      const result = await authT.mutation(api.sessions.createSessionFull, {
        matchName: "Test",
        format: "ABBA",
        mapPoolSize: 3,
        players: [
          { role: "Player A", teamName: "Team A" },
          { role: "Player B", teamName: "Team B" },
        ],
        mapIds,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.createdBy).toBe(adminId);
    });
  });

  describe("validation errors", () => {
    it("rejects empty match name", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "   ",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds,
        })
      ).rejects.toThrow("Match name cannot be empty");
    });

    it("rejects ABBA format with wrong player count", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team C" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player 1", teamName: "Team A" },
            { role: "Player 2", teamName: "Team B" },
            { role: "Player 3", teamName: "Team C" },
          ],
          mapIds,
        })
      ).rejects.toThrow("ABBA format requires exactly 2 players");
    });

    it("rejects MULTIPLAYER format with wrong player count", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "MULTIPLAYER",
          mapPoolSize: 3,
          players: [
            { role: "Player 1", teamName: "Team A" },
            { role: "Player 2", teamName: "Team B" },
          ],
          mapIds,
        })
      ).rejects.toThrow("MULTIPLAYER format requires exactly 4 players");
    });

    it("rejects duplicate roles in player list", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player A", teamName: "Team B" }, // Duplicate role
          ],
          mapIds,
        })
      ).rejects.toThrow('Duplicate role "Player A"');
    });

    it("rejects non-existent team", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        // Team B not created
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "NonExistent Team" },
          ],
          mapIds,
        })
      ).rejects.toThrow('Team "NonExistent Team" not found');
    });

    it("rejects map count mismatch with mapPoolSize", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 5, // Expecting 5 maps
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds, // Only 3 maps provided
        })
      ).rejects.toThrow("Expected 5 maps, received 3");
    });

    it("rejects duplicate maps in mapIds", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapId } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapId = await ctx.db.insert("maps", mapFactory({ name: "Map 1" }));
        return { mapId };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds: [mapId, mapId, mapId], // Duplicates
        })
      ).rejects.toThrow("Duplicate maps not allowed");
    });

    it("rejects non-existent map", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
        ];
        return { mapIds };
      });

      // Create and delete a map to get a valid but non-existent ID
      const fakeMapId = await createDeletedId(t, async (ctx) =>
        ctx.db.insert("maps", mapFactory({ name: "Deleted Map" }))
      );

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds: [...mapIds, fakeMapId],
        })
      ).rejects.toThrow("Map not found");
    });

    it("rejects inactive map", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Inactive Map", isActive: false })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds,
        })
      ).rejects.toThrow('Map "Inactive Map" is not active');
    });

    it("rejects turn timer below minimum", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          turnTimerSeconds: 5, // Below minimum of 10
          mapPoolSize: 3,
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds,
        })
      ).rejects.toThrow();
    });

    it("rejects map pool size below minimum", async () => {
      const { t, authT } = await createAuthenticatedAdmin();
      const { mapIds } = await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        const mapIds = [
          await ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          await ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
        ];
        return { mapIds };
      });

      await expect(
        authT.mutation(api.sessions.createSessionFull, {
          matchName: "Test",
          format: "ABBA",
          mapPoolSize: 2, // Below minimum of 3
          players: [
            { role: "Player A", teamName: "Team A" },
            { role: "Player B", teamName: "Team B" },
          ],
          mapIds,
        })
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// getSessionByToken Tests
// ============================================================================

describe("sessions.getSessionByToken", () => {
  describe("error cases", () => {
    it("returns INVALID_TOKEN for non-existent token", async () => {
      const t = createTestContext();

      const result = await t.query(api.sessions.getSessionByToken, {
        token: "nonexistent-token",
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("INVALID_TOKEN");
      }
    });

    it("returns TOKEN_EXPIRED for expired token", async () => {
      const t = createTestContext();
      const expiredToken = "expired-token-123";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "WAITING" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: expiredToken,
            tokenExpiresAt: Date.now() - 1000, // Expired 1 second ago
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: expiredToken,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("TOKEN_EXPIRED");
      }
    });

    it("returns SESSION_NOT_FOUND when session is deleted", async () => {
      const t = createTestContext();
      const orphanedToken = "orphaned-token-123";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: orphanedToken,
            teamName: "Team A",
          })
        );
        // Delete the session but keep the player (orphaned state)
        await ctx.db.delete(sessionId);
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: orphanedToken,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_FOUND");
      }
    });
  });

  describe("success cases", () => {
    it("returns valid session data with sanitized players", async () => {
      const t = createTestContext();
      const playerToken = "valid-player-token";

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS", matchName: "Test Match" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
            role: "Captain",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-player-token",
            teamName: "Team B",
            role: "Vice Captain",
          })
        );
        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session._id).toBe(sessionId);
        expect(result.session.matchName).toBe("Test Match");
        expect(result.player.teamName).toBe("Team A");
        expect(result.player.role).toBe("Captain");
        expect(result.otherPlayers).toHaveLength(1);
        expect(result.otherPlayers[0].teamName).toBe("Team B");
      }
    });

    it("excludes token from player data (sanitization)", async () => {
      const t = createTestContext();
      const playerToken = "secret-token-123";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        // Type-safe check: token should not be in the sanitized player object
        expect("token" in result.player).toBe(false);
      }
    });

    it("excludes token from otherPlayers data", async () => {
      const t = createTestContext();
      const playerToken = "my-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-secret-token",
            teamName: "Team B",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.otherPlayers).toHaveLength(1);
        expect("token" in result.otherPlayers[0]).toBe(false);
      }
    });
  });

  describe("turn detection - ABBA format", () => {
    it("isYourTurn true for player 0 at turn 0", async () => {
      const t = createTestContext();
      const player1Token = "player1-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            currentTurn: 0,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        // Player 1 created first = index 0
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: player1Token,
            teamName: "Team A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "player2-token",
            teamName: "Team B",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: player1Token,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(true);
      }
    });

    it("isYourTurn true for player 1 at turns 1 and 2 (ABBA)", async () => {
      const t = createTestContext();
      const player2Token = "player2-token";

      // Test turn 1
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            currentTurn: 1,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "player1-token",
            teamName: "Team A",
          })
        );
        // Player 2 created second = index 1
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: player2Token,
            teamName: "Team B",
          })
        );
      });

      const resultTurn1 = await t.query(api.sessions.getSessionByToken, {
        token: player2Token,
      });

      expect(resultTurn1.status).toBe("valid");
      if (resultTurn1.status === "valid") {
        expect(resultTurn1.isYourTurn).toBe(true);
      }
    });

    it("isYourTurn true for player 0 at turn 3 (ABBA)", async () => {
      const t = createTestContext();
      const player1Token = "player1-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            currentTurn: 3,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: player1Token,
            teamName: "Team A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "player2-token",
            teamName: "Team B",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: player1Token,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(true);
      }
    });

    it("isYourTurn false for wrong player in ABBA pattern", async () => {
      const t = createTestContext();
      const player2Token = "player2-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            currentTurn: 0, // Turn 0 = player 0's turn
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "player1-token",
            teamName: "Team A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: player2Token,
            teamName: "Team B",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: player2Token,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(false);
      }
    });
  });

  describe("turn detection - MULTIPLAYER format", () => {
    it("isYourTurn true when not voted this round", async () => {
      const t = createTestContext();
      const playerToken = "multiplayer-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "MULTIPLAYER",
            status: "IN_PROGRESS",
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
            hasVotedThisRound: false,
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(true);
      }
    });

    it("isYourTurn false when already voted this round", async () => {
      const t = createTestContext();
      const playerToken = "voted-multiplayer-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "MULTIPLAYER",
            status: "IN_PROGRESS",
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
            hasVotedThisRound: true,
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(false);
      }
    });
  });

  describe("session status edge cases", () => {
    it("isYourTurn false when session is DRAFT", async () => {
      const t = createTestContext();
      const playerToken = "draft-session-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "DRAFT",
            currentTurn: 0,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(false);
      }
    });

    it("isYourTurn false when session is WAITING", async () => {
      const t = createTestContext();
      const playerToken = "waiting-session-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "WAITING",
            currentTurn: 0,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(false);
      }
    });

    it("isYourTurn false when session is COMPLETE", async () => {
      const t = createTestContext();
      const playerToken = "complete-session-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "COMPLETE",
            currentTurn: 0,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: playerToken,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, {
        token: playerToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.isYourTurn).toBe(false);
      }
    });
  });
});

// ============================================================================
// getSessionResults Tests
// ============================================================================

describe("sessions.getSessionResults", () => {
  describe("error cases", () => {
    it("returns SESSION_NOT_FOUND for non-existent session", async () => {
      const t = createTestContext();
      const deletedSessionId = await createDeletedSessionId(t);

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId: deletedSessionId,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_FOUND");
      }
    });

    it("returns SESSION_NOT_COMPLETE for DRAFT session", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_COMPLETE");
      }
    });

    it("returns SESSION_NOT_COMPLETE for IN_PROGRESS session", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "IN_PROGRESS");

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_COMPLETE");
      }
    });

    it("returns SESSION_NOT_COMPLETE for WAITING session", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "WAITING");

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_COMPLETE");
      }
    });
  });

  describe("success cases", () => {
    it("returns valid results for COMPLETE session", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "COMPLETE",
            matchName: "Finals Match",
          })
        );
        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session._id).toBe(sessionId);
        expect(result.session.matchName).toBe("Finals Match");
        expect(result.session.status).toBe("COMPLETE");
      }
    });

    it("returns teams array from players", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team Alpha" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team Beta" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team Alpha" })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team Beta" })
        );
        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.teams).toHaveLength(2);
        expect(result.teams).toContain("Team Alpha");
        expect(result.teams).toContain("Team Beta");
      }
    });

    it("returns ban history sorted by turn order", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));

        const player1Id = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team A" })
        );
        const player2Id = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team B" })
        );

        const mapId1 = await ctx.db.insert("maps", mapFactory({ name: "Map 1" }));
        const mapId2 = await ctx.db.insert("maps", mapFactory({ name: "Map 2" }));
        const mapId3 = await ctx.db.insert("maps", mapFactory({ name: "Map 3" }));

        // Create banned maps in non-sequential order to test sorting
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId2, {
            name: "Map 2",
            state: "BANNED",
            bannedByPlayerId: player2Id,
            bannedAtTurn: 1,
          })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId1, {
            name: "Map 1",
            state: "BANNED",
            bannedByPlayerId: player1Id,
            bannedAtTurn: 0,
          })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId3, {
            name: "Map 3",
            state: "WINNER",
          })
        );

        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.banHistory).toHaveLength(2);
        // Should be sorted by turn order
        expect(result.banHistory[0].mapName).toBe("Map 1");
        expect(result.banHistory[0].order).toBe(1);
        expect(result.banHistory[1].mapName).toBe("Map 2");
        expect(result.banHistory[1].order).toBe(2);
      }
    });

    it("returns winner map when present", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );

        const mapId = await ctx.db.insert("maps", mapFactory({ name: "Winner Map" }));
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, {
            name: "Winner Map",
            imageUrl: "https://example.com/winner.png",
            state: "WINNER",
          })
        );

        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.winnerMap).toBeDefined();
        expect(result.winnerMap?.name).toBe("Winner Map");
        expect(result.winnerMap?.imageUrl).toBe("https://example.com/winner.png");
      }
    });

    it("returns undefined winnerMap when no WINNER state map", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );

        const mapId = await ctx.db.insert("maps", mapFactory({ name: "Banned Map" }));
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, {
            name: "Banned Map",
            state: "BANNED",
          })
        );

        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResults, {
        sessionId,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.winnerMap).toBeUndefined();
      }
    });
  });
});

// ============================================================================
// getSessionResultsByToken Tests
// ============================================================================

describe("sessions.getSessionResultsByToken", () => {
  describe("error cases", () => {
    it("returns INVALID_TOKEN for non-existent token", async () => {
      const t = createTestContext();

      const result = await t.query(api.sessions.getSessionResultsByToken, {
        token: "nonexistent-results-token",
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("INVALID_TOKEN");
      }
    });

    it("returns TOKEN_EXPIRED for expired token", async () => {
      const t = createTestContext();
      const expiredToken = "expired-results-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: expiredToken,
            tokenExpiresAt: Date.now() - 1000,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionResultsByToken, {
        token: expiredToken,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("TOKEN_EXPIRED");
      }
    });

    it("returns SESSION_NOT_FOUND when session deleted", async () => {
      const t = createTestContext();
      const orphanedToken = "orphaned-results-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "COMPLETE" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: orphanedToken,
            teamName: "Team A",
          })
        );
        await ctx.db.delete(sessionId);
      });

      const result = await t.query(api.sessions.getSessionResultsByToken, {
        token: orphanedToken,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_FOUND");
      }
    });

    it("returns SESSION_NOT_COMPLETE for non-complete session", async () => {
      const t = createTestContext();
      const validToken = "valid-incomplete-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: validToken,
            teamName: "Team A",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionResultsByToken, {
        token: validToken,
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toBe("SESSION_NOT_COMPLETE");
      }
    });
  });

  describe("success cases", () => {
    it("returns results for valid token and complete session", async () => {
      const t = createTestContext();
      const validToken = "valid-results-token";

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "COMPLETE",
            matchName: "Championship Finals",
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Champions" }));
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: validToken,
            teamName: "Champions",
          })
        );

        const mapId = await ctx.db.insert("maps", mapFactory({ name: "Final Map" }));
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, {
            name: "Final Map",
            state: "WINNER",
          })
        );

        return { sessionId };
      });

      const result = await t.query(api.sessions.getSessionResultsByToken, {
        token: validToken,
      });

      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session._id).toBe(sessionId);
        expect(result.session.matchName).toBe("Championship Finals");
        expect(result.teams).toContain("Champions");
        expect(result.winnerMap?.name).toBe("Final Map");
      }
    });
  });
});

// ============================================================================
// WAR-35: Voting Query Enhancements
// ============================================================================

describe("WAR-35: getSessionByToken enhancements", () => {
  describe("roundHistory", () => {
    it("returns empty roundHistory when no maps are banned", async () => {
      const t = createTestContext();
      const token = "round-history-empty";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, { state: "AVAILABLE" })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.roundHistory).toEqual([]);
      }
    });

    it("returns ABBA round history organized by turn", async () => {
      const t = createTestContext();
      const token = "abba-history-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "ABBA",
            currentTurn: 3,
          })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));

        const playerA = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token,
            teamName: "Team A",
            role: "Player A",
          })
        );
        const playerB = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-player",
            teamName: "Team B",
            role: "Player B",
          })
        );

        const mapIds = await Promise.all(
          ["Dust2", "Mirage", "Inferno", "Nuke", "Overpass"].map((name) =>
            ctx.db.insert("maps", mapFactory({ name }))
          )
        );

        // Map 0 banned by player A at turn 0
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[0], {
            name: "Dust2",
            state: "BANNED",
            bannedByPlayerId: playerA,
            bannedAtTurn: 0,
          })
        );
        // Map 1 banned by player B at turn 1
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[1], {
            name: "Mirage",
            state: "BANNED",
            bannedByPlayerId: playerB,
            bannedAtTurn: 1,
          })
        );
        // Map 2 banned by player B at turn 2
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[2], {
            name: "Inferno",
            state: "BANNED",
            bannedByPlayerId: playerB,
            bannedAtTurn: 2,
          })
        );
        // Remaining maps still available
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[3], { name: "Nuke" })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[4], { name: "Overpass" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.roundHistory).toHaveLength(3);
        // Turn 0 → round 1
        expect(result.roundHistory[0].round).toBe(1);
        expect(result.roundHistory[0].bans[0].mapName).toBe("Dust2");
        expect(result.roundHistory[0].bans[0].bannedByTeam).toBe("Team A");
        // Turn 1 → round 2
        expect(result.roundHistory[1].round).toBe(2);
        expect(result.roundHistory[1].bans[0].mapName).toBe("Mirage");
        expect(result.roundHistory[1].bans[0].bannedByTeam).toBe("Team B");
        // Turn 2 → round 3
        expect(result.roundHistory[2].round).toBe(3);
        expect(result.roundHistory[2].bans[0].mapName).toBe("Inferno");
        expect(result.roundHistory[2].bans[0].bannedByTeam).toBe("Team B");

        // ABBA bans don't have vote counts
        expect(result.roundHistory[0].bans[0].voteCount).toBeUndefined();
      }

      // Verify Player B sees the same round history (viewer-independent ordering)
      const resultB = await t.query(api.sessions.getSessionByToken, {
        token: "other-player",
      });
      expect(resultB.status).toBe("valid");
      if (resultB.status === "valid") {
        expect(resultB.roundHistory).toHaveLength(3);
        expect(resultB.roundHistory[0].round).toBe(1);
        expect(resultB.roundHistory[0].bans[0].mapName).toBe("Dust2");
        expect(resultB.roundHistory[0].bans[0].bannedByTeam).toBe("Team A");
        expect(resultB.roundHistory[1].round).toBe(2);
        expect(resultB.roundHistory[1].bans[0].mapName).toBe("Mirage");
        expect(resultB.roundHistory[1].bans[0].bannedByTeam).toBe("Team B");
        expect(resultB.roundHistory[2].round).toBe(3);
        expect(resultB.roundHistory[2].bans[0].mapName).toBe("Inferno");
        expect(resultB.roundHistory[2].bans[0].bannedByTeam).toBe("Team B");
        expect(resultB.roundHistory[0].bans[0].voteCount).toBeUndefined();
      }
    });

    it("returns MULTIPLAYER round history with multiple bans per round", async () => {
      const t = createTestContext();
      const token = "multi-history-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            playerCount: 4,
            currentRound: 2,
          })
        );

        await Promise.all(
          ["Team A", "Team B", "Team C", "Team D"].map((name, i) =>
            ctx.db.insert(
              "sessionPlayers",
              sessionPlayerFactory(sessionId, {
                token: i === 0 ? token : `other-${i}`,
                teamName: name,
                role: `PLAYER_${i + 1}`,
              })
            )
          )
        );

        const mapIds = await Promise.all(
          ["Map1", "Map2", "Map3", "Map4", "Map5"].map((name) =>
            ctx.db.insert("maps", mapFactory({ name }))
          )
        );

        // Round 1: Maps 0 and 1 banned with vote counts
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[0], {
            name: "Map1",
            state: "BANNED",
            bannedAtRound: 1,
            voteCount: 3,
          })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[1], {
            name: "Map2",
            state: "BANNED",
            bannedAtRound: 1,
            voteCount: 2,
          })
        );
        // Remaining maps still available
        for (let i = 2; i < 5; i++) {
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, mapIds[i], {
              name: `Map${i + 1}`,
            })
          );
        }
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.roundHistory).toHaveLength(1);
        expect(result.roundHistory[0].round).toBe(1);
        expect(result.roundHistory[0].bans).toHaveLength(2);
        expect(result.roundHistory[0].bans.map((b) => b.mapName)).toContain(
          "Map1"
        );
        expect(result.roundHistory[0].bans.map((b) => b.mapName)).toContain(
          "Map2"
        );

        // Vote counts are included for MULTIPLAYER
        const map1Ban = result.roundHistory[0].bans.find(
          (b) => b.mapName === "Map1"
        );
        const map2Ban = result.roundHistory[0].bans.find(
          (b) => b.mapName === "Map2"
        );
        expect(map1Ban?.voteCount).toBe(3);
        expect(map2Ban?.voteCount).toBe(2);
      }
    });
  });

  describe("voteProgress", () => {
    it("returns voteProgress for MULTIPLAYER IN_PROGRESS sessions", async () => {
      const t = createTestContext();
      const token = "vote-progress-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            playerCount: 4,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );

        // Create 4 players, 2 have voted
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token,
            teamName: "Team A",
            hasVotedThisRound: true,
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-1",
            teamName: "Team B",
            hasVotedThisRound: true,
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-2",
            teamName: "Team C",
            hasVotedThisRound: false,
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-3",
            teamName: "Team D",
            hasVotedThisRound: false,
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.voteProgress).toBeDefined();
        expect(result.voteProgress!.totalPlayers).toBe(4);
        expect(result.voteProgress!.votedCount).toBe(2);
        expect(result.voteProgress!.allVoted).toBe(false);
      }
    });

    it("returns allVoted true when all players have voted", async () => {
      const t = createTestContext();
      const token = "all-voted-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            playerCount: 2,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );

        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token,
            teamName: "Team A",
            hasVotedThisRound: true,
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "other-voted",
            teamName: "Team B",
            hasVotedThisRound: true,
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.voteProgress!.allVoted).toBe(true);
        expect(result.voteProgress!.votedCount).toBe(2);
      }
    });

    it("does not include voteProgress for ABBA format", async () => {
      const t = createTestContext();
      const token = "abba-no-progress";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "ABBA",
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.voteProgress).toBeUndefined();
      }
    });

    it("does not include voteProgress for non-IN_PROGRESS MULTIPLAYER sessions", async () => {
      const t = createTestContext();
      const token = "waiting-no-progress";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "WAITING",
            format: "MULTIPLAYER",
            playerCount: 4,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.voteProgress).toBeUndefined();
      }
    });
  });

  describe("isRevoteRound", () => {
    it("returns false when isRevoteRound is not set", async () => {
      const t = createTestContext();
      const token = "no-revote";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.isRevoteRound).toBe(false);
      }
    });

    it("returns true during deadlock revote", async () => {
      const t = createTestContext();
      const token = "revote-active";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            isRevoteRound: true,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.isRevoteRound).toBe(true);
      }
    });
  });

  describe("completedRounds", () => {
    it("returns 0 at the start of an ABBA session", async () => {
      const t = createTestContext();
      const token = "abba-start";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "ABBA",
            currentTurn: 0,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.completedRounds).toBe(0);
      }
    });

    it("counts banned maps for ABBA completedRounds", async () => {
      const t = createTestContext();
      const token = "abba-mid";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "ABBA",
            currentTurn: 2,
          })
        );

        const player = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );

        const mapIds = await Promise.all(
          ["A", "B", "C"].map((n) =>
            ctx.db.insert("maps", mapFactory({ name: `Map ${n}` }))
          )
        );

        // 2 maps banned
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[0], {
            state: "BANNED",
            bannedByPlayerId: player,
            bannedAtTurn: 0,
          })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[1], {
            state: "BANNED",
            bannedByPlayerId: player,
            bannedAtTurn: 1,
          })
        );
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapIds[2], { state: "AVAILABLE" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.completedRounds).toBe(2);
      }
    });

    it("returns 0 at the start of a MULTIPLAYER session", async () => {
      const t = createTestContext();
      const token = "multi-start";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            currentRound: 1,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.completedRounds).toBe(0);
      }
    });

    it("derives completedRounds from currentRound for MULTIPLAYER", async () => {
      const t = createTestContext();
      const token = "multi-round3";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            format: "MULTIPLAYER",
            currentRound: 3,
          })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { token, teamName: "Team A" })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        expect(result.session.completedRounds).toBe(2);
      }
    });
  });

  describe("privacy enforcement", () => {
    it("does not expose tokens in otherPlayers", async () => {
      const t = createTestContext();
      const token = "privacy-token";

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token,
            teamName: "Team A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: "secret-other-token",
            teamName: "Team B",
            ipAddress: "10.0.0.1",
          })
        );
      });

      const result = await t.query(api.sessions.getSessionByToken, { token });
      expect(result.status).toBe("valid");
      if (result.status === "valid") {
        const otherPlayer = result.otherPlayers[0];
        // Token should not be in the response
        expect("token" in otherPlayer).toBe(false);
        // IP address should not be in the response
        expect("ipAddress" in otherPlayer).toBe(false);
        // Only expected fields present
        expect(Object.keys(otherPlayer).sort()).toEqual(
          ["_id", "connectionStatus", "hasVotedThisRound", "isConnected", "role", "teamName"].sort()
        );
      }
    });
  });
});

// ============================================================================
// WAR-35: GDPR — IP Address Redaction in Admin Queries
// ============================================================================

describe("WAR-35: GDPR IP redaction in getSession", () => {
  it("returns isIpLocked true when player has IP set", async () => {
    const { t, authT } = await createAuthenticatedAdmin();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );
      await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team A",
          ipAddress: "192.168.1.1",
        })
      );
      return { sessionId };
    });

    const session = await authT.query(api.sessions.getSession, { sessionId });
    expect(session).not.toBeNull();
    expect(session!.players[0].isIpLocked).toBe(true);
  });

  it("returns isIpLocked false when player has no IP", async () => {
    const { t, authT } = await createAuthenticatedAdmin();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "DRAFT" })
      );
      await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team A",
          ipAddress: undefined,
        })
      );
      return { sessionId };
    });

    const session = await authT.query(api.sessions.getSession, { sessionId });
    expect(session).not.toBeNull();
    expect(session!.players[0].isIpLocked).toBe(false);
  });

  it("does not expose ipAddress field in admin response", async () => {
    const { t, authT } = await createAuthenticatedAdmin();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );
      await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team A",
          ipAddress: "10.0.0.5",
        })
      );
      return { sessionId };
    });

    const session = await authT.query(api.sessions.getSession, { sessionId });
    expect(session).not.toBeNull();
    const player = session!.players[0];
    expect("ipAddress" in player).toBe(false);
    expect("isIpLocked" in player).toBe(true);
  });
});

// ============================================================================
// WAR-20: playerVotedMapId Tests
// ============================================================================

describe("WAR-20: playerVotedMapId in getSessionByToken", () => {
  /** Set up a MULTIPLAYER session with one player and one map. */
  async function setupMultiplayerWithVote(
    t: ReturnType<typeof createTestContext>,
    opts: {
      token: string;
      currentRound?: number;
      hasVotedThisRound?: boolean;
      voteRound?: number | null; // null = no vote record, number = insert vote for that round
    }
  ) {
    return await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "IN_PROGRESS",
          format: "MULTIPLAYER",
          currentRound: opts.currentRound ?? 1,
        })
      );
      const mapId = await ctx.db.insert("maps", mapFactory());
      const sessionMapId = await ctx.db.insert(
        "sessionMaps",
        sessionMapFactory(sessionId, mapId, { state: "AVAILABLE" })
      );
      const playerId = await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          token: opts.token,
          teamName: "Team A",
          ipAddress: "10.0.0.1",
          hasVotedThisRound: opts.hasVotedThisRound ?? false,
        })
      );

      if (opts.voteRound != null) {
        await ctx.db.insert(
          "votes",
          voteFactory(sessionId, playerId, sessionMapId, {
            round: opts.voteRound,
          })
        );
      }

      return { sessionMapId };
    });
  }

  it("returns undefined when player has not voted this round", async () => {
    const t = createTestContext();
    const token = "not-voted-yet";
    await setupMultiplayerWithVote(t, { token, voteRound: null });

    const result = await t.query(api.sessions.getSessionByToken, { token });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid");
    expect(result.playerVotedMapId).toBeUndefined();
  });

  it("returns the voted map ID after player votes", async () => {
    const t = createTestContext();
    const token = "already-voted";
    const { sessionMapId } = await setupMultiplayerWithVote(t, {
      token,
      hasVotedThisRound: true,
      voteRound: 1,
    });

    const result = await t.query(api.sessions.getSessionByToken, { token });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid");
    expect(result.playerVotedMapId).toBe(sessionMapId);
  });

  it("returns undefined for new round when vote exists only in previous round", async () => {
    const t = createTestContext();
    const token = "new-round-no-vote";
    await setupMultiplayerWithVote(t, {
      token,
      currentRound: 2,
      hasVotedThisRound: false,
      voteRound: 1, // vote from round 1 only
    });

    const result = await t.query(api.sessions.getSessionByToken, { token });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid");
    expect(result.playerVotedMapId).toBeUndefined();
  });

  it("returns undefined for ABBA format", async () => {
    const t = createTestContext();
    const token = "abba-no-voted-map";

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "IN_PROGRESS",
          format: "ABBA",
          currentTurn: 0,
        })
      );
      const mapId = await ctx.db.insert("maps", mapFactory());
      await ctx.db.insert(
        "sessionMaps",
        sessionMapFactory(sessionId, mapId, { state: "AVAILABLE" })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          token,
          teamName: "Team A",
          ipAddress: "10.0.0.1",
        })
      );
    });

    const result = await t.query(api.sessions.getSessionByToken, { token });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid");
    expect(result.playerVotedMapId).toBeUndefined();
  });
});

// ============================================================================
// Lifecycle Mutation Tests
// ============================================================================

/**
 * Creates a DRAFT session with the correct number of players and maps
 * for finalize guard testing.
 */
async function createFinalizableSession(
  overrides: { playerCount?: number; mapPoolSize?: number } = {}
) {
  const playerCount = overrides.playerCount ?? 2;
  const mapPoolSize = overrides.mapPoolSize ?? 5;
  const { t, authT, adminId } = await createAuthenticatedAdmin();

  const sessionId = await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        status: "DRAFT",
        playerCount,
        mapPoolSize,
      })
    );

    // Create master maps
    const masterMapIds = await Promise.all(
      Array.from({ length: mapPoolSize }, (_, i) =>
        ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
      )
    );

    // Create session players
    await Promise.all(
      Array.from({ length: playerCount }, (_, i) =>
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: `Team ${i + 1}`,
            isConnected: false,
          })
        )
      )
    );

    // Create session maps
    await Promise.all(
      masterMapIds.map((mapId, i) =>
        ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
        )
      )
    );

    return sessionId;
  });

  return { t, authT, adminId, sessionId };
}

/**
 * Creates a WAITING session with all players connected, ready to start.
 */
async function createStartableSession() {
  const { t, authT, adminId } = await createAuthenticatedAdmin();

  const sessionId = await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        status: "WAITING",
        playerCount: 2,
        mapPoolSize: 5,
      })
    );

    // Create connected players
    await Promise.all([
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team Alpha",
          isConnected: true,
        })
      ),
      ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team Beta",
          isConnected: true,
        })
      ),
    ]);

    return sessionId;
  });

  return { t, authT, adminId, sessionId };
}

/** Helper to verify an audit log entry exists for a session. */
async function expectAuditLog(
  t: ReturnType<typeof createTestContext>,
  sessionId: Id<"sessions">,
  expectedAction: string,
  additionalChecks?: (log: Record<string, unknown>) => void
) {
  const auditLogs = await t.run(async (ctx) =>
    ctx.db
      .query("auditLogs")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect()
  );
  const log = auditLogs.find((l) => l.action === expectedAction);
  expect(log).toBeDefined();
  expect(log?.actorType).toBe("ADMIN");
  if (additionalChecks && log) {
    additionalChecks(log as unknown as Record<string, unknown>);
  }
  return log;
}

// ============================================================================
// finalizeSession Tests (WAR-38)
// ============================================================================

describe("sessions.finalizeSession", () => {
  it("transitions DRAFT → WAITING with correct player/map counts", async () => {
    const { t, authT, sessionId } = await createFinalizableSession();

    const result = await authT.mutation(api.sessions.finalizeSession, {
      sessionId,
    });
    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("WAITING");
  });

  it("creates audit log with SESSION_FINALIZED action", async () => {
    const { t, authT, sessionId } = await createFinalizableSession();

    await authT.mutation(api.sessions.finalizeSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_FINALIZED");
  });

  it("rejects when players are missing", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "DRAFT",
          playerCount: 2,
          mapPoolSize: 5,
        })
      );

      // Only add 1 player (need 2)
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team Solo" })
      );

      // Add all 5 maps
      const masterMapIds = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
        )
      );
      await Promise.all(
        masterMapIds.map((mapId, i) =>
          ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
          )
        )
      );

      return sessionId;
    });

    await expect(
      authT.mutation(api.sessions.finalizeSession, { sessionId })
    ).rejects.toThrow(/1 of 2 players assigned/);
  });

  it("rejects when maps are missing", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "DRAFT",
          playerCount: 2,
          mapPoolSize: 5,
        })
      );

      // Add 2 players (correct)
      await Promise.all([
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team A" })
        ),
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Team B" })
        ),
      ]);

      // Only add 3 maps (need 5)
      const masterMapIds = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
        )
      );
      await Promise.all(
        masterMapIds.map((mapId, i) =>
          ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
          )
        )
      );

      return sessionId;
    });

    await expect(
      authT.mutation(api.sessions.finalizeSession, { sessionId })
    ).rejects.toThrow(/3 of 5 maps assigned/);
  });

  it("rejects wrong status (WAITING → WAITING invalid)", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "WAITING"
    );

    await expect(
      authT.mutation(api.sessions.finalizeSession, { sessionId })
    ).rejects.toThrow(/Cannot transition from WAITING/);
  });

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.finalizeSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });

  it("throws when not authenticated", async () => {
    const t = createTestContext();

    const sessionId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      return ctx.db.insert("sessions", sessionFactory(adminId));
    });

    await expect(
      t.mutation(api.sessions.finalizeSession, { sessionId })
    ).rejects.toThrow(/Authentication required/);
  });
});

// ============================================================================
// startSession Tests (WAR-39)
// ============================================================================

describe("sessions.startSession", () => {
  it("transitions WAITING → IN_PROGRESS with all players connected", async () => {
    const { t, authT, sessionId } = await createStartableSession();

    const result = await authT.mutation(api.sessions.startSession, {
      sessionId,
    });
    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("IN_PROGRESS");
  });

  it("sets startedAt and timerStartedAt to current timestamp", async () => {
    const { t, authT, sessionId } = await createStartableSession();

    const before = Date.now();
    await authT.mutation(api.sessions.startSession, { sessionId });
    const after = Date.now();

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.startedAt).toBeGreaterThanOrEqual(before);
    expect(session?.startedAt).toBeLessThanOrEqual(after);
    expect(session?.timerStartedAt).toBe(session?.startedAt);
  });

  it("sets currentTurn to 0 and currentRound to 1", async () => {
    const { t, authT, sessionId } = await createStartableSession();

    await authT.mutation(api.sessions.startSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.currentTurn).toBe(0);
    expect(session?.currentRound).toBe(1);
  });

  it("creates audit log with SESSION_STARTED action", async () => {
    const { t, authT, sessionId } = await createStartableSession();

    await authT.mutation(api.sessions.startSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_STARTED");
  });

  it("rejects when players are disconnected", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "WAITING",
          playerCount: 2,
        })
      );

      await Promise.all([
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Team Alpha",
            isConnected: true,
          })
        ),
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            teamName: "Team Beta",
            isConnected: false,
          })
        ),
      ]);

      return sessionId;
    });

    await expect(
      authT.mutation(api.sessions.startSession, { sessionId })
    ).rejects.toThrow(/not connected.*Team Beta/);
  });

  it("rejects wrong status (DRAFT → IN_PROGRESS invalid)", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "DRAFT"
    );

    await expect(
      authT.mutation(api.sessions.startSession, { sessionId })
    ).rejects.toThrow(/Cannot transition from DRAFT to IN_PROGRESS/);
  });

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.startSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });

  it("clears readyAt on all players", async () => {
    const { t, authT, sessionId } = await createStartableSession();

    // Set readyAt on all players before starting
    await t.run(async (ctx) => {
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      for (const player of players) {
        await ctx.db.patch(player._id, { readyAt: Date.now() });
      }
    });

    await authT.mutation(api.sessions.startSession, { sessionId });

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    expect(players).toHaveLength(2);
    for (const player of players) {
      expect(player.readyAt).toBeUndefined();
    }
  });
});

// ============================================================================
// pauseSession Tests (WAR-40)
// ============================================================================

describe("sessions.pauseSession", () => {
  it("transitions IN_PROGRESS → PAUSED", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    const result = await authT.mutation(api.sessions.pauseSession, {
      sessionId,
    });
    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("PAUSED");
  });

  it("sets timerPausedAt to current timestamp", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    const before = Date.now();
    await authT.mutation(api.sessions.pauseSession, { sessionId });
    const after = Date.now();

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.timerPausedAt).toBeGreaterThanOrEqual(before);
    expect(session?.timerPausedAt).toBeLessThanOrEqual(after);
  });

  it("records optional reason in audit details", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    await authT.mutation(api.sessions.pauseSession, {
      sessionId,
      reason: "Player disconnected",
    });

    await expectAuditLog(t, sessionId, "SESSION_PAUSED", (log) => {
      expect((log as { details?: { reason?: string } }).details?.reason).toBe("Player disconnected");
    });
  });

  it("creates audit log without reason when not provided", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    await authT.mutation(api.sessions.pauseSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_PAUSED");
  });

  it("rejects reason exceeding MAX_REASON_LENGTH", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    const longReason = "x".repeat(MAX_REASON_LENGTH + 1);
    await expect(
      authT.mutation(api.sessions.pauseSession, {
        sessionId,
        reason: longReason,
      })
    ).rejects.toThrow(/500 characters/);
  });

  it("rejects wrong status (WAITING → PAUSED invalid)", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "WAITING"
    );

    await expect(
      authT.mutation(api.sessions.pauseSession, { sessionId })
    ).rejects.toThrow(/Cannot transition from WAITING/);
  });

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.pauseSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });
});

// ============================================================================
// resumeSession Tests (WAR-40)
// ============================================================================

describe("sessions.resumeSession", () => {
  it("transitions PAUSED → IN_PROGRESS", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "PAUSED"
    );

    const result = await authT.mutation(api.sessions.resumeSession, {
      sessionId,
    });
    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("IN_PROGRESS");
  });

  it("preserves remaining timer via arithmetic", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    // Set up session with known timer values:
    // timerStartedAt = 1000, timerPausedAt = 1012000 (12s elapsed)
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "PAUSED",
        })
      )
    );

    // Patch timer fields directly (factory doesn't support these optional fields)
    await t.run(async (ctx) => {
      await ctx.db.patch(sessionId, {
        timerStartedAt: 1000,
        timerPausedAt: 13000, // 12 seconds elapsed
      });
    });

    const beforeResume = Date.now();
    await authT.mutation(api.sessions.resumeSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));

    // Elapsed was 13000 - 1000 = 12000ms
    // adjustedTimerStart = now - 12000
    // So timerStartedAt should be roughly (beforeResume - 12000)
    expect(session?.timerStartedAt).toBeDefined();
    const expectedStart = beforeResume - 12000;
    // Allow small timing tolerance (mutation executes ~within 100ms)
    expect(Math.abs(session!.timerStartedAt! - expectedStart)).toBeLessThan(
      200
    );
  });

  it("clears timerPausedAt to undefined", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const id = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "PAUSED" })
      );
      await ctx.db.patch(id, {
        timerStartedAt: 1000,
        timerPausedAt: 5000,
      });
      return id;
    });

    await authT.mutation(api.sessions.resumeSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.timerPausedAt).toBeUndefined();
  });

  it("preserves isRevoteRound through pause/resume", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const id = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "PAUSED", isRevoteRound: true })
      );
      await ctx.db.patch(id, {
        timerStartedAt: 1000,
        timerPausedAt: 5000,
      });
      return id;
    });

    await authT.mutation(api.sessions.resumeSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.isRevoteRound).toBe(true);
  });

  it("handles null timer fields safely (defaults to 0 elapsed)", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "PAUSED"
    );

    // Session created without timerStartedAt/timerPausedAt (both undefined)
    const before = Date.now();
    await authT.mutation(api.sessions.resumeSession, { sessionId });
    const after = Date.now();

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    // With both undefined, elapsed = (now - now) = 0, so timerStartedAt ≈ now
    expect(session?.timerStartedAt).toBeGreaterThanOrEqual(before);
    expect(session?.timerStartedAt).toBeLessThanOrEqual(after);
  });

  it("creates audit log with SESSION_RESUMED action", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "PAUSED"
    );

    await authT.mutation(api.sessions.resumeSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_RESUMED");
  });

  it("rejects wrong status (IN_PROGRESS → IN_PROGRESS invalid)", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    await expect(
      authT.mutation(api.sessions.resumeSession, { sessionId })
    ).rejects.toThrow(/Cannot transition from IN_PROGRESS/);
  });

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.resumeSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });
});

// ============================================================================
// endSession Tests (WAR-41)
// ============================================================================

describe("sessions.endSession", () => {
  it.each(["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"] as const)(
    "force-ends from %s → COMPLETE",
    async (status) => {
      const { t, authT, sessionId } =
        await createAuthenticatedSessionInStatus(status);

      const result = await authT.mutation(api.sessions.endSession, {
        sessionId,
      });

      expect(result.success).toBe(true);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("COMPLETE");
    }
  );

  it("sets completedAt and clears timer fields", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      const id = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );
      await ctx.db.patch(id, {
        timerStartedAt: 1000,
        timerPausedAt: 5000,
      });
      return id;
    });

    const before = Date.now();
    await authT.mutation(api.sessions.endSession, { sessionId });

    const after = Date.now();

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.completedAt).toBeGreaterThanOrEqual(before);
    expect(session?.completedAt).toBeLessThanOrEqual(after);
    expect(session?.timerStartedAt).toBeUndefined();
    expect(session?.timerPausedAt).toBeUndefined();
    expect(session?.isRevoteRound).toBe(false);
  });

  it("clears isRevoteRound when force-ending a paused revote session", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) => {
      return ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "PAUSED", isRevoteRound: true })
      );
    });

    await authT.mutation(api.sessions.endSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("COMPLETE");
    expect(session?.isRevoteRound).toBe(false);
  });

  it("does NOT set winnerMapId", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    await authT.mutation(api.sessions.endSession, { sessionId });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.winnerMapId).toBeUndefined();
  });

  it("rejects already-COMPLETE session", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "COMPLETE"
    );

    await expect(
      authT.mutation(api.sessions.endSession, { sessionId })
    ).rejects.toThrow(/Cannot transition from COMPLETE/);
  });

  it("rejects EXPIRED session (terminal state)", async () => {
    const { authT, sessionId } = await createAuthenticatedSessionInStatus(
      "EXPIRED"
    );

    await expect(
      authT.mutation(api.sessions.endSession, { sessionId })
    ).rejects.toThrow(/terminal state/);
  });

  it("creates audit log with SESSION_ENDED and reason ADMIN_FORCE_END", async () => {
    const { t, authT, sessionId } = await createAuthenticatedSessionInStatus(
      "IN_PROGRESS"
    );

    await authT.mutation(api.sessions.endSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_ENDED", (log) => {
      expect((log as { details?: { reason?: string } }).details?.reason).toBe("ADMIN_FORCE_END");
    });
  });

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.endSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });

  it("throws when not authenticated", async () => {
    const t = createTestContext();

    const sessionId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      return ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );
    });

    await expect(
      t.mutation(api.sessions.endSession, { sessionId })
    ).rejects.toThrow(/Authentication required/);
  });
});

// ============================================================================
// forceRandomSelection (WAR-43)
// ============================================================================

describe("sessions.forceRandomSelection", () => {
  /** Create an IN_PROGRESS or PAUSED session with available maps for testing. */
  async function createForceRandomSession(
    t: ReturnType<typeof createTestContext>,
    adminId: Id<"admins">,
    overrides: { status?: "IN_PROGRESS" | "PAUSED"; mapCount?: number } = {}
  ) {
    const status = overrides.status ?? "IN_PROGRESS";
    const mapCount = overrides.mapCount ?? 3;

    return await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status, mapPoolSize: mapCount })
      );

      const mapIds: Id<"sessionMaps">[] = [];
      for (let i = 0; i < mapCount; i++) {
        const mapId = await ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }));
        const sessionMapId = await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId, { name: `Map ${i + 1}` })
        );
        mapIds.push(sessionMapId);
      }

      return { sessionId, mapIds };
    });
  }

  // --------------------------------------------------------------------------
  // Happy Path
  // --------------------------------------------------------------------------

  it("randomly selects a winner from IN_PROGRESS session", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const { sessionId } = await createForceRandomSession(t, adminId);

    const result = await authT.mutation(api.sessions.forceRandomSelection, { sessionId });

    expect(result.success).toBe(true);
    expect(["Map 1", "Map 2", "Map 3"]).toContain(result.winnerMapName);

    // Verify exactly 1 WINNER and rest BANNED
    const maps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );
    const winners = maps.filter((m) => m.state === "WINNER");
    const banned = maps.filter((m) => m.state === "BANNED");
    expect(winners).toHaveLength(1);
    expect(banned).toHaveLength(2);
    expect(winners[0].name).toBe(result.winnerMapName);

    // Verify session is COMPLETE
    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("COMPLETE");
    expect(session?.completedAt).toBeDefined();
    expect(session?.winnerMapId).toBe(winners[0]._id);
  });

  it("randomly selects a winner from PAUSED session", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const { sessionId } = await createForceRandomSession(t, adminId, {
      status: "PAUSED",
    });

    const result = await authT.mutation(api.sessions.forceRandomSelection, { sessionId });

    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("COMPLETE");
  });

  it("handles single available map", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const { sessionId } = await createForceRandomSession(t, adminId, {
      mapCount: 1,
    });

    const result = await authT.mutation(api.sessions.forceRandomSelection, { sessionId });

    expect(result.success).toBe(true);
    expect(result.winnerMapName).toBe("Map 1");

    // Only 1 map, should be WINNER with no BANNED
    const maps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );
    expect(maps.filter((m) => m.state === "WINNER")).toHaveLength(1);
    expect(maps.filter((m) => m.state === "BANNED")).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Audit Logging
  // --------------------------------------------------------------------------

  it("logs RANDOM_SELECTION and WINNER_DECLARED audit events", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const { sessionId } = await createForceRandomSession(t, adminId);

    await authT.mutation(api.sessions.forceRandomSelection, { sessionId });

    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    const randomLog = logs.find((l) => l.action === "RANDOM_SELECTION");
    expect(randomLog).toBeDefined();
    expect(randomLog?.actorType).toBe("ADMIN");
    expect(randomLog?.details.reason).toBe("ADMIN_FORCE");
    expect(randomLog?.details.mapName).toBeDefined();

    const winnerLog = logs.find((l) => l.action === "WINNER_DECLARED");
    expect(winnerLog).toBeDefined();
    expect(winnerLog?.actorType).toBe("SYSTEM");
    expect(winnerLog?.details.reason).toBe("ADMIN_FORCE");
    expect(winnerLog?.details.mapName).toBe(randomLog?.details.mapName);
  });

  // --------------------------------------------------------------------------
  // Validation Errors
  // --------------------------------------------------------------------------

  it("rejects unauthenticated calls", async () => {
    const { t, adminId } = await createAuthenticatedAdmin();
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("sessions", sessionFactory(adminId, { status: "IN_PROGRESS" }))
    );

    await expect(
      t.mutation(api.sessions.forceRandomSelection, { sessionId })
    ).rejects.toThrow(/Authentication required/);
  });

  it("rejects non-existent session", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedSessionId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.forceRandomSelection, { sessionId: deletedSessionId })
    ).rejects.toThrow(/Session not found/);
  });

  it("rejects EXPIRED session (terminal state)", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("sessions", sessionFactory(adminId, { status: "EXPIRED" }))
    );

    await expect(
      authT.mutation(api.sessions.forceRandomSelection, { sessionId })
    ).rejects.toThrow(/terminal state/);
  });

  it("rejects COMPLETE session", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("sessions", sessionFactory(adminId, { status: "COMPLETE" }))
    );

    await expect(
      authT.mutation(api.sessions.forceRandomSelection, { sessionId })
    ).rejects.toThrow(/Cannot transition from COMPLETE to COMPLETE/);
  });

  it("rejects when no available maps exist", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const sessionId = await t.run(async (ctx) => {
      const sid = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );
      // Add only BANNED maps
      const mapId = await ctx.db.insert("maps", mapFactory());
      await ctx.db.insert(
        "sessionMaps",
        sessionMapFactory(sid, mapId, { state: "BANNED" })
      );
      return sid;
    });

    await expect(
      authT.mutation(api.sessions.forceRandomSelection, { sessionId })
    ).rejects.toThrow(/No available maps to select from/);
  });
});

// ============================================================================
// resetSession Tests (WAR-45)
// ============================================================================

describe("sessions.resetSession", () => {
  /** Create a COMPLETE session with players, maps (some BANNED/WINNER), and votes. */
  async function createCompletedSession() {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const { sessionId, playerIds, mapIds, voteIds } = await t.run(
      async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "COMPLETE",
            playerCount: 2,
            mapPoolSize: 3,
            currentTurn: 4,
            currentRound: 3,
            isRevoteRound: true,
          })
        );

        // Create master maps
        const masterMapIds = await Promise.all([
          ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ]);

        // Create session players
        const playerIds = await Promise.all([
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, {
              role: "Captain",
              teamName: "Team Alpha",
              hasVotedThisRound: true,
            })
          ),
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, {
              role: "Vice Captain",
              teamName: "Team Beta",
              hasVotedThisRound: true,
            })
          ),
        ]);

        // Create session maps: 2 BANNED + 1 WINNER
        const mapIds = [
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[0], {
              name: "Map 1",
              state: "BANNED",
              bannedByPlayerId: playerIds[0],
              bannedAtTurn: 0,
              bannedAtRound: 1,
              voteCount: 2,
              submittedByAdmin: false,
            })
          ),
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[1], {
              name: "Map 2",
              state: "BANNED",
              bannedByPlayerId: playerIds[1],
              bannedAtTurn: 1,
              bannedAtRound: 1,
              voteCount: 1,
            })
          ),
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[2], {
              name: "Map 3",
              state: "WINNER",
            })
          ),
        ];

        // Create votes
        const voteIds = [
          await ctx.db.insert(
            "votes",
            voteFactory(sessionId, playerIds[0], mapIds[0])
          ),
          await ctx.db.insert(
            "votes",
            voteFactory(sessionId, playerIds[1], mapIds[1])
          ),
        ];

        // Seed fields that reset should clear (so assertions aren't vacuous)
        await ctx.db.patch(sessionId, {
          winnerMapId: mapIds[2],
          completedAt: Date.now() - 60_000,
          startedAt: Date.now() - 120_000,
          timerStartedAt: Date.now() - 30_000,
          timerPausedAt: Date.now() - 10_000,
        });

        return { sessionId, playerIds, mapIds, voteIds };
      }
    );

    return { t, authT, adminId, sessionId, playerIds, mapIds, voteIds };
  }

  // --------------------------------------------------------------------------
  // Happy Path
  // --------------------------------------------------------------------------

  it("resets COMPLETE session to WAITING with correct field values", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    const result = await authT.mutation(api.sessions.resetSession, {
      sessionId,
    });
    expect(result.success).toBe(true);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("WAITING");
    expect(session?.currentTurn).toBe(0);
    expect(session?.currentRound).toBe(1);
    expect(session?.isRevoteRound).toBe(false);
    expect(session?.winnerMapId).toBeUndefined();
    expect(session?.completedAt).toBeUndefined();
    expect(session?.startedAt).toBeUndefined();
    expect(session?.timerStartedAt).toBeUndefined();
    expect(session?.timerPausedAt).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Data Cleanup
  // --------------------------------------------------------------------------

  it("deletes all votes for the session", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    await authT.mutation(api.sessions.resetSession, { sessionId });

    const votes = await t.run(async (ctx) =>
      ctx.db
        .query("votes")
        .withIndex("by_sessionId_and_round", (q) =>
          q.eq("sessionId", sessionId)
        )
        .collect()
    );
    expect(votes).toHaveLength(0);
  });

  it("resets all sessionMaps to AVAILABLE and clears ban metadata", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    await authT.mutation(api.sessions.resetSession, { sessionId });

    const maps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    expect(maps).toHaveLength(3);
    for (const map of maps) {
      expect(map.state).toBe("AVAILABLE");
      expect(map.bannedByPlayerId).toBeUndefined();
      expect(map.bannedAtTurn).toBeUndefined();
      expect(map.bannedAtRound).toBeUndefined();
      expect(map.voteCount).toBeUndefined();
      expect(map.submittedByAdmin).toBeUndefined();
    }
  });

  it("resets all players hasVotedThisRound to false", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    await authT.mutation(api.sessions.resetSession, { sessionId });

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    expect(players).toHaveLength(2);
    for (const player of players) {
      expect(player.hasVotedThisRound).toBe(false);
    }
  });

  it("clears readyAt on all players", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    // Set readyAt on all players before resetting
    await t.run(async (ctx) => {
      const players = await ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      for (const player of players) {
        await ctx.db.patch(player._id, { readyAt: Date.now() });
      }
    });

    await authT.mutation(api.sessions.resetSession, { sessionId });

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    expect(players).toHaveLength(2);
    for (const player of players) {
      expect(player.readyAt).toBeUndefined();
    }
  });

  it("extends player tokenExpiresAt by 24 hours from now", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    // Create session with players whose tokens are already expired
    const sessionId = await t.run(async (ctx) => {
      const sid = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "COMPLETE", playerCount: 2 })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sid, {
          role: "Captain",
          teamName: "Team A",
          tokenExpiresAt: Date.now() - 1000, // expired
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sid, {
          role: "Vice Captain",
          teamName: "Team B",
          tokenExpiresAt: Date.now() - 1000, // expired
        })
      );
      return sid;
    });

    const before = Date.now();
    await authT.mutation(api.sessions.resetSession, { sessionId });
    const after = Date.now();

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    for (const player of players) {
      expect(player.tokenExpiresAt).toBeGreaterThanOrEqual(
        before + TOKEN_EXPIRY_MS
      );
      expect(player.tokenExpiresAt).toBeLessThanOrEqual(
        after + TOKEN_EXPIRY_MS
      );
    }
  });

  // --------------------------------------------------------------------------
  // Expiration Extension
  // --------------------------------------------------------------------------

  it("extends expiresAt by 2 weeks from now", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    // Create session with an expired expiresAt
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "COMPLETE",
          expiresAt: Date.now() - 1000, // already expired
        })
      )
    );

    const before = Date.now();
    await authT.mutation(api.sessions.resetSession, { sessionId });
    const after = Date.now();

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.expiresAt).toBeGreaterThanOrEqual(
      before + SESSION_EXPIRY_MS
    );
    expect(session?.expiresAt).toBeLessThanOrEqual(after + SESSION_EXPIRY_MS);
  });

  // --------------------------------------------------------------------------
  // Validation Errors
  // --------------------------------------------------------------------------

  it.each(["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED", "EXPIRED"] as const)(
    "rejects %s session (only COMPLETE allowed)",
    async (status) => {
      const { authT, sessionId } =
        await createAuthenticatedSessionInStatus(status);

      await expect(
        authT.mutation(api.sessions.resetSession, { sessionId })
      ).rejects.toThrow(/Cannot reset session in/);
    }
  );

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.resetSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });

  it("throws when not authenticated", async () => {
    const t = createTestContext();

    const sessionId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      return ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "COMPLETE" })
      );
    });

    await expect(
      t.mutation(api.sessions.resetSession, { sessionId })
    ).rejects.toThrow(/Authentication required/);
  });

  // --------------------------------------------------------------------------
  // Audit Logging
  // --------------------------------------------------------------------------

  it("creates SESSION_RESET audit log", async () => {
    const { t, authT, sessionId } = await createCompletedSession();

    await authT.mutation(api.sessions.resetSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_RESET");
  });
});

// ============================================================================
// cloneSession Tests (WAR-46)
// ============================================================================

describe("sessions.cloneSession", () => {
  /**
   * Create a session with players and maps suitable for clone testing.
   * Source session is IN_PROGRESS with BANNED/WINNER maps and votes.
   */
  async function createSessionForCloning(
    statusOverride: SessionStatus = "IN_PROGRESS"
  ) {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const { sessionId, playerIds, mapIds, voteIds } = await t.run(
      async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: statusOverride,
            matchName: "Grand Final",
            format: "ABBA",
            turnTimerSeconds: 45,
            mapPoolSize: 3,
            playerCount: 2,
            currentTurn: 3,
            currentRound: 2,
          })
        );

        // Seed timer/completion fields so we can verify they aren't cloned
        const now = Date.now();
        await ctx.db.patch(sessionId, {
          startedAt: now - 120_000,
          timerStartedAt: now - 30_000,
          timerPausedAt: now - 10_000,
          winnerMapId: undefined,
          isRevoteRound: true,
        });

        // Create master maps
        const masterMapIds = await Promise.all([
          ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
          ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
          ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
        ]);

        // Create session players
        const playerIds = await Promise.all([
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, {
              role: "Captain",
              teamName: "Team Alpha",
              isConnected: true,
              hasVotedThisRound: true,
            })
          ),
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, {
              role: "Vice Captain",
              teamName: "Team Beta",
              isConnected: true,
              hasVotedThisRound: true,
            })
          ),
        ]);

        // Create session maps: 1 BANNED, 1 WINNER, 1 AVAILABLE
        const mapIds = [
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[0], {
              name: "Map 1",
              state: "BANNED",
              bannedByPlayerId: playerIds[0],
              bannedAtTurn: 0,
              bannedAtRound: 1,
            })
          ),
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[1], {
              name: "Map 2",
              state: "WINNER",
            })
          ),
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sessionId, masterMapIds[2], {
              name: "Map 3",
              state: "AVAILABLE",
            })
          ),
        ];

        // Create votes
        const voteIds = [
          await ctx.db.insert(
            "votes",
            voteFactory(sessionId, playerIds[0], mapIds[0])
          ),
          await ctx.db.insert(
            "votes",
            voteFactory(sessionId, playerIds[1], mapIds[1])
          ),
        ];

        return { sessionId, playerIds, mapIds, voteIds };
      }
    );

    return { t, authT, adminId, sessionId, playerIds, mapIds, voteIds };
  }

  // --------------------------------------------------------------------------
  // Happy Path
  // --------------------------------------------------------------------------

  it("clones session into new DRAFT with ' (Copy)' suffix", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    expect(result.newSessionId).toBeDefined();
    expect(result.newSessionId).not.toBe(sessionId);

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.status).toBe("DRAFT");
    expect(newSession?.matchName).toBe("Grand Final (Copy)");
  });

  it("copies config fields: format, turnTimerSeconds, mapPoolSize, playerCount", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession).toMatchObject({
      format: "ABBA",
      turnTimerSeconds: 45,
      mapPoolSize: 3,
      playerCount: 2,
    });
  });

  it("sets createdBy to current admin (not source creator)", async () => {
    const { t, authT, adminId, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.createdBy).toBe(adminId);
  });

  it("sets fresh expiresAt (2 weeks from now)", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const before = Date.now();
    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });
    const after = Date.now();

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.expiresAt).toBeGreaterThanOrEqual(
      before + SESSION_EXPIRY_MS
    );
    expect(newSession?.expiresAt).toBeLessThanOrEqual(
      after + SESSION_EXPIRY_MS
    );
  });

  // --------------------------------------------------------------------------
  // Player Cloning
  // --------------------------------------------------------------------------

  it("creates new players with same roles and teamNames", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    expect(players).toHaveLength(2);
    const roles = players.map((p) => p.role).sort();
    const teams = players.map((p) => p.teamName).sort();
    expect(roles).toEqual(["Captain", "Vice Captain"]);
    expect(teams).toEqual(["Team Alpha", "Team Beta"]);
  });

  it("generates unique tokens different from source", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    // Get source tokens
    const sourceTokens = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );
    const sourceTokenSet = new Set(sourceTokens.map((p) => p.token));

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const clonedPlayers = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    // All tokens should be unique and different from source
    const clonedTokens = clonedPlayers.map((p) => p.token);
    const uniqueTokens = new Set(clonedTokens);
    expect(uniqueTokens.size).toBe(clonedTokens.length);
    for (const token of clonedTokens) {
      expect(sourceTokenSet.has(token)).toBe(false);
    }
  });

  it("sets isConnected=false and hasVotedThisRound=false", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    for (const player of players) {
      expect(player.isConnected).toBe(false);
      expect(player.hasVotedThisRound).toBe(false);
    }
  });

  it("sets tokenExpiresAt to 24 hours from now", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const before = Date.now();
    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });
    const after = Date.now();

    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    for (const player of players) {
      expect(player.tokenExpiresAt).toBeGreaterThanOrEqual(
        before + TOKEN_EXPIRY_MS
      );
      expect(player.tokenExpiresAt).toBeLessThanOrEqual(
        after + TOKEN_EXPIRY_MS
      );
    }
  });

  // --------------------------------------------------------------------------
  // Map Cloning
  // --------------------------------------------------------------------------

  it("creates sessionMaps with same mapId, name, imageUrl from source", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    // Get source maps for comparison
    const sourceMaps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const clonedMaps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    expect(clonedMaps).toHaveLength(sourceMaps.length);
    const sourceMapData = sourceMaps
      .map((m) => ({ mapId: m.mapId, name: m.name, imageUrl: m.imageUrl }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const clonedMapData = clonedMaps
      .map((m) => ({ mapId: m.mapId, name: m.name, imageUrl: m.imageUrl }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(clonedMapData).toEqual(sourceMapData);
  });

  it("resets all map states to AVAILABLE (even BANNED/WINNER sources)", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const clonedMaps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );

    expect(clonedMaps).toHaveLength(3);
    for (const map of clonedMaps) {
      expect(map.state).toBe("AVAILABLE");
      expect(map.bannedByPlayerId).toBeUndefined();
      expect(map.bannedAtTurn).toBeUndefined();
      expect(map.bannedAtRound).toBeUndefined();
      expect(map.voteCount).toBeUndefined();
      expect(map.submittedByAdmin).toBeUndefined();
    }
  });

  // --------------------------------------------------------------------------
  // Data Isolation
  // --------------------------------------------------------------------------

  it("does NOT copy votes to new session", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const votes = await t.run(async (ctx) =>
      ctx.db
        .query("votes")
        .withIndex("by_sessionId_and_round", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );
    expect(votes).toHaveLength(0);
  });

  it("new session has currentTurn=0, currentRound=1", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.currentTurn).toBe(0);
    expect(newSession?.currentRound).toBe(1);
  });

  it("new session has no timer state or completion fields", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.timerStartedAt).toBeUndefined();
    expect(newSession?.timerPausedAt).toBeUndefined();
    expect(newSession?.winnerMapId).toBeUndefined();
    expect(newSession?.completedAt).toBeUndefined();
    expect(newSession?.startedAt).toBeUndefined();
    expect(newSession?.isRevoteRound).toBeUndefined();
  });

  it("source session is unmodified after clone", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    // Snapshot source before clone
    const sourceBefore = await t.run(async (ctx) => ctx.db.get(sessionId));

    await authT.mutation(api.sessions.cloneSession, { sessionId });

    const sourceAfter = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(sourceAfter?.status).toBe(sourceBefore?.status);
    expect(sourceAfter?.matchName).toBe(sourceBefore?.matchName);
    expect(sourceAfter?.currentTurn).toBe(sourceBefore?.currentTurn);
    expect(sourceAfter?.currentRound).toBe(sourceBefore?.currentRound);
  });

  // --------------------------------------------------------------------------
  // Any Source Status
  // --------------------------------------------------------------------------

  it.each([
    "DRAFT",
    "WAITING",
    "IN_PROGRESS",
    "PAUSED",
    "COMPLETE",
    "EXPIRED",
  ] as const)("clones from %s status successfully", async (status) => {
    const { t, authT, sessionId } = await createSessionForCloning(status);

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    expect(result.newSessionId).toBeDefined();
    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.status).toBe("DRAFT");
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  it("truncates matchName when source + ' (Copy)' exceeds MAX_NAME_LENGTH", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const longName = "A".repeat(MAX_NAME_LENGTH);

    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { matchName: longName })
      )
    );

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    const newSession = await t.run(async (ctx) =>
      ctx.db.get(result.newSessionId)
    );
    expect(newSession?.matchName).toBe("A".repeat(93) + " (Copy)");
    expect(newSession?.matchName.length).toBe(MAX_NAME_LENGTH);
  });

  it("clones session with 0 players (empty DRAFT)", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("sessions", sessionFactory(adminId, { playerCount: 2 }))
    );

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    expect(result.newSessionId).toBeDefined();
    const players = await t.run(async (ctx) =>
      ctx.db
        .query("sessionPlayers")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );
    expect(players).toHaveLength(0);
  });

  it("clones session with 0 maps (empty DRAFT)", async () => {
    const { t, authT, adminId } = await createAuthenticatedAdmin();

    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("sessions", sessionFactory(adminId, { mapPoolSize: 3 }))
    );

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    expect(result.newSessionId).toBeDefined();
    const maps = await t.run(async (ctx) =>
      ctx.db
        .query("sessionMaps")
        .withIndex("by_sessionId", (q) =>
          q.eq("sessionId", result.newSessionId)
        )
        .collect()
    );
    expect(maps).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Audit Logging
  // --------------------------------------------------------------------------

  it("creates SESSION_CLONED audit log on source session", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    await authT.mutation(api.sessions.cloneSession, { sessionId });

    await expectAuditLog(t, sessionId, "SESSION_CLONED");
  });

  it("creates SESSION_CLONED audit log on new session", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    await expectAuditLog(t, result.newSessionId, "SESSION_CLONED");
  });

  it("audit details contain cross-reference session IDs", async () => {
    const { t, authT, sessionId } = await createSessionForCloning();

    const result = await authT.mutation(api.sessions.cloneSession, {
      sessionId,
    });

    // Source audit log should reference new session
    const sourceLog = await expectAuditLog(
      t,
      sessionId,
      "SESSION_CLONED",
      (log) => {
        const details = log.details as { reason?: string } | undefined;
        expect(details?.reason).toContain(result.newSessionId);
      }
    );
    expect(sourceLog).toBeDefined();

    // New session audit log should reference source session
    const newLog = await expectAuditLog(
      t,
      result.newSessionId,
      "SESSION_CLONED",
      (log) => {
        const details = log.details as { reason?: string } | undefined;
        expect(details?.reason).toContain(sessionId);
      }
    );
    expect(newLog).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Validation Errors
  // --------------------------------------------------------------------------

  it("throws when session not found", async () => {
    const { t, authT } = await createAuthenticatedAdmin();
    const deletedId = await createDeletedSessionId(t);

    await expect(
      authT.mutation(api.sessions.cloneSession, { sessionId: deletedId })
    ).rejects.toThrow(/Session not found/);
  });

  it("throws when not authenticated", async () => {
    const t = createTestContext();

    const sessionId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      return ctx.db.insert("sessions", sessionFactory(adminId));
    });

    await expect(
      t.mutation(api.sessions.cloneSession, { sessionId })
    ).rejects.toThrow(/Authentication required/);
  });
});
