/**
 * Teams CRUD Tests
 *
 * Tests for team management operations: create, list, update, delete.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  teamFactory,
  adminFactory,
  sessionFactory,
  sessionPlayerFactory,
} from "./test.factories";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

type SessionStatus =
  | "DRAFT"
  | "WAITING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETE"
  | "EXPIRED";

/**
 * Creates a team that's being used in a session with the specified status.
 * Used for testing rename/delete blocking behavior across all session states.
 */
async function createTeamInSession(
  t: ReturnType<typeof createTestContext>,
  status: SessionStatus
): Promise<{
  teamId: Id<"teams">;
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const teamId = await ctx.db.insert("teams", teamFactory({ name: "Test Team" }));
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status })
    );
    await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, { teamName: "Test Team" })
    );
    return { teamId, sessionId, adminId };
  });
}

// ============================================================================
// createTeam Tests
// ============================================================================

describe("teams.createTeam", () => {
  describe("success cases", () => {
    it("creates team with valid name", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.teams.createTeam, {
        name: "Alpha Team",
      });

      expect(result.teamId).toBeDefined();

      const team = await t.run(async (ctx) => ctx.db.get(result.teamId));
      expect(team).toMatchObject({ name: "Alpha Team" });
    });

    it("creates team with external logoUrl", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.teams.createTeam, {
        name: "Team With Logo",
        logoUrl: "https://example.com/logo.png",
      });

      const team = await t.run(async (ctx) => ctx.db.get(result.teamId));
      expect(team?.logoUrl).toBe("https://example.com/logo.png");
    });

    it("trims whitespace from name", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.teams.createTeam, {
        name: "  Padded Name  ",
      });

      const team = await t.run(async (ctx) => ctx.db.get(result.teamId));
      expect(team?.name).toBe("Padded Name");
    });

    it("sets updatedAt timestamp", async () => {
      const t = createTestContext();
      const before = Date.now();

      const result = await t.mutation(api.teams.createTeam, {
        name: "Timestamped Team",
      });

      const team = await t.run(async (ctx) => ctx.db.get(result.teamId));
      expect(team?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(team?.updatedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("validation errors", () => {
    it("throws for empty name", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.teams.createTeam, { name: "" })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for whitespace-only name", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.teams.createTeam, { name: "   " })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for name exceeding 100 characters", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.teams.createTeam, { name: "A".repeat(101) })
      ).rejects.toThrow(/cannot exceed 100 characters/);
    });

    it("throws for invalid logoUrl (internal address)", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.teams.createTeam, {
          name: "Team",
          logoUrl: "http://127.0.0.1/logo.png",
        })
      ).rejects.toThrow(/Invalid logo URL/);
    });

    // Note: Testing "both logoUrl and logoStorageId" requires a real storage ID.
    // The validator rejects invalid storage IDs before business logic runs.
    // This behavior is covered by the validator itself - we test the error message
    // from the validator instead.
    it("throws for invalid logoStorageId format", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.teams.createTeam, {
          name: "Team",
          // @ts-expect-error - testing with invalid storage ID
          logoStorageId: "invalid_storage_id",
        })
      ).rejects.toThrow(/Validator error/);
    });
  });

  describe("duplicate handling", () => {
    it("throws for duplicate team name", async () => {
      const t = createTestContext();

      await t.mutation(api.teams.createTeam, { name: "Unique Team" });

      await expect(
        t.mutation(api.teams.createTeam, { name: "Unique Team" })
      ).rejects.toThrow(/already exists/);
    });

    it("treats trimmed duplicate as conflict", async () => {
      const t = createTestContext();

      await t.mutation(api.teams.createTeam, { name: "Duplicate" });

      await expect(
        t.mutation(api.teams.createTeam, { name: "  Duplicate  " })
      ).rejects.toThrow(/already exists/);
    });

    it("allows case-different names (case-sensitive uniqueness)", async () => {
      const t = createTestContext();

      await t.mutation(api.teams.createTeam, { name: "Cloud9" });

      // Should succeed - different case is treated as different team
      const result = await t.mutation(api.teams.createTeam, { name: "cloud9" });
      expect(result.teamId).toBeDefined();
    });
  });

  describe("storage handling", () => {
    // These tests document scenarios that cannot be tested with convex-test
    // due to its inability to mock storage IDs. Test these in integration
    // tests against a real dev deployment.

    it.skip("creates team with logoStorageId", () => {
      // Requires real storage ID - convex-test cannot mock storage IDs
      // Test in integration tests against dev deployment
    });

    it.skip("throws when both logoUrl and logoStorageId provided", () => {
      // Requires real storage ID - validator rejects invalid IDs before business logic
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// listTeams Tests
// ============================================================================

describe("teams.listTeams", () => {
  describe("empty state", () => {
    it("returns empty page when no teams exist", async () => {
      const t = createTestContext();

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  describe("pagination", () => {
    it("returns teams sorted by name ascending", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Zebra" }));
        await ctx.db.insert("teams", teamFactory({ name: "Alpha" }));
        await ctx.db.insert("teams", teamFactory({ name: "Mango" }));
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      const names = result.page.map((t) => t.name);
      expect(names).toEqual(["Alpha", "Mango", "Zebra"]);
    });

    it("returns correct page size", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert("teams", teamFactory({ name: `Team ${i}` }));
        }
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
    });

    it("continues from cursor", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Alpha" }));
        await ctx.db.insert("teams", teamFactory({ name: "Beta" }));
        await ctx.db.insert("teams", teamFactory({ name: "Gamma" }));
        await ctx.db.insert("teams", teamFactory({ name: "Delta" }));
      });

      const page1 = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page1.page.map((t) => t.name)).toEqual(["Alpha", "Beta"]);

      const page2 = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });

      expect(page2.page.map((t) => t.name)).toEqual(["Delta", "Gamma"]);
    });

    it("sets isDone correctly for last page", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Team A" }));
        await ctx.db.insert("teams", teamFactory({ name: "Team B" }));
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(true);
    });
  });

  describe("logo handling", () => {
    it("returns teams with external logoUrl", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", {
          ...teamFactory({ name: "Logo Team" }),
          logoUrl: "https://example.com/logo.png",
        });
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].logoUrl).toBe("https://example.com/logo.png");
    });
  });

  describe("sessions count", () => {
    it("returns sessionsCount of 0 for team not in any session", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("teams", teamFactory({ name: "Lonely Team" }));
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].sessionsCount).toBe(0);
    });

    it("returns correct sessionsCount for team in one session", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert("teams", teamFactory({ name: "Active Team" }));
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Active Team" })
        );
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].sessionsCount).toBe(1);
    });

    it("returns correct sessionsCount for team in multiple sessions", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert("teams", teamFactory({ name: "Popular Team" }));

        // Create 3 different sessions with this team
        for (let i = 0; i < 3; i++) {
          const sessionId = await ctx.db.insert(
            "sessions",
            sessionFactory(adminId, { matchName: `Match ${i}` })
          );
          await ctx.db.insert(
            "sessionPlayers",
            sessionPlayerFactory(sessionId, { teamName: "Popular Team" })
          );
        }
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page[0].sessionsCount).toBe(3);
    });

    it("counts unique sessions when team has multiple players in same session", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("admins", adminFactory());
        await ctx.db.insert("teams", teamFactory({ name: "Multi Player Team" }));
        const sessionId = await ctx.db.insert(
          "sessions",
          sessionFactory(adminId)
        );

        // Add multiple players from same team to same session
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Multi Player Team", role: "TEAM_A" })
        );
        await ctx.db.insert(
          "sessionPlayers",
          sessionPlayerFactory(sessionId, { teamName: "Multi Player Team", role: "TEAM_B" })
        );
      });

      const result = await t.query(api.teams.listTeams, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      // Should count as 1 session, not 2 players
      expect(result.page[0].sessionsCount).toBe(1);
    });
  });
});

// ============================================================================
// updateTeam Tests
// ============================================================================

describe("teams.updateTeam", () => {
  describe("success cases", () => {
    it("updates team name", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Original Name",
      });

      await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "New Name",
      });

      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team?.name).toBe("New Name");
    });

    it("updates logoUrl", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
      });

      await t.mutation(api.teams.updateTeam, {
        teamId,
        logoUrl: "https://example.com/new-logo.png",
      });

      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team?.logoUrl).toBe("https://example.com/new-logo.png");
    });

    it("clears logoUrl when set to null", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
        logoUrl: "https://example.com/logo.png",
      });

      await t.mutation(api.teams.updateTeam, {
        teamId,
        logoUrl: null,
      });

      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team?.logoUrl).toBeUndefined();
    });

    it("allows keeping same name (no-op rename)", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Same Name",
      });

      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "Same Name",
      });

      expect(result.success).toBe(true);
    });

    it("whitespace-only logoUrl validates and becomes undefined", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
        logoUrl: "https://example.com/original.png",
      });

      await t.mutation(api.teams.updateTeam, {
        teamId,
        logoUrl: "   ", // whitespace only - becomes undefined after validateLogoUrl
      });

      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      // Whitespace becomes undefined in validateLogoUrl, which doesn't trigger an update
      // But the code DOES set updates.logoUrl = validatedUrl (undefined)
      // So the URL actually gets cleared - this is the actual behavior
      expect(team?.logoUrl).toBeUndefined();
    });
  });

  describe("not found", () => {
    it("throws for non-existent team", async () => {
      const t = createTestContext();

      // Create and delete a team to get a valid but non-existent ID
      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Temporary",
      });
      await t.mutation(api.teams.deleteTeam, { teamId });

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Team not found/);
    });
  });

  describe("duplicate handling", () => {
    it("throws when renaming to existing team name", async () => {
      const t = createTestContext();

      await t.mutation(api.teams.createTeam, { name: "Existing Team" });
      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "My Team",
      });

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "Existing Team" })
      ).rejects.toThrow(/already exists/);
    });
  });

  // Session blocking tests use representative statuses from ACTIVE_SESSION_STATUSES constant.
  // Active statuses (DRAFT, WAITING, IN_PROGRESS, PAUSED) share the same blocking logic.
  // Testing one from each category (active/inactive) provides sufficient coverage.
  describe("session blocking", () => {
    it("blocks rename when team in active session", async () => {
      const t = createTestContext();
      // Uses IN_PROGRESS as representative of ACTIVE_SESSION_STATUSES
      const { teamId } = await createTeamInSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Cannot rename team.*active session/);
    });

    it("allows rename when team only in inactive session", async () => {
      const t = createTestContext();
      // Uses COMPLETE as representative of inactive statuses (COMPLETE, EXPIRED)
      const { teamId } = await createTeamInSession(t, "COMPLETE");

      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "Renamed Team",
      });

      expect(result.success).toBe(true);
      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team?.name).toBe("Renamed Team");
    });

    it("allows rename when team not used in any session", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Unused Team",
      });

      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "Renamed Team",
      });

      expect(result.success).toBe(true);
    });

    it("allows logo update even when team in active session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInSession(t, "IN_PROGRESS");

      // Logo updates should work even in active session (only rename is blocked)
      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        logoUrl: "https://example.com/new-logo.png",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("throws for empty name", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
      });

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "" })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for invalid logoUrl", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
      });

      await expect(
        t.mutation(api.teams.updateTeam, {
          teamId,
          logoUrl: "http://localhost/logo.png",
        })
      ).rejects.toThrow(/Invalid logo URL/);
    });

    // Note: Testing "both logoUrl and logoStorageId" requires a real storage ID.
    // The validator rejects invalid storage IDs before business logic runs.
    it("throws for invalid logoStorageId format", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Team",
      });

      await expect(
        t.mutation(api.teams.updateTeam, {
          teamId,
          // @ts-expect-error - testing with invalid storage ID
          logoStorageId: "invalid_storage_id",
        })
      ).rejects.toThrow(/Validator error/);
    });
  });

  describe("storage handling", () => {
    // These tests document scenarios that cannot be tested with convex-test
    // due to its inability to mock storage IDs. Test these in integration
    // tests against a real dev deployment.

    it.skip("clears old storage when switching to URL", () => {
      // Requires real storage ID for initial setup
      // Test in integration tests against dev deployment
    });

    it.skip("clears old storage when switching to new storage", () => {
      // Requires real storage ID for initial setup
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// deleteTeam Tests
// ============================================================================

describe("teams.deleteTeam", () => {
  describe("success cases", () => {
    it("deletes existing team", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "To Delete",
      });

      const result = await t.mutation(api.teams.deleteTeam, { teamId });

      expect(result.success).toBe(true);

      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team).toBeNull();
    });
  });

  describe("not found", () => {
    it("throws for non-existent team", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Temporary",
      });
      await t.mutation(api.teams.deleteTeam, { teamId });

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Team not found/);
    });
  });

  // Session blocking tests use representative statuses from ACTIVE_SESSION_STATUSES constant.
  // Active statuses (DRAFT, WAITING, IN_PROGRESS, PAUSED) share the same blocking logic.
  // Testing one from each category (active/inactive) provides sufficient coverage.
  describe("session blocking", () => {
    it("blocks delete when team in active session", async () => {
      const t = createTestContext();
      // Uses IN_PROGRESS as representative of ACTIVE_SESSION_STATUSES
      const { teamId } = await createTeamInSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Cannot delete team.*active session/);
    });

    it("allows delete when team only in inactive session", async () => {
      const t = createTestContext();
      // Uses COMPLETE as representative of inactive statuses (COMPLETE, EXPIRED)
      const { teamId } = await createTeamInSession(t, "COMPLETE");

      const result = await t.mutation(api.teams.deleteTeam, { teamId });

      expect(result.success).toBe(true);
    });

    it("allows delete when team not used in any session", async () => {
      const t = createTestContext();

      const { teamId } = await t.mutation(api.teams.createTeam, {
        name: "Unused Team",
      });

      const result = await t.mutation(api.teams.deleteTeam, { teamId });

      expect(result.success).toBe(true);
    });
  });

  describe("storage handling", () => {
    // These tests document scenarios that cannot be tested with convex-test
    // due to its inability to mock storage IDs. Test these in integration
    // tests against a real dev deployment.

    it.skip("cleans up storage on delete", () => {
      // Requires real storage ID
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// generateUploadUrl Tests
// ============================================================================

describe("teams.generateUploadUrl", () => {
  it("returns string URL", async () => {
    const t = createTestContext();

    const url = await t.mutation(api.teams.generateUploadUrl, {});

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
