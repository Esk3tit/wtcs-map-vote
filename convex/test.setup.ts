/// <reference types="vite/client" />

/**
 * Test Setup Utilities
 *
 * Provides factory functions for creating test contexts with convex-test.
 */

import { convexTest } from "convex-test";

import schema from "./schema";

// ============================================================================
// Module Configuration
// ============================================================================

/**
 * Glob all Convex function files for convex-test.
 *
 * The extglob pattern matches files with single-extension names (.ts, .js)
 * while excluding multi-dot files (.d.ts). This is from the convex-test docs:
 * - Includes _generated JS files (required for convex-test module resolution)
 * - Excludes _generated .d.ts files (type definitions not needed at runtime)
 * - Excludes test files by pattern naturally
 */
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");

// ============================================================================
// Test Context Factories
// ============================================================================

/**
 * Create a fresh convex-test instance with schema.
 * Call this at the start of each test for isolation.
 */
export function createTestContext() {
  return convexTest(schema, modules);
}

/**
 * Create an authenticated test context with identity.
 *
 * @param identity - Auth identity to attach to the test context
 */
export function createAuthenticatedContext(identity: {
  name: string;
  email?: string;
  subject?: string;
  issuer?: string;
}) {
  const t = convexTest(schema, modules);
  return t.withIdentity({
    name: identity.name,
    email: identity.email,
    subject:
      identity.subject ??
      `user_${identity.name.toLowerCase().replace(/\s/g, "_")}`,
    issuer: identity.issuer ?? "https://auth.example.com",
  });
}

// ============================================================================
// Admin Authentication Helper
// ============================================================================

/** Default admin email used for test authentication */
export const TEST_ADMIN_EMAIL = "test-admin@test.com";

/**
 * Admin data matching the default test admin identity.
 * Use this when inserting an admin to the database before running authenticated mutations.
 */
export const TEST_ADMIN_DATA = {
  email: TEST_ADMIN_EMAIL,
  name: "Test Admin",
  isRootAdmin: false,
  lastLoginAt: Date.now(),
};

/**
 * Creates an authenticated test context with a whitelisted admin.
 * Sets up the admin record in the database and returns an authenticated context.
 *
 * @returns Object containing authT (authenticated context) and adminId
 */
export async function createAuthenticatedAdmin() {
  const t = createTestContext();

  // Insert admin into whitelist
  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("admins", TEST_ADMIN_DATA)
  );

  // Create authenticated context with matching email
  const authT = t.withIdentity({
    name: TEST_ADMIN_DATA.name,
    email: TEST_ADMIN_DATA.email,
    subject: `user_${TEST_ADMIN_DATA.email}`,
    issuer: "https://auth.example.com",
  });

  return { t, authT, adminId };
}

// Re-export for convenience
export { schema };
