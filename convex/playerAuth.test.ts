/**
 * Player Auth Tests
 *
 * Tests for token validation with IP locking and player heartbeat.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
} from "./test.factories";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    it("succeeds for unactivated token (no IP to compare)", async () => {
      const t = createTestContext();
      const { token } = await createSessionWithUnactivatedPlayer(t);

      const result = await t.mutation(internal.playerAuth.playerHeartbeat, {
        token,
        ipAddress: "10.0.0.1",
      });

      // Heartbeat doesn't enforce activation - it just updates connection status
      expect(result).toEqual({ status: "ok" });
    });
  });
});
