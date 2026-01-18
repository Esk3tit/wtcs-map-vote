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

/** Glob all Convex function files (excludes _generated and test files) */
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
