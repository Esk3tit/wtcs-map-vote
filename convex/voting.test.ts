/**
 * Voting Module Tests
 *
 * Tests for ABBA ban submission, MULTIPLAYER vote submission,
 * and admin vote-on-behalf: validation errors, happy path,
 * completion logic, and audit logging.
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedAdmin } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  mapFactory,
  voteFactory,
} from "./test.factories";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

type TestContext = ReturnType<typeof createTestContext>;

interface ABBASessionData {
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
  playerA: { id: Id<"sessionPlayers">; token: string };
  playerB: { id: Id<"sessionPlayers">; token: string };
  mapIds: Id<"sessionMaps">[];
}

/**
 * Executes the full 4-ban ABBA sequence (A, B, B, A) using the first 4 map IDs.
 * Returns the result of the final ban (which triggers completion).
 */
async function completeABBAFlow(t: TestContext, session: ABBASessionData) {
  const { playerA, playerB, mapIds } = session;

  // Turn 0: Player A bans Map 1
  await t.mutation(internal.voting.submitBan, {
    token: playerA.token, mapId: mapIds[0], ipAddress: "10.0.0.1",
  });
  // Turn 1: Player B bans Map 2
  await t.mutation(internal.voting.submitBan, {
    token: playerB.token, mapId: mapIds[1], ipAddress: "10.0.0.2",
  });
  // Turn 2: Player B bans Map 3
  await t.mutation(internal.voting.submitBan, {
    token: playerB.token, mapId: mapIds[2], ipAddress: "10.0.0.2",
  });
  // Turn 3: Player A bans Map 4 (triggers completion)
  const result = await t.mutation(internal.voting.submitBan, {
    token: playerA.token, mapId: mapIds[3], ipAddress: "10.0.0.1",
  });

  return result;
}

/**
 * Creates a full ABBA session in IN_PROGRESS state with 2 players and 5 maps.
 * Player A is created first for consistent _creationTime ordering.
 */
async function createABBASession(
  t: TestContext,
  overrides: {
    adminId?: Id<"admins">;
    sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    format?: "ABBA" | "MULTIPLAYER";
    mapPoolSize?: number;
    currentTurn?: number;
    playerAIp?: string;
    playerBIp?: string;
    tokenExpiresAt?: number;
    timerStartedAt?: number;
    timerPausedAt?: number;
  } = {}
): Promise<ABBASessionData> {
  return await t.run(async (ctx) => {
    const adminId = overrides.adminId ?? await ctx.db.insert("admins", adminFactory());
    const mapPoolSize = overrides.mapPoolSize ?? 5;
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        format: overrides.format ?? "ABBA",
        status: overrides.sessionStatus ?? "IN_PROGRESS",
        mapPoolSize,
        playerCount: 2,
        currentTurn: overrides.currentTurn ?? 0,
        timerStartedAt: overrides.timerStartedAt,
        timerPausedAt: overrides.timerPausedAt,
      })
    );

    // Create master maps
    const masterMapIds = await Promise.all(
      Array.from({ length: mapPoolSize }, (_, i) =>
        ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
      )
    );

    // Create session maps (snapshot from master pool)
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
    const tokenA = crypto.randomUUID();
    const playerAId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        token: tokenA,
        role: "PLAYER_A",
        teamName: "Team Alpha",
        ipAddress: overrides.playerAIp ?? "10.0.0.1",
        isConnected: true,
        tokenExpiresAt: overrides.tokenExpiresAt,
      })
    );

    // Create Player B second
    const tokenB = crypto.randomUUID();
    const playerBId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        token: tokenB,
        role: "PLAYER_B",
        teamName: "Team Beta",
        ipAddress: overrides.playerBIp ?? "10.0.0.2",
        isConnected: true,
        tokenExpiresAt: overrides.tokenExpiresAt,
      })
    );

    return {
      sessionId,
      adminId,
      playerA: { id: playerAId, token: tokenA },
      playerB: { id: playerBId, token: tokenB },
      mapIds,
    };
  });
}

// ============================================================================
// submitBan - Validation Errors
// ============================================================================

describe("voting.submitBan", () => {
  describe("validation errors", () => {
    it("rejects invalid token", async () => {
      const t = createTestContext();
      const { mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: "nonexistent-token",
        mapId: mapIds[0], // Use a real map ID; token validation fails first
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_TOKEN" });
    });

    it("rejects empty IP address", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_IP" });
    });

    it("rejects unknown IP address", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "unknown",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_IP" });
    });

    it("rejects expired token", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t, {
        tokenExpiresAt: Date.now() - 1000, // Already expired
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "TOKEN_EXPIRED" });
    });

    it("rejects IP mismatch", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "99.99.99.99", // Different from locked IP (10.0.0.1)
      });

      expect(result).toEqual({ status: "error", error: "IP_MISMATCH" });
    });

    it.each(["DRAFT", "WAITING", "PAUSED", "COMPLETE", "EXPIRED"] as const)(
      "rejects when session is not IN_PROGRESS (%s)",
      async (sessionStatus) => {
        const t = createTestContext();
        const { playerA, mapIds } = await createABBASession(t, {
          sessionStatus,
        });

        const result = await t.mutation(internal.voting.submitBan, {
          token: playerA.token,
          mapId: mapIds[0],
          ipAddress: "10.0.0.1",
        });

        expect(result).toEqual({ status: "error", error: "SESSION_NOT_IN_PROGRESS" });
      }
    );

    it("rejects ban when session has passed expiresAt even if status is still IN_PROGRESS", async () => {
      const t = createTestContext();
      // Create an ABBA session with expiresAt in the past but status still IN_PROGRESS
      const session = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 2,
            currentTurn: 0,
            expiresAt: Date.now() - 1000, // 1 second in the past
          })
        );

        const masterMapIds = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
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

        const tokenA = crypto.randomUUID();
        const playerAId = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: tokenA,
            role: "PLAYER_1",
            teamName: "Team A",
            ipAddress: "10.0.0.1",
            isConnected: true,
          })
        );

        return {
          sessionId,
          playerA: { id: playerAId, token: tokenA },
          mapIds,
        };
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: session.playerA.token,
        mapId: session.mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "SESSION_NOT_IN_PROGRESS" });
    });

    it("rejects when format is MULTIPLAYER (not ABBA)", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t, {
        format: "MULTIPLAYER",
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "FORMAT_NOT_ABBA" });
    });

    it("rejects when it's not the player's turn (Player B on turn 0)", async () => {
      const t = createTestContext();
      const { playerB, mapIds } = await createABBASession(t);
      // Turn 0 = Player A's turn (ABBA pattern [0,1,1,0])

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.2",
      });

      expect(result).toEqual({ status: "error", error: "NOT_YOUR_TURN" });
    });

    it("rejects when it's not the player's turn (Player A on turn 1)", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t, {
        currentTurn: 1,
      });
      // Turn 1 = Player B's turn

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "NOT_YOUR_TURN" });
    });

    it("rejects when target map is already BANNED", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      // Manually ban the first map
      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "BANNED" });
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });

    it("rejects when target map belongs to a different session", async () => {
      const t = createTestContext();
      const session1 = await createABBASession(t);

      // Create a second session with its own maps
      const otherMapId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory({ email: "other@test.com" }));
        const otherSessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 2,
          })
        );
        const masterMapId = await ctx.db.insert("maps", mapFactory({ name: "Other Map" }));
        return await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(otherSessionId, masterMapId, {
            name: "Other Map",
            state: "AVAILABLE",
          })
        );
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: session1.playerA.token,
        mapId: otherMapId,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });

    it("rejects when target map state is WINNER", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "WINNER" });
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });
  });

  // ============================================================================
  // submitBan - Happy Path
  // ============================================================================

  describe("happy path", () => {
    it("Player A bans a map on turn 0", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.banned.mapId).toBe(mapIds[0]);
      expect(result.banned.mapName).toBe("Map 1");
      expect(result.banned.turn).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.winnerMapId).toBeUndefined();
    });

    it("Player B bans a map on turn 1", async () => {
      const t = createTestContext();
      const { playerA, playerB, mapIds } = await createABBASession(t);

      // Turn 0: Player A bans
      await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      // Turn 1: Player B bans
      const result = await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[1],
        ipAddress: "10.0.0.2",
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.banned.mapId).toBe(mapIds[1]);
      expect(result.banned.turn).toBe(1);
      expect(result.isComplete).toBe(false);
    });

    it("Player B bans again on turn 2 (ABBA pattern)", async () => {
      const t = createTestContext();
      const { playerA, playerB, mapIds } = await createABBASession(t);

      // Turn 0: Player A
      await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });
      // Turn 1: Player B
      await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[1],
        ipAddress: "10.0.0.2",
      });

      // Turn 2: Player B again
      const result = await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[2],
        ipAddress: "10.0.0.2",
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.banned.turn).toBe(2);
      expect(result.isComplete).toBe(false);
    });

    it("updates sessionMap state and metadata on ban", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      const map = await t.run(async (ctx) => ctx.db.get(mapIds[0]));
      expect(map?.state).toBe("BANNED");
      expect(map?.bannedByPlayerId).toBe(playerA.id);
      expect(map?.bannedAtTurn).toBe(0);
    });

    it("increments session currentTurn after ban", async () => {
      const t = createTestContext();
      const { sessionId, playerA, mapIds } = await createABBASession(t);

      await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.currentTurn).toBe(1);
    });
  });

  // ============================================================================
  // submitBan - Full ABBA Flow & Completion
  // ============================================================================

  describe("completion logic", () => {
    it("completes full ABBA flow: 4 bans → winner declared", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);
      const { sessionId, mapIds } = session;

      const result = await completeABBAFlow(t, session);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.isComplete).toBe(true);
      expect(result.winnerMapId).toBe(mapIds[4]);

      // Verify session is COMPLETE
      const dbSession = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.winnerMapId).toBe(mapIds[4]);
      expect(dbSession?.completedAt).toBeDefined();
      expect(dbSession?.currentTurn).toBe(4);

      // Verify map states
      const maps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );
      const banned = maps.filter((m) => m.state === "BANNED");
      const winners = maps.filter((m) => m.state === "WINNER");
      expect(banned).toHaveLength(4);
      expect(winners).toHaveLength(1);
      expect(winners[0]._id).toBe(mapIds[4]);
    });

    it("session transitions to COMPLETE with completedAt timestamp", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);
      const beforeComplete = Date.now();

      await completeABBAFlow(t, session);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.completedAt).toBeGreaterThanOrEqual(beforeComplete);
    });

    it("winning map is marked as WINNER state", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);

      await completeABBAFlow(t, session);

      const winnerMap = await t.run(async (ctx) => ctx.db.get(session.mapIds[4]));
      expect(winnerMap?.state).toBe("WINNER");
    });

    it("rejects ban after session is already COMPLETE", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);

      // Complete the session
      await completeABBAFlow(t, session);

      // Try to ban after completion
      const result = await t.mutation(internal.voting.submitBan, {
        token: session.playerA.token,
        mapId: session.mapIds[4],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "SESSION_NOT_IN_PROGRESS" });
    });

    it("works with non-standard pool size (3 maps = 2 bans)", async () => {
      const t = createTestContext();
      const { sessionId, playerA, playerB, mapIds } = await createABBASession(t, {
        mapPoolSize: 3,
      });

      // Turn 0: Player A bans Map 1
      const r1 = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });
      expect(r1.status).toBe("ok");
      if (r1.status !== "ok") throw new Error("Expected ok");
      expect(r1.isComplete).toBe(false);

      // Turn 1: Player B bans Map 2 → triggers completion (2 bans needed for 3 maps)
      const r2 = await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[1],
        ipAddress: "10.0.0.2",
      });
      expect(r2.status).toBe("ok");
      if (r2.status !== "ok") throw new Error("Expected ok");
      expect(r2.isComplete).toBe(true);
      expect(r2.winnerMapId).toBe(mapIds[2]);

      // Verify session completed
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("COMPLETE");
      expect(session?.currentTurn).toBe(2);
    });
  });

  // ============================================================================
  // submitBan - Audit Logging
  // ============================================================================

  describe("audit logging", () => {
    it("logs MAP_BANNED for each ban with correct details", async () => {
      const t = createTestContext();
      const { sessionId, playerA, mapIds } = await createABBASession(t);

      await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const banLog = logs.find((l) => l.action === "MAP_BANNED");
      expect(banLog).toBeDefined();
      expect(banLog?.actorType).toBe("PLAYER");
      expect(banLog?.actorId).toBe(playerA.id);
      expect(banLog?.details.mapId).toBe(mapIds[0]);
      expect(banLog?.details.mapName).toBe("Map 1");
      expect(banLog?.details.teamName).toBe("Team Alpha");
      expect(banLog?.details.turn).toBe(0);
    });

    it("logs WINNER_DECLARED on completion with map details", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);

      await completeABBAFlow(t, session);

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const winnerLog = logs.find((l) => l.action === "WINNER_DECLARED");
      expect(winnerLog).toBeDefined();
      expect(winnerLog?.actorType).toBe("SYSTEM");
      expect(winnerLog?.details.mapId).toBe(session.mapIds[4]);
      expect(winnerLog?.details.mapName).toBe("Map 5");
    });

    it("logs 4 MAP_BANNED and 1 WINNER_DECLARED for complete flow", async () => {
      const t = createTestContext();
      const session = await createABBASession(t);

      await completeABBAFlow(t, session);

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const banLogs = logs.filter((l) => l.action === "MAP_BANNED");
      const winnerLogs = logs.filter((l) => l.action === "WINNER_DECLARED");
      expect(banLogs).toHaveLength(4);
      expect(winnerLogs).toHaveLength(1);
    });
  });

  // ============================================================================
  // submitBan - Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("allows same IP for both players (LAN scenario)", async () => {
      const t = createTestContext();
      const { playerA, playerB, mapIds } = await createABBASession(t, {
        playerAIp: "192.168.1.1",
        playerBIp: "192.168.1.1", // Same IP, different tokens
      });

      // Turn 0: Player A bans
      const r1 = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "192.168.1.1",
      });
      expect(r1.status).toBe("ok");

      // Turn 1: Player B bans from same IP
      const r2 = await t.mutation(internal.voting.submitBan, {
        token: playerB.token,
        mapId: mapIds[1],
        ipAddress: "192.168.1.1",
      });
      expect(r2.status).toBe("ok");
    });

    it("trims whitespace from IP address before validation", async () => {
      const t = createTestContext();
      const { playerA, mapIds } = await createABBASession(t);

      const result = await t.mutation(internal.voting.submitBan, {
        token: playerA.token,
        mapId: mapIds[0],
        ipAddress: "  10.0.0.1  ", // Whitespace around IP
      });

      expect(result.status).toBe("ok");
    });

    it("player cannot ban when token has no IP locked (unactivated)", async () => {
      const t = createTestContext();
      const { mapIds, sessionId } = await createABBASession(t);

      // Create a player with no IP address (unactivated token)
      const unactivatedToken = crypto.randomUUID();
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: unactivatedToken,
            ipAddress: undefined,
            isConnected: false,
          })
        );
      });

      const result = await t.mutation(internal.voting.submitBan, {
        token: unactivatedToken,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "IP_MISMATCH" });
    });

    it("banned maps have correct bannedByPlayerId for each player", async () => {
      const t = createTestContext();
      const { playerA, playerB, mapIds } = await createABBASession(t);

      // Turn 0: Player A bans Map 1
      await t.mutation(internal.voting.submitBan, {
        token: playerA.token, mapId: mapIds[0], ipAddress: "10.0.0.1",
      });
      // Turn 1: Player B bans Map 2
      await t.mutation(internal.voting.submitBan, {
        token: playerB.token, mapId: mapIds[1], ipAddress: "10.0.0.2",
      });

      const map1 = await t.run(async (ctx) => ctx.db.get(mapIds[0]));
      const map2 = await t.run(async (ctx) => ctx.db.get(mapIds[1]));

      expect(map1?.bannedByPlayerId).toBe(playerA.id);
      expect(map1?.bannedAtTurn).toBe(0);
      expect(map2?.bannedByPlayerId).toBe(playerB.id);
      expect(map2?.bannedAtTurn).toBe(1);
    });
  });

  // ============================================================================
  // submitBan - Timer Management
  // ============================================================================

  describe("timer management", () => {
    it("resets timerStartedAt and clears timerPausedAt after turn advance", async () => {
      const t = createTestContext();
      const session = await createABBASession(t, {
        timerStartedAt: Date.now() - 30_000,
        timerPausedAt: Date.now() - 5_000,
      });

      const before = Date.now();
      await t.mutation(internal.voting.submitBan, {
        token: session.playerA.token,
        mapId: session.mapIds[0],
        ipAddress: "10.0.0.1",
      });
      const after = Date.now();

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.timerStartedAt).toBeGreaterThanOrEqual(before);
      expect(dbSession?.timerStartedAt).toBeLessThanOrEqual(after);
      expect(dbSession?.timerPausedAt).toBeUndefined();
    });

    it("clears both timer fields on session completion", async () => {
      const t = createTestContext();
      const session = await createABBASession(t, {
        timerStartedAt: Date.now() - 60_000,
      });

      await completeABBAFlow(t, session);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.timerStartedAt).toBeUndefined();
      expect(dbSession?.timerPausedAt).toBeUndefined();
    });
  });
});

// ============================================================================
// submitVote - Test Helpers
// ============================================================================

interface MultiplayerSessionData {
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
  players: Array<{ id: Id<"sessionPlayers">; token: string; ip: string }>;
  mapIds: Id<"sessionMaps">[];
}

/**
 * Creates a MULTIPLAYER session in IN_PROGRESS state with N players and maps.
 * Players are created in order with unique tokens and IPs.
 */
async function createMultiplayerSession(
  t: TestContext,
  overrides: {
    adminId?: Id<"admins">;
    sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    format?: "ABBA" | "MULTIPLAYER";
    mapPoolSize?: number;
    playerCount?: number;
    currentRound?: number;
    isRevoteRound?: boolean;
    tokenExpiresAt?: number;
    playerOverrides?: Array<{ ip?: string }>;
    timerStartedAt?: number;
    timerPausedAt?: number;
  } = {}
): Promise<MultiplayerSessionData> {
  return await t.run(async (ctx) => {
    const adminId = overrides.adminId ?? await ctx.db.insert("admins", adminFactory());
    const playerCount = overrides.playerCount ?? 3;
    const mapPoolSize = overrides.mapPoolSize ?? 5;
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        format: overrides.format ?? "MULTIPLAYER",
        status: overrides.sessionStatus ?? "IN_PROGRESS",
        mapPoolSize,
        playerCount,
        currentRound: overrides.currentRound ?? 1,
        isRevoteRound: overrides.isRevoteRound ?? false,
        timerStartedAt: overrides.timerStartedAt,
        timerPausedAt: overrides.timerPausedAt,
      })
    );

    // Create master maps
    const masterMapIds = await Promise.all(
      Array.from({ length: mapPoolSize }, (_, i) =>
        ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }))
      )
    );

    // Create session maps
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

    // Create players with unique tokens and IPs
    const players: MultiplayerSessionData["players"] = [];
    for (let i = 0; i < playerCount; i++) {
      const token = crypto.randomUUID();
      const ip = overrides.playerOverrides?.[i]?.ip ?? `10.0.0.${i + 1}`;
      const playerId = await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          token,
          role: `PLAYER_${i + 1}`,
          teamName: `Team ${String.fromCharCode(65 + i)}`,
          ipAddress: ip,
          isConnected: true,
          tokenExpiresAt: overrides.tokenExpiresAt,
        })
      );
      players.push({ id: playerId, token, ip });
    }

    return { sessionId, adminId, players, mapIds };
  });
}

// ============================================================================
// submitVote - Validation Errors
// ============================================================================

describe("voting.submitVote", () => {
  // These validation tests exercise the full submitVote mutation path including
  // the shared validatePlayerForVoting helper. While the helper is also tested
  // via submitBan, these provide integration-level regression coverage in case
  // the mutations diverge in the future.
  describe("validation errors", () => {
    it("rejects invalid token", async () => {
      const t = createTestContext();
      const { mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: "nonexistent-token",
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_TOKEN" });
    });

    it("rejects empty IP address", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: "",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_IP" });
    });

    it("rejects unknown IP address", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: "unknown",
      });

      expect(result).toEqual({ status: "error", error: "INVALID_IP" });
    });

    it("rejects expired token", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t, {
        tokenExpiresAt: Date.now() - 1000,
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "TOKEN_EXPIRED" });
    });

    it("rejects IP mismatch", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: "99.99.99.99",
      });

      expect(result).toEqual({ status: "error", error: "IP_MISMATCH" });
    });

    it.each(["DRAFT", "WAITING", "PAUSED", "COMPLETE", "EXPIRED"] as const)(
      "rejects when session is not IN_PROGRESS (%s)",
      async (sessionStatus) => {
        const t = createTestContext();
        const { players, mapIds } = await createMultiplayerSession(t, {
          sessionStatus,
        });

        const result = await t.mutation(internal.voting.submitVote, {
          token: players[0].token,
          mapId: mapIds[0],
          ipAddress: players[0].ip,
        });

        expect(result).toEqual({ status: "error", error: "SESSION_NOT_IN_PROGRESS" });
      }
    );

    it("rejects vote when session has passed expiresAt even if status is still IN_PROGRESS", async () => {
      const t = createTestContext();
      // Create a MULTIPLAYER session with expiresAt in the past but status still IN_PROGRESS
      const session = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "MULTIPLAYER",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 3,
            currentRound: 1,
            expiresAt: Date.now() - 1000, // 1 second in the past
          })
        );

        const masterMapIds = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
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

        const token = crypto.randomUUID();
        const playerId = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token,
            role: "PLAYER_1",
            teamName: "Team A",
            ipAddress: "10.0.0.1",
            isConnected: true,
          })
        );

        return {
          sessionId,
          players: [{ id: playerId, token, ip: "10.0.0.1" }],
          mapIds,
        };
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "SESSION_NOT_IN_PROGRESS" });
    });

    it("rejects when format is ABBA (not MULTIPLAYER)", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t, {
        format: "ABBA",
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "FORMAT_NOT_MULTIPLAYER" });
    });

    it("rejects when player has already voted this round", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      // First vote succeeds
      await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      // Second vote from same player is rejected
      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[1],
        ipAddress: players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "ALREADY_VOTED" });
    });

    it("rejects when target map is already BANNED", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "BANNED" });
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });

    it("rejects when target map belongs to a different session", async () => {
      const t = createTestContext();
      const session1 = await createMultiplayerSession(t);

      // Create a map in a different session
      const otherMapId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory({ email: "other@test.com" }));
        const otherSessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "MULTIPLAYER",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 3,
          })
        );
        const masterMapId = await ctx.db.insert("maps", mapFactory({ name: "Other Map" }));
        return await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(otherSessionId, masterMapId, {
            name: "Other Map",
            state: "AVAILABLE",
          })
        );
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: session1.players[0].token,
        mapId: otherMapId,
        ipAddress: session1.players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });

    it("rejects when target map state is WINNER", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "WINNER" });
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result).toEqual({ status: "error", error: "MAP_UNAVAILABLE" });
    });
  });

  // ============================================================================
  // submitVote - Happy Path
  // ============================================================================

  describe("happy path", () => {
    it("first player votes successfully", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.vote.mapId).toBe(mapIds[0]);
      expect(result.vote.mapName).toBe("Map 1");
      expect(result.vote.round).toBe(1);
    });

    it("returns allVotesSubmitted: false when not all voted", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.allVotesSubmitted).toBe(false);
    });

    it("returns allVotesSubmitted: true when last player votes", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      // All 3 players vote
      await t.mutation(internal.voting.submitVote, {
        token: players[0].token, mapId: mapIds[0], ipAddress: players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: players[1].token, mapId: mapIds[1], ipAddress: players[1].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: players[2].token, mapId: mapIds[2], ipAddress: players[2].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.allVotesSubmitted).toBe(true);
    });

    it("inserts vote record with correct fields", async () => {
      const t = createTestContext();
      const { sessionId, players, mapIds } = await createMultiplayerSession(t);

      const beforeVote = Date.now();
      await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );

      expect(votes).toHaveLength(1);
      expect(votes[0].sessionId).toBe(sessionId);
      expect(votes[0].round).toBe(1);
      expect(votes[0].playerId).toBe(players[0].id);
      expect(votes[0].mapId).toBe(mapIds[0]);
      expect(votes[0].submittedByAdmin).toBe(false);
      expect(votes[0].submittedAt).toBeGreaterThanOrEqual(beforeVote);
    });

    it("sets hasVotedThisRound to true after voting", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      const player = await t.run(async (ctx) => ctx.db.get(players[0].id));
      expect(player?.hasVotedThisRound).toBe(true);
    });

    it("multiple players can vote for the same map", async () => {
      const t = createTestContext();
      const { sessionId, players, mapIds } = await createMultiplayerSession(t);

      // All 3 players vote for the same map
      await t.mutation(internal.voting.submitVote, {
        token: players[0].token, mapId: mapIds[0], ipAddress: players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: players[1].token, mapId: mapIds[0], ipAddress: players[1].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: players[2].token, mapId: mapIds[0], ipAddress: players[2].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.allVotesSubmitted).toBe(true);

      // All 3 votes should be recorded
      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );
      expect(votes).toHaveLength(3);
      expect(votes.every((v) => v.mapId === mapIds[0])).toBe(true);
    });
  });

  // ============================================================================
  // submitVote - Audit Logging
  // ============================================================================

  describe("audit logging", () => {
    it("logs VOTE_SUBMITTED with correct details", async () => {
      const t = createTestContext();
      const { sessionId, players, mapIds } = await createMultiplayerSession(t);

      await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const voteLog = logs.find((l) => l.action === "VOTE_SUBMITTED");
      expect(voteLog).toBeDefined();
      expect(voteLog?.actorType).toBe("PLAYER");
      expect(voteLog?.actorId).toBe(players[0].id);
      expect(voteLog?.details.mapId).toBe(mapIds[0]);
      expect(voteLog?.details.mapName).toBe("Map 1");
      expect(voteLog?.details.teamName).toBe("Team A");
      expect(voteLog?.details.round).toBe(1);
    });

    it("logs one VOTE_SUBMITTED per player vote", async () => {
      const t = createTestContext();
      const { sessionId, players, mapIds } = await createMultiplayerSession(t);

      await t.mutation(internal.voting.submitVote, {
        token: players[0].token, mapId: mapIds[0], ipAddress: players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: players[1].token, mapId: mapIds[1], ipAddress: players[1].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: players[2].token, mapId: mapIds[2], ipAddress: players[2].ip,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const voteLogs = logs.filter((l) => l.action === "VOTE_SUBMITTED");
      expect(voteLogs).toHaveLength(3);
    });
  });

  // ============================================================================
  // submitVote - Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("allows same IP for multiple players (LAN scenario)", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t, {
        playerOverrides: [
          { ip: "192.168.1.1" },
          { ip: "192.168.1.1" },
          { ip: "192.168.1.1" },
        ],
      });

      const r1 = await t.mutation(internal.voting.submitVote, {
        token: players[0].token, mapId: mapIds[0], ipAddress: "192.168.1.1",
      });
      expect(r1.status).toBe("ok");

      const r2 = await t.mutation(internal.voting.submitVote, {
        token: players[1].token, mapId: mapIds[1], ipAddress: "192.168.1.1",
      });
      expect(r2.status).toBe("ok");

      const r3 = await t.mutation(internal.voting.submitVote, {
        token: players[2].token, mapId: mapIds[2], ipAddress: "192.168.1.1",
      });
      expect(r3.status).toBe("ok");
    });

    it("trims whitespace from IP address before validation", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t);

      const result = await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: "  10.0.0.1  ",
      });

      expect(result.status).toBe("ok");
    });

    it("player cannot vote when token has no IP locked (unactivated)", async () => {
      const t = createTestContext();
      const { mapIds, sessionId } = await createMultiplayerSession(t);

      // Create a player with no IP address (unactivated token)
      const unactivatedToken = crypto.randomUUID();
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: unactivatedToken,
            ipAddress: undefined,
            isConnected: false,
          })
        );
      });

      const result = await t.mutation(internal.voting.submitVote, {
        token: unactivatedToken,
        mapId: mapIds[0],
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "error", error: "IP_MISMATCH" });
    });

    it("uses session currentRound for vote record", async () => {
      const t = createTestContext();
      const { sessionId, players, mapIds } = await createMultiplayerSession(t, {
        currentRound: 3,
      });

      await t.mutation(internal.voting.submitVote, {
        token: players[0].token,
        mapId: mapIds[0],
        ipAddress: players[0].ip,
      });

      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 3)
          )
          .collect()
      );

      expect(votes).toHaveLength(1);
      expect(votes[0].round).toBe(3);
    });

    it("works with 2-player session", async () => {
      const t = createTestContext();
      const { players, mapIds } = await createMultiplayerSession(t, {
        playerCount: 2,
      });

      const r1 = await t.mutation(internal.voting.submitVote, {
        token: players[0].token, mapId: mapIds[0], ipAddress: players[0].ip,
      });
      expect(r1.status).toBe("ok");
      if (r1.status !== "ok") throw new Error("Expected ok");
      expect(r1.allVotesSubmitted).toBe(false);

      const r2 = await t.mutation(internal.voting.submitVote, {
        token: players[1].token, mapId: mapIds[1], ipAddress: players[1].ip,
      });
      expect(r2.status).toBe("ok");
      if (r2.status !== "ok") throw new Error("Expected ok");
      expect(r2.allVotesSubmitted).toBe(true);
    });
  });
});

// ============================================================================
// Round Resolution (triggered via submitVote)
// ============================================================================

/**
 * Helper: all players vote for different maps (one vote per map).
 * Returns the result of the last vote (which triggers resolution).
 */
async function allPlayersVoteDifferent(
  t: TestContext,
  session: MultiplayerSessionData
) {
  const { players, mapIds } = session;
  let lastResult;
  for (let i = 0; i < players.length; i++) {
    lastResult = await t.mutation(internal.voting.submitVote, {
      token: players[i].token,
      mapId: mapIds[i],
      ipAddress: players[i].ip,
    });
  }
  return lastResult!;
}

/**
 * Helper: all players vote for the same map.
 * Returns the result of the last vote (which triggers resolution).
 */
async function allPlayersVoteSame(
  t: TestContext,
  session: MultiplayerSessionData,
  targetMapIndex: number
) {
  const { players, mapIds } = session;
  let lastResult;
  for (const player of players) {
    lastResult = await t.mutation(internal.voting.submitVote, {
      token: player.token,
      mapId: mapIds[targetMapIndex],
      ipAddress: player.ip,
    });
  }
  return lastResult!;
}

describe("voting.resolveRound", () => {
  // ============================================================================
  // Normal Resolution
  // ============================================================================

  describe("normal resolution", () => {
    it("bans maps with votes and advances round when >1 maps remain", async () => {
      const t = createTestContext();
      // 3 players, 5 maps: each votes different map → 3 banned, 2 remain
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      const result = await allPlayersVoteDifferent(t, session);

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.allVotesSubmitted).toBe(true);
      expect(result.resolution).toBeDefined();
      expect(result.resolution!.outcome).toBe("ROUND_ADVANCED");
      expect(result.resolution!.eliminatedMapIds).toHaveLength(3);
      expect(result.resolution!.remainingCount).toBe(2);
    });

    it("declares winner when exactly 1 map remains after banning", async () => {
      const t = createTestContext();
      // 2 players, 3 maps: both vote different maps → 2 banned, 1 remains → winner
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 3,
      });

      // Player 0 votes Map 1, Player 1 votes Map 2 → Map 3 survives
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("WINNER");
      expect(result.resolution!.winnerMapId).toBe(session.mapIds[2]);
    });

    it("sets correct voteCount on banned maps", async () => {
      const t = createTestContext();
      // 3 players, 5 maps: 2 players vote Map 1, 1 votes Map 2
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[1].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[2].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[2].ip,
      });

      const map1 = await t.run(async (ctx) => ctx.db.get(session.mapIds[0]));
      const map2 = await t.run(async (ctx) => ctx.db.get(session.mapIds[1]));

      expect(map1?.state).toBe("BANNED");
      expect(map1?.voteCount).toBe(2);
      expect(map1?.bannedAtRound).toBe(1);
      expect(map2?.state).toBe("BANNED");
      expect(map2?.voteCount).toBe(1);
      expect(map2?.bannedAtRound).toBe(1);
    });

    it("maps with 0 votes remain AVAILABLE", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      // All 3 players vote for the same map
      await allPlayersVoteSame(t, session, 0);

      // Maps 2-5 should still be AVAILABLE
      for (let i = 1; i < 5; i++) {
        const map = await t.run(async (ctx) => ctx.db.get(session.mapIds[i]));
        expect(map?.state).toBe("AVAILABLE");
      }
    });

    it("session transitions to COMPLETE with winnerMapId on winner", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 3,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.winnerMapId).toBe(session.mapIds[2]);
      expect(dbSession?.completedAt).toBeDefined();
    });

    it("resets hasVotedThisRound on round advance", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      await allPlayersVoteDifferent(t, session);

      // All players should have hasVotedThisRound = false after advance
      for (const player of session.players) {
        const dbPlayer = await t.run(async (ctx) => ctx.db.get(player.id));
        expect(dbPlayer?.hasVotedThisRound).toBe(false);
      }
    });

    it("increments currentRound on round advance", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      await allPlayersVoteDifferent(t, session);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.currentRound).toBe(2);
    });

    it("multi-round flow to winner: round 1 advance, round 2 winner", async () => {
      const t = createTestContext();
      // 3 players, 5 maps
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      // Round 1: 3 players vote 3 different maps → 3 banned, 2 remain
      await allPlayersVoteDifferent(t, session);

      // Find remaining available maps for round 2
      const availableMaps = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", session.sessionId).eq("state", "AVAILABLE")
          )
          .collect()
      );
      expect(availableMaps).toHaveLength(2);

      // Round 2: Player 0 votes one remaining map, Player 1 votes same → 1 banned, 1 remains
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: availableMaps[0]._id,
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: availableMaps[0]._id,
        ipAddress: session.players[1].ip,
      });
      const finalResult = await t.mutation(internal.voting.submitVote, {
        token: session.players[2].token,
        mapId: availableMaps[0]._id,
        ipAddress: session.players[2].ip,
      });

      expect(finalResult.status).toBe("ok");
      if (finalResult.status !== "ok") throw new Error("Expected ok");
      expect(finalResult.resolution!.outcome).toBe("WINNER");
      expect(finalResult.resolution!.winnerMapId).toBe(availableMaps[1]._id);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
    });
  });

  // ============================================================================
  // Deadlock → Revote
  // ============================================================================

  describe("deadlock → revote", () => {
    it("triggers revote when all maps are eliminated (deadlock)", async () => {
      const t = createTestContext();
      // 3 players, 3 maps: each votes different → all 3 eliminated → deadlock
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      const result = await allPlayersVoteDifferent(t, session);

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("REVOTE");
      expect(result.resolution!.eliminatedMapIds).toHaveLength(3);
      expect(result.resolution!.remainingCount).toBe(3); // All 3 reset to AVAILABLE
    });

    it("sets isRevoteRound and increments round on deadlock", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      await allPlayersVoteDifferent(t, session);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.isRevoteRound).toBe(true);
      expect(dbSession?.currentRound).toBe(2); // Was 1, incremented
    });

    it("resets maps banned in current round back to AVAILABLE", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      await allPlayersVoteDifferent(t, session);

      // All 3 maps should be AVAILABLE again
      for (const mapId of session.mapIds) {
        const map = await t.run(async (ctx) => ctx.db.get(mapId));
        expect(map?.state).toBe("AVAILABLE");
        expect(map?.voteCount).toBeUndefined();
        expect(map?.bannedAtRound).toBeUndefined();
        expect(map?.bannedByPlayerId).toBeUndefined();
      }
    });

    it("only resets current-round bans, not previous rounds", async () => {
      const t = createTestContext();
      // 3 players, 5 maps: round 1 bans 1 map, then manually set up round 2 deadlock
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      // Round 1: all vote for Map 1 → only Map 1 banned, 4 remain
      await allPlayersVoteSame(t, session, 0);

      // Verify Map 1 is banned, session advanced
      const map1AfterR1 = await t.run(async (ctx) => ctx.db.get(session.mapIds[0]));
      expect(map1AfterR1?.state).toBe("BANNED");
      expect(map1AfterR1?.bannedAtRound).toBe(1);

      // Round 2: get remaining maps and have each player vote different ones
      const availableR2 = await t.run(async (ctx) =>
        ctx.db
          .query("sessionMaps")
          .withIndex("by_sessionId_and_state", (q) =>
            q.eq("sessionId", session.sessionId).eq("state", "AVAILABLE")
          )
          .collect()
      );
      expect(availableR2).toHaveLength(4);

      // Need 4 available maps all voted → need 4 players? No, we have 3 players.
      // With 3 players voting 3 different maps out of 4 → 3 banned, 1 remains → winner not deadlock.
      // To get a deadlock with 3 players, we need exactly 3 available maps.
      // Let's manually ban one more map to set up the scenario.
      await t.run(async (ctx) => {
        await ctx.db.patch(availableR2[0]._id, {
          state: "BANNED",
          bannedAtRound: 2,
          voteCount: 0,
        });
      });

      // Now 3 maps available. Each player votes different → deadlock
      const remaining3 = availableR2.slice(1); // Maps 3, 4, 5
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: remaining3[0]._id,
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: remaining3[1]._id,
        ipAddress: session.players[1].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[2].token,
        mapId: remaining3[2]._id,
        ipAddress: session.players[2].ip,
      });

      // Map 1 (banned in round 1) should STILL be banned
      const map1AfterR2 = await t.run(async (ctx) => ctx.db.get(session.mapIds[0]));
      expect(map1AfterR2?.state).toBe("BANNED");
      expect(map1AfterR2?.bannedAtRound).toBe(1);

      // The 3 deadlocked maps should be reset to AVAILABLE
      for (const map of remaining3) {
        const dbMap = await t.run(async (ctx) => ctx.db.get(map._id));
        expect(dbMap?.state).toBe("AVAILABLE");
      }
    });

    it("revote → normal resolution (winner found)", async () => {
      const t = createTestContext();
      // 3 players, 3 maps → deadlock → revote → winner
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      // Round 1: deadlock (each votes different)
      await allPlayersVoteDifferent(t, session);

      // Round 2 (revote): 2 players vote Map 1, 1 votes Map 2 → Map 3 survives
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[2].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[2].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("WINNER");
      expect(result.resolution!.winnerMapId).toBe(session.mapIds[2]);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.isRevoteRound).toBe(false);
    });

    it("revote → round advance clears isRevoteRound", async () => {
      const t = createTestContext();
      // 2 players, 4 maps. Round 1: deadlock with all 4 voted.
      // We need a setup where revote has >1 maps remain after resolution.
      // Use isRevoteRound=true with 4 maps, 2 players vote same → 1 banned, 3 remain
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 4,
        isRevoteRound: true,
      });

      // Both players vote for Map 1 → 1 banned, 3 remain → ROUND_ADVANCED
      await allPlayersVoteSame(t, session, 0);

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.isRevoteRound).toBe(false);
      expect(dbSession?.status).toBe("IN_PROGRESS");
    });

    it("resets hasVotedThisRound on revote trigger", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      await allPlayersVoteDifferent(t, session);

      for (const player of session.players) {
        const dbPlayer = await t.run(async (ctx) => ctx.db.get(player.id));
        expect(dbPlayer?.hasVotedThisRound).toBe(false);
      }
    });
  });

  // ============================================================================
  // Double Deadlock → Random Selection
  // ============================================================================

  describe("double deadlock → random selection", () => {
    it("triggers random selection on double deadlock", async () => {
      const t = createTestContext();
      // 2 players, 2 maps: each votes different → deadlock
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 2,
      });

      // Round 1: deadlock
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      // Verify revote state
      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.isRevoteRound).toBe(true);

      // Round 2 (revote): same deadlock again
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("RANDOM_WINNER");
      expect(result.resolution!.winnerMapId).toBeDefined();
      expect(
        [session.mapIds[0], session.mapIds[1]]
      ).toContain(result.resolution!.winnerMapId);
    });

    it("random winner is from the revote pool", async () => {
      const t = createTestContext();
      // Set up directly with isRevoteRound=true, 3 maps, 3 players
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
        isRevoteRound: true,
      });

      // All 3 vote different maps → all eliminated → double deadlock
      const result = await allPlayersVoteDifferent(t, session);

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("RANDOM_WINNER");
      expect(session.mapIds).toContain(result.resolution!.winnerMapId);
    });

    it("session completes on random selection", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 2,
        isRevoteRound: true,
      });

      // Both vote different → double deadlock
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.winnerMapId).toBeDefined();
      expect(dbSession?.completedAt).toBeDefined();
      expect(dbSession?.isRevoteRound).toBe(false);
    });

    it("4-player, 4-map double deadlock scenario (stakeholder requirement)", async () => {
      const t = createTestContext();
      // 4 players, 4 maps: each votes different → deadlock → revote → same → random
      const session = await createMultiplayerSession(t, {
        playerCount: 4,
        mapPoolSize: 4,
      });

      // Round 1: each player votes a different map → all 4 eliminated → deadlock
      for (let i = 0; i < 4; i++) {
        await t.mutation(internal.voting.submitVote, {
          token: session.players[i].token,
          mapId: session.mapIds[i],
          ipAddress: session.players[i].ip,
        });
      }

      let dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.isRevoteRound).toBe(true);
      expect(dbSession?.currentRound).toBe(2);

      // Round 2 (revote): same votes → double deadlock → random
      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.voting.submitVote, {
          token: session.players[i].token,
          mapId: session.mapIds[i],
          ipAddress: session.players[i].ip,
        });
      }
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[3].token,
        mapId: session.mapIds[3],
        ipAddress: session.players[3].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("RANDOM_WINNER");
      expect(session.mapIds).toContain(result.resolution!.winnerMapId);

      dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
    });
  });

  // ============================================================================
  // Audit Logging
  // ============================================================================

  describe("audit logging", () => {
    it("logs ROUND_RESOLVED on normal round advance", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      await allPlayersVoteDifferent(t, session);

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const resolvedLog = logs.find((l) => l.action === "ROUND_RESOLVED");
      expect(resolvedLog).toBeDefined();
      expect(resolvedLog?.actorType).toBe("SYSTEM");
      expect(resolvedLog?.details.round).toBe(1);
      expect(resolvedLog?.details.reason).toContain("3 maps banned");
      expect(resolvedLog?.details.reason).toContain("2 remain");
    });

    it("logs ROUND_REVOTE_TRIGGERED on deadlock", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      await allPlayersVoteDifferent(t, session);

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const revoteLog = logs.find((l) => l.action === "ROUND_REVOTE_TRIGGERED");
      expect(revoteLog).toBeDefined();
      expect(revoteLog?.actorType).toBe("SYSTEM");
      expect(revoteLog?.details.round).toBe(1);
      expect(revoteLog?.details.reason).toContain("deadlock");
    });

    it("logs REVOTE_DEADLOCK_RANDOM_SELECTION on double deadlock", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 2,
        isRevoteRound: true,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const randomLog = logs.find((l) => l.action === "REVOTE_DEADLOCK_RANDOM_SELECTION");
      expect(randomLog).toBeDefined();
      expect(randomLog?.actorType).toBe("SYSTEM");
      expect(randomLog?.details.mapId).toBeDefined();
      expect(randomLog?.details.mapName).toBeDefined();
      expect(randomLog?.details.reason).toContain("Random selection");
    });

    it("logs WINNER_DECLARED on winner", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 3,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const winnerLog = logs.find((l) => l.action === "WINNER_DECLARED");
      expect(winnerLog).toBeDefined();
      expect(winnerLog?.actorType).toBe("SYSTEM");
      expect(winnerLog?.details.mapId).toBe(session.mapIds[2]);
      expect(winnerLog?.details.mapName).toBe("Map 3");
      expect(winnerLog?.details.reason).toBe("Last map standing");
    });

    it("full flow produces correct audit log sequence", async () => {
      const t = createTestContext();
      // 3 players, 3 maps → deadlock → revote → winner
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
      });

      // Round 1: deadlock
      await allPlayersVoteDifferent(t, session);

      // Round 2: 2 vote Map 1, 1 votes Map 2 → Map 3 wins
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[1].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[2].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[2].ip,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .collect()
      );

      const actions = logs.map((l) => l.action);

      // 6 total VOTE_SUBMITTED (3 from round 1 + 3 from revote round 2)
      expect(actions.filter((a) => a === "VOTE_SUBMITTED")).toHaveLength(6);
      expect(actions.filter((a) => a === "ROUND_REVOTE_TRIGGERED")).toHaveLength(1);

      // Resolution after revote round: ROUND_RESOLVED + WINNER_DECLARED
      expect(actions.filter((a) => a === "ROUND_RESOLVED")).toHaveLength(1);
      expect(actions.filter((a) => a === "WINNER_DECLARED")).toHaveLength(1);
    });
  });

  // ============================================================================
  // Timer Management
  // ============================================================================

  describe("timer management", () => {
    it("resets timerStartedAt and clears timerPausedAt on round advance (ROUND_ADVANCED)", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
        timerStartedAt: Date.now() - 30_000,
        timerPausedAt: Date.now() - 15_000,
      });

      // 3 players vote 3 different maps → 3 banned, 2 remain → ROUND_ADVANCED
      const before = Date.now();
      await allPlayersVoteDifferent(t, session);
      const after = Date.now();

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("IN_PROGRESS");
      // timerStartedAt is offset by REVEAL_DURATION_MS (3s) to account for
      // the client-side reveal phase before the next round starts.
      expect(dbSession?.timerStartedAt).toBeGreaterThanOrEqual(before + 3_000);
      expect(dbSession?.timerStartedAt).toBeLessThanOrEqual(after + 3_000);
      expect(dbSession?.timerPausedAt).toBeUndefined();
    });

    it("resets timerStartedAt on revote (REVOTE)", async () => {
      const t = createTestContext();
      const pastTimerStart = Date.now() - 30_000;
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 3,
        timerStartedAt: pastTimerStart,
      });

      // 3 players, 3 maps: each votes different → all eliminated → deadlock → revote
      const before = Date.now();
      await allPlayersVoteDifferent(t, session);
      const after = Date.now();

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.isRevoteRound).toBe(true);
      // timerStartedAt is offset by REVEAL_DURATION_MS (3s) for the reveal phase
      expect(dbSession?.timerStartedAt).toBeGreaterThanOrEqual(before + 3_000);
      expect(dbSession?.timerStartedAt).toBeLessThanOrEqual(after + 3_000);
    });

    it("clears timers on session completion (WINNER)", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 3,
        timerStartedAt: Date.now() - 30_000,
      });

      // 2 players vote 2 different maps → 2 banned, 1 remains → WINNER
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.timerStartedAt).toBeUndefined();
      expect(dbSession?.timerPausedAt).toBeUndefined();
    });

    it("clears timers on random selection (RANDOM_WINNER)", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 2,
        isRevoteRound: true,
        timerStartedAt: Date.now() - 30_000,
      });

      // Double deadlock → random winner
      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("COMPLETE");
      expect(dbSession?.timerStartedAt).toBeUndefined();
      expect(dbSession?.timerPausedAt).toBeUndefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("2-player, 2-map deadlock triggers revote", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 2,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.resolution!.outcome).toBe("REVOTE");
    });

    it("all players vote same map: only 1 map banned per round", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 4,
        mapPoolSize: 5,
      });

      // All 4 players vote Map 1
      for (const player of session.players) {
        await t.mutation(internal.voting.submitVote, {
          token: player.token,
          mapId: session.mapIds[0],
          ipAddress: player.ip,
        });
      }

      const map1 = await t.run(async (ctx) => ctx.db.get(session.mapIds[0]));
      expect(map1?.state).toBe("BANNED");
      expect(map1?.voteCount).toBe(4);

      // 4 maps remain
      const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
      expect(dbSession?.status).toBe("IN_PROGRESS");
      expect(dbSession?.currentRound).toBe(2);
    });

    it("no resolution data when not all votes submitted", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 3,
        mapPoolSize: 5,
      });

      // Only 1 of 3 players votes
      const result = await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("Expected ok");
      expect(result.allVotesSubmitted).toBe(false);
      expect(result.resolution).toBeUndefined();
    });

    it("winning map is marked as WINNER state", async () => {
      const t = createTestContext();
      const session = await createMultiplayerSession(t, {
        playerCount: 2,
        mapPoolSize: 3,
      });

      await t.mutation(internal.voting.submitVote, {
        token: session.players[0].token,
        mapId: session.mapIds[0],
        ipAddress: session.players[0].ip,
      });
      await t.mutation(internal.voting.submitVote, {
        token: session.players[1].token,
        mapId: session.mapIds[1],
        ipAddress: session.players[1].ip,
      });

      const winnerMap = await t.run(async (ctx) => ctx.db.get(session.mapIds[2]));
      expect(winnerMap?.state).toBe("WINNER");
    });
  });
});

// ============================================================================
// WAR-20: Additional Voting Coverage
// ============================================================================

describe("WAR-20: defense-in-depth duplicate vote check", () => {
  it("rejects vote via DB check when hasVotedThisRound flag is desynchronized", async () => {
    const t = createTestContext();
    const session = await createMultiplayerSession(t, {
      playerCount: 2,
      mapPoolSize: 5,
    });

    // Manually insert a vote record but leave hasVotedThisRound = false
    // (simulates a desync between the flag and actual vote records)
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "votes",
        voteFactory(session.sessionId, session.players[0].id, session.mapIds[0])
      );
    });

    // The hasVotedThisRound flag is still false, but the DB vote record exists
    const result = await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[1],
      ipAddress: session.players[0].ip,
    });

    expect(result).toEqual({ status: "error", error: "ALREADY_VOTED" });
  });

  it("DB duplicate check does not false-positive on votes from different rounds", async () => {
    const t = createTestContext();
    const session = await createMultiplayerSession(t, {
      playerCount: 2,
      mapPoolSize: 5,
      currentRound: 2,
    });

    // Insert a vote record from round 1 (previous round)
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "votes",
        voteFactory(session.sessionId, session.players[0].id, session.mapIds[0], {
          round: 1,
        })
      );
    });

    // Vote in round 2 should succeed despite round 1 vote existing
    const result = await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[1],
      ipAddress: session.players[0].ip,
    });

    expect(result.status).toBe("ok");
  });
});

describe("WAR-20: multi-round voting flow", () => {
  it("players can vote again after round advances", async () => {
    const t = createTestContext();
    // 3 players, 5 maps: round 1 bans 3 maps, 2 remain → advance
    const session = await createMultiplayerSession(t, {
      playerCount: 3,
      mapPoolSize: 5,
    });

    // Round 1: each player votes a different map → 3 banned, 2 remain → ROUND_ADVANCED
    const r1Result = await allPlayersVoteDifferent(t, session);
    expect(r1Result.status).toBe("ok");
    if (r1Result.status !== "ok") throw new Error("Expected ok");
    expect(r1Result.resolution!.outcome).toBe("ROUND_ADVANCED");

    // Verify round actually advanced and vote flags reset
    const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.currentRound).toBe(2);
    for (const player of session.players) {
      const dbPlayer = await t.run(async (ctx) => ctx.db.get(player.id));
      expect(dbPlayer?.hasVotedThisRound).toBe(false);
    }

    // Verify all players can vote again in round 2
    // Maps 4 and 5 (index 3, 4) are still available
    const r2_p1 = await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[3],
      ipAddress: session.players[0].ip,
    });
    expect(r2_p1.status).toBe("ok");
    if (r2_p1.status !== "ok") throw new Error("Expected ok");
    expect(r2_p1.allVotesSubmitted).toBe(false);

    const r2_p2 = await t.mutation(internal.voting.submitVote, {
      token: session.players[1].token,
      mapId: session.mapIds[4],
      ipAddress: session.players[1].ip,
    });
    expect(r2_p2.status).toBe("ok");
    if (r2_p2.status !== "ok") throw new Error("Expected ok");
    expect(r2_p2.allVotesSubmitted).toBe(false);

    const r2_p3 = await t.mutation(internal.voting.submitVote, {
      token: session.players[2].token,
      mapId: session.mapIds[3],
      ipAddress: session.players[2].ip,
    });
    expect(r2_p3.status).toBe("ok");
    if (r2_p3.status !== "ok") throw new Error("Expected ok");
    expect(r2_p3.allVotesSubmitted).toBe(true);
    // Both remaining maps received votes → both banned → 0 remain → deadlock → REVOTE
    expect(r2_p3.resolution!.outcome).toBe("REVOTE");
  });

  it("vote records use correct round number across rounds", async () => {
    const t = createTestContext();
    const session = await createMultiplayerSession(t, {
      playerCount: 2,
      mapPoolSize: 4,
    });

    // Round 1: both vote same map → 1 banned, 3 remain → ROUND_ADVANCED
    await allPlayersVoteSame(t, session, 0);

    // Round 2: both vote same map → 1 banned, 2 remain → ROUND_ADVANCED
    await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[1],
      ipAddress: session.players[0].ip,
    });
    await t.mutation(internal.voting.submitVote, {
      token: session.players[1].token,
      mapId: session.mapIds[1],
      ipAddress: session.players[1].ip,
    });

    // Verify vote records have correct round numbers
    const allVotes = await t.run(async (ctx) =>
      ctx.db
        .query("votes")
        .filter((q) => q.eq(q.field("sessionId"), session.sessionId))
        .collect()
    );

    const round1Votes = allVotes.filter((v) => v.round === 1);
    const round2Votes = allVotes.filter((v) => v.round === 2);

    expect(round1Votes).toHaveLength(2);
    expect(round2Votes).toHaveLength(2);
  });

});

describe("WAR-20: revote allows re-voting on same maps", () => {
  it("players can vote on the exact same maps after revote resets them", async () => {
    const t = createTestContext();
    // 2 players, 2 maps: deadlock → revote → vote on same maps again
    const session = await createMultiplayerSession(t, {
      playerCount: 2,
      mapPoolSize: 2,
    });

    // Round 1: each votes different map → all eliminated → REVOTE
    await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[0],
      ipAddress: session.players[0].ip,
    });
    const r1Result = await t.mutation(internal.voting.submitVote, {
      token: session.players[1].token,
      mapId: session.mapIds[1],
      ipAddress: session.players[1].ip,
    });
    expect(r1Result.status).toBe("ok");
    if (r1Result.status !== "ok") throw new Error("Expected ok");
    expect(r1Result.resolution!.outcome).toBe("REVOTE");

    // Round 2 (revote): both vote for the SAME map → 1 banned, 1 remains → WINNER
    await t.mutation(internal.voting.submitVote, {
      token: session.players[0].token,
      mapId: session.mapIds[0], // Same map as round 1
      ipAddress: session.players[0].ip,
    });
    const r2Result = await t.mutation(internal.voting.submitVote, {
      token: session.players[1].token,
      mapId: session.mapIds[0], // Both vote Map 1 → Map 1 banned → Map 2 wins
      ipAddress: session.players[1].ip,
    });

    expect(r2Result.status).toBe("ok");
    if (r2Result.status !== "ok") throw new Error("Expected ok");
    expect(r2Result.resolution!.outcome).toBe("WINNER");
    expect(r2Result.resolution!.winnerMapId).toBe(session.mapIds[1]);

    // Verify session is complete
    const dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.status).toBe("COMPLETE");
  });
});

describe("WAR-20: large session", () => {
  it("6-player 7-map session resolves correctly through multiple rounds", async () => {
    const t = createTestContext();
    const session = await createMultiplayerSession(t, {
      playerCount: 6,
      mapPoolSize: 7,
    });

    // Round 1: all 6 players vote for Map 1 → only Map 1 banned, 6 remain
    for (const player of session.players) {
      await t.mutation(internal.voting.submitVote, {
        token: player.token,
        mapId: session.mapIds[0],
        ipAddress: player.ip,
      });
    }

    let dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.status).toBe("IN_PROGRESS");
    expect(dbSession?.currentRound).toBe(2);

    // Round 2: pairs of players vote maps 2, 3, 4 (all 3 banned, 3 remain)
    const round2Targets = [1, 1, 2, 2, 3, 3]; // mapIds index per player
    for (let i = 0; i < session.players.length; i++) {
      await t.mutation(internal.voting.submitVote, {
        token: session.players[i].token,
        mapId: session.mapIds[round2Targets[i]],
        ipAddress: session.players[i].ip,
      });
    }

    dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.status).toBe("IN_PROGRESS");
    expect(dbSession?.currentRound).toBe(3);

    // 3 maps remain (indices 4, 5, 6). Round 3: all vote Map 5 → banned, 2 remain
    for (const player of session.players) {
      await t.mutation(internal.voting.submitVote, {
        token: player.token,
        mapId: session.mapIds[4],
        ipAddress: player.ip,
      });
    }

    dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.status).toBe("IN_PROGRESS");
    expect(dbSession?.currentRound).toBe(4);

    // 2 maps remain (indices 5, 6). Round 4: all vote Map 6 → banned → Map 7 wins
    for (const player of session.players) {
      await t.mutation(internal.voting.submitVote, {
        token: player.token,
        mapId: session.mapIds[5],
        ipAddress: player.ip,
      });
    }

    dbSession = await t.run(async (ctx) => ctx.db.get(session.sessionId));
    expect(dbSession?.status).toBe("COMPLETE");
    expect(dbSession?.winnerMapId).toBe(session.mapIds[6]);

    // Verify winner map state
    const winnerMap = await t.run(async (ctx) => ctx.db.get(session.mapIds[6]));
    expect(winnerMap?.state).toBe("WINNER");
  });
});

// ============================================================================
// adminVoteOnBehalf (WAR-44)
// ============================================================================

describe("voting.adminVoteOnBehalf", () => {
  // --------------------------------------------------------------------------
  // Test Helpers
  // --------------------------------------------------------------------------

  /** Create an ABBA session with admin auth context for adminVoteOnBehalf tests. */
  async function createAdminABBASession(
    overrides: {
      sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
      mapPoolSize?: number;
      currentTurn?: number;
    } = {}
  ) {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const session = await createABBASession(t, { ...overrides, adminId });
    return {
      t,
      authT,
      adminId,
      sessionId: session.sessionId,
      mapIds: session.mapIds,
      playerAId: session.playerA.id,
      playerBId: session.playerB.id,
    };
  }

  /** Create a MULTIPLAYER session with admin auth context for adminVoteOnBehalf tests. */
  async function createAdminMultiplayerSession(
    overrides: {
      sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
      mapPoolSize?: number;
      playerCount?: number;
      currentRound?: number;
      isRevoteRound?: boolean;
    } = {}
  ) {
    const { t, authT, adminId } = await createAuthenticatedAdmin();
    const session = await createMultiplayerSession(t, { ...overrides, adminId });
    return {
      t,
      authT,
      adminId,
      sessionId: session.sessionId,
      mapIds: session.mapIds,
      playerIds: session.players.map((p) => p.id),
    };
  }

  // --------------------------------------------------------------------------
  // ABBA - Happy Path
  // --------------------------------------------------------------------------

  describe("ABBA format", () => {
    it("bans a map on behalf of the current-turn player", async () => {
      const { t, authT, sessionId, playerAId, mapIds } =
        await createAdminABBASession();

      const result = await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerAId,
        mapId: mapIds[0],
      });

      expect(result.mapName).toBe("Map 1");
      expect(result.isComplete).toBe(false);

      // Verify map state
      const map = await t.run(async (ctx) => ctx.db.get(mapIds[0]));
      expect(map?.state).toBe("BANNED");
      expect(map?.bannedByPlayerId).toBe(playerAId);
      expect(map?.bannedAtTurn).toBe(0);
      expect(map?.submittedByAdmin).toBe(true);

      // Verify turn advanced and timer reset
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.currentTurn).toBe(1);
      expect(session?.timerStartedAt).toBeDefined();
      expect(session?.timerPausedAt).toBeUndefined();
    });

    it("completes session when final ban is submitted", async () => {
      // 5 maps → 4 bans needed. Pre-ban 3 maps, then admin submits final ban.
      const { t, authT, sessionId, playerAId, mapIds } =
        await createAdminABBASession({ currentTurn: 3 });

      // Pre-ban maps 0-2 (turns 0, 1, 2 already happened)
      await t.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.patch(mapIds[i], {
            state: "BANNED",
            bannedAtTurn: i,
          });
        }
      });

      // Turn 3 = Player A's turn (ABBA pattern [0,1,1,0])
      const result = await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerAId,
        mapId: mapIds[3],
      });

      expect(result.isComplete).toBe(true);
      expect(result.winnerMapName).toBe("Map 5");

      // Verify session complete
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("COMPLETE");
      expect(session?.completedAt).toBeDefined();

      // Verify winner map
      const winnerMap = await t.run(async (ctx) => ctx.db.get(mapIds[4]));
      expect(winnerMap?.state).toBe("WINNER");
    });

    it("logs MAP_BANNED audit event with admin actor", async () => {
      const { t, authT, adminId, sessionId, playerAId, mapIds } =
        await createAdminABBASession();

      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerAId,
        mapId: mapIds[0],
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const banLog = logs.find((l) => l.action === "MAP_BANNED");
      expect(banLog).toBeDefined();
      expect(banLog?.actorType).toBe("ADMIN");
      expect(banLog?.actorId).toBe(adminId);
      expect(banLog?.details.mapName).toBe("Map 1");
      expect(banLog?.details.teamName).toBe("Team Alpha");
      expect(banLog?.details.reason).toBe("ADMIN_VOTE_ON_BEHALF");
    });

    // --------------------------------------------------------------------------
    // ABBA - Validation Errors
    // --------------------------------------------------------------------------

    it("rejects when it's not the target player's turn", async () => {
      const { authT, sessionId, playerBId, mapIds } =
        await createAdminABBASession(); // Turn 0 = Player A's turn

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerBId, // Player B, but it's Player A's turn
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Not this player's turn/);
    });

    it("rejects when target map is already banned", async () => {
      const { t, authT, sessionId, playerAId, mapIds } =
        await createAdminABBASession();

      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "BANNED" });
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerAId,
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Map not available/);
    });

    it("rejects when session is not IN_PROGRESS", async () => {
      const { authT, sessionId, playerAId, mapIds } =
        await createAdminABBASession({ sessionStatus: "PAUSED" });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerAId,
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Session is not in progress/);
    });

    it("rejects when session has expired (expiresAt in the past)", async () => {
      const { t, authT, sessionId, playerAId, mapIds } =
        await createAdminABBASession();

      await t.run(async (ctx) => {
        await ctx.db.patch(sessionId, { expiresAt: Date.now() - 1000 });
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerAId,
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Session has expired/);
    });
  });

  // --------------------------------------------------------------------------
  // MULTIPLAYER - Happy Path
  // --------------------------------------------------------------------------

  describe("MULTIPLAYER format", () => {
    it("votes on behalf of a player", async () => {
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      const result = await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[0],
        mapId: mapIds[0],
      });

      expect(result.mapName).toBe("Map 1");
      expect(result.isComplete).toBe(false);

      // Verify vote record
      const votes = await t.run(async (ctx) =>
        ctx.db
          .query("votes")
          .withIndex("by_sessionId_and_round", (q) =>
            q.eq("sessionId", sessionId).eq("round", 1)
          )
          .collect()
      );
      expect(votes).toHaveLength(1);
      expect(votes[0].playerId).toBe(playerIds[0]);
      expect(votes[0].mapId).toBe(mapIds[0]);
      expect(votes[0].submittedByAdmin).toBe(true);

      // Verify player flagged
      const player = await t.run(async (ctx) => ctx.db.get(playerIds[0]));
      expect(player?.hasVotedThisRound).toBe(true);
    });

    it("triggers round resolution when last vote is submitted", async () => {
      // 3 players, 5 maps. All vote for same map → it gets banned.
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      // First two players vote via internal mutation (simulate normal player votes)
      for (let i = 0; i < 2; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("votes", voteFactory(sessionId, playerIds[i], mapIds[0]));
          await ctx.db.patch(playerIds[i], { hasVotedThisRound: true });
        });
      }

      // Admin submits last vote on behalf of player 3
      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[2],
        mapId: mapIds[0],
      });

      // Verify round advanced (Map 1 banned, 4 remain → round 2)
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.currentRound).toBe(2);

      const bannedMap = await t.run(async (ctx) => ctx.db.get(mapIds[0]));
      expect(bannedMap?.state).toBe("BANNED");
    });

    it("logs VOTE_SUBMITTED audit event with admin actor", async () => {
      const { t, authT, adminId, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[0],
        mapId: mapIds[0],
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      const voteLog = logs.find((l) => l.action === "VOTE_SUBMITTED");
      expect(voteLog).toBeDefined();
      expect(voteLog?.actorType).toBe("ADMIN");
      expect(voteLog?.actorId).toBe(adminId);
      expect(voteLog?.details.mapName).toBe("Map 1");
      expect(voteLog?.details.teamName).toBe("Team A");
      expect(voteLog?.details.reason).toBe("ADMIN_VOTE_ON_BEHALF");
    });

    // --------------------------------------------------------------------------
    // MULTIPLAYER - Validation Errors
    // --------------------------------------------------------------------------

    it("rejects when player has already voted this round", async () => {
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      // Mark player as voted
      await t.run(async (ctx) => {
        await ctx.db.patch(playerIds[0], { hasVotedThisRound: true });
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerIds[0],
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Player has already voted this round/);
    });

    it("rejects when target map is not available", async () => {
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      await t.run(async (ctx) => {
        await ctx.db.patch(mapIds[0], { state: "BANNED" });
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerIds[0],
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Map not available/);
    });

    it("rejects when session is not IN_PROGRESS", async () => {
      const { authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession({ sessionStatus: "COMPLETE" });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerIds[0],
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Session is not in progress/);
    });
  });

  // --------------------------------------------------------------------------
  // Shared Validation Errors
  // --------------------------------------------------------------------------

  describe("shared validation", () => {
    it("rejects unauthenticated callers", async () => {
      const { t, adminId } = await createAuthenticatedAdmin();

      const sessionId = await t.run(async (ctx) =>
        ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "IN_PROGRESS" })
        )
      );

      const playerId = await t.run(async (ctx) =>
        ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId)
        )
      );

      const mapId = await t.run(async (ctx) => {
        const masterMapId = await ctx.db.insert("maps", mapFactory());
        return ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, masterMapId)
        );
      });

      // Use unauthenticated context (t, not authT)
      await expect(
        t.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId,
          mapId,
        })
      ).rejects.toThrow(/Authentication required/);
    });

    it("rejects when player does not belong to the session", async () => {
      const { t, authT, adminId } = await createAuthenticatedAdmin();

      // Create two sessions
      const data = await t.run(async (ctx) => {
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 2,
          })
        );

        const otherSessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            format: "ABBA",
            status: "IN_PROGRESS",
            mapPoolSize: 5,
            playerCount: 2,
          })
        );

        // Player belongs to other session
        const playerId = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(otherSessionId, {
            role: "PLAYER_A",
            teamName: "Team A",
          })
        );

        const masterMapId = await ctx.db.insert("maps", mapFactory());
        const mapId = await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, masterMapId)
        );

        return { sessionId, playerId, mapId };
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId: data.sessionId,
          playerId: data.playerId,
          mapId: data.mapId,
        })
      ).rejects.toThrow(/Player not found in session/);
    });

    it("rejects non-existent session", async () => {
      const { t, authT } = await createAuthenticatedAdmin();

      // Create then delete a session to get a valid but non-existent ID
      const data = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory({ email: "other@test.com" }));
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        const playerId = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId)
        );
        const masterMapId = await ctx.db.insert("maps", mapFactory());
        const mapId = await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, masterMapId)
        );
        await ctx.db.delete(sessionId);
        return { sessionId, playerId, mapId };
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId: data.sessionId,
          playerId: data.playerId,
          mapId: data.mapId,
        })
      ).rejects.toThrow(/Session not found/);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("defense-in-depth: rejects duplicate vote via DB check when hasVotedThisRound flag is desynchronized (MULTIPLAYER)", async () => {
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession();

      // Submit a legitimate vote via admin for player 1
      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[0],
        mapId: mapIds[0],
      });

      // Manually reset hasVotedThisRound to false (simulates a desync between flag and actual vote records)
      await t.run(async (ctx) => {
        await ctx.db.patch(playerIds[0], { hasVotedThisRound: false });
      });

      // The hasVotedThisRound flag is false, but the DB vote record exists.
      // The defense-in-depth DB check should catch this.
      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: playerIds[0],
          mapId: mapIds[1],
        })
      ).rejects.toThrow(/Player has already voted this round/);
    });

    it("admin vote triggers WINNER outcome through full multi-round flow (MULTIPLAYER)", async () => {
      // 2 players, 3 maps: need to eliminate 2 maps to get a winner
      const { t, authT, sessionId, playerIds, mapIds } =
        await createAdminMultiplayerSession({ playerCount: 2, mapPoolSize: 3 });

      // Round 1: both players vote same map -> 1 banned, 2 remain -> ROUND_ADVANCED
      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[0],
        mapId: mapIds[0],
      });
      const r1Result = await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[1],
        mapId: mapIds[0],
      });

      expect(r1Result.mapName).toBe("Map 1");
      expect(r1Result.isComplete).toBe(false);

      // Verify round advanced
      const sessionAfterR1 = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(sessionAfterR1?.currentRound).toBe(2);

      // Round 2: both players vote same map -> 1 banned, 1 remains -> WINNER
      await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[0],
        mapId: mapIds[1],
      });
      const r2Result = await authT.mutation(api.voting.adminVoteOnBehalf, {
        sessionId,
        playerId: playerIds[1],
        mapId: mapIds[1],
      });

      expect(r2Result.isComplete).toBe(true);
      expect(r2Result.winnerMapName).toBe("Map 3");

      // Verify session is complete
      const sessionAfterR2 = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(sessionAfterR2?.status).toBe("COMPLETE");
      expect(sessionAfterR2?.completedAt).toBeDefined();

      // Verify winner map state
      const winnerMap = await t.run(async (ctx) => ctx.db.get(mapIds[2]));
      expect(winnerMap?.state).toBe("WINNER");
    });

    it("rejects when player ID does not exist", async () => {
      const { t, authT, sessionId, mapIds } =
        await createAdminMultiplayerSession();

      // Create a player and then delete it to get a valid but non-existent ID
      const deletedPlayerId = await t.run(async (ctx) => {
        const tempPlayerId = await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            role: "PLAYER_99",
            teamName: "Team Deleted",
            ipAddress: "10.0.0.99",
            isConnected: true,
          })
        );
        await ctx.db.delete(tempPlayerId);
        return tempPlayerId;
      });

      await expect(
        authT.mutation(api.voting.adminVoteOnBehalf, {
          sessionId,
          playerId: deletedPlayerId,
          mapId: mapIds[0],
        })
      ).rejects.toThrow(/Player not found in session/);
    });
  });
});
