/**
 * Team Logo Resolution Tests
 *
 * Tests for team logo URL resolution utilities:
 * - resolveTeamLogoUrl: single team logo URL resolver
 * - resolveTeamLogos: batch team logo resolver (by name)
 * - logoMapToRecord: Map-to-Record converter (filters undefined)
 *
 * Note: Convex's t.run() serializes undefined → null in return values.
 * Tests that check for "no logo" assert against null when crossing the
 * t.run() boundary, while the actual function returns undefined.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import { teamFactory } from "./test.factories";
import { logoMapToRecord } from "./lib/teamLogos";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert Map entries to a Convex-serializable format.
 * Replaces undefined values with null since Convex cannot serialize undefined.
 */
function serializableEntries(
  map: Map<string, string | undefined>
): [string, string | null][] {
  return [...map.entries()].map(([k, v]) => [k, v ?? null]);
}

// ============================================================================
// resolveTeamLogos Tests
// ============================================================================

describe("resolveTeamLogos", () => {
  it("returns empty map for empty team names array", async () => {
    const t = createTestContext();

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, []);
      return serializableEntries(logoMap);
    });

    expect(result).toEqual([]);
  });

  it("returns null for unknown team names", async () => {
    const t = createTestContext();

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, [
        "Nonexistent A",
        "Nonexistent B",
      ]);
      return serializableEntries(logoMap);
    });

    // undefined values become null after Convex serialization
    expect(result).toEqual([
      ["Nonexistent A", null],
      ["Nonexistent B", null],
    ]);
  });

  it("resolves logoUrl for teams with external URLs", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      await ctx.db.insert("teams", {
        ...teamFactory({ name: "Alpha" }),
        logoUrl: "https://example.com/alpha.png",
      });
      await ctx.db.insert("teams", {
        ...teamFactory({ name: "Beta" }),
        logoUrl: "https://example.com/beta.png",
      });
    });

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, ["Alpha", "Beta"]);
      return serializableEntries(logoMap);
    });

    expect(result).toEqual([
      ["Alpha", "https://example.com/alpha.png"],
      ["Beta", "https://example.com/beta.png"],
    ]);
  });

  it("returns null for teams without any logo", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      await ctx.db.insert("teams", teamFactory({ name: "No Logo Team" }));
    });

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, ["No Logo Team"]);
      return serializableEntries(logoMap);
    });

    // undefined becomes null after Convex serialization
    expect(result).toEqual([["No Logo Team", null]]);
  });

  it("deduplicates team names (queries each unique name only once)", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      await ctx.db.insert("teams", {
        ...teamFactory({ name: "Duped Team" }),
        logoUrl: "https://example.com/duped.png",
      });
    });

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, [
        "Duped Team",
        "Duped Team",
        "Duped Team",
      ]);
      // Map should have exactly 1 entry despite 3 duplicate inputs
      return {
        size: logoMap.size,
        entries: serializableEntries(logoMap),
      };
    });

    expect(result.size).toBe(1);
    expect(result.entries).toEqual([
      ["Duped Team", "https://example.com/duped.png"],
    ]);
  });

  it("handles mix of known and unknown team names", async () => {
    const t = createTestContext();

    await t.run(async (ctx) => {
      await ctx.db.insert("teams", {
        ...teamFactory({ name: "Known Team" }),
        logoUrl: "https://example.com/known.png",
      });
    });

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogos } = await import("./lib/teamLogos");
      const logoMap = await resolveTeamLogos(ctx, [
        "Known Team",
        "Unknown Team",
      ]);
      return serializableEntries(logoMap);
    });

    expect(result).toEqual([
      ["Known Team", "https://example.com/known.png"],
      ["Unknown Team", null],
    ]);
  });
});

// ============================================================================
// resolveTeamLogoUrl Tests
// ============================================================================

describe("resolveTeamLogoUrl", () => {
  it("returns logoUrl when team has only external URL", async () => {
    const t = createTestContext();

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogoUrl } = await import("./lib/teamLogos");
      return resolveTeamLogoUrl(ctx, {
        logoUrl: "https://example.com/logo.png",
      });
    });

    expect(result).toBe("https://example.com/logo.png");
  });

  it("returns null when team has neither logoUrl nor logoStorageId", async () => {
    const t = createTestContext();

    // resolveTeamLogoUrl returns undefined, but Convex serializes it to null
    // across the t.run() boundary
    const result = await t.run(async (ctx) => {
      const { resolveTeamLogoUrl } = await import("./lib/teamLogos");
      return resolveTeamLogoUrl(ctx, {});
    });

    expect(result).toBeNull();
  });

  it("returns null when logo fields are explicitly undefined", async () => {
    const t = createTestContext();

    const result = await t.run(async (ctx) => {
      const { resolveTeamLogoUrl } = await import("./lib/teamLogos");
      return resolveTeamLogoUrl(ctx, {
        logoUrl: undefined,
        logoStorageId: undefined,
      });
    });

    // Convex serializes undefined → null across t.run() boundary
    expect(result).toBeNull();
  });

  describe("storage handling", () => {
    // convex-test does not support ctx.storage.getUrl() with real storage IDs.
    // These scenarios require integration tests against a real dev deployment.

    it.skip("prefers storage URL over external logoUrl when both exist", () => {
      // Requires real storage ID - convex-test cannot mock ctx.storage.getUrl()
      // Test in integration tests against dev deployment
    });

    it.skip("resolves storage URL when only logoStorageId is set", () => {
      // Requires real storage ID - convex-test cannot mock ctx.storage.getUrl()
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// logoMapToRecord Tests
// ============================================================================

describe("logoMapToRecord", () => {
  it("filters out undefined entries and preserves valid URLs", () => {
    const logoMap = new Map<string, string | undefined>([
      ["Team A", "https://example.com/a.png"],
      ["Team B", undefined],
      ["Team C", "https://example.com/c.png"],
      ["Team D", undefined],
    ]);

    const result = logoMapToRecord(logoMap);

    expect(result).toEqual({
      "Team A": "https://example.com/a.png",
      "Team C": "https://example.com/c.png",
    });
  });

  it("returns empty record for empty map", () => {
    const logoMap = new Map<string, string | undefined>();

    const result = logoMapToRecord(logoMap);

    expect(result).toEqual({});
  });

  it("returns empty record when all entries are undefined", () => {
    const logoMap = new Map<string, string | undefined>([
      ["Team A", undefined],
      ["Team B", undefined],
    ]);

    const result = logoMapToRecord(logoMap);

    expect(result).toEqual({});
  });

  it("preserves all entries when none are undefined", () => {
    const logoMap = new Map<string, string | undefined>([
      ["Team A", "https://example.com/a.png"],
      ["Team B", "https://example.com/b.png"],
    ]);

    const result = logoMapToRecord(logoMap);

    expect(result).toEqual({
      "Team A": "https://example.com/a.png",
      "Team B": "https://example.com/b.png",
    });
  });
});
