/**
 * Session Cleanup Tests
 *
 * Tests for session cleanup internal mutations: clearSessionIpAddresses,
 * expireStaleSessions, clearCompletedSessionIps, and checkHeartbeatTimeouts.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  mapFactory,
  teamFactory,
} from "./test.factories";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { HEARTBEAT_TIMEOUT_MS } from "./lib/constants";

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

// ============================================================================
// handleTimerExpiry Tests (WAR-47)
// ============================================================================

/**
 * Creates a full ABBA session in IN_PROGRESS state with 2 players and maps.
 * Mirrors the pattern from voting.test.ts but returns IDs directly.
 */
async function createABBATimerSession(
  t: TestContext,
  overrides: {
    mapPoolSize?: number;
    currentTurn?: number;
    timerStartedAt?: number;
    timerPausedAt?: number;
    status?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    turnTimerSeconds?: number;
  } = {}
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const mapPoolSize = overrides.mapPoolSize ?? 5;
    const timerStartedAt = overrides.timerStartedAt ?? Date.now();
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        format: "ABBA",
        status: overrides.status ?? "IN_PROGRESS",
        mapPoolSize,
        playerCount: 2,
        currentTurn: overrides.currentTurn ?? 0,
        timerStartedAt,
        timerPausedAt: overrides.timerPausedAt,
        turnTimerSeconds: overrides.turnTimerSeconds ?? 30,
      })
    );

    // Create master maps and session maps
    const masterMapIds = await Promise.all(
      Array.from({ length: mapPoolSize }, (_, i) =>
        ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
      )
    );
    const mapIds = await Promise.all(
      masterMapIds.map((masterMapId, i) =>
        ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, masterMapId, {
            name: `Map ${i + 1}`,
            state: "AVAILABLE",
          })
        )
      )
    );

    // Create Player A first (consistent _creationTime ordering)
    const playerAId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        role: "PLAYER_A",
        teamName: "Team Alpha",
        ipAddress: "10.0.0.1",
      })
    );

    // Create Player B second
    const playerBId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        role: "PLAYER_B",
        teamName: "Team Beta",
        ipAddress: "10.0.0.2",
      })
    );

    return { sessionId, adminId, playerAId, playerBId, mapIds, timerStartedAt };
  });
}

/**
 * Creates a full MULTIPLAYER session in IN_PROGRESS state with N players and maps.
 */
async function createMultiplayerTimerSession(
  t: TestContext,
  overrides: {
    mapPoolSize?: number;
    playerCount?: number;
    currentRound?: number;
    isRevoteRound?: boolean;
    timerStartedAt?: number;
    timerPausedAt?: number;
    status?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    turnTimerSeconds?: number;
    playersVoted?: number[];
  } = {}
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const mapPoolSize = overrides.mapPoolSize ?? 5;
    const playerCount = overrides.playerCount ?? 3;
    const timerStartedAt = overrides.timerStartedAt ?? Date.now();
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        format: "MULTIPLAYER",
        status: overrides.status ?? "IN_PROGRESS",
        mapPoolSize,
        playerCount,
        currentRound: overrides.currentRound ?? 1,
        isRevoteRound: overrides.isRevoteRound ?? false,
        timerStartedAt,
        timerPausedAt: overrides.timerPausedAt,
        turnTimerSeconds: overrides.turnTimerSeconds ?? 30,
      })
    );

    // Create master maps and session maps
    const masterMapIds = await Promise.all(
      Array.from({ length: mapPoolSize }, (_, i) =>
        ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
      )
    );
    const mapIds = await Promise.all(
      masterMapIds.map((masterMapId, i) =>
        ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, masterMapId, {
            name: `Map ${i + 1}`,
            state: "AVAILABLE",
          })
        )
      )
    );

    // Create players
    const playersVotedSet = new Set(overrides.playersVoted ?? []);
    const playerIds: Id<"sessionPlayers">[] = [];
    for (let i = 0; i < playerCount; i++) {
      const playerId = await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          role: `PLAYER_${i + 1}`,
          teamName: `Team ${String.fromCharCode(65 + i)}`,
          ipAddress: `10.0.0.${i + 1}`,
          hasVotedThisRound: playersVotedSet.has(i),
        })
      );
      playerIds.push(playerId);
    }

    return { sessionId, adminId, playerIds, mapIds, timerStartedAt };
  });
}

describe("sessionCleanup.handleTimerExpiry", () => {
  // --------------------------------------------------------------------------
  // Guard / no-op tests
  // --------------------------------------------------------------------------

  describe("guard conditions (no-op)", () => {
    it("returns processed:false when session not found", async () => {
      const t = createTestContext();

      // Create and delete a session to get a valid but non-existent ID
      const deletedSessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const id = await ctx.db.insert("sessions", sessionFactory(adminId));
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId: deletedSessionId,
        expectedTimerStartedAt: Date.now(),
        format: "ABBA",
      });

      expect(result).toEqual({ processed: false });
    });

    it("returns processed:false when session is not IN_PROGRESS", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        status: "PAUSED",
        timerStartedAt,
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      expect(result).toEqual({ processed: false });
    });

    it("returns processed:false when timerStartedAt has changed", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        timerStartedAt,
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt - 1000, // Different from actual
        format: "ABBA",
      });

      expect(result).toEqual({ processed: false });
    });

    it("returns processed:false when timer is paused", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        timerStartedAt,
        timerPausedAt: Date.now(),
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      expect(result).toEqual({ processed: false });
    });
  });

  // --------------------------------------------------------------------------
  // ABBA auto-ban tests
  // --------------------------------------------------------------------------

  describe("ABBA format", () => {
    it("auto-bans a map for the active player (turn 0 → Player A)", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId, playerAId } = await createABBATimerSession(t, {
        timerStartedAt,
        currentTurn: 0,
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      expect(result).toEqual({ processed: true });

      // Verify one map was banned
      const bannedMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", sessionId).eq("state", "BANNED")
          )
          .collect()
      );
      expect(bannedMaps).toHaveLength(1);
      expect(bannedMaps[0].bannedByPlayerId).toBe(playerAId);

      // Verify session advanced to turn 1
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.currentTurn).toBe(1);
    });

    it("auto-bans for Player B on turn 1", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId, playerBId } = await createABBATimerSession(t, {
        timerStartedAt,
        currentTurn: 1,
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      expect(result).toEqual({ processed: true });

      const bannedMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", sessionId).eq("state", "BANNED")
          )
          .collect()
      );
      expect(bannedMaps).toHaveLength(1);
      expect(bannedMaps[0].bannedByPlayerId).toBe(playerBId);
    });

    it("completes session when last ban is made (mapPoolSize=3, turn 1 of 2 bans)", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        mapPoolSize: 3,
        currentTurn: 1,
        timerStartedAt,
      });

      // Ban map at turn 0 first via direct DB manipulation
      await t.run(async (ctx) => {
        const maps = await ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", sessionId).eq("state", "AVAILABLE")
          )
          .collect();
        await ctx.db.patch(maps[0]._id, { state: "BANNED", bannedAtTurn: 0 });
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      expect(result).toEqual({ processed: true });

      // Verify session is COMPLETE
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("COMPLETE");
      expect(session?.winnerMapId).toBeDefined();
    });

    it("logs TIMER_EXPIRED and MAP_BANNED audit events", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        timerStartedAt,
        currentTurn: 0,
      });

      await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("TIMER_EXPIRED");
      expect(actions).toContain("MAP_BANNED");

      // TIMER_EXPIRED log should have SYSTEM actor and AUTO_EXPIRED reason
      const timerLog = logs.find((l) => l.action === "TIMER_EXPIRED");
      expect(timerLog?.actorType).toBe("SYSTEM");
      expect(timerLog?.details).toMatchObject({ reason: "AUTO_EXPIRED" });

      // MAP_BANNED log should have SYSTEM actor and TIMER_EXPIRED reason
      const banLog = logs.find((l) => l.action === "MAP_BANNED");
      expect(banLog?.actorType).toBe("SYSTEM");
      expect(banLog?.details).toMatchObject({ reason: "TIMER_EXPIRED" });
    });

    it("does not mark ban as submittedByAdmin for system timer actions", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createABBATimerSession(t, {
        timerStartedAt,
      });

      await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "ABBA",
      });

      const bannedMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", sessionId).eq("state", "BANNED")
          )
          .collect()
      );
      expect(bannedMaps[0].submittedByAdmin).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // MULTIPLAYER auto-vote tests
  // --------------------------------------------------------------------------

  describe("MULTIPLAYER format", () => {
    it("auto-votes for all unvoted players", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId, playerIds } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 3,
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      expect(result).toEqual({ processed: true });

      // Verify vote records were created for all 3 players
      // (hasVotedThisRound may be reset by resolveRound advancing to next round)
      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );
      expect(votes).toHaveLength(3);

      // Each player should have exactly one vote
      const votedPlayerIds = votes.map((v) => v.playerId);
      for (const playerId of playerIds) {
        expect(votedPlayerIds).toContain(playerId);
      }
    });

    it("only auto-votes for unvoted players, preserves existing votes", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId, playerIds, mapIds } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 3,
        playersVoted: [0], // Player 0 already voted
      });

      // Insert a real vote for player 0
      await t.run(async (ctx) => {
        await ctx.db.insert("votes", {
          sessionId,
          round: 1,
          playerId: playerIds[0],
          mapId: mapIds[0],
          submittedAt: Date.now(),
          submittedByAdmin: false,
        });
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      expect(result).toEqual({ processed: true });

      // Verify votes: player 0's existing + 2 auto-votes = 3 total
      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );
      expect(votes).toHaveLength(3);

      // Player 0's vote should NOT have submittedByAdmin
      const player0Vote = votes.find(
        (v) => v.playerId === playerIds[0]
      );
      expect(player0Vote?.submittedByAdmin).toBe(false);

      // Other votes should NOT have submittedByAdmin (system timer, not admin)
      const autoVotes = votes.filter(
        (v) => v.playerId !== playerIds[0]
      );
      for (const vote of autoVotes) {
        expect(vote.submittedByAdmin).toBe(false);
      }
    });

    it("returns processed:false when all players already voted", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 2,
        playersVoted: [0, 1], // All voted
      });

      const result = await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      expect(result).toEqual({ processed: false });
    });

    it("triggers round resolution when last auto-vote completes", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      // 3 players, 5 maps — each votes for different map → 3 maps eliminated, 2 remain → next round
      const { sessionId } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 3,
        mapPoolSize: 5,
      });

      await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      // Verify round resolved — session should have advanced or completed
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      // With 3 players voting for random maps out of 5, at least some maps are banned.
      // The round should have resolved (currentRound advances or session completes).
      expect(
        session?.currentRound !== 1 || session?.status === "COMPLETE"
      ).toBe(true);
    });

    it("logs TIMER_EXPIRED and VOTE_SUBMITTED audit events", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 2,
      });

      await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("TIMER_EXPIRED");
      expect(actions).toContain("VOTE_SUBMITTED");

      // Verify TIMER_EXPIRED log
      const timerLog = logs.find((l) => l.action === "TIMER_EXPIRED");
      expect(timerLog?.actorType).toBe("SYSTEM");
      expect(timerLog?.details).toMatchObject({
        reason: expect.stringContaining("AUTO_EXPIRED"),
      });

      // Verify VOTE_SUBMITTED logs have SYSTEM actor
      const voteLogs = logs.filter((l) => l.action === "VOTE_SUBMITTED");
      expect(voteLogs).toHaveLength(2);
      for (const log of voteLogs) {
        expect(log.actorType).toBe("SYSTEM");
        expect(log.details).toMatchObject({ reason: "TIMER_EXPIRED" });
      }
    });

    it("auto-votes mark submittedByAdmin:false for system timer actions", async () => {
      const t = createTestContext();
      const timerStartedAt = Date.now();
      const { sessionId } = await createMultiplayerTimerSession(t, {
        timerStartedAt,
        playerCount: 2,
      });

      await t.mutation(internal.sessionCleanup.handleTimerExpiry, {
        sessionId,
        expectedTimerStartedAt: timerStartedAt,
        format: "MULTIPLAYER",
      });

      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );

      for (const vote of votes) {
        expect(vote.submittedByAdmin).toBe(false);
      }
    });
  });
});

// ============================================================================
// checkHeartbeatTimeouts Tests (WAR-49)
// ============================================================================

describe("sessionCleanup.checkHeartbeatTimeouts", () => {
  // --------------------------------------------------------------------------
  // Detection tests
  // --------------------------------------------------------------------------

  describe("detection", () => {
    it("marks stale connected player as disconnected", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerAId } = await createABBATimerSession(t);

      // Set player A as connected with a stale heartbeat
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(1);

      // Verify player is now disconnected
      const player = await t.run(async (ctx) => ctx.db.get(playerAId));
      expect(player?.isConnected).toBe(false);
    });

    it("skips players with fresh heartbeats", async () => {
      const t = createTestContext();
      const freshTime = Date.now() - 5000; // 5 seconds ago (well within timeout)
      const { playerAId } = await createABBATimerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: freshTime,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(0);

      const player = await t.run(async (ctx) => ctx.db.get(playerAId));
      expect(player?.isConnected).toBe(true);
    });

    it("skips connected player with undefined lastHeartbeat", async () => {
      const t = createTestContext();
      const { playerAId } = await createABBATimerSession(t);

      // Player is connected but has never completed a heartbeat cycle
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: undefined,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(0);

      const player = await t.run(async (ctx) => ctx.db.get(playerAId));
      expect(player?.isConnected).toBe(true);
    });

    it("skips already disconnected players", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerAId } = await createABBATimerSession(t);

      // Player is already disconnected (isConnected: false) with stale heartbeat
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: false,
          lastHeartbeat: staleTime,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(0);
    });

    it("does not disconnect player at exact threshold boundary", async () => {
      const t = createTestContext();
      const { playerAId } = await createABBATimerSession(t);

      // Set lastHeartbeat comfortably within the threshold to verify "still alive".
      // Add a 500ms buffer to absorb Date.now() drift between test and mutation handler.
      const now = Date.now();
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: now - HEARTBEAT_TIMEOUT_MS + 500,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(0);

      const player = await t.run(async (ctx) => ctx.db.get(playerAId));
      expect(player?.isConnected).toBe(true);
    });

    it("disconnects player 1ms past threshold boundary", async () => {
      const t = createTestContext();
      const { playerAId } = await createABBATimerSession(t);

      const now = Date.now();
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: now - HEARTBEAT_TIMEOUT_MS - 1,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.disconnectedPlayerCount).toBe(1);

      const player = await t.run(async (ctx) => ctx.db.get(playerAId));
      expect(player?.isConnected).toBe(false);
    });

    it("logs PLAYER_DISCONNECTED audit event", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerAId, sessionId } = await createABBATimerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      await t.mutation(internal.sessionCleanup.checkHeartbeatTimeouts, {});

      const auditLogs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const disconnectLog = auditLogs.find(
        (l) => l.action === "PLAYER_DISCONNECTED"
      );
      expect(disconnectLog).toBeDefined();
      expect(disconnectLog?.actorType).toBe("SYSTEM");
      expect(disconnectLog?.details?.teamName).toBe("Team Alpha");
    });
  });

  // --------------------------------------------------------------------------
  // ABBA auto-pause tests
  // --------------------------------------------------------------------------

  describe("ABBA auto-pause", () => {
    it("auto-pauses when any player disconnects", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerBId, sessionId } = await createABBATimerSession(t);

      // Player B disconnects (not the active turn player at turn 0)
      await t.run(async (ctx) => {
        await ctx.db.patch(playerBId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.pausedSessionCount).toBe(1);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("PAUSED");
    });

    it("sets timerPausedAt after auto-pause", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerAId, sessionId } = await createABBATimerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      await t.mutation(internal.sessionCleanup.checkHeartbeatTimeouts, {});

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.timerPausedAt).toBeDefined();
      expect(typeof session?.timerPausedAt).toBe("number");
    });

    it("logs SESSION_PAUSED with reason PLAYER_DISCONNECT", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerAId, sessionId } = await createABBATimerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      await t.mutation(internal.sessionCleanup.checkHeartbeatTimeouts, {});

      const auditLogs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const pauseLog = auditLogs.find((l) => l.action === "SESSION_PAUSED");
      expect(pauseLog).toBeDefined();
      expect(pauseLog?.actorType).toBe("SYSTEM");
      expect(pauseLog?.details?.reason).toBe("PLAYER_DISCONNECT");
    });
  });

  // --------------------------------------------------------------------------
  // MULTIPLAYER auto-pause tests
  // --------------------------------------------------------------------------

  describe("MULTIPLAYER auto-pause", () => {
    it("auto-pauses when unvoted player disconnects", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerIds, sessionId } = await createMultiplayerTimerSession(t);

      // Player 0 is connected with stale heartbeat and has NOT voted
      await t.run(async (ctx) => {
        await ctx.db.patch(playerIds[0], {
          isConnected: true,
          lastHeartbeat: staleTime,
          hasVotedThisRound: false,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.pausedSessionCount).toBe(1);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("PAUSED");
    });

    it("does NOT pause when already-voted player disconnects", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerIds, sessionId } = await createMultiplayerTimerSession(t);

      // Player 0 is connected with stale heartbeat but has already voted
      await t.run(async (ctx) => {
        await ctx.db.patch(playerIds[0], {
          isConnected: true,
          lastHeartbeat: staleTime,
          hasVotedThisRound: true,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      // Player should still be marked disconnected
      expect(result.disconnectedPlayerCount).toBe(1);
      // But session should NOT be paused
      expect(result.pausedSessionCount).toBe(0);

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("IN_PROGRESS");
    });

    it("disconnects multiple players simultaneously and pauses session once", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;
      const { playerIds, sessionId } = await createMultiplayerTimerSession(t, {
        playerCount: 3,
      });

      // Set 2 players as stale (connected with old heartbeat, unvoted)
      // Keep player 2 fresh
      await t.run(async (ctx) => {
        await ctx.db.patch(playerIds[0], {
          isConnected: true,
          lastHeartbeat: staleTime,
          hasVotedThisRound: false,
        });
        await ctx.db.patch(playerIds[1], {
          isConnected: true,
          lastHeartbeat: staleTime,
          hasVotedThisRound: false,
        });
        await ctx.db.patch(playerIds[2], {
          isConnected: true,
          lastHeartbeat: Date.now(),
          hasVotedThisRound: false,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      // Both stale players should be disconnected
      expect(result.disconnectedPlayerCount).toBe(2);
      // Session should be paused exactly once
      expect(result.pausedSessionCount).toBe(1);

      // Verify session status is PAUSED
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("PAUSED");

      // Verify player states
      const players = await t.run(async (ctx) =>
        Promise.all(playerIds.map((id) => ctx.db.get(id)))
      );
      expect(players[0]?.isConnected).toBe(false);
      expect(players[1]?.isConnected).toBe(false);
      expect(players[2]?.isConnected).toBe(true);

      // Verify 2 PLAYER_DISCONNECTED audit logs exist
      const auditLogs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const disconnectLogs = auditLogs.filter(
        (l) => l.action === "PLAYER_DISCONNECTED"
      );
      expect(disconnectLogs).toHaveLength(2);
      for (const log of disconnectLogs) {
        expect(log.actorType).toBe("SYSTEM");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("returns zeros when no IN_PROGRESS sessions exist", async () => {
      const t = createTestContext();

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result).toEqual({
        checkedSessionCount: 0,
        disconnectedPlayerCount: 0,
        pausedSessionCount: 0,
      });
    });

    it("handles multiple sessions with correct counts", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;

      // Session 1: ABBA with a stale player (should pause)
      const session1 = await createABBATimerSession(t);

      // Session 2: ABBA with all players fresh (should not pause)
      const session2 = await createABBATimerSession(t);

      // Make session 1 player A stale
      await t.run(async (ctx) => {
        await ctx.db.patch(session1.playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      // Make session 2 player A fresh
      await t.run(async (ctx) => {
        await ctx.db.patch(session2.playerAId, {
          isConnected: true,
          lastHeartbeat: Date.now(),
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.checkedSessionCount).toBe(2);
      expect(result.disconnectedPlayerCount).toBe(1);
      expect(result.pausedSessionCount).toBe(1);

      // Verify only session 1 is paused
      const s1 = await t.run(async (ctx) => ctx.db.get(session1.sessionId));
      const s2 = await t.run(async (ctx) => ctx.db.get(session2.sessionId));
      expect(s1?.status).toBe("PAUSED");
      expect(s2?.status).toBe("IN_PROGRESS");
    });

    it("does not process non-IN_PROGRESS sessions", async () => {
      const t = createTestContext();
      const staleTime = Date.now() - HEARTBEAT_TIMEOUT_MS - 1000;

      // Create an ABBA session in COMPLETE status — excluded by the by_status
      // index query, so it never enters the per-session loop.
      // Note: The true mid-processing race (session completes between disconnect
      // mark and pause) is guarded by the freshSession re-read (line 478) but
      // is impractical to reproduce in a single-threaded unit test.
      const { playerAId } = await createABBATimerSession(t, {
        status: "COMPLETE",
      });

      // Player has stale heartbeat
      await t.run(async (ctx) => {
        await ctx.db.patch(playerAId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        });
      });

      const result = await t.mutation(
        internal.sessionCleanup.checkHeartbeatTimeouts,
        {}
      );

      expect(result.checkedSessionCount).toBe(0);
      expect(result.pausedSessionCount).toBe(0);
    });
  });
});
