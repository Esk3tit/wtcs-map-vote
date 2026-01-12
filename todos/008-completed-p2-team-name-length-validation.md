---
status: completed
priority: p2
issue_id: "008"
tags: [code-review, validation, convex]
dependencies: []
---

# Team Name Length Validation

## Problem Statement

While the code validates that team names are not empty after trimming, there is no maximum length validation. The Convex string validator accepts strings up to 1MB when UTF-8 encoded.

**Why it matters:** Without length limits, attackers could submit extremely long names causing memory exhaustion, database bloat, and UI rendering issues.

## Findings

**Source:** Security Sentinel review of PR #14

**Location:** `convex/teams.ts` lines 38-41 (createTeam), 86-90 (updateTeam)

```typescript
const trimmedName = args.name.trim();
if (trimmedName.length === 0) {
  throw new ConvexError("Team name cannot be empty");
}
// No maximum length check
```

## Proposed Solutions

### Option A: Add inline length check (Recommended)
**Pros:** Simple, minimal change
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
const MAX_NAME_LENGTH = 100;
const trimmedName = args.name.trim();
if (trimmedName.length === 0) {
  throw new ConvexError("Team name cannot be empty");
}
if (trimmedName.length > MAX_NAME_LENGTH) {
  throw new ConvexError(`Team name cannot exceed ${MAX_NAME_LENGTH} characters`);
}
```

### Option B: Use Convex validator with length constraint
**Pros:** Validates at schema level
**Cons:** Convex doesn't have built-in length validators
**Effort:** N/A
**Risk:** N/A

Not available in Convex validators.

## Recommended Action

Option A - Add maximum length check (suggest 100 characters).

## Technical Details

**Affected files:**
- `convex/teams.ts` (createTeam, updateTeam)

## Acceptance Criteria

- [x] Team names exceeding 100 characters are rejected
- [x] Error message clearly indicates the limit
- [x] Existing valid team names still work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-12 | Identified in PR #14 code review | Input validation gap |
| 2026-01-12 | Fixed in commit bd980d2 | Added MAX_NAME_LENGTH constant and validation in createTeam/updateTeam |

## Resources

- [PR #14](https://github.com/Esk3tit/wtcs-map-vote/pull/14)
