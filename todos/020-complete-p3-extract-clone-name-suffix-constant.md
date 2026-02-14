---
status: complete
priority: p3
issue_id: "020"
tags: [code-review, quality, constants]
dependencies: []
---

# Extract Clone Name Suffix to Constant

## Problem Statement
The `" (Copy)"` suffix in `cloneSession` (line ~1379) is a magic string. Should be extracted to a named constant for maintainability.

## Findings
- Location: `convex/sessions.ts:1379`
- Magic string: `" (Copy)"`
- Used in name truncation logic alongside `MAX_NAME_LENGTH`

## Proposed Solutions

### Option 1: Add to `convex/lib/constants.ts`
```typescript
export const CLONE_NAME_SUFFIX = " (Copy)";
```

- **Pros**: Consistent with other constants, easy to find and change
- **Cons**: Minor change
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Add constant and update `cloneSession` to reference it.

## Technical Details
- **Affected Files**: `convex/lib/constants.ts`, `convex/sessions.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `CLONE_NAME_SUFFIX` constant added to `convex/lib/constants.ts`
- [ ] `cloneSession` updated to use constant
- [ ] Tests pass

## Work Log

### 2026-02-14 - Approved for Work
**By:** Claude Triage System

## Resources
- Source: Code review of PR #65 (WAR-46)
