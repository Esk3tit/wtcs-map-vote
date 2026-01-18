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

// Re-export for convenience
export { schema };
