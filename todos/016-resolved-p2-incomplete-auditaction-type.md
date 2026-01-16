---
status: resolved
priority: p2
issue_id: "016"
tags: [code-review, types, audit, pr-21]
dependencies: []
---

# Incomplete AuditAction Type Missing Used Actions

## Problem Statement

The `AuditAction` type in `convex/lib/types.ts` and the corresponding `auditActionValidator` in `convex/lib/validators.ts` are missing action types that are already used in the codebase. This creates a type safety gap where existing code uses action strings that aren't in the official type.

**Why it matters:**
- Type safety is compromised - existing code bypasses TypeScript checking
- If existing mutations are refactored to use `logAction()`, they will fail validation
- Inconsistency between what's allowed and what's used

## Findings

**Source:** architecture-strategist agent, data-integrity-guardian agent, pattern-recognition-specialist agent, PR #21 review

**Missing Actions (used in sessions.ts and sessionCleanup.ts):**

| Action | Used In | Line |
|--------|---------|------|
| `SESSION_DELETED` | sessions.ts | 395 |
| `PLAYER_ASSIGNED` | sessions.ts | 500 |
| `MAPS_ASSIGNED` | sessions.ts | 603 |
| `SESSION_EXPIRED` | sessionCleanup.ts | 109 |

**Current AuditAction type has 15 actions:**
```typescript
// convex/lib/types.ts lines 29-48
export type AuditAction =
  | "SESSION_CREATED" | "SESSION_UPDATED" | "SESSION_FINALIZED"
  | "SESSION_STARTED" | "SESSION_PAUSED" | "SESSION_RESUMED" | "SESSION_ENDED"
  | "PLAYER_CONNECTED" | "PLAYER_DISCONNECTED"
  | "MAP_BANNED" | "VOTE_SUBMITTED"
  | "ROUND_RESOLVED" | "TIMER_EXPIRED" | "RANDOM_SELECTION" | "WINNER_DECLARED";
```

## Proposed Solutions

### Solution 1: Add Missing Actions (Recommended)

**Pros:** Complete type coverage, enables safe refactoring
**Cons:** None
**Effort:** Small
**Risk:** Low

Add to `convex/lib/types.ts`:
```typescript
export type AuditAction =
  // ... existing actions
  // Session lifecycle (additions)
  | "SESSION_DELETED"
  | "SESSION_EXPIRED"
  // Player events (additions)
  | "PLAYER_ASSIGNED"
  // Map events (additions)
  | "MAPS_ASSIGNED";
```

Add to `convex/lib/validators.ts`:
```typescript
export const auditActionValidator = v.union(
  // ... existing literals
  v.literal("SESSION_DELETED"),
  v.literal("SESSION_EXPIRED"),
  v.literal("PLAYER_ASSIGNED"),
  v.literal("MAPS_ASSIGNED"),
);
```

## Recommended Action

**RESOLVED**: Added SESSION_DELETED, SESSION_EXPIRED, PLAYER_ASSIGNED, and MAPS_ASSIGNED to both `AuditAction` type in lib/types.ts and `auditActionValidator` in lib/validators.ts.

## Technical Details

**Affected Files:**
- `convex/lib/types.ts` (lines 29-48)
- `convex/lib/validators.ts` (lines 42-62)

## Acceptance Criteria

- [ ] AuditAction type includes all actions used in codebase
- [ ] auditActionValidator matches AuditAction type exactly
- [ ] TypeScript build passes
- [ ] Existing code remains compatible

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-16 | Created from PR #21 review | Type/validator must stay in sync with usage |
| 2026-01-16 | Resolved: Added 4 missing action types | Synced type and validator with actual codebase usage |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/21
- convex/sessions.ts (lines 395, 500, 603)
- convex/sessionCleanup.ts (line 109)
