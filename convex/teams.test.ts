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

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a team that's being used in an active session.
 * Used for testing rename/delete blocking behavior.
 */
async function createTeamInActiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "DRAFT" | "WAITING" | "IN_PROGRESS" | "PAUSED" = "IN_PROGRESS"
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const teamId = await ctx.db.insert(
      "teams",
      teamFactory({ name: "Active Team" })
    );
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, matchName: "Active Match" })
    );
    await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, { teamName: "Active Team" })
    );
    return { teamId, sessionId, adminId };
  });
}

/**
 * Creates a team that's only used in inactive (completed/expired) sessions.
 */
async function createTeamInInactiveSession(
  t: ReturnType<typeof createTestContext>,
  status: "COMPLETE" | "EXPIRED" = "COMPLETE"
) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const teamId = await ctx.db.insert(
      "teams",
      teamFactory({ name: "Inactive Team" })
    );
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status, matchName: "Completed Match" })
    );
    await ctx.db.insert(
      "sessionPlayers",
      sessionPlayerFactory(sessionId, { teamName: "Inactive Team" })
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
    it("rejects invalid logoStorageId format", async () => {
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

  describe("session blocking", () => {
    it("blocks rename when team in DRAFT session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "DRAFT");

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Cannot rename team.*active session/);
    });

    it("blocks rename when team in WAITING session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "WAITING");

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Cannot rename team.*active session/);
    });

    it("blocks rename when team in IN_PROGRESS session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Cannot rename team.*active session/);
    });

    it("blocks rename when team in PAUSED session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "PAUSED");

      await expect(
        t.mutation(api.teams.updateTeam, { teamId, name: "New Name" })
      ).rejects.toThrow(/Cannot rename team.*active session/);
    });

    it("allows rename when team only in COMPLETE session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInInactiveSession(t, "COMPLETE");

      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "Renamed Team",
      });

      expect(result.success).toBe(true);
      const team = await t.run(async (ctx) => ctx.db.get(teamId));
      expect(team?.name).toBe("Renamed Team");
    });

    it("allows rename when team only in EXPIRED session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInInactiveSession(t, "EXPIRED");

      const result = await t.mutation(api.teams.updateTeam, {
        teamId,
        name: "Renamed Team",
      });

      expect(result.success).toBe(true);
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
      const { teamId } = await createTeamInActiveSession(t, "IN_PROGRESS");

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
    it("rejects invalid logoStorageId format", async () => {
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

  describe("session blocking", () => {
    it("blocks delete when team in DRAFT session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "DRAFT");

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Cannot delete team.*active session/);
    });

    it("blocks delete when team in WAITING session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "WAITING");

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Cannot delete team.*active session/);
    });

    it("blocks delete when team in IN_PROGRESS session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Cannot delete team.*active session/);
    });

    it("blocks delete when team in PAUSED session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInActiveSession(t, "PAUSED");

      await expect(
        t.mutation(api.teams.deleteTeam, { teamId })
      ).rejects.toThrow(/Cannot delete team.*active session/);
    });

    it("allows delete when team only in COMPLETE session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInInactiveSession(t, "COMPLETE");

      const result = await t.mutation(api.teams.deleteTeam, { teamId });

      expect(result.success).toBe(true);
    });

    it("allows delete when team only in EXPIRED session", async () => {
      const t = createTestContext();
      const { teamId } = await createTeamInInactiveSession(t, "EXPIRED");

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

  it("can be called multiple times", async () => {
    const t = createTestContext();

    const url1 = await t.mutation(api.teams.generateUploadUrl, {});
    const url2 = await t.mutation(api.teams.generateUploadUrl, {});

    expect(url1).toBeDefined();
    expect(url2).toBeDefined();
    // URLs should be different (unique per call)
    expect(url1).not.toBe(url2);
  });
});
