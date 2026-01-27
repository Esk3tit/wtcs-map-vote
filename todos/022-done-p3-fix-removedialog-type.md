---
status: done
priority: p3
issue_id: "022"
tags: [code-review, typescript, quality]
dependencies: []
---

# Fix RemoveAdminDialogProps Type

## Problem Statement

In `src/routes/admin/settings.tsx`, the `RemoveAdminDialogProps` interface types `_id` as `string` instead of `Id<'admins'>`, losing type safety.

**Why it matters:** Using the proper Convex ID type provides better type checking and IDE support.

## Findings

**Source:** architecture-strategist agent, pattern-recognition-specialist agent

**Evidence from `/src/routes/admin/settings.tsx` (lines 307-315):**
```typescript
interface RemoveAdminDialogProps {
  admin: {
    _id: string  // Should be Id<'admins'>
    name: string
    email: string
  }
  isCurrentUser: boolean
  onRemove: () => void
}
```

## Proposed Solutions

### Option 1: Use proper Convex ID type (Recommended)

**Approach:** Import and use `Id` type

```typescript
import type { Id } from '../../convex/_generated/dataModel'

interface RemoveAdminDialogProps {
  admin: {
    _id: Id<'admins'>
    name: string
    email: string
  }
  isCurrentUser: boolean
  onRemove: () => void
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Type safety, IDE support |
| Cons | None |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/admin/settings.tsx` - lines 307-315

**Database Changes:** None

## Acceptance Criteria

- [x] `_id` typed as `Id<'admins'>`
- [x] Import added for Id type
- [x] No TypeScript errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Use proper types for Convex IDs |
| 2026-01-27 | Fixed: Changed `_id: string` to `_id: Id<'admins'>` in RemoveAdminDialogProps | Import already existed; only type annotation needed update |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
