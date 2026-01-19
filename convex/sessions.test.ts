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
} from "./test.factories";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SessionStatus } from "./lib/constants";

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

      // Create and delete an admin to get a valid but non-existent ID
      const deletedAdminId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("admins", adminFactory());
        await ctx.db.delete(id);
        return id;
      });

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

  describe("boundary values", () => {
    it("accepts minimum player count (2)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.playerCount).toBe(2);
    });

    it("accepts maximum player count (8)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 8,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.playerCount).toBe(8);
    });

    it("accepts minimum turn timer (10 seconds)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        turnTimerSeconds: 10,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(10);
    });

    it("accepts maximum turn timer (300 seconds)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        turnTimerSeconds: 300,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.turnTimerSeconds).toBe(300);
    });

    it("accepts minimum map pool size (3)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        mapPoolSize: 3,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(3);
    });

    it("accepts maximum map pool size (15)", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "Test",
        format: "ABBA",
        playerCount: 2,
        mapPoolSize: 15,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.mapPoolSize).toBe(15);
    });

    it("accepts single character match name", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: "A",
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe("A");
    });

    it("accepts exactly 100 character match name", async () => {
      const t = createTestContext();
      const adminId = await createAdmin(t);
      const maxName = "a".repeat(100);

      const { sessionId } = await t.mutation(api.sessions.createSession, {
        matchName: maxName,
        format: "ABBA",
        playerCount: 2,
        createdBy: adminId,
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.matchName).toBe(maxName);
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

      // Create sessions with different times to ensure order
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { matchName: "First" })
        );
      });

      // Small delay to ensure different creation times
      await new Promise((resolve) => setTimeout(resolve, 10));

      await t.run(async (ctx) => {
        const admin = await ctx.db.query("admins").first();
        await ctx.db.insert(
          "sessions",
          sessionFactory(admin!._id, { matchName: "Second" })
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

    it.each([
      ["DRAFT"],
      ["WAITING"],
      ["IN_PROGRESS"],
      ["PAUSED"],
      ["COMPLETE"],
      ["EXPIRED"],
    ] as const)("filters by %s status", async (status) => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert("sessions", sessionFactory(adminId, { status }));
        // Always add a COMPLETE session to have multiple sessions
        if (status !== "COMPLETE") {
          await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status: "COMPLETE" })
          );
        }
      });

      const result = await t.query(api.sessions.listSessions, {
        paginationOpts: { numItems: 10, cursor: null },
        status,
      });

      expect(result.page.length).toBeGreaterThanOrEqual(1);
      expect(result.page.every((s) => s.status === status)).toBe(true);
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

      // Create and delete a session to get a valid but non-existent ID
      const deletedSessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.delete(sessionId);
        return sessionId;
      });

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
      const { sessionId } = await createSessionInStatus(t, "DRAFT");

      const beforeUpdate = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await t.mutation(api.sessions.updateSession, {
        sessionId,
        matchName: "Updated",
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.updatedAt).toBeGreaterThan(beforeUpdate);
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
    it.each([["IN_PROGRESS"], ["PAUSED"], ["COMPLETE"], ["EXPIRED"]] as const)(
      "throws when updating session in %s state",
      async (status) => {
        const t = createTestContext();
        const { sessionId } = await createSessionInStatus(t, status);

        await expect(
          t.mutation(api.sessions.updateSession, {
            sessionId,
            matchName: "Updated",
          })
        ).rejects.toThrow(/Cannot update session/i);
      }
    );
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();

      const deletedSessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.delete(sessionId);
        return sessionId;
      });

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
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("state restrictions", () => {
    it.each([
      ["WAITING"],
      ["IN_PROGRESS"],
      ["PAUSED"],
      ["COMPLETE"],
      ["EXPIRED"],
    ] as const)("throws when deleting session in %s state", async (status) => {
      const t = createTestContext();
      const { sessionId } = await createSessionInStatus(t, status);

      await expect(
        t.mutation(api.sessions.deleteSession, { sessionId })
      ).rejects.toThrow(/Cannot delete session/i);
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();

      const deletedSessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.delete(sessionId);
        return sessionId;
      });

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
    it.each([["IN_PROGRESS"], ["PAUSED"], ["COMPLETE"], ["EXPIRED"]] as const)(
      "throws when assigning in %s state",
      async (status) => {
        const t = createTestContext();
        const { sessionId } = await createSessionInStatus(t, status);

        await t.run(async (ctx) => {
          await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
        });

        await expect(
          t.mutation(api.sessions.assignPlayer, {
            sessionId,
            role: "Captain",
            teamName: "Test Team",
          })
        ).rejects.toThrow(/Cannot assign players/i);
      }
    );
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();

      const deletedSessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
        await ctx.db.delete(sessionId);
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

      const { sessionId, mapIds, beforeUpdate } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds, beforeUpdate: Date.now() };
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.updatedAt).toBeGreaterThan(beforeUpdate);
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
    it.each([
      ["WAITING"],
      ["IN_PROGRESS"],
      ["PAUSED"],
      ["COMPLETE"],
      ["EXPIRED"],
    ] as const)("throws when setting maps in %s state", async (status) => {
      const t = createTestContext();

      const { sessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status, mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        return { sessionId, mapIds };
      });

      await expect(
        t.mutation(api.sessions.setSessionMaps, { sessionId, mapIds })
      ).rejects.toThrow(/Cannot set maps/i);
    });
  });

  describe("not found", () => {
    it("throws for non-existent session", async () => {
      const t = createTestContext();

      const { deletedSessionId, mapIds } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { mapPoolSize: 1 })
        );
        const mapIds = [await ctx.db.insert("maps", mapFactory())];
        await ctx.db.delete(sessionId);
        return { deletedSessionId: sessionId, mapIds };
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
  });
});
