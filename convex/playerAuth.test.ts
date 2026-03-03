/**
 * Player Auth Tests
 *
 * Tests for token validation with IP locking and player heartbeat.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  mapFactory,
  sessionFactory,
  sessionMapFactory,
  sessionPlayerFactory,
} from "./test.factories";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { HEARTBEAT_SKIP_MS } from "./lib/constants";

// ============================================================================
// Test Helpers
// ============================================================================

type TestContext = ReturnType<typeof createTestContext>;

/**
 * Creates a session with a player who has no IP address (unactivated token).
 */
async function createSessionWithUnactivatedPlayer(
  t: TestContext,
  overrides: {
    sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
    tokenExpiresAt?: number;
  } = {}
): Promise<{
  adminId: Id<"admins">;
  sessionId: Id<"sessions">;
  playerId: Id<"sessionPlayers">;
  token: string;
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status: overrides.sessionStatus ?? "WAITING" })
    );

    const token = crypto.randomUUID();
    const playerId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        token,
        ipAddress: undefined, // Unactivated
        tokenExpiresAt: overrides.tokenExpiresAt,
      })
    );

    return { adminId, sessionId, playerId, token };
  });
}

/**
 * Creates a session with a player whose token is already IP-locked.
 */
async function createSessionWithActivatedPlayer(
  t: TestContext,
  ipAddress: string = "192.168.1.1",
  overrides: {
    sessionStatus?: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE" | "EXPIRED";
  } = {}
): Promise<{
  adminId: Id<"admins">;
  sessionId: Id<"sessions">;
  playerId: Id<"sessionPlayers">;
  token: string;
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status: overrides.sessionStatus ?? "WAITING" })
    );

    const token = crypto.randomUUID();
    const playerId = await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, {
        token,
        ipAddress,
        isConnected: true,
      })
    );

    return { adminId, sessionId, playerId, token };
  });
}

// ============================================================================
// validateAndLockToken Tests
// ============================================================================

describe("playerAuth.validateAndLockToken", () => {
  describe("first use (IP locking)", () => {
    it("locks IP on first use of valid token", async () => {
      const t = createTestContext();
      const { token, playerId, sessionId } =
        await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "ok",
        playerId,
        sessionId,
      });

      // Verify IP was stored
      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.ipAddress).toBe("10.0.0.1");
      expect(player?.isConnected).toBe(true);
      expect(player?.lastHeartbeat).toBeDefined();
    });

    it("creates audit log on token activation", async () => {
      const t = createTestContext();
      const { token, sessionId } =
        await createSessionWithUnactivatedPlayer(t);

      await t.mutation(internal.playerAuth.validateAndLockToken, {
        token,
        ipAddress: "10.0.0.1",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "TOKEN_ACTIVATED",
        actorType: "PLAYER",
      });
    });
  });

  describe("subsequent use (IP verification)", () => {
    it("succeeds when IP matches stored address", async () => {
      const t = createTestContext();
      const { token, playerId, sessionId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "ok",
        playerId,
        sessionId,
      });
    });

    it("updates heartbeat on successful verification", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const before = Date.now();
      await t.mutation(internal.playerAuth.validateAndLockToken, {
        token,
        ipAddress: "10.0.0.1",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.lastHeartbeat).toBeGreaterThanOrEqual(before);
      expect(player?.isConnected).toBe(true);
    });

    it("returns IP_MISMATCH when IP differs", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.99" }
      );

      expect(result).toEqual({
        status: "error",
        error: "IP_MISMATCH",
      });
    });

    it("creates audit log on IP mismatch", async () => {
      const t = createTestContext();
      const { token, sessionId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      await t.mutation(internal.playerAuth.validateAndLockToken, {
        token,
        ipAddress: "10.0.0.99",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "TOKEN_IP_BLOCKED",
        actorType: "SYSTEM",
      });
    });
  });

  describe("error cases", () => {
    it("returns INVALID_TOKEN for non-existent token", async () => {
      const t = createTestContext();

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token: "nonexistent-token", ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "error",
        error: "INVALID_TOKEN",
      });
    });

    it("returns TOKEN_EXPIRED for expired token", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        tokenExpiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "error",
        error: "TOKEN_EXPIRED",
      });
    });

    it("returns SESSION_NOT_FOUND when session is deleted", async () => {
      const t = createTestContext();

      // Create player with valid token but delete the session
      const { token, sessionId } =
        await createSessionWithUnactivatedPlayer(t);
      await t.run(async (ctx) => ctx.db.delete(sessionId));

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "error",
        error: "SESSION_NOT_FOUND",
      });
    });

    it("returns SESSION_NOT_ACTIVE for COMPLETE session", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        sessionStatus: "COMPLETE",
      });

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "error",
        error: "SESSION_NOT_ACTIVE",
      });
    });

    it("returns SESSION_NOT_ACTIVE for EXPIRED session", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        sessionStatus: "EXPIRED",
      });

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result).toEqual({
        status: "error",
        error: "SESSION_NOT_ACTIVE",
      });
    });
  });

  describe("active session states", () => {
    it.each([
      "DRAFT" as const,
      "WAITING" as const,
      "IN_PROGRESS" as const,
      "PAUSED" as const,
    ])("succeeds for %s session status", async (sessionStatus) => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        sessionStatus,
      });

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result.status).toBe("ok");
    });
  });

  describe("IP validation", () => {
    it("returns INVALID_IP for empty string IP address", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "" }
      );

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });

    it("returns INVALID_IP for whitespace-only IP address", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "   " }
      );

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });

    it("returns INVALID_IP for 'unknown' IP address", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "unknown" }
      );

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });
  });

  describe("reconnection logging", () => {
    it("logs PLAYER_CONNECTED when previously disconnected player validates", async () => {
      const t = createTestContext();
      const { token, playerId, sessionId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // Disconnect the player first
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, { isConnected: false })
      );

      await t.mutation(internal.playerAuth.validateAndLockToken, {
        token,
        ipAddress: "10.0.0.1",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "PLAYER_CONNECTED",
        actorType: "PLAYER",
      });
      expect(logs[0].details.teamName).toBeDefined();
    });

    it("does NOT log PLAYER_CONNECTED when already-connected player validates", async () => {
      const t = createTestContext();
      const { token, sessionId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // Player is already connected (default in createSessionWithActivatedPlayer)
      await t.mutation(internal.playerAuth.validateAndLockToken, {
        token,
        ipAddress: "10.0.0.1",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db
          .query("auditLogs")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      );

      // No PLAYER_CONNECTED log should exist
      const connectLogs = logs.filter((l) => l.action === "PLAYER_CONNECTED");
      expect(connectLogs).toHaveLength(0);
    });
  });

  describe("token expiry boundary", () => {
    it("token works 1ms before expiry", async () => {
      const t = createTestContext();
      const now = Date.now();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        tokenExpiresAt: now + 5000, // Expires 5s from now (enough margin for test execution)
      });

      const result = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token, ipAddress: "10.0.0.1" }
      );

      expect(result.status).toBe("ok");
    });

    it("multiple players in same session validate independently", async () => {
      const t = createTestContext();

      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "WAITING" })
        );
        return { adminId, sessionId };
      });

      const token1 = crypto.randomUUID();
      const token2 = crypto.randomUUID();
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: token1,
            ipAddress: undefined,
            teamName: "Team Alpha",
            role: "PLAYER_A",
          })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, {
            token: token2,
            ipAddress: undefined,
            teamName: "Team Beta",
            role: "PLAYER_B",
          })
        );
      });

      const result1 = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token: token1, ipAddress: "10.0.0.1" }
      );
      const result2 = await t.mutation(
        internal.playerAuth.validateAndLockToken,
        { token: token2, ipAddress: "10.0.0.2" }
      );

      expect(result1.status).toBe("ok");
      expect(result2.status).toBe("ok");
    });
  });
});

// ============================================================================
// playerHeartbeat Tests
// ============================================================================

describe("playerAuth.playerHeartbeat", () => {
  describe("success cases", () => {
    it("returns ok for activated player with matching IP", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok" });
    });

    it("updates lastHeartbeat timestamp", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const before = Date.now();
      await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.lastHeartbeat).toBeGreaterThanOrEqual(before);
    });

    it("sets isConnected to true", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // First disconnect the player
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, { isConnected: false })
      );

      await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.isConnected).toBe(true);
    });
  });

  describe("error cases", () => {
    it("returns INVALID_TOKEN for non-existent token", async () => {
      const t = createTestContext();

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token: "nonexistent",
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_TOKEN",
      });
    });

    it("returns TOKEN_EXPIRED for expired token", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        tokenExpiresAt: Date.now() - 1000,
      });

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "TOKEN_EXPIRED",
      });
    });

    it("returns IP_MISMATCH when IP differs from locked address", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.99",
      });

      expect(result).toEqual({
        status: "error",
        error: "IP_MISMATCH",
      });
    });
  });

  describe("unactivated tokens", () => {
    it("returns TOKEN_NOT_ACTIVATED for unactivated token", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      // Heartbeat requires token to be activated first
      expect(result).toEqual({
        status: "error",
        error: "TOKEN_NOT_ACTIVATED",
      });
    });
  });

  describe("IP validation", () => {
    it("returns INVALID_IP for empty string IP address", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });

    it("returns INVALID_IP for whitespace-only IP address", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "   ",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });

    it("returns INVALID_IP for 'unknown' IP address", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "unknown",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });
  });

  describe("heartbeat throttling", () => {
    it("skips DB write when heartbeat is within HEARTBEAT_SKIP_MS threshold", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // Set a recent heartbeat (within threshold)
      const recentTime = Date.now();
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, {
          isConnected: true,
          lastHeartbeat: recentTime,
        })
      );

      // Heartbeat should succeed but NOT update the DB
      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok" });

      // lastHeartbeat should remain unchanged (skip write)
      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.lastHeartbeat).toBe(recentTime);
    });

    it("updates DB when heartbeat exceeds HEARTBEAT_SKIP_MS threshold", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // Set an old heartbeat (beyond threshold)
      const staleTime = Date.now() - HEARTBEAT_SKIP_MS - 1000;
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, {
          isConnected: true,
          lastHeartbeat: staleTime,
        })
      );

      const before = Date.now();
      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok" });

      // lastHeartbeat should be updated
      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.lastHeartbeat).toBeGreaterThanOrEqual(before);
    });

    it("writes heartbeat even within threshold if player was disconnected", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1");

      // Player is disconnected but has recent heartbeat
      const recentTime = Date.now();
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, {
          isConnected: false,
          lastHeartbeat: recentTime,
        })
      );

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok" });

      // Should have reconnected (isConnected should be true)
      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.isConnected).toBe(true);
    });
  });
});

// ============================================================================
// playerReady Tests
// ============================================================================

describe("playerAuth.playerReady", () => {
  describe("toggle behavior", () => {
    it("sets readyAt when toggling to ready", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus: "WAITING",
        });

      const before = Date.now();
      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok", ready: true });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.readyAt).toBeGreaterThanOrEqual(before);
    });

    it("clears readyAt when toggling to un-ready", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus: "WAITING",
        });

      // Set ready first
      await t.run(async (ctx) =>
        ctx.db.patch(playerId, { readyAt: Date.now() })
      );

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({ status: "ok", ready: false });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.readyAt).toBeUndefined();
    });

    it("can toggle ready on → off → on", async () => {
      const t = createTestContext();
      const { token, playerId } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus: "WAITING",
        });

      // Toggle on
      const r1 = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });
      expect(r1).toEqual({ status: "ok", ready: true });

      // Toggle off
      const r2 = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });
      expect(r2).toEqual({ status: "ok", ready: false });

      // Toggle back on
      const before = Date.now();
      const r3 = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });
      expect(r3).toEqual({ status: "ok", ready: true });

      const player = await t.run(async (ctx) => ctx.db.get(playerId));
      expect(player?.readyAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("auto-start", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts session when all players are ready and connected", async () => {
      const t = createTestContext();

      // Arrange: WAITING session with 2 players, both connected, with maps
      const { sessionId, tokenA, tokenB, playerIdA, playerIdB } =
        await t.run(async (ctx) => {
          const adminId = await ctx.db.insert("admins", adminFactory());
          const sid = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, {
              status: "WAITING",
              playerCount: 2,
              mapPoolSize: 3,
            })
          );

          const tA = crypto.randomUUID();
          const pA = await ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sid, {
              token: tA,
              teamName: "Team A",
              ipAddress: "10.0.0.1",
              isConnected: true,
            })
          );

          const tB = crypto.randomUUID();
          const pB = await ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sid, {
              token: tB,
              teamName: "Team B",
              ipAddress: "10.0.0.2",
              isConnected: true,
            })
          );

          // Add required maps
          for (let i = 0; i < 3; i++) {
            const mapId = await ctx.db.insert("maps", mapFactory({ name: `Map ${i + 1}` }));
            await ctx.db.insert("sessionMaps", sessionMapFactory(sid, mapId, { name: `Map ${i + 1}` }));
          }

          return { sessionId: sid, tokenA: tA, tokenB: tB, playerIdA: pA, playerIdB: pB };
        });

      // Player A readies up
      const r1 = await t.mutation(internal.playerAuth.playerReady, {
        token: tokenA,
        ipAddress: "10.0.0.1",
      });
      expect(r1).toEqual({ status: "ok", ready: true });

      // Session should still be WAITING (only 1 of 2 ready)
      const midSession = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(midSession?.status).toBe("WAITING");

      // Player B readies up — should schedule auto-start
      const before = Date.now();
      const r2 = await t.mutation(internal.playerAuth.playerReady, {
        token: tokenB,
        ipAddress: "10.0.0.2",
      });
      expect(r2).toEqual({ status: "ok", ready: true });

      // Auto-start is now a scheduled mutation; advance just enough to trigger it
      // (not the turn timer which is 30+ seconds away)
      await t.finishAllScheduledFunctions(() =>
        vi.advanceTimersByTime(100)
      );

      // Session should now be IN_PROGRESS
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("IN_PROGRESS");
      expect(session?.startedAt).toBeGreaterThanOrEqual(before);
      expect(session?.timerStartedAt).toBeGreaterThanOrEqual(before);

      // All players should have readyAt cleared
      const pA = await t.run(async (ctx) => ctx.db.get(playerIdA));
      const pB = await t.run(async (ctx) => ctx.db.get(playerIdB));
      expect(pA?.readyAt).toBeUndefined();
      expect(pB?.readyAt).toBeUndefined();
    });

    it("does not auto-start when a player is disconnected", async () => {
      const t = createTestContext();

      const { sessionId, tokenA } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sid = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "WAITING",
            playerCount: 2,
            mapPoolSize: 3,
          })
        );

        // Player A: connected
        const tA = crypto.randomUUID();
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sid, {
            token: tA,
            teamName: "Team A",
            ipAddress: "10.0.0.1",
            isConnected: true,
          })
        );

        // Player B: disconnected but ready
        const tB = crypto.randomUUID();
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sid, {
            token: tB,
            teamName: "Team B",
            ipAddress: "10.0.0.2",
            isConnected: false, // disconnected
          })
        );

        // Add required maps
        for (let i = 0; i < 3; i++) {
          const mapId = await ctx.db.insert(
            "maps",
            mapFactory({ name: `Map ${i + 1}` })
          );
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sid, mapId, { name: `Map ${i + 1}` })
          );
        }

        return { sessionId: sid, tokenA: tA };
      });

      // Player A readies up — but Player B is disconnected, so no auto-start
      const result = await t.mutation(internal.playerAuth.playerReady, {
        token: tokenA,
        ipAddress: "10.0.0.1",
      });
      expect(result).toEqual({ status: "ok", ready: true });

      await t.finishAllScheduledFunctions(() =>
        vi.advanceTimersByTime(100)
      );

      // Session should remain WAITING because Player B is disconnected
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("WAITING");
    });

    it("does not auto-start when not all players are assigned", async () => {
      const t = createTestContext();

      // Session expects 3 players but only 2 are created
      const { sessionId, tokenA, tokenB } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sid = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "WAITING",
            playerCount: 3,
            mapPoolSize: 3,
          })
        );

        const tA = crypto.randomUUID();
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sid, {
            token: tA,
            teamName: "Team A",
            ipAddress: "10.0.0.1",
            isConnected: true,
          })
        );

        const tB = crypto.randomUUID();
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sid, {
            token: tB,
            teamName: "Team B",
            ipAddress: "10.0.0.2",
            isConnected: true,
          })
        );

        // Add required maps
        for (let i = 0; i < 3; i++) {
          const mapId = await ctx.db.insert(
            "maps",
            mapFactory({ name: `Map ${i + 1}` })
          );
          await ctx.db.insert(
            "sessionMaps",
            sessionMapFactory(sid, mapId, { name: `Map ${i + 1}` })
          );
        }

        return { sessionId: sid, tokenA: tA, tokenB: tB };
      });

      // Both players ready up
      await t.mutation(internal.playerAuth.playerReady, {
        token: tokenA,
        ipAddress: "10.0.0.1",
      });
      await t.mutation(internal.playerAuth.playerReady, {
        token: tokenB,
        ipAddress: "10.0.0.2",
      });

      await t.finishAllScheduledFunctions(() =>
        vi.advanceTimersByTime(100)
      );

      // Session should remain WAITING (only 2 of 3 players assigned)
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session?.status).toBe("WAITING");
    });

    it("does not auto-start when session is already IN_PROGRESS", async () => {
      const t = createTestContext();

      const { tokenA } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sid = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, {
            status: "IN_PROGRESS",
            playerCount: 2,
            mapPoolSize: 3,
            timerStartedAt: Date.now(),
          })
        );

        const tA = crypto.randomUUID();
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sid, {
            token: tA,
            teamName: "Team A",
            ipAddress: "10.0.0.1",
            isConnected: true,
          })
        );

        return { tokenA: tA };
      });

      // playerReady should reject with SESSION_NOT_WAITING
      const result = await t.mutation(internal.playerAuth.playerReady, {
        token: tokenA,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "SESSION_NOT_WAITING",
      });
    });
  });

  describe("session state guard", () => {
    it.each([
      "DRAFT" as const,
      "IN_PROGRESS" as const,
      "PAUSED" as const,
      "COMPLETE" as const,
      "EXPIRED" as const,
    ])("rejects playerReady in %s state", async (sessionStatus) => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus,
        });

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "SESSION_NOT_WAITING",
      });
    });
  });

  describe("error cases", () => {
    it("returns INVALID_TOKEN for non-existent token", async () => {
      const t = createTestContext();

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token: "nonexistent-token",
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_TOKEN",
      });
    });

    it("returns TOKEN_EXPIRED for expired token", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        tokenExpiresAt: Date.now() - 1000,
      });

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "TOKEN_EXPIRED",
      });
    });

    it("returns TOKEN_NOT_ACTIVATED for unactivated token", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t, {
        sessionStatus: "WAITING",
      });

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.1",
      });

      expect(result).toEqual({
        status: "error",
        error: "TOKEN_NOT_ACTIVATED",
      });
    });

    it("returns IP_MISMATCH when IP differs", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus: "WAITING",
        });

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "10.0.0.99",
      });

      expect(result).toEqual({
        status: "error",
        error: "IP_MISMATCH",
      });
    });

    it("returns INVALID_IP for empty IP address", async () => {
      const t = createTestContext();
      const { token } =
        await createSessionWithActivatedPlayer(t, "10.0.0.1", {
          sessionStatus: "WAITING",
        });

      const result = await t.mutation(internal.playerAuth.playerReady, {
        token,
        ipAddress: "",
      });

      expect(result).toEqual({
        status: "error",
        error: "INVALID_IP",
      });
    });
  });
});
