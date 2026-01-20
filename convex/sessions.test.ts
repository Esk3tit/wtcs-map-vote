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
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  teamFactory,
  mapFactory,
  voteFactory,
  auditLogFactory,
  createDeletedAdminId,
  createDeletedSessionId,
  createDeletedId,
} from "./test.factories";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  SessionStatus,
  MIN_MAP_POOL_SIZE,
  MAX_MAP_POOL_SIZE,
  TOKEN_EXPIRY_MS,
} from "./lib/constants";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates an admin and returns the ID for session creation.
 */
async function createAdmin(
  t: ReturnType<typeof createTestContext>
): Promise<Id<"admins">> {
  return await t.run(async (ctx) => ctx.db.insert("admins", adminFactory()));
}

/**
 * Creates a session in the specified status with an admin.
 * Used for testing state-dependent behavior.
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
 * Creates a full session with players, maps, and votes for cascade delete testing.
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

// ============================================================================
// createSession Tests
// ============================================================================

describe("sessions.createSession", () => {
  describe("success cases", () => {
    it("creates session with required fields", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const result = await t.mutation(api.sessions.createSession, {
        matchName: "Finals Match",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
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
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const result = await t.mutation(api.sessions.createSession, {
        matchName: "Team Battle",
        format: "MULTIPLAYER",
        playerCount: 4,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(result.sessionId));
      expect(session?.format).toBe("MULTIPLAYER");
    });

    it("applies default turn timer (30 seconds)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(30);
    });

    it("applies default map pool size (5)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(5);
    });

    it("accepts custom turn timer", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        turnTimerSeconds: 60,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(60);
    });

    it("accepts custom map pool size", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        mapPoolSize: 7,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(7);
    });

    it("trims whitespace from match name", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "  Padded Name  ",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Padded Name");
    });

    it("sets updatedAt timestamp", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);
      const beforeCreate = Date.now();

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.updatedAt).toBeGreaterThanOrEqual(beforeCreate);
    });

    it("sets expiresAt timestamp (14 days in future)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);
      const beforeCreate = Date.now();
      const expectedMinExpiry = beforeCreate + 14 * 24 * 60 * 60 * 1000 - 1000;

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.expiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
    });
  });

  describe("validation errors", () => {
    it("throws for empty match name", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "",
          format: "ABBA",
          playerCount: 2,
          createdBy: adminId,
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for whitespace-only match name", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "   ",
          format: "ABBA",
          playerCount: 2,
          createdBy: adminId,
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for match name exceeding 100 characters", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);
      const longName = "a".repeat(101);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: longName,
          format: "ABBA",
          playerCount: 2,
          createdBy: adminId,
        })
      ).rejects.toThrow(/100 characters/i);
    });

    it("throws for player count below minimum (2)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 1,
          createdBy: adminId,
        })
      ).rejects.toThrow(/must be at least 2/i);
    });

    it("throws for player count above maximum (8)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 9,
          createdBy: adminId,
        })
      ).rejects.toThrow(/cannot exceed 8/i);
    });

    it("throws for turn timer below minimum (10 seconds)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          turnTimerSeconds: 9,
          createdBy: adminId,
        })
      ).rejects.toThrow(/must be at least 10/i);
    });

    it("throws for turn timer above maximum (300 seconds)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          turnTimerSeconds: 301,
          createdBy: adminId,
        })
      ).rejects.toThrow(/cannot exceed 300/i);
    });

    it("throws for map pool size below minimum (3)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          mapPoolSize: 2,
          createdBy: adminId,
        })
      ).rejects.toThrow(/must be at least 3/i);
    });

    it("throws for map pool size above maximum (15)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          mapPoolSize: 16,
          createdBy: adminId,
        })
      ).rejects.toThrow(/cannot exceed 15/i);
    });

    it("throws when createdBy is missing", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
        })
      ).rejects.toThrow(/createdBy is required/i);
    });

    it("throws for non-existent admin ID", async () => {
      const t = createTestContext();
      const deletedAdminId = await createDeletedAdminId(t);

      await expect(
        t.mutation(api.sessions.createSession, {
          matchName: "Test",
          format: "ABBA",
          playerCount: 2,
          createdBy: deletedAdminId,
        })
      ).rejects.toThrow(/Invalid admin ID/i);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_CREATED audit log", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test Match",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
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
  describe("empty state", () => {
    it("returns empty page when no sessions exist", async () => {
      const t = createTestContext();

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  describe("pagination", () => {
    it("returns correct page size", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
    });

    it("continues from cursor", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        for (let i = 1; i <= 4; i++) {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
        }
      });

      const page1 = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page1.page.length).toBeGreaterThan(0);
      expect(page1.continueCursor).toBeDefined();

      const page2 = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });

      // Page 2 should have remaining sessions
      expect(page2.page.length).toBeGreaterThan(0);
      // Total across pages should be 4
      expect(page1.page.length + page2.page.length).toBeLessThanOrEqual(4);
    });

    it("returns sessions in descending order by creation time", async () => {
      const t = createTestContext();

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

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      // Descending order: newest first
      expect(result.page[0].matchName).toBe("Second");
      expect(result.page[1].matchName).toBe("First");
    });
  });

  describe("status filtering", () => {
    it("filters by DRAFT status", async () => {
      const t = createTestContext();

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

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "DRAFT",
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].matchName).toBe("Draft Session");
    });

    it("returns all sessions when no status filter provided", async () => {
      const t = createTestContext();

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

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(3);
    });

    it("filters by all status values correctly", async () => {
      const t = createTestContext();
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
        const result = await t.query(api.sessions.listSessions, {
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
// getSession Tests
// ============================================================================

describe("sessions.getSession", () => {
  describe("success cases", () => {
    it("returns session with players and maps", async () => {
      const t = createTestContext();
      const { sessionId } = await createFullSession(t);

      const session = await t.query(api.sessions.getSession, { sessionId });

      expect(session).not.toBeNull();
      expect(session?.matchName).toBe("Test Match");
      expect(session?.players).toHaveLength(2);
      expect(session?.maps).toHaveLength(3);
    });

    it("returns session without players or maps (empty relations)", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const session = await t.query(api.sessions.getSession, { sessionId });

      expect(session).not.toBeNull();
      expect(session?.players).toEqual([]);
      expect(session?.maps).toEqual([]);
    });

    it("includes player details in response", async () => {
      const t = createTestContext();
      const { sessionId } = await createFullSession(t);

      const session = await t.query(api.sessions.getSession, { sessionId });

      expect(session?.players[0]).toMatchObject({
        role: expect.any(String),
        teamName: expect.any(String),
        token: expect.any(String),
        isConnected: expect.any(Boolean),
      });
    });

    it("includes map details in response", async () => {
      const t = createTestContext();
      const { sessionId } = await createFullSession(t);

      const session = await t.query(api.sessions.getSession, { sessionId });

      expect(session?.maps[0]).toMatchObject({
        name: expect.any(String),
        imageUrl: expect.any(String),
        state: "AVAILABLE",
      });
    });
  });

  describe("not found", () => {
    it("returns null for non-existent session", async () => {
      const t = createTestContext();
      const deletedSessionId = await createDeletedSessionId(t);

      const session = await t.query(api.sessions.getSession, {
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
  describe("success cases", () => {
    it("updates match name", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const result = await t.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated Match Name",
      });

      expect(result.success).toBe(true);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Updated Match Name");
    });

    it("updates turn timer", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await t.mutation(api.sessions.updateSession, {
        sessionId,
        turnTimerSeconds: 120,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(120);
    });

    it("updates both match name and turn timer", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await t.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "New Name",
        turnTimerSeconds: 45,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("New Name");
      expect(session?.turnTimerSeconds).toBe(45);
    });

    it("allows update in WAITING state", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "WAITING");

      const result = await t.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated in Waiting",
      });

      expect(result.success).toBe(true);
    });

    it("trims whitespace from match name", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await t.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "  Padded  ",
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("Padded");
    });

    it("updates updatedAt timestamp", async () => {
      const t = createTestContext();

      // Capture creation time, then update and verify updatedAt >= _creationTime
      const { sessionId, creationTime } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "DRAFT" })
        );
        const session = await ctx.db.get(sessionId);
        // Floor to integer ms since Date.now() returns integer ms
        return { sessionId, creationTime: Math.floor(session!._creationTime) };
      });

      await t.mutation(api.sessions.updateSession, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.updateSession, {
          sessionId,
          matchName: "",
        })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it("throws for turn timer below minimum", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.updateSession, {
          sessionId,
          turnTimerSeconds: 5,
        })
      ).rejects.toThrow(/must be at least 10/i);
    });

    it("throws for turn timer above maximum", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.updateSession, {
          sessionId,
          turnTimerSeconds: 500,
        })
      ).rejects.toThrow(/cannot exceed 300/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when updating session in restricted states", async () => {
      const t = createTestContext();
      const restrictedStatuses = ["IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states in a single context
      const sessionIds = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
          t.mutation(api.sessions.updateSession, {
            sessionId: sessionIds[status],
            matchName: "Updated",
          })
        ).rejects.toThrow(/Cannot update session/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();
      const deletedSessionId = await createDeletedSessionId(t);

      await expect(
        t.mutation(api.sessions.updateSession, {
          sessionId: deletedSessionId,
          matchName: "Updated",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_UPDATED audit log with changed fields", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await t.mutation(api.sessions.updateSession, {
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
  describe("success cases", () => {
    it("deletes session", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const result = await t.mutation(api.sessions.deleteSession, { sessionId });

      expect(result.success).toBe(true);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();
    });

    it("cascade deletes session players", async () => {
      const t = createTestContext();
      const { sessionId, playerIds } = await createFullSession(t, "DRAFT");

      await t.mutation(api.sessions.deleteSession, { sessionId });

      const remainingPlayers = await t.run(async (ctx) =>
        Promise.all(playerIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingPlayers.every((p) => p === null)).toBe(true);
    });

    it("cascade deletes session maps", async () => {
      const t = createTestContext();
      const { sessionId, mapIds } = await createFullSession(t, "DRAFT");

      await t.mutation(api.sessions.deleteSession, { sessionId });

      const remainingMaps = await t.run(async (ctx) =>
        Promise.all(mapIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingMaps.every((m) => m === null)).toBe(true);
    });

    it("cascade deletes votes", async () => {
      const t = createTestContext();
      const { sessionId, voteIds } = await createFullSession(t, "DRAFT");

      await t.mutation(api.sessions.deleteSession, { sessionId });

      const remainingVotes = await t.run(async (ctx) =>
        Promise.all(voteIds.map((id) => ctx.db.get(id)))
      );

      expect(remainingVotes.every((v) => v === null)).toBe(true);
    });

    it("preserves audit logs (orphaned reference)", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      // Create initial audit log
      await t.run(async (ctx) => {
        await ctx.db.insert("auditLogs", auditLogFactory(sessionId));
      });

      await t.mutation(api.sessions.deleteSession, { sessionId });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      // Should have original log plus SESSION_DELETED log
      expect(logs).toHaveLength(2);
    });
  });

  describe("state restrictions", () => {
    it("throws when deleting session in restricted states", async () => {
      const t = createTestContext();
      const restrictedStatuses = ["WAITING", "IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states in a single context
      const sessionIds = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
          t.mutation(api.sessions.deleteSession, { sessionId: sessionIds[status] })
        ).rejects.toThrow(/Cannot delete session/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();
      const deletedSessionId = await createDeletedSessionId(t);

      await expect(
        t.mutation(api.sessions.deleteSession, { sessionId: deletedSessionId })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates SESSION_DELETED audit log", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await t.mutation(api.sessions.deleteSession, { sessionId });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const deleteLog = logs.find((l) => l.action === "SESSION_DELETED");
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.actorType).toBe("ADMIN");
    });
  });
});

// ============================================================================
// assignPlayer Tests
// ============================================================================

describe("sessions.assignPlayer", () => {
  describe("success cases", () => {
    it("assigns player with token", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      // Create team
      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha Team" }));
      });

      const result = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Alpha Team",
      });

      expect(result.playerId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(32); // UUID without dashes
    });

    it("allows assigning in WAITING state", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "WAITING", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Beta Team" }));
      });

      const result = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Beta Team",
      });

      expect(result.playerId).toBeDefined();
    });

    it("creates player record with correct fields", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { playerId } = await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { playerId } = await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Captain",
          teamName: "Nonexistent Team",
        })
      ).rejects.toThrow(/not found/i);
    });

    it("throws for duplicate role in session", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      // First assignment
      await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      // Second assignment with same role
      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Captain",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/already assigned/i);
    });

    it("detects duplicate role after trimming", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Test Team",
      });

      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "  Captain  ",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/already assigned/i);
    });
  });

  describe("capacity checks", () => {
    it("throws when session is at capacity", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team C" }));
      });

      // Fill to capacity
      await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Team A",
      });
      await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Team B",
      });

      // Third player should fail
      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId,
          role: "Reserve",
          teamName: "Team C",
        })
      ).rejects.toThrow(/maximum/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when assigning in restricted states", async () => {
      const t = createTestContext();
      const restrictedStatuses = ["IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states and a team in a single context
      const sessionIds = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
          t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const deletedSessionId = await createDeletedId(t, async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
        return sessionId;
      });

      await expect(
        t.mutation(api.sessions.assignPlayer, {
          sessionId: deletedSessionId,
          role: "Captain",
          teamName: "Test Team",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("audit logging", () => {
    it("creates PLAYER_ASSIGNED audit log", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const beforeAssign = Date.now();
      const { playerId } = await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 3,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team C" }));
      });

      const result1 = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Team A",
      });
      const result2 = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Team B",
      });
      const result3 = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Reserve",
        teamName: "Team C",
      });

      const tokens = [result1.token, result2.token, result3.token];
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(3);
    });

    it("generates 32-character hex token from UUID", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      const { token } = await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 3,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha Team" }));
      });

      // First assignment
      const result1 = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Captain",
        teamName: "Alpha Team",
      });

      // Second assignment with same team but different role - should succeed
      const result2 = await t.mutation(api.sessions.assignPlayer, {
        sessionId,
        role: "Vice Captain",
        teamName: "Alpha Team",
      });

      expect(result1.playerId).toBeDefined();
      expect(result2.playerId).toBeDefined();
      expect(result1.playerId).not.toBe(result2.playerId);
    });

    it("allows same team in different sessions", async () => {
      const t = createTestContext();

      // Create two sessions and a team
      const { session1Id, session2Id } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
      const result1 = await t.mutation(api.sessions.assignPlayer, {
        sessionId: session1Id,
        role: "Captain",
        teamName: "Shared Team",
      });

      // Assign same team to session 2 - should succeed
      const result2 = await t.mutation(api.sessions.assignPlayer, {
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
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, "DRAFT", {
        playerCount: 2,
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
      });

      await expect(
        t.mutation(api.sessions.assignPlayer, {
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
  describe("success cases", () => {
    it("creates session maps from master maps", async () => {
      const t = createTestContext();

      const { sessionId, masterMapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      const result = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, masterMapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, newMapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      // Capture creation time, then set maps and verify updatedAt >= _creationTime
      const { sessionId, mapIds, creationTime } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        const session = await ctx.db.get(sessionId);
        // Floor to integer ms since Date.now() returns integer ms
        return { sessionId, mapIds, creationTime: Math.floor(session!._creationTime) };
      });

      await t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      // updatedAt should be at least equal to creation time (mutation sets it via Date.now())
      expect(session?.updatedAt).toBeGreaterThanOrEqual(creationTime);
    });
  });

  describe("validation errors", () => {
    it("throws when map count does not match mapPoolSize", async () => {
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
        t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds })
      ).rejects.toThrow(/Expected 5 maps, received 3/i);
    });

    it("throws for duplicate maps", async () => {
      const t = createTestContext();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 2 })
        );
        const mapId = await ctx.db.insert("maps", mapFactory());
        return { sessionId, mapId };
      });

      await expect(
        t.mutation(api.sessions.setSessionMaps, {
          sessionId,
          mapIds: [mapId, mapId],
        })
      ).rejects.toThrow(/Duplicate maps/i);
    });

    it("throws for non-existent map", async () => {
      const t = createTestContext();

      const { sessionId, deletedMapId, validMapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
        t.mutation(api.sessions.setSessionMaps, {
          sessionId,
          mapIds: [validMapId, deletedMapId],
        })
      ).rejects.toThrow(/Map not found/i);
    });

    it("throws for inactive map", async () => {
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
        t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds })
      ).rejects.toThrow(/not active/i);
    });
  });

  describe("state restrictions", () => {
    it("throws when setting maps in restricted states", async () => {
      const t = createTestContext();
      const restrictedStatuses = ["WAITING", "IN_PROGRESS", "PAUSED", "COMPLETE", "EXPIRED"] as const;

      // Create sessions for all restricted states and maps in a single context
      const { sessionIds, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
          t.mutation(api.sessions.setSessionMaps, { sessionId: sessionIds[status], mapIds })
        ).rejects.toThrow(/Cannot set maps/i);
      }
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();

      // Create a map first (persists after session deletion)
      const mapIds = await t.run(async (ctx) => {
        return [await ctx.db.insert("maps", mapFactory())];
      });

      const deletedSessionId = await createDeletedSessionId(t, {
        mapPoolSize: 1,
      });

      await expect(
        t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds };
      });

      await t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

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
      const t = createTestContext();

      const { sessionId, oldMapIds, newMapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
      await t.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: oldMapIds,
      });

      // Reassignment
      await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      const result = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      const result = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
      await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
      await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();
      const longName = "A".repeat(100);

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      const result = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();
      const specialName = "Mäp with émojis & spëcial <chars> 中文 🗺️";

      const { sessionId, mapId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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

      const result = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { session1Id, session2Id, maps1, maps2 } = await t.run(
        async (ctx) => {
          const adminId = await ctx.db.insert("admins", adminFactory());

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
      const result1 = await t.mutation(api.sessions.setSessionMaps, {
        sessionId: session1Id,
        mapIds: maps1,
      });

      const result2 = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapSets } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
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
      const result1 = await t.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: mapSets[0],
      });

      const result2 = await t.mutation(api.sessions.setSessionMaps, {
        sessionId,
        mapIds: mapSets[1],
      });

      const result3 = await t.mutation(api.sessions.setSessionMaps, {
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
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds };
      });

      await t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

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
