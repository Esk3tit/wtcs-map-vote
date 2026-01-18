---
status: complete
priority: p3
issue_id: "020"
tags: [code-review, testing, naming]
dependencies: []
---

# Standardize Error Test Naming Convention

## Problem Statement

Error tests use inconsistent naming: some use "throws for..." while others use "rejects...". Consistent naming improves scanability and maintainability.

## Findings

**Source:** Pattern Recognition Specialist

**Location:** `convex/teams.test.ts`

**Evidence:**
```typescript
// Inconsistent naming
it("throws for empty name", ...)          // Line 129
it("rejects invalid logoStorageId format", ...)  // Line 168
```

## Proposed Solutions

### Option A: Standardize on "throws for..." (Recommended)

Change all error tests to use "throws for..." pattern:

```typescript
it("throws for empty name", ...)
it("throws for invalid logoStorageId format", ...)
it("throws for duplicate team name", ...)
```

**Pros:** Consistent, matches Vitest conventions
**Cons:** Minor rename effort
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Option A - Standardize on "throws for..." pattern

## Technical Details

**Affected Files:**
- `convex/teams.test.ts`

**Tests to Rename:**
- Line 168: "rejects invalid logoStorageId format" → "throws for invalid logoStorageId format"
- Line 571: "rejects invalid logoStorageId format" → "throws for invalid logoStorageId format"

## Acceptance Criteria

- [ ] All error tests use "throws for..." naming pattern
- [ ] Test names are consistent throughout the file

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Naming consistency |
| 2026-01-18 | Approved in triage | Ready to implement |

## Resources

- PR #27: https://github.com/Esk3tit/wtcs-map-vote/pull/27
