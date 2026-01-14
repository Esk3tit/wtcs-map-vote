---
status: resolved
priority: p2
issue_id: "023"
tags: [code-review, architecture, dry, refactor]
dependencies: []
---

# Duplicate validateStorageFile Function

## Problem Statement

The `validateStorageFile` function is copy-pasted between `convex/maps.ts` (lines 39-63) and `convex/teams.ts` (lines 37-61). This violates the DRY principle and creates maintenance burden - any fix or enhancement needs to be applied twice.

## Findings

### Evidence
- `convex/maps.ts` lines 39-63: 25 lines
- `convex/teams.ts` lines 37-61: 25 lines
- **100% identical code**

Both functions:
- Check if storage file exists via `ctx.storage.getMetadata()`
- Validate file size against `MAX_IMAGE_SIZE_BYTES`
- Validate content type against `ALLOWED_IMAGE_CONTENT_TYPES`

### Similar Issue
The URL validation functions are also nearly identical:
- `validateImageUrl` in maps.ts (lines 21-33)
- `validateLogoUrl` in teams.ts (lines 21-31)
- ~95% similar, only error message text differs

## Proposed Solutions

### Option 1: Extract to Shared Library (Recommended)
Create `convex/lib/storageValidation.ts`:
```typescript
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_CONTENT_TYPES } from "./imageConstants";

export async function validateStorageFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  // shared implementation
}
```

**Pros:** Single source of truth, consistent behavior
**Cons:** Minor refactor required
**Effort:** Small (30 min)
**Risk:** Low

### Option 2: Keep Separate with TODO
Add comments linking the two implementations.

**Pros:** No code changes needed
**Cons:** Technical debt remains
**Effort:** None
**Risk:** None (but debt accumulates)

## Recommended Action

_To be filled during triage_

## Technical Details

### Affected Files
- `convex/maps.ts`
- `convex/teams.ts`
- New: `convex/lib/storageValidation.ts`

### Components Affected
- Map CRUD operations
- Team CRUD operations

## Acceptance Criteria

- [ ] Single `validateStorageFile` function exists in `convex/lib/`
- [ ] Both `maps.ts` and `teams.ts` import from shared location
- [ ] Build passes
- [ ] Tests pass (manual verification of upload validation)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-14 | Created during PR #18 code review | Pattern recognition agent identified 100% code duplication |

## Resources

- PR #18: feat(maps): Add maps admin page with image upload support
- Similar pattern: URL validation functions also duplicated
