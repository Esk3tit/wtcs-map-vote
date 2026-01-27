---
title: Type-Safe OAuth Profile Extraction in Convex Auth
category: convex-patterns
tags: [convex, auth, oauth, typescript, type-safety]
created: 2026-01-27
problem_type: type_safety
severity: minor
components: [convex-auth, oauth]
---

# Type-Safe OAuth Profile Extraction in Convex Auth

## Problem

The `@convex-dev/auth` library's `afterUserCreatedOrUpdated` callback provides `args.profile` as `Record<string, unknown>`, making direct field access unsafe:

```typescript
// UNSAFE - profile fields are unknown type
afterUserCreatedOrUpdated: async (ctx, args) => {
  const name = args.profile.name;        // unknown
  const avatarUrl = args.profile.image;  // unknown

  // TypeScript won't catch if you assign unknown to string
  await ctx.db.patch(adminId, {
    name: name,           // Type error or runtime issue
    avatarUrl: avatarUrl  // Type error or runtime issue
  });
}
```

This causes TypeScript errors or silent runtime issues when patching database records.

## Root Cause

OAuth providers return different profile shapes. Google returns `{ name, email, picture }`, GitHub returns `{ name, email, avatar_url }`, etc. The library uses `unknown` to force explicit type handling.

## Solution

Create a helper function that safely extracts string values:

```typescript
// convex/auth.ts
function extractProfileString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
```

Use it in the callback:

```typescript
afterUserCreatedOrUpdated: async (ctx, args) => {
  const profileName = extractProfileString(args.profile.name);
  const avatarUrl = extractProfileString(args.profile.image);

  // Now types are correct: string | undefined
  await ctx.db.patch(adminId, {
    ...(profileName && { name: profileName }),
    ...(avatarUrl && { avatarUrl }),
  });
}
```

## Additional Context Issue

The callback context also lacks schema-aware types. To use typed index queries:

```typescript
import type { MutationCtx } from "./_generated/server";

afterUserCreatedOrUpdated: async (ctx, args) => {
  // Cast to get typed database access
  const db = (ctx as unknown as MutationCtx).db;

  // Now can use indexes
  const admin = await db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}
```

## Complete Pattern

```typescript
import type { MutationCtx } from "./_generated/server";
import { normalizeEmail } from "./lib/auth";

function extractProfileString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default convexAuth({
  providers: [Google],
  callbacks: {
    afterUserCreatedOrUpdated: async (ctx, args) => {
      if (args.existingUserId) return;

      const profile = args.profile;
      const rawEmail = extractProfileString(profile.email);
      if (!rawEmail) return;

      const email = normalizeEmail(rawEmail);
      const db = (ctx as unknown as MutationCtx).db;

      const admin = await db
        .query("admins")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (admin) {
        const profileName = extractProfileString(profile.name);
        const avatarUrl = extractProfileString(profile.image);

        await db.patch(admin._id, {
          lastLoginAt: Date.now(),
          ...(profileName && { name: profileName }),
          ...(avatarUrl && { avatarUrl }),
        });
      }
    },
  },
});
```

## Prevention

1. Always use extraction helpers for `unknown` types
2. Never assume OAuth profile field existence
3. Use conditional spreads for optional updates
4. Cast context only when necessary for index queries

## Related

- [Convex Auth Documentation](https://labs.convex.dev/auth)
- PR #44: Admin whitelist implementation
