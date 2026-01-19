/**
 * Maps CRUD Tests
 *
 * Tests for map management operations: create, list, get, update, deactivate, reactivate.
 *
 * Note: convex-test cannot mock storage IDs. Tests requiring imageStorageId
 * are skipped and documented for integration testing.
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import {
  mapFactory,
  adminFactory,
  sessionFactory,
  sessionMapFactory,
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
 * Creates a map that's being used in a session with the specified status.
 * Used for testing update/deactivate blocking behavior across session states.
 */
async function createMapInSession(
  t: ReturnType<typeof createTestContext>,
  status: SessionStatus
): Promise<{
  mapId: Id<"maps">;
  sessionId: Id<"sessions">;
  adminId: Id<"admins">;
}> {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("admins", adminFactory());
    const mapId = await ctx.db.insert(
      "maps",
      mapFactory({
        name: "Test Map",
        imageUrl: "https://example.com/map.png",
      })
    );
    const sessionId = await ctx.db.insert(
      "sessions",
      sessionFactory(adminId, { status })
    );
    await ctx.db.insert("sessionMaps", sessionMapFactory(sessionId, mapId));
    return { mapId, sessionId, adminId };
  });
}

// ============================================================================
// createMap Tests
// ============================================================================

describe("maps.createMap", () => {
  describe("success cases", () => {
    it("creates map with valid name and imageUrl", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.maps.createMap, {
        name: "Dust II",
        imageUrl: "https://example.com/dust2.png",
      });

      expect(result.mapId).toBeDefined();

      const map = await t.run(async (ctx) => ctx.db.get(result.mapId));
      expect(map).toMatchObject({
        name: "Dust II",
        imageUrl: "https://example.com/dust2.png",
        isActive: true,
      });
    });

    it("trims whitespace from name", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.maps.createMap, {
        name: "  Padded Name  ",
        imageUrl: "https://example.com/map.png",
      });

      const map = await t.run(async (ctx) => ctx.db.get(result.mapId));
      expect(map?.name).toBe("Padded Name");
    });

    it("sets isActive=true by default", async () => {
      const t = createTestContext();

      const result = await t.mutation(api.maps.createMap, {
        name: "Active Map",
        imageUrl: "https://example.com/map.png",
      });

      const map = await t.run(async (ctx) => ctx.db.get(result.mapId));
      expect(map?.isActive).toBe(true);
    });

    it("sets updatedAt timestamp", async () => {
      const t = createTestContext();
      const before = Date.now();

      const result = await t.mutation(api.maps.createMap, {
        name: "Timestamped Map",
        imageUrl: "https://example.com/map.png",
      });

      const map = await t.run(async (ctx) => ctx.db.get(result.mapId));
      expect(map?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(map?.updatedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("validation errors", () => {
    it("throws for empty name", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "",
          imageUrl: "https://example.com/map.png",
        })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for whitespace-only name", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "   ",
          imageUrl: "https://example.com/map.png",
        })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for name exceeding 100 characters", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "A".repeat(101),
          imageUrl: "https://example.com/map.png",
        })
      ).rejects.toThrow(/cannot exceed 100 characters/);
    });

    it("throws when no image source provided", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "No Image Map",
        })
      ).rejects.toThrow(/image is required/);
    });

    it("throws for invalid imageUrl (internal address)", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "Map",
          imageUrl: "http://127.0.0.1/map.png",
        })
      ).rejects.toThrow(/Invalid image URL/);
    });

    it("throws for invalid imageStorageId format", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.maps.createMap, {
          name: "Map",
          // @ts-expect-error - testing with invalid storage ID
          imageStorageId: "invalid_storage_id",
        })
      ).rejects.toThrow(/Validator error/);
    });
  });

  describe("duplicate handling", () => {
    it("throws for duplicate map name", async () => {
      const t = createTestContext();

      await t.mutation(api.maps.createMap, {
        name: "Unique Map",
        imageUrl: "https://example.com/map1.png",
      });

      await expect(
        t.mutation(api.maps.createMap, {
          name: "Unique Map",
          imageUrl: "https://example.com/map2.png",
        })
      ).rejects.toThrow(/already exists/);
    });

    it("treats trimmed duplicate as conflict", async () => {
      const t = createTestContext();

      await t.mutation(api.maps.createMap, {
        name: "Duplicate",
        imageUrl: "https://example.com/map.png",
      });

      await expect(
        t.mutation(api.maps.createMap, {
          name: "  Duplicate  ",
          imageUrl: "https://example.com/map2.png",
        })
      ).rejects.toThrow(/already exists/);
    });
  });

  describe("storage handling", () => {
    // These tests document scenarios that cannot be tested with convex-test
    // due to its inability to mock storage IDs. Test these in integration
    // tests against a real dev deployment.

    it.skip("creates map with imageStorageId", () => {
      // Requires real storage ID - convex-test cannot mock storage IDs
      // Test in integration tests against dev deployment
    });

    it.skip("throws when both imageUrl and imageStorageId provided", () => {
      // Requires real storage ID - validator rejects invalid IDs before business logic
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// listMaps Tests
// ============================================================================

describe("maps.listMaps", () => {
  describe("empty state", () => {
    it("returns empty array when no maps exist", async () => {
      const t = createTestContext();

      const result = await t.query(api.maps.listMaps, {});

      expect(result).toEqual([]);
    });
  });

  describe("filtering", () => {
    it("excludes inactive maps by default", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert(
          "maps",
          mapFactory({ name: "Active Map", imageUrl: "https://example.com/active.png", isActive: true })
        );
        await ctx.db.insert(
          "maps",
          mapFactory({ name: "Inactive Map", imageUrl: "https://example.com/inactive.png", isActive: false })
        );
      });

      const result = await t.query(api.maps.listMaps, {});

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Active Map");
    });

    it("includes inactive maps when includeInactive=true", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert(
          "maps",
          mapFactory({ name: "Active", imageUrl: "https://example.com/active.png", isActive: true })
        );
        await ctx.db.insert(
          "maps",
          mapFactory({ name: "Inactive", imageUrl: "https://example.com/inactive.png", isActive: false })
        );
      });

      const result = await t.query(api.maps.listMaps, { includeInactive: true });

      expect(result).toHaveLength(2);
    });
  });

  describe("sorting", () => {
    it("returns maps sorted alphabetically by name", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await ctx.db.insert("maps", mapFactory({ name: "Zebra", imageUrl: "https://example.com/z.png" }));
        await ctx.db.insert("maps", mapFactory({ name: "Alpha", imageUrl: "https://example.com/a.png" }));
        await ctx.db.insert("maps", mapFactory({ name: "Mango", imageUrl: "https://example.com/m.png" }));
      });

      const result = await t.query(api.maps.listMaps, {});

      const names = result.map((m) => m.name);
      expect(names).toEqual(["Alpha", "Mango", "Zebra"]);
    });
  });
});

// ============================================================================
// getMap Tests
// ============================================================================

describe("maps.getMap", () => {
  describe("success cases", () => {
    it("returns map by ID", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Found Map",
        imageUrl: "https://example.com/map.png",
      });

      const map = await t.query(api.maps.getMap, { mapId });

      expect(map).toMatchObject({
        name: "Found Map",
        imageUrl: "https://example.com/map.png",
      });
    });

    it("returns map with imageUrl preserved", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "URL Map",
        imageUrl: "https://example.com/external.png",
      });

      const map = await t.query(api.maps.getMap, { mapId });

      expect(map?.imageUrl).toBe("https://example.com/external.png");
    });
  });

  describe("not found", () => {
    it("returns null for non-existent map", async () => {
      const t = createTestContext();

      // Create and deactivate a map to get a valid but "non-existent" ID
      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Temporary",
        imageUrl: "https://example.com/map.png",
      });
      await t.mutation(api.maps.deactivateMap, { mapId });

      // Create another map and delete it via direct DB access to get a truly deleted ID
      const deletedMapId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "maps",
          mapFactory({ name: "To Delete", imageUrl: "https://example.com/del.png" })
        );
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.query(api.maps.getMap, { mapId: deletedMapId });
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// updateMap Tests
// ============================================================================

describe("maps.updateMap", () => {
  describe("success cases", () => {
    it("updates map name", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Original Name",
        imageUrl: "https://example.com/map.png",
      });

      await t.mutation(api.maps.updateMap, {
        mapId,
        name: "New Name",
      });

      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.name).toBe("New Name");
    });

    it("updates imageUrl", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/old.png",
      });

      await t.mutation(api.maps.updateMap, {
        mapId,
        imageUrl: "https://example.com/new.png",
      });

      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.imageUrl).toBe("https://example.com/new.png");
    });

    it("allows keeping same name (no-op rename)", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Same Name",
        imageUrl: "https://example.com/map.png",
      });

      const result = await t.mutation(api.maps.updateMap, {
        mapId,
        name: "Same Name",
      });

      expect(result.success).toBe(true);
    });

    it("updates updatedAt timestamp", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      const before = Date.now();
      await t.mutation(api.maps.updateMap, {
        mapId,
        name: "Updated Map",
      });

      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("validation errors", () => {
    it("throws for empty name", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      await expect(
        t.mutation(api.maps.updateMap, { mapId, name: "" })
      ).rejects.toThrow(/cannot be empty/);
    });

    it("throws for invalid imageUrl", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      await expect(
        t.mutation(api.maps.updateMap, {
          mapId,
          imageUrl: "http://localhost/map.png",
        })
      ).rejects.toThrow(/Invalid image URL/);
    });

    it("throws when clearing all image sources", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      await expect(
        t.mutation(api.maps.updateMap, {
          mapId,
          imageUrl: null,
        })
      ).rejects.toThrow(/Cannot remove/);
    });
  });

  describe("not found", () => {
    it("throws for non-existent map", async () => {
      const t = createTestContext();

      // Create and delete a map to get a valid but non-existent ID
      const deletedMapId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Temporary", imageUrl: "https://example.com/map.png" })
        );
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.mutation(api.maps.updateMap, { mapId: deletedMapId, name: "New Name" })
      ).rejects.toThrow(/Map not found/);
    });
  });

  describe("duplicate handling", () => {
    it("throws when renaming to existing map name", async () => {
      const t = createTestContext();

      await t.mutation(api.maps.createMap, {
        name: "Existing Map",
        imageUrl: "https://example.com/existing.png",
      });
      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "My Map",
        imageUrl: "https://example.com/my.png",
      });

      await expect(
        t.mutation(api.maps.updateMap, { mapId, name: "Existing Map" })
      ).rejects.toThrow(/already exists/);
    });
  });

  // Session blocking tests use representative statuses from ACTIVE_SESSION_STATUSES constant.
  // Active statuses (DRAFT, WAITING, IN_PROGRESS, PAUSED) share the same blocking logic.
  // Testing one from each category (active/inactive) provides sufficient coverage.
  describe("session blocking", () => {
    it("blocks name change when map in active session", async () => {
      const t = createTestContext();
      // Uses IN_PROGRESS as representative of ACTIVE_SESSION_STATUSES
      const { mapId } = await createMapInSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.maps.updateMap, { mapId, name: "New Name" })
      ).rejects.toThrow(/Cannot update map.*active session/);
    });

    it("blocks image change when map in active session", async () => {
      const t = createTestContext();
      const { mapId } = await createMapInSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.maps.updateMap, {
          mapId,
          imageUrl: "https://example.com/new.png",
        })
      ).rejects.toThrow(/Cannot update map.*active session/);
    });

    it("allows update when map only in inactive session", async () => {
      const t = createTestContext();
      // Uses COMPLETE as representative of inactive statuses (COMPLETE, EXPIRED)
      const { mapId } = await createMapInSession(t, "COMPLETE");

      const result = await t.mutation(api.maps.updateMap, {
        mapId,
        name: "Renamed Map",
      });

      expect(result.success).toBe(true);
      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.name).toBe("Renamed Map");
    });

    it("allows update when map not used in any session", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Unused Map",
        imageUrl: "https://example.com/map.png",
      });

      const result = await t.mutation(api.maps.updateMap, {
        mapId,
        name: "Renamed Map",
      });

      expect(result.success).toBe(true);
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

    it.skip("updates imageStorageId", () => {
      // Requires real storage ID for initial setup
      // Test in integration tests against dev deployment
    });
  });
});

// ============================================================================
// deactivateMap Tests
// ============================================================================

describe("maps.deactivateMap", () => {
  describe("success cases", () => {
    it("deactivates active map", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Active Map",
        imageUrl: "https://example.com/map.png",
      });

      const result = await t.mutation(api.maps.deactivateMap, { mapId });

      expect(result.success).toBe(true);
      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.isActive).toBe(false);
    });

    it("updates updatedAt timestamp", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      const before = Date.now();
      await t.mutation(api.maps.deactivateMap, { mapId });

      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("not found", () => {
    it("throws for non-existent map", async () => {
      const t = createTestContext();

      const deletedMapId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Temporary", imageUrl: "https://example.com/map.png" })
        );
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.mutation(api.maps.deactivateMap, { mapId: deletedMapId })
      ).rejects.toThrow(/Map not found/);
    });
  });

  describe("already inactive", () => {
    it("throws when map is already inactive", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });
      await t.mutation(api.maps.deactivateMap, { mapId });

      await expect(
        t.mutation(api.maps.deactivateMap, { mapId })
      ).rejects.toThrow(/already inactive/);
    });
  });

  // Session blocking tests use representative statuses from ACTIVE_SESSION_STATUSES constant.
  describe("session blocking", () => {
    it("blocks deactivation when map in active session", async () => {
      const t = createTestContext();
      // Uses IN_PROGRESS as representative of ACTIVE_SESSION_STATUSES
      const { mapId } = await createMapInSession(t, "IN_PROGRESS");

      await expect(
        t.mutation(api.maps.deactivateMap, { mapId })
      ).rejects.toThrow(/Cannot deactivate map.*active session/);
    });

    it("allows deactivation when map only in inactive session", async () => {
      const t = createTestContext();
      // Uses COMPLETE as representative of inactive statuses
      const { mapId } = await createMapInSession(t, "COMPLETE");

      const result = await t.mutation(api.maps.deactivateMap, { mapId });

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// reactivateMap Tests
// ============================================================================

describe("maps.reactivateMap", () => {
  describe("success cases", () => {
    it("reactivates inactive map", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });
      await t.mutation(api.maps.deactivateMap, { mapId });

      const result = await t.mutation(api.maps.reactivateMap, { mapId });

      expect(result.success).toBe(true);
      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.isActive).toBe(true);
    });

    it("updates updatedAt timestamp", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });
      await t.mutation(api.maps.deactivateMap, { mapId });

      const before = Date.now();
      await t.mutation(api.maps.reactivateMap, { mapId });

      const map = await t.run(async (ctx) => ctx.db.get(mapId));
      expect(map?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("not found", () => {
    it("throws for non-existent map", async () => {
      const t = createTestContext();

      const deletedMapId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "maps",
          mapFactory({ name: "Temporary", imageUrl: "https://example.com/map.png" })
        );
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.mutation(api.maps.reactivateMap, { mapId: deletedMapId })
      ).rejects.toThrow(/Map not found/);
    });
  });

  describe("already active", () => {
    it("throws when map is already active", async () => {
      const t = createTestContext();

      const { mapId } = await t.mutation(api.maps.createMap, {
        name: "Map",
        imageUrl: "https://example.com/map.png",
      });

      await expect(
        t.mutation(api.maps.reactivateMap, { mapId })
      ).rejects.toThrow(/already active/);
    });
  });

  describe("duplicate name conflict", () => {
    it("throws when another active map has same name", async () => {
      const t = createTestContext();

      // Use direct DB access to set up the scenario:
      // 1. An active map named "Contested Name" (inserted first, gets lower _id)
      // 2. An inactive map named "Contested Name" (inserted second, gets higher _id)
      // The reactivateMap query uses `.first()` which returns the document with
      // the lower _id when names are equal, so the active map will be found.
      const deactivatedMapId = await t.run(async (ctx) => {
        // Create active map FIRST (will have lower _id)
        await ctx.db.insert("maps", mapFactory({
          name: "Contested Name",
          imageUrl: "https://example.com/map1.png",
          isActive: true,
        }));

        // Create inactive map SECOND (will have higher _id)
        const inactiveId = await ctx.db.insert("maps", mapFactory({
          name: "Contested Name",
          imageUrl: "https://example.com/map2.png",
          isActive: false,
        }));

        return inactiveId;
      });

      // Try to reactivate the inactive map - should fail due to name conflict
      // with the already-active map
      await expect(
        t.mutation(api.maps.reactivateMap, { mapId: deactivatedMapId })
      ).rejects.toThrow(/another map named/);
    });
  });
});

// ============================================================================
// generateUploadUrl Tests
// ============================================================================

describe("maps.generateUploadUrl", () => {
  it("returns string URL", async () => {
    const t = createTestContext();

    const url = await t.mutation(api.maps.generateUploadUrl, {});

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
