---
status: resolved
priority: p3
issue_id: "027"
tags: [code-review, documentation, agent-native]
dependencies: []
---

# Multi-Step Upload Workflow Not Documented

## Problem Statement

The image upload workflow requires 3 steps (generate URL, POST file, use storageId), but this orchestration pattern is not documented. AI agents and new developers must discover this by reading implementation code.

## Findings

### Evidence
Location: `/convex/maps.ts` lines 500-516

```typescript
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    return await ctx.storage.generateUploadUrl();
  },
});
```

### Missing Documentation
No JSDoc explaining:
1. How to use the returned URL
2. What Content-Type header to send
3. How to extract storageId from response
4. How to pass storageId to createMap/updateMap

### Impact
- AI agents cannot discover this workflow programmatically
- New developers must read frontend code to understand the pattern
- Error-prone integration

## Proposed Solutions

### Option 1: Add Comprehensive JSDoc (Recommended)
```typescript
/**
 * Generate a short-lived upload URL for map images.
 *
 * ## Usage Workflow
 * 1. Call this mutation to get an upload URL
 * 2. POST the file to the URL:
 *    ```
 *    fetch(uploadUrl, {
 *      method: "POST",
 *      headers: { "Content-Type": file.type },
 *      body: file
 *    })
 *    ```
 * 3. Extract storageId from response: `const { storageId } = await response.json()`
 * 4. Pass storageId to createMap/updateMap as imageStorageId
 *
 * ## Constraints
 * - Max file size: 2MB
 * - Allowed types: PNG, JPG, WebP
 * - URL expires in ~1 hour
 */
export const generateUploadUrl = mutation({ ... });
```

**Pros:** Self-documenting API, helps agents and developers
**Cons:** None
**Effort:** Small (10 min)
**Risk:** None

### Option 2: Add getImageConstraints Query
```typescript
export const getImageConstraints = query({
  args: {},
  handler: async () => ({
    maxSizeBytes: 2 * 1024 * 1024,
    maxSizeMB: 2,
    allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    recommendedAspectRatio: "16:9",
  }),
});
```

**Pros:** Programmatic discovery of constraints
**Cons:** Additional endpoint to maintain
**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

### Affected Files
- `convex/maps.ts`
- Possibly: `convex/teams.ts` (same pattern)

## Acceptance Criteria

- [ ] generateUploadUrl has comprehensive JSDoc
- [ ] Workflow is discoverable without reading frontend code
- [ ] Constraints are documented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-14 | Created during PR #18 code review | Agent-native reviewer identified discovery gap |

## Resources

- PR #18: feat(maps): Add maps admin page with image upload support
- Convex file storage docs
