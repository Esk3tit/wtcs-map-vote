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
 */
async function createWhitelistedAdmin(
  t: ReturnType<typeof createTestContext>,
  overrides: Partial<Parameters<typeof adminFactory>[0]> = {}
) {
  const adminData = adminFactory(overrides);
  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("admins", adminData)
  );
  const authT = t.withIdentity({
    name: adminData.name,
    email: adminData.email,
    subject: `user_${adminData.email}`,
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
      const authT = createAuthenticatedContext({
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
      const authT = createAuthenticatedContext({
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
  });
});
