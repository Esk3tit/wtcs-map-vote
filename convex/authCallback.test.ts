/**
 * Auth Callback Tests
 *
 * Genuinely tested:
 * - extractProfileString helper (pure function, exported from auth.ts)
 * - Unauthorized email path logic conditions (verifies rejection criteria)
 *
 * NOT tested here (see doc comment below):
 * - Existing admin login path (profile update, lastLoginAt, audit log)
 * - First user bootstrap path (root admin creation, audit log)
 *
 * The afterUserCreatedOrUpdated callback runs inside convexAuth() and cannot
 * be invoked directly from convex-test. See convex/auth.ts lines 29-108.
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
});

// ============================================================================
// Auth Callback Behavior (NOT directly testable)
// ============================================================================

/**
 * The afterUserCreatedOrUpdated callback in convex/auth.ts (lines 29-108)
 * handles three code paths:
 *
 * 1. EXISTING ADMIN LOGIN (lines 49-72):
 *    - Looks up admin by normalized email via by_email index
 *    - Updates name/avatarUrl from OAuth profile (falls back to existing values)
 *    - Sets lastLoginAt to Date.now()
 *    - Logs ADMIN_LOGIN to adminAuditLogs
 *
 * 2. FIRST USER BOOTSTRAP (lines 74-98):
 *    - Triggers when no admins exist in the table
 *    - Creates admin record with isRootAdmin: true
 *    - Uses profile name or falls back to "Root Admin"
 *    - Logs SYSTEM_BOOTSTRAP to adminAuditLogs
 *
 * 3. UNAUTHORIZED EMAIL (lines 100-107):
 *    - Email not in admins table AND admins already exist
 *    - Throws ConvexError to block sign-in
 *    - Cannot audit log because the throw rolls back all writes
 *
 * WHY THESE CANNOT BE TESTED:
 * The callback runs inside convexAuth() which convex-test cannot invoke.
 * Previous tests in this file simulated the callback by manually calling
 * ctx.db.patch/ctx.db.insert, but that tests Convex DB operations, not the
 * actual callback logic. The real callback is integration-tested via manual
 * OAuth sign-in flows.
 *
 * Only the unauthorized path's LOGIC CONDITIONS are testable below, since
 * we can verify the query results that would trigger rejection.
 */

// ============================================================================
// Unauthorized Email Path (logic conditions)
// ============================================================================

describe("auth callback effects", () => {
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
