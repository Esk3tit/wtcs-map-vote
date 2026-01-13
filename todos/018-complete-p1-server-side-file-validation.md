---
status: complete
priority: p1
issue_id: "018"
tags: [code-review, security, convex, teams]
dependencies: []
---

# Server-Side File Validation Missing

## Problem Statement

The `generateUploadUrl` mutation generates upload URLs without any server-side validation of uploaded files. While client-side validation exists in `src/lib/image-validation.ts`, it can be bypassed by malicious clients or agents calling the API directly. This allows arbitrary files to be uploaded and associated with teams.

## Findings

### Security Review Finding
- **Location:** `convex/teams.ts:301-308`
- **Evidence:**
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
- The server accepts any `logoStorageId` passed from the client in `createTeam` and `updateTeam` without validating file type, size, or content.

### Client-Side Validation (Bypassable)
- Max 2MB file size
- PNG, JPG, WebP MIME types only
- Extension whitelist

### Attack Vectors
1. Upload oversized files (storage exhaustion)
2. Upload non-image files (data corruption assumptions)
3. Upload SVG with embedded JavaScript (XSS)
4. Upload executable content

## Proposed Solutions

### Solution 1: Validate Storage Metadata in Mutations (Recommended)
**Description:** Check Convex storage metadata when `logoStorageId` is provided to mutations.

```typescript
// In createTeam/updateTeam
if (args.logoStorageId) {
  const metadata = await ctx.db.system.get(args.logoStorageId);
  if (!metadata) throw new ConvexError("Invalid storage ID");
  if (metadata.size > MAX_FILE_SIZE_BYTES) throw new ConvexError("File too large");
  if (!ALLOWED_CONTENT_TYPES.includes(metadata.contentType)) {
    throw new ConvexError("Invalid file type");
  }
}
```

**Pros:** Simple, validates at point of use, no new actions needed
**Cons:** Validation duplicated in create/update, file already uploaded
**Effort:** Small (1-2 hours)
**Risk:** Low

### Solution 2: Upload Action Wrapper
**Description:** Create an action that wraps upload + validation, returning validated storage ID.

**Pros:** Single point of validation, can add image processing
**Cons:** More complex, changes client workflow
**Effort:** Medium (3-4 hours)
**Risk:** Medium

### Solution 3: Add Constants to Backend
**Description:** Share validation constants between frontend and backend, add validation to mutations.

**Pros:** Single source of truth for limits
**Cons:** Still need to implement validation logic
**Effort:** Small (1 hour)
**Risk:** Low

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `convex/teams.ts` - Add validation in `createTeam` and `updateTeam`
- `convex/lib/imageConstants.ts` - New file for shared constants

**Constants to Validate:**
- `MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024` (2MB)
- `ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"]`

## Acceptance Criteria

- [ ] Server rejects storage IDs for files > 2MB
- [ ] Server rejects storage IDs for non-image MIME types
- [ ] Error messages are user-friendly
- [ ] Existing teams with valid logos continue to work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Multiple agents flagged this as critical security gap |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
- Client validation: `src/lib/image-validation.ts`
- Convex storage docs: https://docs.convex.dev/file-storage
