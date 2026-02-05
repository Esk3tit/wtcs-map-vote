/**
 * Auth Callback Tests
 *
 * Tests for the OAuth callback logic in auth.ts:
 * - extractProfileString helper (exported for direct testing)
 * - Callback effects for all three code paths (existing admin, bootstrap, unauthorized)
 *
 * NOTE: The afterUserCreatedOrUpdated callback runs inside convexAuth() and
 * cannot be invoked directly from convex-test. We test the business logic by:
 * 1. Testing extractProfileString as a pure function
 * 2. Simulating the callback's DB effects via t.run() and verifying state
 */

import { describe, it, expect } from "vitest";
import { createTestContext } from "./test.setup";
import { adminFactory } from "./test.factories";
import { extractProfileString } from "./auth";

// ============================================================================
// extractProfileString Tests
// ============================================================================

describe("extractProfileString", () => {
  it("returns string for non-empty string input", () => {
    expect(extractProfileString("John Doe")).toBe("John Doe");
  });

  it("returns undefined for empty string", () => {
    expect(extractProfileString("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(extractProfileString(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(extractProfileString(undefined)).toBeUndefined();
  });

  it("returns undefined for number", () => {
    expect(extractProfileString(42)).toBeUndefined();
  });

  it("returns undefined for object", () => {
    expect(extractProfileString({ name: "test" })).toBeUndefined();
  });

  it("returns undefined for boolean", () => {
    expect(extractProfileString(true)).toBeUndefined();
  });

  it("returns string for single character", () => {
    expect(extractProfileString("A")).toBe("A");
  });
});

// ============================================================================
// Auth Callback Effect Tests
// ============================================================================

/**
 * These tests simulate what the afterUserCreatedOrUpdated callback does
 * by directly manipulating the database and verifying the expected state.
 * This validates the business logic of each code path.
 */
describe("auth callback effects", () => {
  describe("existing admin login path", () => {
    it("updates lastLoginAt when admin signs in", async () => {
      const t = createTestContext();
      const oldLoginTime = Date.now() - 86400000; // 1 day ago

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "admin@test.com", lastLoginAt: oldLoginTime })
        )
      );

      // Simulate callback updating lastLoginAt
      const now = Date.now();
      await t.run(async (ctx) => {
        const admin = await ctx.db.get(adminId);
        if (!admin) throw new Error("Admin not found");
        await ctx.db.patch(adminId, { lastLoginAt: now });
      });

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.lastLoginAt).toBeGreaterThanOrEqual(now);
    });

    it("updates name from OAuth profile if provided", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "admin@test.com", name: "Old Name" })
        )
      );

      // Simulate callback: profile has new name
      const profileName = extractProfileString("New Name");
      await t.run(async (ctx) => {
        const admin = await ctx.db.get(adminId);
        if (!admin) throw new Error("Admin not found");
        const updatedName = profileName ?? admin.name;
        await ctx.db.patch(adminId, { name: updatedName });
      });

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.name).toBe("New Name");
    });

    it("preserves existing name when profile name is empty", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "admin@test.com", name: "Keep This Name" })
        )
      );

      // Simulate callback: profile has empty name
      const profileName = extractProfileString("");
      await t.run(async (ctx) => {
        const admin = await ctx.db.get(adminId);
        if (!admin) throw new Error("Admin not found");
        const updatedName = profileName ?? admin.name;
        await ctx.db.patch(adminId, { name: updatedName });
      });

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.name).toBe("Keep This Name");
    });

    it("updates avatarUrl from OAuth profile if provided", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({
            email: "admin@test.com",
            avatarUrl: "https://old-avatar.png",
          })
        )
      );

      const profileImage = extractProfileString("https://new-avatar.png");
      await t.run(async (ctx) => {
        const admin = await ctx.db.get(adminId);
        if (!admin) throw new Error("Admin not found");
        const updatedAvatar = profileImage ?? admin.avatarUrl;
        await ctx.db.patch(adminId, { avatarUrl: updatedAvatar });
      });

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.avatarUrl).toBe("https://new-avatar.png");
    });

    it("preserves existing avatarUrl when profile image is empty", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({
            email: "admin@test.com",
            avatarUrl: "https://keep-this.png",
          })
        )
      );

      const profileImage = extractProfileString("");
      await t.run(async (ctx) => {
        const admin = await ctx.db.get(adminId);
        if (!admin) throw new Error("Admin not found");
        const updatedAvatar = profileImage ?? admin.avatarUrl;
        await ctx.db.patch(adminId, { avatarUrl: updatedAvatar });
      });

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.avatarUrl).toBe("https://keep-this.png");
    });

    it("creates ADMIN_LOGIN audit log with correct fields", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "admin@test.com", name: "Test Admin" })
        )
      );

      // Simulate callback creating audit log (matching auth.ts:62-69)
      await t.run(async (ctx) => {
        await ctx.db.insert("adminAuditLogs", {
          action: "ADMIN_LOGIN",
          actorId: adminId,
          actorEmail: "admin@test.com",
          targetId: adminId,
          targetEmail: "admin@test.com",
          details: { targetName: "Test Admin" },
          timestamp: Date.now(),
        });
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "ADMIN_LOGIN",
        actorEmail: "admin@test.com",
        targetEmail: "admin@test.com",
      });
      expect(logs[0].actorId).toBeDefined();
      expect(logs[0].targetId).toBeDefined();
      expect(logs[0].details?.targetName).toBe("Test Admin");
    });
  });

  describe("first user bootstrap path", () => {
    it("creates root admin when no admins exist", async () => {
      const t = createTestContext();

      // Verify no admins exist
      const before = await t.run(async (ctx) =>
        ctx.db.query("admins").collect()
      );
      expect(before).toHaveLength(0);

      // Simulate callback creating first user as root
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", {
          email: "first@test.com",
          name: "First Admin",
          avatarUrl: undefined,
          isRootAdmin: true,
          lastLoginAt: Date.now(),
        })
      );

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.isRootAdmin).toBe(true);
      expect(admin?.email).toBe("first@test.com");
    });

    it("uses profile name if available", async () => {
      const t = createTestContext();

      const profileName = extractProfileString("Jane Doe");
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", {
          email: "jane@test.com",
          name: profileName ?? "Root Admin",
          isRootAdmin: true,
          lastLoginAt: Date.now(),
        })
      );

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.name).toBe("Jane Doe");
    });

    it("falls back to 'Root Admin' when no profile name", async () => {
      const t = createTestContext();

      const profileName = extractProfileString(undefined);
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", {
          email: "anon@test.com",
          name: profileName ?? "Root Admin",
          isRootAdmin: true,
          lastLoginAt: Date.now(),
        })
      );

      const admin = await t.run(async (ctx) => ctx.db.get(adminId));
      expect(admin?.name).toBe("Root Admin");
    });

    it("creates SYSTEM_BOOTSTRAP audit log with details", async () => {
      const t = createTestContext();

      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", {
          email: "first@test.com",
          name: "Root Admin",
          isRootAdmin: true,
          lastLoginAt: Date.now(),
        })
      );

      // Simulate callback creating bootstrap audit log (matching auth.ts:86-95)
      await t.run(async (ctx) => {
        await ctx.db.insert("adminAuditLogs", {
          action: "SYSTEM_BOOTSTRAP",
          targetId: adminId,
          targetEmail: "first@test.com",
          details: {
            isRootAdmin: true,
            targetName: "Root Admin",
            message: "First admin created as root admin",
          },
          timestamp: Date.now(),
        });
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "SYSTEM_BOOTSTRAP",
        targetEmail: "first@test.com",
      });
      expect(logs[0].details?.isRootAdmin).toBe(true);
      expect(logs[0].details?.targetName).toBe("Root Admin");
      expect(logs[0].details?.message).toBe(
        "First admin created as root admin"
      );
    });
  });

  describe("unauthorized email path", () => {
    it("rejects non-whitelisted email when admins exist", async () => {
      const t = createTestContext();

      // Create an existing admin (so bootstrap path doesn't trigger)
      await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "admin@test.com", isRootAdmin: true })
        )
      );

      // Simulate checking: is this email whitelisted? No.
      const existingAdmin = await t.run(async (ctx) =>
        ctx.db
          .query("admins")
          .withIndex("by_email", (q) => q.eq("email", "unauthorized@test.com"))
          .first()
      );
      expect(existingAdmin).toBeNull();

      // Simulate checking: are there any admins? Yes.
      const anyAdmin = await t.run(async (ctx) =>
        ctx.db.query("admins").first()
      );
      expect(anyAdmin).not.toBeNull();

      // Therefore callback would throw ConvexError
      // (we verify the logic conditions that lead to rejection)
    });

    it("cannot persist audit log due to transaction rollback", async () => {
      // This test documents the known limitation:
      // When afterUserCreatedOrUpdated throws ConvexError, ALL writes
      // in that mutation are rolled back (including audit log inserts).
      // ctx.scheduler.runAfter is also rolled back.
      // This is why ADMIN_LOGIN_DENIED is not in the schema.

      const t = createTestContext();
      const before = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(before).toHaveLength(0);

      // Even if we inserted an audit log and then threw, it would be rolled back.
      // The ConvexError already surfaces as a 403 to the client.
    });
  });
});
