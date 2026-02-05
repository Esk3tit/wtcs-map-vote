/**
 * Admins CRUD Tests
 *
 * Tests for admin whitelist management: add, remove, update role, session invalidation.
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext } from "./test.setup";
import { adminFactory } from "./test.factories";
import { api } from "./_generated/api";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates an authenticated context with admin in whitelist.
 * Sets up auth user + admin records and uses "userId|sessionId" subject format.
 */
async function createWhitelistedAdmin(
  t: ReturnType<typeof createTestContext>,
  overrides: Partial<Parameters<typeof adminFactory>[0]> = {}
) {
  const adminData = adminFactory(overrides);

  // Insert auth user into users table (required for getAuthUserId lookup)
  const authUserId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: adminData.email, name: adminData.name })
  );

  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("admins", adminData)
  );
  const authT = t.withIdentity({
    name: adminData.name,
    subject: `${authUserId}|fake_session_id`,
    issuer: "https://auth.example.com",
  });
  return { adminId, adminData, authT };
}

// ============================================================================
// getMe Tests
// ============================================================================

describe("admins.getMe", () => {
  describe("unauthenticated", () => {
    it("returns null when not authenticated", async () => {
      const t = createTestContext();

      const result = await t.query(api.admins.getMe, {});

      expect(result).toBeNull();
    });
  });

  describe("authenticated", () => {
    it("returns admin info when whitelisted", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        name: "Root Admin",
        isRootAdmin: true,
      });

      const result = await authT.query(api.admins.getMe, {});

      expect(result).toMatchObject({
        email: "root@test.com",
        name: "Root Admin",
        isRootAdmin: true,
      });
    });

    it("returns null when authenticated but not whitelisted", async () => {
      const authT = await createAuthenticatedContext({
        name: "Unknown User",
        email: "unknown@test.com",
      });

      const result = await authT.query(api.admins.getMe, {});

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// listAdmins Tests
// ============================================================================

describe("admins.listAdmins", () => {
  describe("authorization", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(t.query(api.admins.listAdmins, {})).rejects.toThrow(
        /Authentication required/
      );
    });

    it("throws when authenticated but not whitelisted", async () => {
      const authT = await createAuthenticatedContext({
        name: "Unknown User",
        email: "unknown@test.com",
      });

      await expect(authT.query(api.admins.listAdmins, {})).rejects.toThrow(
        /Authentication required/
      );
    });
  });

  describe("success cases", () => {
    it("returns all admins when authenticated as admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      // Add another admin
      await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "other@test.com", name: "Other Admin" })
        )
      );

      const result = await authT.query(api.admins.listAdmins, {});

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.email)).toContain("admin@test.com");
      expect(result.map((a) => a.email)).toContain("other@test.com");
    });
  });
});

// ============================================================================
// getAdmin Tests
// ============================================================================

describe("admins.getAdmin", () => {
  describe("authorization", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      await expect(
        t.query(api.admins.getAdmin, { adminId })
      ).rejects.toThrow(/Authentication required/);
    });

    it("throws when authenticated but not whitelisted", async () => {
      const t = createTestContext();
      const adminId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );
      const authT = await createAuthenticatedContext({
        name: "Unknown User",
        email: "unknown@test.com",
      });

      await expect(
        authT.query(api.admins.getAdmin, { adminId })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("returns admin by ID when authenticated", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({
            email: "target@test.com",
            name: "Target Admin",
            isRootAdmin: true,
          })
        )
      );

      const result = await authT.query(api.admins.getAdmin, {
        adminId: targetId,
      });

      expect(result).toMatchObject({
        _id: targetId,
        email: "target@test.com",
        name: "Target Admin",
        isRootAdmin: true,
      });
    });

    it("returns null for non-existent admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      const deletedId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "admins",
          adminFactory({ email: "temp@test.com" })
        );
        await ctx.db.delete(id);
        return id;
      });

      const result = await authT.query(api.admins.getAdmin, {
        adminId: deletedId,
      });

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// getAdminByEmail Tests
// ============================================================================

describe("admins.getAdminByEmail", () => {
  describe("authorization", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(
        t.query(api.admins.getAdminByEmail, { email: "target@test.com" })
      ).rejects.toThrow(/Authentication required/);
    });

    it("throws when authenticated but not whitelisted", async () => {
      const authT = await createAuthenticatedContext({
        name: "Unknown User",
        email: "unknown@test.com",
      });

      await expect(
        authT.query(api.admins.getAdminByEmail, { email: "target@test.com" })
      ).rejects.toThrow(/Authentication required/);
    });
  });

  describe("success cases", () => {
    it("returns admin by email when authenticated", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({
            email: "target@test.com",
            name: "Target Admin",
            isRootAdmin: true,
          })
        )
      );

      const result = await authT.query(api.admins.getAdminByEmail, {
        email: "target@test.com",
      });

      expect(result).toMatchObject({
        _id: targetId,
        email: "target@test.com",
        name: "Target Admin",
        isRootAdmin: true,
      });
    });

    it("normalizes email for lookup", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", name: "Target" })
        )
      );

      const result = await authT.query(api.admins.getAdminByEmail, {
        email: "  TARGET@TEST.COM  ",
      });

      expect(result).not.toBeNull();
      expect(result?.email).toBe("target@test.com");
    });

    it("returns null for non-existent email", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "admin@test.com",
        isRootAdmin: false,
      });

      const result = await authT.query(api.admins.getAdminByEmail, {
        email: "nonexistent@test.com",
      });

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// addAdmin Tests
// ============================================================================

describe("admins.addAdmin", () => {
  describe("authorization", () => {
    it("throws when not authenticated", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.admins.addAdmin, {
          email: "new@test.com",
          name: "New Admin",
        })
      ).rejects.toThrow(/Authentication required/);
    });

    it("throws when authenticated but not root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "regular@test.com",
        isRootAdmin: false,
      });

      await expect(
        authT.mutation(api.admins.addAdmin, {
          email: "new@test.com",
          name: "New Admin",
        })
      ).rejects.toThrow(/Root admin access required/);
    });
  });

  describe("success cases", () => {
    it("adds new admin when called by root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const result = await authT.mutation(api.admins.addAdmin, {
        email: "new@test.com",
        name: "New Admin",
      });

      expect(result.adminId).toBeDefined();

      const admin = await t.run(async (ctx) => ctx.db.get(result.adminId));
      expect(admin).toMatchObject({
        email: "new@test.com",
        name: "New Admin",
        isRootAdmin: false,
        lastLoginAt: 0,
      });
    });

    it("adds admin with root privileges when specified", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const result = await authT.mutation(api.admins.addAdmin, {
        email: "newroot@test.com",
        name: "New Root",
        isRootAdmin: true,
      });

      const admin = await t.run(async (ctx) => ctx.db.get(result.adminId));
      expect(admin?.isRootAdmin).toBe(true);
    });

    it("normalizes email to lowercase", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const result = await authT.mutation(api.admins.addAdmin, {
        email: "UPPERCASE@TEST.COM",
        name: "Test Admin",
      });

      const admin = await t.run(async (ctx) => ctx.db.get(result.adminId));
      expect(admin?.email).toBe("uppercase@test.com");
    });

    it("trims whitespace from name", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const result = await authT.mutation(api.admins.addAdmin, {
        email: "new@test.com",
        name: "  Padded Name  ",
      });

      const admin = await t.run(async (ctx) => ctx.db.get(result.adminId));
      expect(admin?.name).toBe("Padded Name");
    });

    it("creates audit log entry", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await authT.mutation(api.admins.addAdmin, {
        email: "new@test.com",
        name: "New Admin",
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "ADMIN_ADDED",
        targetEmail: "new@test.com",
      });
    });
  });

  describe("validation errors", () => {
    it("throws for invalid email format", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await expect(
        authT.mutation(api.admins.addAdmin, {
          email: "invalid-email",
          name: "Test",
        })
      ).rejects.toThrow(/Invalid email format/);
    });

    it("throws for empty name", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await expect(
        authT.mutation(api.admins.addAdmin, {
          email: "new@test.com",
          name: "   ",
        })
      ).rejects.toThrow(/Name is required/);
    });

    it("throws for duplicate email", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await authT.mutation(api.admins.addAdmin, {
        email: "existing@test.com",
        name: "First",
      });

      await expect(
        authT.mutation(api.admins.addAdmin, {
          email: "existing@test.com",
          name: "Second",
        })
      ).rejects.toThrow(/already exists/);
    });
  });
});

// ============================================================================
// removeAdmin Tests
// ============================================================================

describe("admins.removeAdmin", () => {
  describe("authorization", () => {
    it("throws when not root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "regular@test.com",
        isRootAdmin: false,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      await expect(
        authT.mutation(api.admins.removeAdmin, { adminId: targetId })
      ).rejects.toThrow(/Root admin access required/);
    });
  });

  describe("success cases", () => {
    it("removes admin from whitelist", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      const result = await authT.mutation(api.admins.removeAdmin, {
        adminId: targetId,
      });

      expect(result.success).toBe(true);

      const admin = await t.run(async (ctx) => ctx.db.get(targetId));
      expect(admin).toBeNull();
    });

    it("creates audit log entry", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      await authT.mutation(api.admins.removeAdmin, { adminId: targetId });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      const removeLog = logs.find((l) => l.action === "ADMIN_REMOVED");
      expect(removeLog).toMatchObject({
        action: "ADMIN_REMOVED",
        targetEmail: "target@test.com",
      });
    });
  });

  describe("protection rules", () => {
    it("prevents removing last root admin", async () => {
      const t = createTestContext();
      const { authT, adminId } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await expect(
        authT.mutation(api.admins.removeAdmin, { adminId })
      ).rejects.toThrow(/Cannot remove the last root admin/);
    });

    it("allows removing self if not last root admin", async () => {
      const t = createTestContext();
      const { authT, adminId } = await createWhitelistedAdmin(t, {
        email: "root1@test.com",
        isRootAdmin: true,
      });

      // Add another root admin
      await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "root2@test.com", isRootAdmin: true })
        )
      );

      const result = await authT.mutation(api.admins.removeAdmin, { adminId });

      expect(result.success).toBe(true);
    });
  });

  describe("not found", () => {
    it("throws for non-existent admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const deletedId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "admins",
          adminFactory({ email: "temp@test.com" })
        );
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        authT.mutation(api.admins.removeAdmin, { adminId: deletedId })
      ).rejects.toThrow(/Admin not found/);
    });
  });
});

// ============================================================================
// updateAdminRole Tests
// ============================================================================

describe("admins.updateAdminRole", () => {
  describe("authorization", () => {
    it("throws when not root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "regular@test.com",
        isRootAdmin: false,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      await expect(
        authT.mutation(api.admins.updateAdminRole, {
          adminId: targetId,
          isRootAdmin: true,
        })
      ).rejects.toThrow(/Root admin access required/);
    });
  });

  describe("success cases", () => {
    it("promotes admin to root", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", isRootAdmin: false })
        )
      );

      const result = await authT.mutation(api.admins.updateAdminRole, {
        adminId: targetId,
        isRootAdmin: true,
      });

      expect(result.success).toBe(true);

      const admin = await t.run(async (ctx) => ctx.db.get(targetId));
      expect(admin?.isRootAdmin).toBe(true);
    });

    it("demotes root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", isRootAdmin: true })
        )
      );

      const result = await authT.mutation(api.admins.updateAdminRole, {
        adminId: targetId,
        isRootAdmin: false,
      });

      expect(result.success).toBe(true);

      const admin = await t.run(async (ctx) => ctx.db.get(targetId));
      expect(admin?.isRootAdmin).toBe(false);
    });

    it("no-op when already at target state", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", isRootAdmin: true })
        )
      );

      const result = await authT.mutation(api.admins.updateAdminRole, {
        adminId: targetId,
        isRootAdmin: true,
      });

      expect(result.success).toBe(true);

      // Should not create audit log for no-op
      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs).toHaveLength(0);
    });

    it("creates audit log entry for promotion", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", isRootAdmin: false })
        )
      );

      await authT.mutation(api.admins.updateAdminRole, {
        adminId: targetId,
        isRootAdmin: true,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs[0]).toMatchObject({
        action: "ADMIN_PROMOTED",
        targetEmail: "target@test.com",
      });
    });

    it("creates audit log entry for demotion", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", isRootAdmin: true })
        )
      );

      await authT.mutation(api.admins.updateAdminRole, {
        adminId: targetId,
        isRootAdmin: false,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );
      expect(logs[0]).toMatchObject({
        action: "ADMIN_DEMOTED",
        targetEmail: "target@test.com",
      });
    });
  });

  describe("protection rules", () => {
    it("prevents demoting last root admin", async () => {
      const t = createTestContext();
      const { authT, adminId } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      await expect(
        authT.mutation(api.admins.updateAdminRole, {
          adminId,
          isRootAdmin: false,
        })
      ).rejects.toThrow(/Cannot demote the last root admin/);
    });

    it("allows demoting self if not last root admin", async () => {
      const t = createTestContext();
      const { authT, adminId } = await createWhitelistedAdmin(t, {
        email: "root1@test.com",
        isRootAdmin: true,
      });

      // Add another root admin
      await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "root2@test.com", isRootAdmin: true })
        )
      );

      const result = await authT.mutation(api.admins.updateAdminRole, {
        adminId,
        isRootAdmin: false,
      });

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// isEmailWhitelisted Tests
// ============================================================================

describe("admins.isEmailWhitelisted", () => {
  it("returns true for whitelisted email", async () => {
    const t = createTestContext();
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "admin@test.com",
    });

    expect(result).toBe(true);
  });

  it("returns false for non-whitelisted email", async () => {
    const t = createTestContext();

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "unknown@test.com",
    });

    expect(result).toBe(false);
  });

  it("normalizes email for comparison", async () => {
    const t = createTestContext();
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "ADMIN@TEST.COM",
    });

    expect(result).toBe(true);
  });
});

// ============================================================================
// invalidateAdminSessions Tests
// ============================================================================

describe("admins.invalidateAdminSessions", () => {
  describe("authorization", () => {
    it("throws when not root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "regular@test.com",
        isRootAdmin: false,
      });

      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "target@test.com" }))
      );

      await expect(
        authT.mutation(api.admins.invalidateAdminSessions, {
          adminId: targetId,
        })
      ).rejects.toThrow(/Root admin access required/);
    });
  });

  describe("success cases", () => {
    it("deletes all auth sessions for target admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      // Create target admin with auth user and auth sessions
      const targetAuthUserId = await t.run(async (ctx) =>
        ctx.db.insert("users", {
          email: "target@test.com",
          name: "Target Admin",
        })
      );
      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", name: "Target Admin" })
        )
      );

      // Create auth sessions for the target user
      await t.run(async (ctx) => {
        await ctx.db.insert("authSessions", {
          userId: targetAuthUserId,
          expirationTime: Date.now() + 86400000,
        });
        await ctx.db.insert("authSessions", {
          userId: targetAuthUserId,
          expirationTime: Date.now() + 86400000,
        });
      });

      // Verify sessions exist before
      const sessionsBefore = await t.run(async (ctx) =>
        ctx.db
          .query("authSessions")
          .withIndex("userId", (q) => q.eq("userId", targetAuthUserId))
          .collect()
      );
      expect(sessionsBefore).toHaveLength(2);

      const result = await authT.mutation(
        api.admins.invalidateAdminSessions,
        { adminId: targetId }
      );

      expect(result.success).toBe(true);

      // Verify sessions deleted
      const sessionsAfter = await t.run(async (ctx) =>
        ctx.db
          .query("authSessions")
          .withIndex("userId", (q) => q.eq("userId", targetAuthUserId))
          .collect()
      );
      expect(sessionsAfter).toHaveLength(0);
    });

    it("creates ADMIN_SESSIONS_INVALIDATED audit log", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetAuthUserId = await t.run(async (ctx) =>
        ctx.db.insert("users", {
          email: "target@test.com",
          name: "Target Admin",
        })
      );
      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", name: "Target Admin" })
        )
      );
      await t.run(async (ctx) => {
        await ctx.db.insert("authSessions", {
          userId: targetAuthUserId,
          expirationTime: Date.now() + 86400000,
        });
      });

      await authT.mutation(api.admins.invalidateAdminSessions, {
        adminId: targetId,
      });

      const logs = await t.run(async (ctx) =>
        ctx.db.query("adminAuditLogs").collect()
      );

      const invalidateLog = logs.find(
        (l) => l.action === "ADMIN_SESSIONS_INVALIDATED"
      );
      expect(invalidateLog).toBeDefined();
      expect(invalidateLog).toMatchObject({
        action: "ADMIN_SESSIONS_INVALIDATED",
        targetEmail: "target@test.com",
      });
      expect(invalidateLog?.details?.message).toBe(
        "Manual session invalidation by root admin"
      );
      expect(invalidateLog?.details?.targetName).toBe("Target Admin");
    });

    it("target admin remains in whitelist after invalidation", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const targetAuthUserId = await t.run(async (ctx) =>
        ctx.db.insert("users", {
          email: "target@test.com",
          name: "Target Admin",
        })
      );
      const targetId = await t.run(async (ctx) =>
        ctx.db.insert(
          "admins",
          adminFactory({ email: "target@test.com", name: "Target Admin" })
        )
      );
      await t.run(async (ctx) => {
        await ctx.db.insert("authSessions", {
          userId: targetAuthUserId,
          expirationTime: Date.now() + 86400000,
        });
      });

      await authT.mutation(api.admins.invalidateAdminSessions, {
        adminId: targetId,
      });

      // Admin should still be in whitelist
      const admin = await t.run(async (ctx) => ctx.db.get(targetId));
      expect(admin).not.toBeNull();
      expect(admin?.email).toBe("target@test.com");
    });
  });

  describe("not found", () => {
    it("throws for non-existent admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const deletedId = await t.run(async (ctx) => {
        const id = await ctx.db.insert(
          "admins",
          adminFactory({ email: "temp@test.com" })
        );
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        authT.mutation(api.admins.invalidateAdminSessions, {
          adminId: deletedId,
        })
      ).rejects.toThrow(/Admin not found/);
    });

    it("throws when admin has no auth user", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      // Admin without corresponding auth user
      const targetId = await t.run(async (ctx) =>
        ctx.db.insert("admins", adminFactory({ email: "noauth@test.com" }))
      );

      await expect(
        authT.mutation(api.admins.invalidateAdminSessions, {
          adminId: targetId,
        })
      ).rejects.toThrow(/no active sessions/);
    });
  });
});

// ============================================================================
// getAdminAuditLogs Tests
// ============================================================================

describe("admins.getAdminAuditLogs", () => {
  describe("authorization", () => {
    it("throws when not root admin", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "regular@test.com",
        isRootAdmin: false,
      });

      await expect(
        authT.query(api.admins.getAdminAuditLogs, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).rejects.toThrow(/Root admin access required/);
    });
  });

  describe("success cases", () => {
    it("returns audit logs sorted by timestamp descending", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      // Create some audit logs
      await t.run(async (ctx) => {
        await ctx.db.insert("adminAuditLogs", {
          action: "ADMIN_ADDED",
          targetEmail: "first@test.com",
          timestamp: 1000,
        });
        await ctx.db.insert("adminAuditLogs", {
          action: "ADMIN_REMOVED",
          targetEmail: "second@test.com",
          timestamp: 2000,
        });
      });

      const result = await authT.query(api.admins.getAdminAuditLogs, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.page[0].targetEmail).toBe("second@test.com");
      expect(result.page[1].targetEmail).toBe("first@test.com");
    });

    it("returns empty page when no audit logs exist", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      const result = await authT.query(api.admins.getAdminAuditLogs, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });

    it("paginates correctly across multiple pages", async () => {
      const t = createTestContext();
      const { authT } = await createWhitelistedAdmin(t, {
        email: "root@test.com",
        isRootAdmin: true,
      });

      // Create 5 audit logs with distinct timestamps
      await t.run(async (ctx) => {
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert("adminAuditLogs", {
            action: "ADMIN_ADDED",
            targetEmail: `user${i}@test.com`,
            timestamp: i * 1000,
          });
        }
      });

      // Fetch page 1 (2 items)
      const page1 = await authT.query(api.admins.getAdminAuditLogs, {
        paginationOpts: { numItems: 2, cursor: null },
      });
      expect(page1.page).toHaveLength(2);
      expect(page1.isDone).toBe(false);
      // Newest first
      expect(page1.page[0].targetEmail).toBe("user5@test.com");
      expect(page1.page[1].targetEmail).toBe("user4@test.com");

      // Fetch page 2 (2 items)
      const page2 = await authT.query(api.admins.getAdminAuditLogs, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });
      expect(page2.page).toHaveLength(2);
      expect(page2.page[0].targetEmail).toBe("user3@test.com");
      expect(page2.page[1].targetEmail).toBe("user2@test.com");

      // Fetch page 3 (remaining 1 item)
      const page3 = await authT.query(api.admins.getAdminAuditLogs, {
        paginationOpts: { numItems: 2, cursor: page2.continueCursor },
      });
      expect(page3.page).toHaveLength(1);
      expect(page3.page[0].targetEmail).toBe("user1@test.com");
      expect(page3.isDone).toBe(true);
    });
  });
});
