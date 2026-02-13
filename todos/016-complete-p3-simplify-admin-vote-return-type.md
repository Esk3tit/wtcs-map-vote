---
status: complete
priority: p3
issue_id: "016"
tags: [code-review, simplicity, api-design]
dependencies: []
---

# Simplify adminVoteOnBehalf return type

## Problem Statement

The `adminVoteOnBehalf` return type includes two fields that provide no value:
1. `success: boolean` — always `true` because errors throw `ConvexError`. The caller never sees `success: false`.
2. `format: "ABBA" | "MULTIPLAYER"` — echoes back the session format the admin already knows (visible in the session query).

By contrast, `forceRandomSelection` returns a clean `{ success: boolean, winnerMapName: string }` — though it also has the `success` issue.

## Findings

- **Location:** `convex/voting.ts:703-709` (return type validator)
- **Agents:** code-simplicity-reviewer
- **Context:** Dead data in API responses adds noise. The useful fields are `mapName`, `isComplete`, and `winnerMapName`.

## Proposed Solutions

### Option 1: Remove success and format fields (Recommended)
```typescript
returns: v.object({
  mapName: v.string(),
  isComplete: v.boolean(),
  winnerMapName: v.optional(v.string()),
})
```
- **Pros:** Cleaner API, no dead data
- **Cons:** Minor breaking change if frontend already consumes these (unlikely — no UI yet)
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Remove `success` and `format` fields from the return type. No frontend consumer exists yet.

## Acceptance Criteria

- [ ] Return type simplified
- [ ] Tests updated to match new return shape
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #63 code review | success is always true in ConvexError-throwing mutations |
| 2026-02-13 | Approved during triage | Status: pending → ready. |

## Resources

- PR #63: https://github.com/Esk3tit/wtcs-map-vote/pull/63
