/**
 * Session Cleanup Tests
 *
 * Tests for session cleanup internal mutations: clearSessionIpAddresses,
 * expireStaleSessions, and clearCompletedSessionIps.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  teamFactory,
} from "./test.factories";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

type TestContext = ReturnType<typeof createTestContext>;

/**
 * Creates a session with players that have IP addresses set.
 */
async function createSessionWithPlayers(
  t: TestContext,
  sessionOverrides: Parameters<typeof sessionFactory>[1] = {},
  playerConfigs: Array<{ ipAddress?: string }> = [{ ipAddress: "192.168.1.1" }]
): Promise<{
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
  playerIds: Id<"sessionPlayers">[];
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, sessionOverrides)
    );
    await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));

    const playerIds = await Promise.all(
      playerConfigs.map((config, index) =>
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            role: `Player ${index + 1}`,
            teamName: "Test Team",
            ipAddress: config.ipAddress,
          })
        )
      )
    );

    return { sessionId, adminId, playerIds };
  });
}

// ============================================================================
// clearSessionIpAddresses Tests
// ============================================================================

describe("sessionCleanup.clearSessionIpAddresses", () => {
  it("clears IP addresses from players with IPs", async () => {
    const t = createTestContext();
    const { sessionId, playerIds } = await createSessionWithPlayers(t, {}, [
      { ipAddress: "192.168.1.1" },
      { ipAddress: "192.168.1.2" },
    ]);

    const result = await t.mutation(internal.sessionCleanup.clearSessionIpAddresses, {
      sessionId,
    });

    expect(result.clearedCount).toBe(2);

    // Verify IPs are cleared
    const players = await t.run(async (ctx) =>
      Promise.all(playerIds.map((id) => ctx.db.get(id)))
    );

    expect(players[0]?.ipAddress).toBeUndefined();
    expect(players[1]?.ipAddress).toBeUndefined();
  });

  it("returns count of cleared IPs", async () => {
    const t = createTestContext();
    const { sessionId } = await createSessionWithPlayers(t, {}, [
      { ipAddress: "10.0.0.1" },
      { ipAddress: "10.0.0.2" },
      { ipAddress: "10.0.0.3" },
    ]);

    const result = await t.mutation(internal.sessionCleanup.clearSessionIpAddresses, {
      sessionId,
    });

    expect(result.clearedCount).toBe(3);
  });

  it("does nothing for players without IPs", async () => {
    const t = createTestContext();
    const { sessionId, playerIds } = await createSessionWithPlayers(t, {}, [
      { ipAddress: undefined },
      { ipAddress: undefined },
    ]);

    const result = await t.mutation(internal.sessionCleanup.clearSessionIpAddresses, {
      sessionId,
    });

    expect(result.clearedCount).toBe(0);

    // Verify players still exist
    const players = await t.run(async (ctx) =>
      Promise.all(playerIds.map((id) => ctx.db.get(id)))
    );

    expect(players[0]).toBeDefined();
    expect(players[1]).toBeDefined();
  });

  it("handles sessions with no players", async () => {
    const t = createTestContext();

    const sessionId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      return ctx.db.insert("sessions", sessionFactory(adminId));
    });

    const result = await t.mutation(internal.sessionCleanup.clearSessionIpAddresses, {
      sessionId,
    });

    expect(result.clearedCount).toBe(0);
  });

  it("handles mixed players (some with IPs, some without)", async () => {
    const t = createTestContext();
    const { sessionId, playerIds } = await createSessionWithPlayers(t, {}, [
      { ipAddress: "192.168.1.1" },
      { ipAddress: undefined },
      { ipAddress: "192.168.1.3" },
    ]);

    const result = await t.mutation(internal.sessionCleanup.clearSessionIpAddresses, {
      sessionId,
    });

    expect(result.clearedCount).toBe(2);

    // Verify only IPs that existed were cleared
    const players = await t.run(async (ctx) =>
      Promise.all(playerIds.map((id) => ctx.db.get(id)))
    );

    expect(players[0]?.ipAddress).toBeUndefined();
    expect(players[1]?.ipAddress).toBeUndefined();
    expect(players[2]?.ipAddress).toBeUndefined();
  });
});

// ============================================================================
// expireStaleSessions Tests
// ============================================================================

describe("sessionCleanup.expireStaleSessions", () => {
  it("expires DRAFT sessions past expiresAt", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "DRAFT",
          expiresAt: Date.now() - 1000, // Expired 1 second ago
        })
      );
      return { sessionId };
    });

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(1);

    // Verify session is now EXPIRED
    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("EXPIRED");
  });

  it("expires WAITING sessions past expiresAt", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "WAITING",
          expiresAt: Date.now() - 1000,
        })
      );
      return { sessionId };
    });

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(1);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("EXPIRED");
  });

  it("does NOT expire IN_PROGRESS sessions", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "IN_PROGRESS",
          expiresAt: Date.now() - 1000, // Expired, but should not be touched
        })
      );
      return { sessionId };
    });

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(0);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("IN_PROGRESS");
  });

  it("does NOT expire COMPLETE sessions", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "COMPLETE",
          expiresAt: Date.now() - 1000,
        })
      );
      return { sessionId };
    });

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(0);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("COMPLETE");
  });

  it("clears IP addresses when expiring", async () => {
    const t = createTestContext();

    const { playerIds } = await createSessionWithPlayers(
      t,
      {
        status: "DRAFT",
        expiresAt: Date.now() - 1000,
      },
      [{ ipAddress: "192.168.1.1" }, { ipAddress: "192.168.1.2" }]
    );

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(1);
    expect(result.ipsClearedCount).toBe(2);

    // Verify IPs are cleared
    const players = await t.run(async (ctx) =>
      Promise.all(playerIds.map((id) => ctx.db.get(id)))
    );

    expect(players[0]?.ipAddress).toBeUndefined();
    expect(players[1]?.ipAddress).toBeUndefined();
  });

  it("creates audit log entry on expiration", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "DRAFT",
          expiresAt: Date.now() - 1000,
        })
      );
      return { sessionId };
    });

    await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    // Verify audit log was created
    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect()
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("SESSION_EXPIRED");
    expect(logs[0].actorType).toBe("SYSTEM");
  });

  it("does not expire sessions not past expiresAt", async () => {
    const t = createTestContext();

    const { sessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "DRAFT",
          expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour in future
        })
      );
      return { sessionId };
    });

    const result = await t.mutation(internal.sessionCleanup.expireStaleSessions, {});

    expect(result.expiredCount).toBe(0);

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("DRAFT");
  });
});

// ============================================================================
// clearCompletedSessionIps Tests
// ============================================================================

describe("sessionCleanup.clearCompletedSessionIps", () => {
  it("clears IPs from COMPLETE sessions", async () => {
    const t = createTestContext();

    const { playerIds } = await createSessionWithPlayers(
      t,
      { status: "COMPLETE" },
      [{ ipAddress: "192.168.1.1" }, { ipAddress: "192.168.1.2" }]
    );

    const result = await t.mutation(internal.sessionCleanup.clearCompletedSessionIps, {});

    expect(result.sessionsProcessed).toBe(1);
    expect(result.ipsClearedCount).toBe(2);

    // Verify IPs are cleared
    const players = await t.run(async (ctx) =>
      Promise.all(playerIds.map((id) => ctx.db.get(id)))
    );

    expect(players[0]?.ipAddress).toBeUndefined();
    expect(players[1]?.ipAddress).toBeUndefined();
  });

  it("returns count of sessions processed and IPs cleared", async () => {
    const t = createTestContext();

    // Create multiple complete sessions with players
    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      await ctx.db.insert("teams", teamFactory({ name: "Team A" }));

      // Session 1 with 2 players with IPs
      const session1Id = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "COMPLETE" })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(session1Id, {
          teamName: "Team A",
          ipAddress: "10.0.0.1",
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(session1Id, {
          teamName: "Team A",
          ipAddress: "10.0.0.2",
        })
      );

      // Session 2 with 1 player with IP
      const session2Id = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "COMPLETE" })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(session2Id, {
          teamName: "Team A",
          ipAddress: "10.0.0.3",
        })
      );
    });

    const result = await t.mutation(internal.sessionCleanup.clearCompletedSessionIps, {});

    expect(result.sessionsProcessed).toBe(2);
    expect(result.ipsClearedCount).toBe(3);
  });

  it("does not count sessions without IPs", async () => {
    const t = createTestContext();

    await createSessionWithPlayers(
      t,
      { status: "COMPLETE" },
      [{ ipAddress: undefined }, { ipAddress: undefined }]
    );

    const result = await t.mutation(internal.sessionCleanup.clearCompletedSessionIps, {});

    expect(result.sessionsProcessed).toBe(0);
    expect(result.ipsClearedCount).toBe(0);
  });

  it("does not affect non-COMPLETE sessions", async () => {
    const t = createTestContext();

    const { playerIds } = await createSessionWithPlayers(
      t,
      { status: "IN_PROGRESS" },
      [{ ipAddress: "192.168.1.1" }]
    );

    const result = await t.mutation(internal.sessionCleanup.clearCompletedSessionIps, {});

    expect(result.sessionsProcessed).toBe(0);
    expect(result.ipsClearedCount).toBe(0);

    // Verify IP is still present
    const player = await t.run(async (ctx) => ctx.db.get(playerIds[0]));
    expect(player?.ipAddress).toBe("192.168.1.1");
  });
});
