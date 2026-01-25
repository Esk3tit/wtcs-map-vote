/**
 * Cascade Delete Tests
 *
 * Tests for the deleteSessionWithCascade internal mutation that handles
 * atomic deletion of sessions and all related records (votes, players,
 * maps, audit logs).
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
  sessionMapFactory,
  voteFactory,
  auditLogFactory,
  teamFactory,
  mapFactory,
  createDeletedSessionId,
} from "./test.factories";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

type TestContext = ReturnType<typeof createTestContext>;

/**
 * Creates a full session with related records for cascade delete testing.
 */
async function createFullSessionForCascade(
  t: TestContext
): Promise<{
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
  playerIds: Id<"sessionPlayers">[];
  mapIds: Id<"sessionMaps">[];
  voteIds: Id<"votes">[];
  auditLogIds: Id<"auditLogs">[];
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status: "DRAFT", playerCount: 2, mapPoolSize: 3 })
    );

    // Create teams
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
        sessionPlayerFactory(sessionId, { role: "Vice Captain", teamName: "Team Beta" })
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

    // Create audit logs
    const auditLogIds = await Promise.all([
      ctx.db.insert("auditLogs", auditLogFactory(sessionId, { action: "SESSION_CREATED" })),
      ctx.db.insert("auditLogs", auditLogFactory(sessionId, { action: "PLAYER_ASSIGNED" })),
    ]);

    return { sessionId, adminId, playerIds, mapIds, voteIds, auditLogIds };
  });
}

// ============================================================================
// deleteSessionWithCascade Tests
// ============================================================================

describe("lib/cascadeDelete.deleteSessionWithCascade", () => {
  describe("error cases", () => {
    it("throws ConvexError for non-existent session", async () => {
      const t = createTestContext();
      const deletedSessionId = await createDeletedSessionId(t);

      await expect(
        t.mutation(internal.lib.cascadeDelete.deleteSessionWithCascade, {
          sessionId: deletedSessionId,
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("successful deletion", () => {
    it("deletes session and all related records", async () => {
      const t = createTestContext();
      const {
        sessionId,
        playerIds,
        mapIds,
        voteIds,
        auditLogIds,
      } = await createFullSessionForCascade(t);

      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId }
      );

      expect(result.deleted.session).toBe(1);
      expect(result.deleted.votes).toBe(2);
      expect(result.deleted.players).toBe(2);
      expect(result.deleted.maps).toBe(3);
      expect(result.deleted.auditLogs).toBe(2);

      // Verify all records are deleted
      const [session, players, maps, votes, logs] = await t.run(async (ctx) => {
        const session = await ctx.db.get(sessionId);
        const players = await Promise.all(playerIds.map((id) => ctx.db.get(id)));
        const maps = await Promise.all(mapIds.map((id) => ctx.db.get(id)));
        const votes = await Promise.all(voteIds.map((id) => ctx.db.get(id)));
        const logs = await Promise.all(auditLogIds.map((id) => ctx.db.get(id)));
        return [session, players, maps, votes, logs];
      });

      expect(session).toBeNull();
      expect(players.every((p) => p === null)).toBe(true);
      expect(maps.every((m) => m === null)).toBe(true);
      expect(votes.every((v) => v === null)).toBe(true);
      expect(logs.every((l) => l === null)).toBe(true);
    });

    it("preserves audit logs when preserveAuditLogs=true", async () => {
      const t = createTestContext();
      const { sessionId, auditLogIds } = await createFullSessionForCascade(t);

      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId, preserveAuditLogs: true }
      );

      expect(result.deleted.session).toBe(1);
      expect(result.deleted.auditLogs).toBe(0);

      // Verify audit logs still exist
      const logs = await t.run(async (ctx) =>
        Promise.all(auditLogIds.map((id) => ctx.db.get(id)))
      );

      expect(logs.every((l) => l !== null)).toBe(true);
    });

    it("deletes audit logs when preserveAuditLogs=false (default)", async () => {
      const t = createTestContext();
      const { sessionId, auditLogIds } = await createFullSessionForCascade(t);

      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId, preserveAuditLogs: false }
      );

      expect(result.deleted.auditLogs).toBe(2);

      // Verify audit logs are deleted
      const logs = await t.run(async (ctx) =>
        Promise.all(auditLogIds.map((id) => ctx.db.get(id)))
      );

      expect(logs.every((l) => l === null)).toBe(true);
    });

    it("returns accurate deletion counts", async () => {
      const t = createTestContext();

      // Create a session with specific counts
      const { sessionId } = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId, { status: "DRAFT" })
        );
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));

        // 3 players
        const playerIds = await Promise.all([
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, { role: "P1", teamName: "Team A" })
          ),
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, { role: "P2", teamName: "Team A" })
          ),
          ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, { role: "P3", teamName: "Team A" })
          ),
        ]);

        // 4 maps
        const mapId = await ctx.db.insert("maps", mapFactory());
        const sessionMapIds = await Promise.all([
          ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, mapId, { name: "M1" })),
          ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, mapId, { name: "M2" })),
          ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, mapId, { name: "M3" })),
          ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, mapId, { name: "M4" })),
        ]);

        // 5 votes
        await Promise.all([
          ctx.db.insert("votes", voteFactory(sessionId, playerIds[0], sessionMapIds[0])),
          ctx.db.insert("votes", voteFactory(sessionId, playerIds[0], sessionMapIds[1])),
          ctx.db.insert("votes", voteFactory(sessionId, playerIds[1], sessionMapIds[0])),
          ctx.db.insert("votes", voteFactory(sessionId, playerIds[1], sessionMapIds[1])),
          ctx.db.insert("votes", voteFactory(sessionId, playerIds[2], sessionMapIds[0])),
        ]);

        // 1 audit log
        await ctx.db.insert("auditLogs", auditLogFactory(sessionId));

        return { sessionId };
      });

      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId }
      );

      expect(result.deleted).toEqual({
        votes: 5,
        players: 3,
        maps: 4,
        auditLogs: 1,
        session: 1,
      });
    });

    it("handles session with no related records", async () => {
      const t = createTestContext();

      const sessionId = await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        return ctx.db.insert("sessions", sessionFactory(adminId));
      });

      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId }
      );

      expect(result.deleted).toEqual({
        votes: 0,
        players: 0,
        maps: 0,
        auditLogs: 0,
        session: 1,
      });

      // Verify session is deleted
      const session = await t.run(async (ctx) => ctx.db.get(sessionId));
      expect(session).toBeNull();
    });
  });

  describe("referential integrity", () => {
    it("deletes votes before players (votes reference players)", async () => {
      const t = createTestContext();
      const { sessionId } = await createFullSessionForCascade(t);

      // If the deletion order was wrong (players before votes), this would fail
      // because Convex would try to delete players that votes reference.
      // The test passes if no error is thrown.
      const result = await t.mutation(
        internal.lib.cascadeDelete.deleteSessionWithCascade,
        { sessionId }
      );

      expect(result.deleted.votes).toBe(2);
      expect(result.deleted.players).toBe(2);
    });
  });
});
