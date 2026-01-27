---
title: Convex-Test Authentication with Whitelist Pattern
category: test-failures
tags: [convex, testing, authentication, convex-test]
created: 2026-01-27
problem_type: test_configuration
severity: moderate
components: [convex-test, authentication]
---

# Convex-Test Authentication with Whitelist Pattern

## Problem

Testing auth-protected Convex mutations fails even with `withIdentity()`:

```typescript
// Test fails despite having identity
const t = convexTest(schema);
const authT = t.withIdentity({ email: "test@example.com" });

// Error: "Authentication required" or "Unauthorized"
await authT.mutation(api.admins.addAdmin, { email: "new@example.com" });
```

The identity is set but the mutation still rejects the request.

## Root Cause

Auth-protected mutations often check BOTH:
1. A valid identity exists (handled by `withIdentity()`)
2. The user exists in a whitelist/admins table (NOT handled by `withIdentity()`)

```typescript
// From requireAdmin helper
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) {
    throw new ConvexError("Authentication required");
  }

  // THIS CHECK FAILS - no matching record in admins table
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .first();

  if (!admin) {
    throw new ConvexError("Unauthorized");
  }

  return admin;
}
```

## Solution

Create a test helper that sets up BOTH the identity AND the database record:

```typescript
// convex/test.setup.ts
import { convexTest } from "convex-test";
import schema from "./schema";

export const TEST_ADMIN_DATA = {
  email: "test-admin@example.com",
  name: "Test Admin",
  isRootAdmin: true,
  lastLoginAt: Date.now(),
};

export function createTestContext() {
  return convexTest(schema);
}

export async function createAuthenticatedAdmin(overrides = {}) {
  const t = createTestContext();

  // 1. Insert admin record in database
  const adminData = { ...TEST_ADMIN_DATA, ...overrides };
  const adminId = await t.run(async (ctx) => {
    return ctx.db.insert("admins", adminData);
  });

  // 2. Create identity with MATCHING email
  const authT = t.withIdentity({
    email: adminData.email,
    name: adminData.name,
    subject: `user_${adminData.email}`,
    issuer: "https://auth.example.com",
  });

  return { t, authT, adminId };
}
```

## Usage in Tests

```typescript
import { createAuthenticatedAdmin, createTestContext } from "./test.setup";

describe("addAdmin", () => {
  it("allows root admin to add new admin", async () => {
    const { authT } = await createAuthenticatedAdmin({ isRootAdmin: true });

    const result = await authT.mutation(api.admins.addAdmin, {
      email: "new-admin@example.com",
      name: "New Admin",
    });

    expect(result.adminId).toBeDefined();
  });

  it("rejects non-root admin", async () => {
    const { authT } = await createAuthenticatedAdmin({ isRootAdmin: false });

    await expect(
      authT.mutation(api.admins.addAdmin, {
        email: "new@example.com",
        name: "New",
      })
    ).rejects.toThrow("Root admin access required");
  });

  it("rejects unauthenticated users", async () => {
    const t = createTestContext();
    // No withIdentity, no admin record

    await expect(
      t.mutation(api.admins.addAdmin, {
        email: "new@example.com",
        name: "New",
      })
    ).rejects.toThrow("Authentication required");
  });
});
```

## Key Points

### Email Must Match

The email in `withIdentity()` MUST match the email in the database record:

```typescript
// WRONG - emails don't match
const adminId = await t.run(ctx =>
  ctx.db.insert("admins", { email: "admin@example.com", ... })
);
const authT = t.withIdentity({ email: "different@example.com" }); // Won't work!

// CORRECT - emails match
const adminId = await t.run(ctx =>
  ctx.db.insert("admins", { email: "admin@example.com", ... })
);
const authT = t.withIdentity({ email: "admin@example.com" }); // Works!
```

### Return Both Contexts

Return both `t` (raw) and `authT` (authenticated) for flexibility:

```typescript
const { t, authT, adminId } = await createAuthenticatedAdmin();

// Use authT for authenticated API calls
await authT.mutation(api.admins.updateAdminRole, {...});

// Use t for direct database inspection
const admin = await t.run(ctx => ctx.db.get(adminId));
expect(admin.isRootAdmin).toBe(true);
```

### Factory Functions for Related Data

Create factory functions for test data:

```typescript
// convex/test.factories.ts
export const adminFactory = (overrides = {}) => ({
  email: `admin-${Date.now()}@example.com`,
  name: "Test Admin",
  isRootAdmin: false,
  lastLoginAt: Date.now(),
  ...overrides,
});

export const mapFactory = (overrides = {}) => ({
  name: "Test Map",
  imageUrl: "https://example.com/map.png",
  isActive: true,
  ...overrides,
});
```

## Prevention

1. Always check if mutations require whitelist membership
2. Create shared test setup helpers early in development
3. Test both positive (authorized) and negative (unauthorized) cases
4. Use consistent email values across identity and database

## Related

- [convex-test Documentation](https://docs.convex.dev/testing)
- [Convex Authentication](https://docs.convex.dev/auth)
- docs/solutions/test-failures/convex-test-runner-bun-vs-vitest.md
- PR #44: Admin whitelist implementation
