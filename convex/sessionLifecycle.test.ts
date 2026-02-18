/**
 * Session Lifecycle Tests
 *
 * Comprehensive tests for the centralized session state transition system:
 * - validateTransition: valid and invalid transitions
 * - requireSessionStatus: allowed-state guard for non-transition checks
 * - guardFinalize: player count and map count preconditions
 * - guardStart: player connectivity preconditions
 * - transitionSession: atomic validate + patch + audit
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
import type { SessionStatus } from "./lib/constants";
import {
  VALID_TRANSITIONS,
  SESSION_RESET_PATCHES,
  EDITABLE_STATUSES,
  RESETTABLE_STATUSES,
  MAP_POOL_STATUSES,
  DELETABLE_STATUSES,
} from "./lib/constants";
import {
  validateTransition,
  requireSessionStatus,
  guardFinalize,
  guardStart,
  transitionSession,
} from "./lib/sessionLifecycle";

// ============================================================================
// Test Helpers
// ============================================================================

/** All session statuses for exhaustive testing. */
const ALL_STATUSES: SessionStatus[] = [
  "DRAFT",
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETE",
  "EXPIRED",
];

// ============================================================================
// validateTransition
// ============================================================================

describe("validateTransition", () => {
  describe("valid transitions", () => {
    it("allows DRAFT -> WAITING (finalize)", () => {
      expect(() => validateTransition("DRAFT", "WAITING")).not.toThrow();
    });

    it("allows DRAFT -> COMPLETE (force end)", () => {
      expect(() => validateTransition("DRAFT", "COMPLETE")).not.toThrow();
    });

    it("allows WAITING -> IN_PROGRESS (start)", () => {
      expect(() => validateTransition("WAITING", "IN_PROGRESS")).not.toThrow();
    });

    it("allows WAITING -> COMPLETE (force end)", () => {
      expect(() => validateTransition("WAITING", "COMPLETE")).not.toThrow();
    });

    it("allows IN_PROGRESS -> PAUSED (pause)", () => {
      expect(() =>
        validateTransition("IN_PROGRESS", "PAUSED")
      ).not.toThrow();
    });

    it("allows IN_PROGRESS -> COMPLETE (end/winner)", () => {
      expect(() =>
        validateTransition("IN_PROGRESS", "COMPLETE")
      ).not.toThrow();
    });

    it("allows PAUSED -> IN_PROGRESS (resume)", () => {
      expect(() =>
        validateTransition("PAUSED", "IN_PROGRESS")
      ).not.toThrow();
    });

    it("allows PAUSED -> COMPLETE (force end)", () => {
      expect(() => validateTransition("PAUSED", "COMPLETE")).not.toThrow();
    });

    it("allows COMPLETE -> WAITING (reset)", () => {
      expect(() => validateTransition("COMPLETE", "WAITING")).not.toThrow();
    });
  });

  describe("invalid transitions", () => {
    it.each([
      ["DRAFT", "IN_PROGRESS"],
      ["DRAFT", "PAUSED"],
      ["DRAFT", "EXPIRED"],
      ["DRAFT", "DRAFT"],
    ] as [SessionStatus, SessionStatus][])(
      "rejects DRAFT -> %s",
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(
          /Cannot transition from DRAFT/
        );
      }
    );

    it.each([
      ["WAITING", "DRAFT"],
      ["WAITING", "PAUSED"],
      ["WAITING", "EXPIRED"],
      ["WAITING", "WAITING"],
    ] as [SessionStatus, SessionStatus][])(
      "rejects WAITING -> %s",
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(
          /Cannot transition from WAITING/
        );
      }
    );

    it.each([
      ["IN_PROGRESS", "DRAFT"],
      ["IN_PROGRESS", "WAITING"],
      ["IN_PROGRESS", "EXPIRED"],
      ["IN_PROGRESS", "IN_PROGRESS"],
    ] as [SessionStatus, SessionStatus][])(
      "rejects IN_PROGRESS -> %s",
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(
          /Cannot transition from IN_PROGRESS/
        );
      }
    );

    it.each([
      ["PAUSED", "DRAFT"],
      ["PAUSED", "WAITING"],
      ["PAUSED", "EXPIRED"],
      ["PAUSED", "PAUSED"],
    ] as [SessionStatus, SessionStatus][])(
      "rejects PAUSED -> %s",
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(
          /Cannot transition from PAUSED/
        );
      }
    );

    it.each([
      ["COMPLETE", "DRAFT"],
      ["COMPLETE", "IN_PROGRESS"],
      ["COMPLETE", "PAUSED"],
      ["COMPLETE", "EXPIRED"],
      ["COMPLETE", "COMPLETE"],
    ] as [SessionStatus, SessionStatus][])(
      "rejects COMPLETE -> %s",
      (from, to) => {
        expect(() => validateTransition(from, to)).toThrow(
          /Cannot transition from COMPLETE/
        );
      }
    );
  });

  describe("terminal state (EXPIRED)", () => {
    it.each(ALL_STATUSES)(
      "rejects EXPIRED -> %s",
      (target) => {
        expect(() => validateTransition("EXPIRED", target)).toThrow(
          /Cannot transition from EXPIRED.*terminal state/
        );
      }
    );
  });

  describe("error messages", () => {
    it("lists valid transitions in error message", () => {
      expect(() => validateTransition("DRAFT", "IN_PROGRESS")).toThrow(
        /Valid transitions: WAITING, COMPLETE/
      );
    });

    it("shows terminal state message for EXPIRED", () => {
      expect(() => validateTransition("EXPIRED", "DRAFT")).toThrow(
        "Cannot transition from EXPIRED. It is a terminal state"
      );
    });
  });
});

// ============================================================================
// VALID_TRANSITIONS constant
// ============================================================================

describe("VALID_TRANSITIONS", () => {
  it("covers all session statuses", () => {
    for (const status of ALL_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("has correct transition count per status", () => {
    expect(VALID_TRANSITIONS.DRAFT.size).toBe(2);
    expect(VALID_TRANSITIONS.WAITING.size).toBe(2);
    expect(VALID_TRANSITIONS.IN_PROGRESS.size).toBe(2);
    expect(VALID_TRANSITIONS.PAUSED.size).toBe(2);
    expect(VALID_TRANSITIONS.COMPLETE.size).toBe(1);
    expect(VALID_TRANSITIONS.EXPIRED.size).toBe(0);
  });
});

// ============================================================================
// SESSION_RESET_PATCHES constant
// ============================================================================

describe("SESSION_RESET_PATCHES", () => {
  it("resets voting state fields", () => {
    expect(SESSION_RESET_PATCHES).toEqual({
      currentTurn: 0,
      currentRound: 1,
      isRevoteRound: false,
      winnerMapId: undefined,
      completedAt: undefined,
      startedAt: undefined,
      timerStartedAt: undefined,
      timerPausedAt: undefined,
    });
  });
});

// ============================================================================
// guardFinalize
// ============================================================================

describe("guardFinalize", () => {
  it("passes when player count and map count match", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, mapPoolSize: 3, status: "DRAFT" })
      );

      // Create 2 players
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team A" })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team B" })
      );

      // Create 3 maps
      const masterMapIds = await Promise.all([
        ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
        ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
        ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
      ]);
      for (const mapId of masterMapIds) {
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
      }

      const session = await ctx.db.get(sessionId);
      await expect(guardFinalize(ctx, session!)).resolves.toBeUndefined();
    });
  });

  it("throws when players are missing", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, mapPoolSize: 3, status: "DRAFT" })
      );

      // Only 1 of 2 players assigned
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team A" })
      );

      // All 3 maps assigned
      const masterMapIds = await Promise.all([
        ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
        ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
        ctx.db.insert("maps", mapFactory({ name: "Map 3" })),
      ]);
      for (const mapId of masterMapIds) {
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
      }

      const session = await ctx.db.get(sessionId);
      await expect(guardFinalize(ctx, session!)).rejects.toThrow(
        /Cannot finalize: 1 of 2 players assigned/
      );
    });
  });

  it("throws when maps are missing", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, mapPoolSize: 5, status: "DRAFT" })
      );

      // 2 players assigned
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team A" })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, { teamName: "Team B" })
      );

      // Only 2 of 5 maps
      const masterMapIds = await Promise.all([
        ctx.db.insert("maps", mapFactory({ name: "Map 1" })),
        ctx.db.insert("maps", mapFactory({ name: "Map 2" })),
      ]);
      for (const mapId of masterMapIds) {
        await ctx.db.insert(
          "sessionMaps",
          sessionMapFactory(sessionId, mapId)
        );
      }

      const session = await ctx.db.get(sessionId);
      await expect(guardFinalize(ctx, session!)).rejects.toThrow(
        /Cannot finalize: 2 of 5 maps assigned/
      );
    });
  });

  it("throws when both players and maps are missing (players checked first)", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, mapPoolSize: 3, status: "DRAFT" })
      );

      // No players, no maps
      const session = await ctx.db.get(sessionId);
      await expect(guardFinalize(ctx, session!)).rejects.toThrow(
        /Cannot finalize: 0 of 2 players assigned/
      );
    });
  });
});

// ============================================================================
// guardStart
// ============================================================================

describe("guardStart", () => {
  it("passes when all players are connected", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, status: "WAITING" })
      );

      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team A",
          isConnected: true,
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team B",
          isConnected: true,
        })
      );

      const session = await ctx.db.get(sessionId);
      await expect(guardStart(ctx, session!)).resolves.toBeUndefined();
    });
  });

  it("throws when some players are disconnected", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, status: "WAITING" })
      );

      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team A",
          isConnected: true,
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Team B",
          isConnected: false,
        })
      );

      const session = await ctx.db.get(sessionId);
      await expect(guardStart(ctx, session!)).rejects.toThrow(
        /Cannot start: 1 player\(s\) not connected \(Team B\)/
      );
    });
  });

  it("throws listing all disconnected teams", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          playerCount: 4,
          format: "MULTIPLAYER",
          status: "WAITING",
        })
      );

      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Alpha",
          isConnected: false,
          role: "PLAYER_1",
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Beta",
          isConnected: true,
          role: "PLAYER_2",
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Gamma",
          isConnected: false,
          role: "PLAYER_3",
        })
      );
      await ctx.db.insert(
        "sessionPlayers",
        sessionPlayerFactory(sessionId, {
          teamName: "Delta",
          isConnected: true,
          role: "PLAYER_4",
        })
      );

      const session = await ctx.db.get(sessionId);
      await expect(guardStart(ctx, session!)).rejects.toThrow(
        /Cannot start: 2 player\(s\) not connected \(Alpha, Gamma\)/
      );
    });
  });

  it("throws when no players exist", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { playerCount: 2, status: "WAITING" })
      );

      // No players inserted — should fail player count check
      const session = await ctx.db.get(sessionId);
      await expect(guardStart(ctx, session!)).rejects.toThrow(
        /Cannot start: 0 of 2 players assigned/
      );
    });
  });
});

// ============================================================================
// transitionSession
// ============================================================================

describe("transitionSession", () => {
  it("patches status and updatedAt on the session", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "DRAFT" })
      );

      const session = await ctx.db.get(sessionId);
      await transitionSession(ctx, session!, "WAITING", {
        auditAction: "SESSION_FINALIZED",
        actorType: "ADMIN",
        actorId: adminId,
      });

      const updated = await ctx.db.get(sessionId);
      expect(updated!.status).toBe("WAITING");
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(session!.updatedAt);
    });
  });

  it("creates an audit log entry", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "WAITING" })
      );

      const session = await ctx.db.get(sessionId);
      await transitionSession(ctx, session!, "IN_PROGRESS", {
        auditAction: "SESSION_STARTED",
        actorType: "ADMIN",
        actorId: adminId,
      });

      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("SESSION_STARTED");
      expect(logs[0].actorType).toBe("ADMIN");
      expect(logs[0].actorId).toBe(adminId);
    });
  });

  it("applies additional patches", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS", isRevoteRound: true })
      );

      const session = await ctx.db.get(sessionId);
      const pausedAt = Date.now();
      await transitionSession(ctx, session!, "PAUSED", {
        auditAction: "SESSION_PAUSED",
        actorType: "ADMIN",
        actorId: adminId,
        patches: { timerPausedAt: pausedAt },
      });

      const updated = await ctx.db.get(sessionId);
      expect(updated!.status).toBe("PAUSED");
      expect(updated!.timerPausedAt).toBe(pausedAt);
      // isRevoteRound not cleared — that's the caller's responsibility
      expect(updated!.isRevoteRound).toBe(true);
    });
  });

  it("includes audit details when provided", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "PAUSED" })
      );

      const session = await ctx.db.get(sessionId);
      await transitionSession(ctx, session!, "COMPLETE", {
        auditAction: "SESSION_ENDED",
        actorType: "ADMIN",
        actorId: adminId,
        patches: { isRevoteRound: false },
        auditDetails: { reason: "Admin forced end" },
      });

      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      expect(logs[0].details.reason).toBe("Admin forced end");
    });
  });

  it("throws on invalid transition and does not modify session", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "DRAFT" })
      );

      const session = await ctx.db.get(sessionId);
      await expect(
        transitionSession(ctx, session!, "IN_PROGRESS", {
          auditAction: "SESSION_STARTED",
          actorType: "ADMIN",
          actorId: adminId,
        })
      ).rejects.toThrow(/Cannot transition from DRAFT to IN_PROGRESS/);

      // Session unchanged
      const unchanged = await ctx.db.get(sessionId);
      expect(unchanged!.status).toBe("DRAFT");

      // No audit log created
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      expect(logs).toHaveLength(0);
    });
  });

  it("supports SYSTEM actor type without actorId", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, { status: "IN_PROGRESS" })
      );

      const session = await ctx.db.get(sessionId);
      await transitionSession(ctx, session!, "COMPLETE", {
        auditAction: "SESSION_ENDED",
        actorType: "SYSTEM",
      });

      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
      expect(logs[0].actorType).toBe("SYSTEM");
      expect(logs[0].actorId).toBeUndefined();
    });
  });

  it("supports COMPLETE -> WAITING reset with reset patches", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("admins", adminFactory());
      const sessionId = await ctx.db.insert(
        "sessions",
        sessionFactory(adminId, {
          status: "COMPLETE",
          currentTurn: 5,
          currentRound: 3,
          isRevoteRound: true,
        })
      );

      const session = await ctx.db.get(sessionId);
      await transitionSession(ctx, session!, "WAITING", {
        auditAction: "SESSION_RESET",
        actorType: "ADMIN",
        actorId: adminId,
        patches: SESSION_RESET_PATCHES,
      });

      const updated = await ctx.db.get(sessionId);
      expect(updated!.status).toBe("WAITING");
      expect(updated!.currentTurn).toBe(0);
      expect(updated!.currentRound).toBe(1);
      expect(updated!.isRevoteRound).toBe(false);
    });
  });

  describe("all force-end paths", () => {
    it.each([
      ["DRAFT", "COMPLETE"],
      ["WAITING", "COMPLETE"],
      ["IN_PROGRESS", "COMPLETE"],
      ["PAUSED", "COMPLETE"],
    ] as [SessionStatus, SessionStatus][])(
      "allows force end: %s -> %s",
      async (from, to) => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const adminId = await ctx.db.insert("admins", adminFactory());
          const sessionId = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { status: from })
          );

          const session = await ctx.db.get(sessionId);
          await transitionSession(ctx, session!, to, {
            auditAction: "SESSION_ENDED",
            actorType: "ADMIN",
            actorId: adminId,
            patches: { isRevoteRound: false },
          });

          const updated = await ctx.db.get(sessionId);
          expect(updated!.status).toBe("COMPLETE");
        });
      }
    );
  });
});

// ============================================================================
// requireSessionStatus
// ============================================================================

describe("requireSessionStatus", () => {
  /** Minimal session stub for pure-function tests. */
  const stubSession = (status: SessionStatus) => ({ status });

  describe("passes for allowed statuses", () => {
    it("passes when status is in the allowed set", () => {
      expect(() =>
        requireSessionStatus(stubSession("DRAFT"), EDITABLE_STATUSES, "update session")
      ).not.toThrow();
    });

    it("passes for second member of set", () => {
      expect(() =>
        requireSessionStatus(stubSession("WAITING"), EDITABLE_STATUSES, "assign players")
      ).not.toThrow();
    });

    it("passes for single-status set", () => {
      expect(() =>
        requireSessionStatus(stubSession("COMPLETE"), RESETTABLE_STATUSES, "reset session")
      ).not.toThrow();
    });
  });

  describe("throws for disallowed statuses", () => {
    it.each([
      ["IN_PROGRESS", "update session"],
      ["PAUSED", "assign players"],
      ["COMPLETE", "update session"],
      ["EXPIRED", "set maps"],
    ] as const)(
      "throws for %s when calling %s",
      (status, action) => {
        expect(() =>
          requireSessionStatus(stubSession(status), EDITABLE_STATUSES, action)
        ).toThrow(/Cannot .+ in .+ state/);
      }
    );

    it("throws for DRAFT when only COMPLETE is allowed", () => {
      expect(() =>
        requireSessionStatus(stubSession("DRAFT"), RESETTABLE_STATUSES, "reset session")
      ).toThrow(/Cannot reset session in DRAFT state/);
    });
  });

  describe("error messages", () => {
    it("includes the action name and current status", () => {
      expect(() =>
        requireSessionStatus(stubSession("IN_PROGRESS"), EDITABLE_STATUSES, "update session")
      ).toThrow(/Cannot update session in IN_PROGRESS state/);
    });

    it("lists allowed statuses", () => {
      expect(() =>
        requireSessionStatus(stubSession("EXPIRED"), EDITABLE_STATUSES, "assign players")
      ).toThrow(/Only DRAFT or WAITING state allowed/);
    });

    it("lists single allowed status", () => {
      expect(() =>
        requireSessionStatus(stubSession("WAITING"), MAP_POOL_STATUSES, "set maps")
      ).toThrow(/Only DRAFT state allowed/);
    });

    it("uses comma-separated format for 3+ allowed statuses", () => {
      expect(() =>
        requireSessionStatus(stubSession("IN_PROGRESS"), DELETABLE_STATUSES, "delete session")
      ).toThrow(
        /Only DRAFT, WAITING, PAUSED, COMPLETE, or EXPIRED state allowed/
      );
    });
  });
});
