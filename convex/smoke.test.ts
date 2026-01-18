/**
 * Smoke Tests
 *
 * Verifies convex-test infrastructure is correctly configured.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext, createAuthenticatedContext } from "./test.setup";
import { teamFactory } from "./test.factories";

describe("convex-test setup", () => {
  it("can create test context", () => {
    const t = createTestContext();
    expect(t).toBeDefined();
    expect(typeof t.query).toBe("function");
    expect(typeof t.mutation).toBe("function");
    expect(typeof t.run).toBe("function");
  });

  it("can access database via t.run", async () => {
    const t = createTestContext();

    const result = await t.run(async (ctx) => {
      // Insert a team directly
      const teamId = await ctx.db.insert(
        "teams",
        teamFactory({ name: "Smoke Test Team" })
      );
      return await ctx.db.get(teamId);
    });

    expect(result).toMatchObject({
      name: "Smoke Test Team",
    });
  });

  it("provides isolated database between tests", async () => {
    const t = createTestContext();

    // This test runs after the previous one, but should have empty DB
    const teams = await t.run(async (ctx) => {
      return await ctx.db.query("teams").collect();
    });

    expect(teams).toEqual([]);
  });

  it("can create authenticated context", async () => {
    const asAdmin = createAuthenticatedContext({
      name: "Test Admin",
      email: "admin@test.com",
    });

    expect(asAdmin).toBeDefined();
    expect(typeof asAdmin.query).toBe("function");
  });

  it("supports t.withIdentity for authentication", async () => {
    const t = createTestContext();

    const asUser = t.withIdentity({
      name: "Test User",
      email: "user@test.com",
    });

    // Verify identity is correctly passed through authenticated context
    const identity = await asUser.run(async (ctx) => {
      return await ctx.auth.getUserIdentity();
    });

    expect(identity).toBeDefined();
    expect(identity?.name).toBe("Test User");
    expect(identity?.email).toBe("user@test.com");
  });
});

describe("convex-test scheduled functions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("can use fake timers for scheduled function testing", async () => {
    const t = createTestContext();

    // Advance time
    vi.advanceTimersByTime(1000);

    // Can use finishInProgressScheduledFunctions
    await t.finishInProgressScheduledFunctions();

    expect(true).toBe(true); // Setup works
  });
});
