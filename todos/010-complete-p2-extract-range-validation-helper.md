---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, dry, validation, sessions, pr-20]
dependencies: []
---

# DRY Violation: Repetitive Range Validation Pattern

## Problem Statement

The same min/max validation pattern is repeated 4 times in `sessions.ts` with nearly identical code for playerCount, turnTimerSeconds (twice), and mapPoolSize. This violates DRY and makes the code harder to maintain.

## Findings

### Pattern Recognition Specialist Analysis

**Locations in `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts`:**

1. Player Count (lines 238-247)
2. Turn Timer in createSession (lines 251-260)
3. Turn Timer in updateSession (lines 357-366)
4. Map Pool Size (lines 264-273)

Each instance follows this pattern:
```typescript
if (value < MIN_X) {
  throw new ConvexError(`Field must be at least ${MIN_X}`);
}
if (value > MAX_X) {
  throw new ConvexError(`Field cannot exceed ${MAX_X}`);
}
```

## Proposed Solutions

### Option A: Create Generic validateRange Helper (Recommended)

Add to `convex/lib/validation.ts`:
```typescript
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string,
  unit?: string
): void {
  const suffix = unit ? ` ${unit}` : "";
  if (value < min) {
    throw new ConvexError(`${fieldName} must be at least ${min}${suffix}`);
  }
  if (value > max) {
    throw new ConvexError(`${fieldName} cannot exceed ${max}${suffix}`);
  }
}
```

Usage:
```typescript
validateRange(args.playerCount, MIN_PLAYER_COUNT, MAX_PLAYER_COUNT, "Player count");
validateRange(turnTimerSeconds, MIN_TURN_TIMER_SECONDS, MAX_TURN_TIMER_SECONDS, "Turn timer", "seconds");
```

**Pros:** Eliminates duplication, consistent error messages, reusable
**Cons:** Additional function, slight indirection
**Effort:** Small
**Risk:** Low

### Option B: Use Convex Validator Constraints
Convex validators support `v.number().gte(min).lte(max)` but error messages are less descriptive.

**Pros:** Built-in, no custom code
**Cons:** Less control over error messages
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/lib/validation.ts` - add new helper
- `convex/sessions.ts` - use helper in createSession, updateSession

**Estimated LOC Reduction:** ~16 lines

## Acceptance Criteria

- [ ] Range validation uses shared helper function
- [ ] Error messages remain clear and descriptive
- [ ] All 4 validation locations use the helper

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Pattern recognition identified 4x duplication |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
