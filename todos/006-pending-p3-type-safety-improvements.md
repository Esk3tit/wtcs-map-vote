---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, typescript, convex, type-safety]
dependencies: []
---

# Type Safety Improvements for Schema Fields

## Problem Statement

Several fields use `v.string()` where union types could provide compile-time type safety: `role` (sessionPlayers) and `action` (auditLogs).

**Why it matters:** Using strings allows any value; typos and invalid values won't be caught until runtime.

## Findings

**Source:** Pattern Recognition Specialist, TypeScript Reviewer

### Finding 1: `role` field
**Location:** `convex/schema.ts:72`
```typescript
role: v.string(), // "PLAYER_A", "PLAYER_B", "PLAYER_1", "PLAYER_2", etc.
```

Per spec Section 3.2, roles are fixed: PLAYER_A, PLAYER_B (ABBA) and PLAYER_1-4 (Multiplayer).

### Finding 2: `action` field
**Location:** `convex/schema.ts:118`
```typescript
action: v.string(), // "BAN", "VOTE", etc.
```

Per spec Appendix C, there are 21 defined action types.

## Proposed Solutions

### Option A: Use union types (Strict)
**Pros:** Full compile-time safety
**Cons:** Schema migration needed to add new values
**Effort:** Small
**Risk:** Low

### Option B: Keep strings, add TypeScript types separately (Flexible)
**Pros:** Schema flexibility, still get TypeScript safety in code
**Cons:** No database-level validation
**Effort:** Small
**Risk:** Low

```typescript
// types.ts
export type PlayerRole = "PLAYER_A" | "PLAYER_B" | "PLAYER_1" | "PLAYER_2" | "PLAYER_3" | "PLAYER_4";
export type AuditAction = "SESSION_CREATED" | "MAP_BANNED" | /* etc */;
```

## Recommended Action

Option B - Keep schema flexible, add TypeScript types for use in functions.

## Acceptance Criteria

- [ ] TypeScript types defined for role and action values
- [ ] Functions use typed constants, not raw strings

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | Balance between flexibility and safety |

## Resources

- [PR #11](https://github.com/Esk3tit/wtcs-map-vote/pull/11)
- docs/SPECIFICATION.md Appendix C (Audit Log Action Types)
