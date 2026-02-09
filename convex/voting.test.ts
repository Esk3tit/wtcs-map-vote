/**
 * Voting Module Tests
 *
 * Tests for ABBA ban submission: validation errors, happy path,
 * completion logic, and audit logging.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  mapFactory,
} from "./test.factories";
import { internal } from "./_generated/api";
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
    sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    format?: "ABBA" | "MULTIPLAYER";
    mapPoolSize?: number;
    currentTurn?: number;
    playerAIp?: string;
    playerBIp?: string;
    tokenExpiresAt?: number;
  } = {}
): Promise<ABBASessionData> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const mapPoolSize = overrides.mapPoolSize ?? 5;
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, {
        format: overrides.format ?? "ABBA",
        status: overrides.sessionStatus ?? "IN_PROGRESS",
        mapPoolSize,
        playerCount: 2,
        currentTurn: overrides.currentTurn ?? 0,
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
});
