/**
 * Audit Logging Tests
 *
 * Tests for audit log functions: logActionMutation internal mutation,
 * getSessionAuditLog paginated query, and getRecentLogs query.
 *
 * Note: The logAction helper function is tested indirectly through mutations
 * that use it (in sessions.test.ts). This file focuses on unit testing the
 * public API and internal mutation directly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createTestContext } from "./test.setup";
import {
  adminFactory,
  sessionFactory,
  auditLogFactory,
} from "./test.factories";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

type TestContext = ReturnType<typeof createTestContext>;

/**
 * Creates an admin and session for test setup.
 */
async function createSessionWithAdmin(t: TestContext): Promise<{
  adminId: Id<"admins">;
  sessionId: Id<"sessions">;
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const sessionId = await ctx.db.insert("sessions", sessionFactory(adminId));
    return { adminId, sessionId };
  });
}

/**
 * Creates multiple audit logs with sequential timestamps for ordering tests.
 * Returns the log IDs in creation order (oldest to newest).
 */
async function createLogsWithSequentialTimestamps(
  t: TestContext,
  sessionId: Id<"sessions">,
  count: number
): Promise<Id<"auditLogs">[]> {
  return await t.run(async (ctx) => {
    const baseTime = 1000000; // Use a fixed base for predictable tests
    const logIds: Id<"auditLogs">[] = [];
    for (let i = 0; i < count; i++) {
      const logId = await ctx.db.insert(
        "auditLogs",
        auditLogFactory(sessionId, {
          timestamp: baseTime + i * 1000, // 1 second apart
          action: "SESSION_UPDATED", // Use valid action type
        })
      );
      logIds.push(logId);
    }
    return logIds;
  });
}

// ============================================================================
// logActionMutation Tests
// ============================================================================

describe("audit.logActionMutation", () => {
  describe("success cases", () => {
    it("creates audit log with all required fields", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_CREATED",
        actorType: "ADMIN",
      });

      expect(logId).toBeDefined();

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log).toMatchObject({
        sessionId,
        action: "SESSION_CREATED",
        actorType: "ADMIN",
      });
    });

    it("creates audit log with all optional fields", async () => {
      const t = createTestContext();
      const { sessionId, adminId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "MAP_BANNED",
        actorType: "ADMIN",
        actorId: adminId,
        details: {
          mapName: "Test Map",
          teamName: "Team Alpha",
          turn: 3,
          round: 1,
          reason: "Player choice",
        },
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log).toMatchObject({
        sessionId,
        action: "MAP_BANNED",
        actorType: "ADMIN",
        actorId: adminId,
        details: {
          mapName: "Test Map",
          teamName: "Team Alpha",
          turn: 3,
          round: 1,
          reason: "Player choice",
        },
      });
    });

    it("sets timestamp to current time", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const beforeCreate = Date.now();

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_CREATED",
        actorType: "SYSTEM",
      });

      const afterCreate = Date.now();

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.timestamp).toBeGreaterThanOrEqual(beforeCreate);
      expect(log?.timestamp).toBeLessThanOrEqual(afterCreate);
    });

    it("defaults details to empty object when not provided", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_CREATED",
        actorType: "SYSTEM",
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.details).toEqual({});
    });
  });

  describe("actor type variations", () => {
    it.each([
      ["ADMIN" as const],
      ["PLAYER" as const],
      ["SYSTEM" as const],
    ])("creates log with actorType %s", async (actorType) => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_CREATED",
        actorType,
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.actorType).toBe(actorType);
    });
  });

  describe("action type coverage", () => {
    it.each([
      // Session lifecycle
      ["SESSION_CREATED" as const, "session lifecycle"],
      ["SESSION_UPDATED" as const, "session lifecycle"],
      ["SESSION_DELETED" as const, "session lifecycle"],
      // Player events
      ["PLAYER_CONNECTED" as const, "player event"],
      ["PLAYER_ASSIGNED" as const, "player event"],
      // Map events
      ["MAP_BANNED" as const, "map event"],
      ["MAPS_ASSIGNED" as const, "map event"],
      // Voting actions
      ["VOTE_SUBMITTED" as const, "voting action"],
      // Round/Timer events
      ["ROUND_RESOLVED" as const, "round/timer event"],
      ["TIMER_EXPIRED" as const, "round/timer event"],
      ["WINNER_DECLARED" as const, "round/timer event"],
    ])("creates log for %s (%s)", async (action, _category) => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action,
        actorType: "SYSTEM",
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.action).toBe(action);
    });
  });

  describe("details validation", () => {
    it("handles all detail fields", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      // Create a session map for the mapId reference
      const mapId = await t.run(async (ctx) => {
        const masterMapId = await ctx.db.insert("maps", {
          name: "Test Map",
          isActive: true,
          updatedAt: Date.now(),
        });
        return await ctx.db.insert("sessionMaps", {
          sessionId,
          mapId: masterMapId,
          name: "Test Map",
          imageUrl: "https://example.com/map.png",
          state: "AVAILABLE",
        });
      });

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "MAP_BANNED",
        actorType: "PLAYER",
        details: {
          mapId,
          mapName: "Test Map",
          teamName: "Team Alpha",
          turn: 5,
          round: 2,
          reason: "Strategic choice",
        },
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.details).toMatchObject({
        mapId,
        mapName: "Test Map",
        teamName: "Team Alpha",
        turn: 5,
        round: 2,
        reason: "Strategic choice",
      });
    });

    it("handles partial details", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_PAUSED",
        actorType: "ADMIN",
        details: {
          reason: "Technical difficulties",
        },
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.details).toEqual({
        reason: "Technical difficulties",
      });
    });
  });
});

// ============================================================================
// getSessionAuditLog Tests
// ============================================================================

describe("audit.getSessionAuditLog", () => {
  describe("empty state", () => {
    it("returns empty result for session with no logs", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  describe("pagination", () => {
    it("returns correct page size", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 10);

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 3, cursor: null },
      });

      expect(result.page).toHaveLength(3);
    });

    it("continues from cursor correctly", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 5);

      const page1 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page1.page).toHaveLength(2);
      expect(page1.continueCursor).toBeDefined();

      const page2 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });

      expect(page2.page).toHaveLength(2);
    });

    it("sets isDone correctly for last page", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 3);

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(3);
      expect(result.isDone).toBe(true);
    });

    it("sets isDone: false when more pages available", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 10);

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 5, cursor: null },
      });

      expect(result.isDone).toBe(false);
    });

    it("has no overlap between pages", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 6);

      const page1 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 3, cursor: null },
      });

      const page2 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 3, cursor: page1.continueCursor },
      });

      const page1Ids = page1.page.map((log) => log._id);
      const page2Ids = page2.page.map((log) => log._id);

      // No ID should appear in both pages
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe("ordering", () => {
    it("returns logs in descending timestamp order (newest first)", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 5);

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      const timestamps = result.page.map((log) => log.timestamp);

      // Verify descending order
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i + 1]);
      }
    });

    it("maintains order across paginated results", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 6);

      const page1 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 3, cursor: null },
      });

      const page2 = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 3, cursor: page1.continueCursor },
      });

      // All page1 timestamps should be > all page2 timestamps
      const minPage1Timestamp = Math.min(
        ...page1.page.map((log) => log.timestamp)
      );
      const maxPage2Timestamp = Math.max(
        ...page2.page.map((log) => log.timestamp)
      );

      expect(minPage1Timestamp).toBeGreaterThan(maxPage2Timestamp);
    });
  });

  describe("session filtering", () => {
    it("only returns logs for specified session", async () => {
      const t = createTestContext();

      // Create two sessions with logs
      const { sessionId: session1Id, adminId } = await createSessionWithAdmin(t);
      const session2Id = await t.run(async (ctx) =>
        ctx.db.insert("sessions", sessionFactory(adminId, { matchName: "Session 2" }))
      );

      // Create logs for both sessions
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "auditLogs",
          auditLogFactory(session1Id, { action: "SESSION_CREATED" })
        );
        await ctx.db.insert(
          "auditLogs",
          auditLogFactory(session1Id, { action: "SESSION_UPDATED" })
        );
        await ctx.db.insert(
          "auditLogs",
          auditLogFactory(session2Id, { action: "SESSION_CREATED" })
        );
      });

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId: session1Id,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.page.every((log) => log.sessionId === session1Id)).toBe(
        true
      );
    });

    it("does not return logs from other sessions", async () => {
      const t = createTestContext();
      const { sessionId: session1Id, adminId } = await createSessionWithAdmin(t);
      const session2Id = await t.run(async (ctx) =>
        ctx.db.insert("sessions", sessionFactory(adminId, { matchName: "Session 2" }))
      );

      // Create logs only for session2
      await t.run(async (ctx) => {
        await ctx.db.insert(
          "auditLogs",
          auditLogFactory(session2Id, { action: "SESSION_CREATED" })
        );
      });

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId: session1Id,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(0);
    });
  });
});

// ============================================================================
// getRecentLogs Tests
// ============================================================================

describe("audit.getRecentLogs", () => {
  describe("default behavior", () => {
    it("returns default of 50 logs when limit not specified", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      // Create 60 logs
      await t.run(async (ctx) => {
        for (let i = 0; i < 60; i++) {
          await ctx.db.insert(
            "auditLogs",
            auditLogFactory(sessionId, { timestamp: Date.now() + i })
          );
        }
      });

      const result = await t.query(api.audit.getRecentLogs, { sessionId });

      expect(result).toHaveLength(50);
    });

    it("returns logs in descending timestamp order", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 5);

      const result = await t.query(api.audit.getRecentLogs, {
        sessionId,
        limit: 5,
      });

      const timestamps = result.map((log) => log.timestamp);

      // Verify descending order
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i + 1]);
      }
    });
  });

  describe("limit handling", () => {
    it("respects custom limit parameter", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 20);

      const result = await t.query(api.audit.getRecentLogs, {
        sessionId,
        limit: 7,
      });

      expect(result).toHaveLength(7);
    });

    it("returns fewer logs if fewer exist than limit", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      await createLogsWithSequentialTimestamps(t, sessionId, 3);

      const result = await t.query(api.audit.getRecentLogs, {
        sessionId,
        limit: 10,
      });

      expect(result).toHaveLength(3);
    });
  });

  describe("limit clamping", () => {
    // Share test data across all limit clamping tests to reduce database inserts
    // (6 tests × 150 logs = 900 inserts → 150 inserts once)
    let sharedSessionId: Id<"sessions">;
    let sharedContext: ReturnType<typeof createTestContext>;

    beforeAll(async () => {
      sharedContext = createTestContext();
      const { sessionId } = await createSessionWithAdmin(sharedContext);
      sharedSessionId = sessionId;

      // Create more logs than max limit to ensure clamping is testable
      await sharedContext.run(async (ctx) => {
        for (let i = 0; i < 150; i++) {
          await ctx.db.insert(
            "auditLogs",
            auditLogFactory(sharedSessionId, { timestamp: Date.now() + i })
          );
        }
      });
    });

    it.each([
      { input: 0, expected: 1, description: "clamps 0 to minimum of 1" },
      { input: -5, expected: 1, description: "clamps negative to minimum of 1" },
      { input: 1, expected: 1, description: "accepts minimum boundary (1)" },
      { input: 50, expected: 50, description: "accepts default value (50)" },
      { input: 100, expected: 100, description: "accepts maximum boundary (100)" },
      { input: 200, expected: 100, description: "clamps over-limit to maximum of 100" },
    ])("$description (limit: $input)", async ({ input, expected }) => {
      const result = await sharedContext.query(api.audit.getRecentLogs, {
        sessionId: sharedSessionId,
        limit: input,
      });

      expect(result).toHaveLength(expected);
    });
  });
});

// ============================================================================
// Audit Log Immutability (Design Documentation - No Tests Required)
// ============================================================================
//
// The audit module is immutable by design - it only exposes query functions
// and an internal mutation. There are no public update/delete mutations.
//
// This is verified by:
// 1. Code inspection: convex/audit.ts only exports getSessionAuditLog and
//    getRecentLogs queries, plus logActionMutation as an internal mutation
// 2. TypeScript: The api.audit type only includes the query functions
// 3. The orphaned reference test in sessions.test.ts verifies logs survive
//    session deletion (they are intentionally kept as orphaned references)
//
// Note: Orphaned reference preservation (logs survive session deletion)
// is tested in sessions.test.ts under "deleteSession preserves audit logs"

// ============================================================================
// Edge Cases
// ============================================================================

describe("audit log edge cases", () => {
  describe("boundary conditions", () => {
    it("handles session with exactly one log", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("auditLogs", auditLogFactory(sessionId));
      });

      const paginatedResult = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(paginatedResult.page).toHaveLength(1);
      expect(paginatedResult.isDone).toBe(true);

      const recentResult = await t.query(api.audit.getRecentLogs, {
        sessionId,
        limit: 10,
      });

      expect(recentResult).toHaveLength(1);
    });

    it("handles logs with identical timestamps (deterministic order)", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);
      const sameTimestamp = 1000000;

      // Create multiple logs with identical timestamps and capture their IDs
      const logIds = await t.run(async (ctx) => {
        const ids: Id<"auditLogs">[] = [];
        for (let i = 0; i < 5; i++) {
          const logId = await ctx.db.insert(
            "auditLogs",
            auditLogFactory(sessionId, {
              timestamp: sameTimestamp,
              action: "SESSION_UPDATED",
            })
          );
          ids.push(logId);
        }
        return ids;
      });

      const result = await t.query(api.audit.getSessionAuditLog, {
        sessionId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      // All 5 logs should be returned
      expect(result.page).toHaveLength(5);
      // All timestamps should be the same
      expect(result.page.every((log) => log.timestamp === sameTimestamp)).toBe(
        true
      );

      // Verify deterministic order (Convex uses _id descending as tie-breaker)
      const returnedIds = result.page.map((log) => log._id);
      const expectedOrder = [...logIds].reverse();
      expect(returnedIds).toEqual(expectedOrder);
    });
  });

  describe("optional fields", () => {
    it("handles undefined actorId correctly", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "TIMER_EXPIRED",
        actorType: "SYSTEM",
        // actorId intentionally omitted
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.actorId).toBeUndefined();
    });

    it("handles empty details object correctly", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "SESSION_STARTED",
        actorType: "ADMIN",
        details: {},
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.details).toEqual({});
    });

    it("handles details with only some fields populated", async () => {
      const t = createTestContext();
      const { sessionId } = await createSessionWithAdmin(t);

      const logId = await t.mutation(internal.audit.logActionMutation, {
        sessionId,
        action: "ROUND_RESOLVED",
        actorType: "SYSTEM",
        details: {
          round: 3,
          // Other fields intentionally omitted
        },
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));
      expect(log?.details).toEqual({ round: 3 });
    });
  });
});
