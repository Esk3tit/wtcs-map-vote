---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, patterns, dry]
dependencies: []
---

# Extract Eliminated Map Filter Helper

## Problem Statement

The logic to filter and identify eliminated maps from the current round is duplicated in the reducer (when computing `eliminatedMapIds`) and in the render logic (when applying visual styles). If the elimination criteria change, both locations must be updated.

## Findings

- **Source**: pattern-recognition-specialist
- **Location**: `src/routes/vote.$token.tsx` — reducer `ROUND_CHANGED` case and map rendering section

## Proposed Solutions

### Option A: Extract Helper Function (Recommended)
```typescript
function getEliminatedMapIds(maps: SessionMap[], currentRound: number): string[] {
  return maps
    .filter((m) => m.state === "ELIMINATED" && m.eliminatedAtRound === currentRound - 1)
    .map((m) => m._id);
}
```

- **Pros**: Single source of truth, testable, clear semantics
- **Cons**: Minor — adds a small function
- **Effort**: Small
- **Risk**: None

## Recommended Action

Implement Option A: Extract helper function

## Technical Details

- **Affected files**: `src/routes/vote.$token.tsx`

## Acceptance Criteria

- [ ] Single helper function for eliminated map identification
- [ ] Used in both reducer and render logic
- [ ] No behavior change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | Pattern recognition reviewer found duplication |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |

## Resources

- PR #75: Multiplayer round results reveal
