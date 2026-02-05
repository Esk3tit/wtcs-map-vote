/**
 * Auth Helper Tests
 *
 * Tests for getCurrentAdmin, requireAdmin, requireRootAdmin, and normalizeEmail.
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedAdmin,
  createAuthenticatedContext,
} from "../test.setup";
import { adminFactory } from "../test.factories";
import { api } from "../_generated/api";

// ============================================================================
// normalizeEmail Tests
// ============================================================================

/**
 * normalizeEmail is a pure function — test it indirectly via the public API
 * (isEmailWhitelisted uses it internally for email comparison).
 */
describe("normalizeEmail (via isEmailWhitelisted)", () => {
  it("lowercases email for comparison", async () => {
    const t = createTestContext();
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "ADMIN@TEST.COM",
    });

    expect(result).toBe(true);
  });

  it("trims whitespace for comparison", async () => {
    const t = createTestContext();
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "  admin@test.com  ",
    });

    expect(result).toBe(true);
  });

  it("handles already-normalized email", async () => {
    const t = createTestContext();
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const result = await t.query(api.admins.isEmailWhitelisted, {
      email: "admin@test.com",
    });

    expect(result).toBe(true);
  });
});

// ============================================================================
// getCurrentAdmin Tests (via getMe which delegates to getCurrentAdmin)
// ============================================================================

describe("getCurrentAdmin (via admins.getMe)", () => {
  it("returns null when not authenticated", async () => {
    const t = createTestContext();

    const result = await t.query(api.admins.getMe, {});

    expect(result).toBeNull();
  });

  it("returns null when user record has no email", async () => {
    const t = createTestContext();

    // Create auth user WITHOUT email (covers lib/auth.ts line 29 branch)
    const authUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "No Email User" })
    );

    const authT = t.withIdentity({
      name: "No Email User",
      subject: `${authUserId}|fake_session_id`,
      issuer: "https://auth.example.com",
    });

    const result = await authT.query(api.admins.getMe, {});

    expect(result).toBeNull();
  });

  it("returns null when email not in admins whitelist", async () => {
    const authT = await createAuthenticatedContext({
      name: "Unknown User",
      email: "unknown@test.com",
    });

    const result = await authT.query(api.admins.getMe, {});

    expect(result).toBeNull();
  });

  it("returns admin when email matches whitelist", async () => {
    const { authT } = await createAuthenticatedAdmin();

    const result = await authT.query(api.admins.getMe, {});

    expect(result).not.toBeNull();
    expect(result?.email).toBe("test-admin@test.com");
  });

  it("normalizes email before lookup (case insensitive)", async () => {
    const t = createTestContext();

    // Create auth user with UPPERCASE email
    const authUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "ADMIN@TEST.COM",
        name: "Admin",
      })
    );

    // Admin in whitelist with lowercase email
    await t.run(async (ctx) =>
      ctx.db.insert("admins", adminFactory({ email: "admin@test.com" }))
    );

    const authT = t.withIdentity({
      name: "Admin",
      subject: `${authUserId}|fake_session_id`,
      issuer: "https://auth.example.com",
    });

    const result = await authT.query(api.admins.getMe, {});

    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin@test.com");
  });
});

// ============================================================================
// requireAdmin Tests (via listAdmins which calls requireAdmin)
// ============================================================================

describe("requireAdmin (via admins.listAdmins)", () => {
  it("succeeds for authenticated whitelisted user", async () => {
    const { authT } = await createAuthenticatedAdmin();

    const result = await authT.query(api.admins.listAdmins, {});

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("throws 'Authentication required' when not authenticated", async () => {
    const t = createTestContext();

    await expect(t.query(api.admins.listAdmins, {})).rejects.toThrow(
      /Authentication required/
    );
  });

  it("throws 'Authentication required' when email not whitelisted", async () => {
    const authT = await createAuthenticatedContext({
      name: "Unknown User",
      email: "unknown@test.com",
    });

    await expect(authT.query(api.admins.listAdmins, {})).rejects.toThrow(
      /Authentication required/
    );
  });
});

// ============================================================================
// requireRootAdmin Tests (via addAdmin which calls requireRootAdmin)
// ============================================================================

describe("requireRootAdmin (via admins.addAdmin)", () => {
  it("succeeds for authenticated root admin", async () => {
    const t = createTestContext();

    // Create root admin
    const authUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "root@test.com", name: "Root Admin" })
    );
    await t.run(async (ctx) =>
      ctx.db.insert(
        "admins",
        adminFactory({ email: "root@test.com", isRootAdmin: true })
      )
    );
    const authT = t.withIdentity({
      name: "Root Admin",
      subject: `${authUserId}|fake_session_id`,
      issuer: "https://auth.example.com",
    });

    const result = await authT.mutation(api.admins.addAdmin, {
      email: "new@test.com",
      name: "New Admin",
    });

    expect(result.adminId).toBeDefined();
  });

  it("throws 'Root admin access required' for non-root admin", async () => {
    const { authT } = await createAuthenticatedAdmin();

    await expect(
      authT.mutation(api.admins.addAdmin, {
        email: "new@test.com",
        name: "New Admin",
      })
    ).rejects.toThrow(/Root admin access required/);
  });

  it("throws 'Authentication required' for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.admins.addAdmin, {
        email: "new@test.com",
        name: "New Admin",
      })
    ).rejects.toThrow(/Authentication required/);
  });
});
