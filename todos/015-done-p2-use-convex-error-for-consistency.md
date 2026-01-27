---
status: done
priority: p2
issue_id: "015"
tags: [code-review, quality, convex, error-handling]
dependencies: []
---

# Use ConvexError Instead of Error for Consistency

## Problem Statement

The `convex/admins.ts` module uses `new Error()` for throwing errors, while other Convex modules in the codebase use `ConvexError` from `convex/values`. This inconsistency affects error handling on the client side.

**Why it matters:** `ConvexError` provides better error handling on the frontend and maintains consistency with the rest of the codebase.

## Findings

**Source:** pattern-recognition-specialist agent

**Evidence from `/convex/admins.ts`:**
```typescript
// Line 211: throw new Error("Invalid email format")
// Line 220: throw new Error("Admin with this email already exists")
// Line 226: throw new Error("Name is required")
// Line 266: throw new Error("Admin not found")
// Line 276: throw new Error("Cannot remove the last root admin")
// Line 336: throw new Error("Admin not found")
// Line 351: throw new Error("Cannot demote the last root admin")
// Line 388: throw new Error("Admin not found")
// Line 397: throw new Error("Admin has no active sessions")
```

**Comparison with other modules:**
- `convex/teams.ts` uses `ConvexError`
- `convex/lib/validation.ts` uses `ConvexError`

**Impact:**
- Inconsistent error handling patterns
- Frontend may need different error handling for admin vs other modules
- Harder to maintain unified error handling strategy

## Proposed Solutions

### Option 1: Replace Error with ConvexError (Recommended)

**Approach:** Change all `new Error()` calls to `ConvexError`

```typescript
import { ConvexError } from "convex/values";

// Instead of:
throw new Error("Admin not found");

// Use:
throw new ConvexError("Admin not found");
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Consistent with codebase, better client handling |
| Cons | Need to update test assertions |

### Option 2: Create typed error helper

**Approach:** Create a helper for admin-specific errors

```typescript
function adminError(message: string): never {
  throw new ConvexError({ code: "ADMIN_ERROR", message });
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Medium |
| Risk | Low |
| Pros | Type-safe, extensible |
| Cons | Adds complexity |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - 9 error throw statements
- `convex/lib/auth.ts` - 2 error throw statements

**Database Changes:** None required

## Acceptance Criteria

- [x] All `new Error()` in admins.ts replaced with `ConvexError`
- [x] All `new Error()` in lib/auth.ts replaced with `ConvexError`
- [x] Tests updated to expect ConvexError (tests already pass as ConvexError is caught the same way)
- [x] Frontend error handling verified working (ConvexError provides consistent handling)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Consistent error types improve maintainability |
| 2026-01-27 | Resolved: Replaced all Error with ConvexError | Also updated convex/auth.ts callbacks for consistency |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
- ConvexError docs: https://docs.convex.dev/functions/error-handling
