---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, refactoring, dry, pr-16]
dependencies: []
---

# P2: Name Validation Logic Duplicated Between maps.ts and teams.ts

## Problem Statement

The name validation logic is duplicated between `maps.ts` and `teams.ts`. Both files have nearly identical code for validating and trimming entity names. This violates DRY (Don't Repeat Yourself) and could lead to inconsistencies if one is updated without the other.

## Findings

**Source:** Pattern Recognition Specialist review of PR #16

**Location:**
- `convex/maps.ts` lines 10-21 (validateAndTrimName function)
- `convex/teams.ts` lines 52-60 (inline in createTeam)
- `convex/teams.ts` lines 130-138 (inline in updateTeam)

**Duplicated Code in maps.ts:**
```typescript
function validateAndTrimName(name: string): string {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new ConvexError("Map name cannot be empty");
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new ConvexError(`Map name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }
  return trimmedName;
}
```

**Duplicated Code in teams.ts (inline):**
```typescript
const trimmedName = args.name.trim();
if (trimmedName.length === 0) {
  throw new ConvexError("Team name cannot be empty");
}
if (trimmedName.length > MAX_NAME_LENGTH) {
  throw new ConvexError(`Team name cannot exceed ${MAX_NAME_LENGTH} characters`);
}
```

## Proposed Solutions

### Solution A: Extract to convex/lib/validation.ts (Recommended)

**Description:** Create a shared validation utility alongside urlValidation.ts

**Implementation:**
```typescript
// convex/lib/validation.ts
import { ConvexError } from "convex/values";
import { MAX_NAME_LENGTH } from "./constants";

export function validateName(name: string, entityType: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError(`${entityType} name cannot be empty`);
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new ConvexError(`${entityType} name cannot exceed ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}
```

**Usage:**
```typescript
// In maps.ts
const trimmedName = validateName(args.name, "Map");

// In teams.ts
const trimmedName = validateName(args.name, "Team");
```

**Pros:**
- Eliminates duplication
- Consistent error messages
- Single point of change
- Follows existing pattern (urlValidation.ts)

**Cons:**
- Another file in convex/lib/

**Effort:** Small (30 minutes)
**Risk:** Low

### Solution B: Add to existing urlValidation.ts (rename to validation.ts)

**Description:** Rename urlValidation.ts to validation.ts and add name validation

**Pros:**
- Fewer files
- All validation in one place

**Cons:**
- Module becomes less focused
- Larger scope change

**Effort:** Medium (45 minutes)
**Risk:** Low

## Recommended Action

**Implement Solution A** - Separate file maintains single responsibility.

## Acceptance Criteria

- [ ] Create `convex/lib/validation.ts` with `validateName()` function
- [ ] Update `maps.ts` to use shared function
- [ ] Update `teams.ts` to use shared function (remove inline validation)
- [ ] Error messages remain consistent
- [ ] `npx convex typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from PR #16 code review | Pattern Recognition identified duplication |

## Resources

- PR #16: https://github.com/Esk3tit/wtcs-map-vote/pull/16
