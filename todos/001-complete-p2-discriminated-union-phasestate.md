---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# PhaseState Should Be a Discriminated Union

## Problem Statement

The `PhaseState` type in `vote.$token.tsx` uses a flat object shape that allows impossible state combinations. For example, `winnerMapId` could theoretically be set during the `VOTING` phase. A discriminated union would make invalid states unrepresentable at the type level.

## Findings

- **Source**: kieran-typescript-reviewer, pattern-recognition-specialist
- **Location**: `src/routes/vote.$token.tsx` — `PhaseState` type and `phaseReducer`
- **Current shape**:
  ```typescript
  type PhaseState = {
    phase: "VOTING" | "REVEALING" | "WINNER_REVEAL" | "REDIRECTING";
    revealRound: number | null;
    eliminatedMapIds: string[];
    winnerMapId: string | null;
    outcome: "WINNER" | "RANDOM_WINNER" | null;
  };
  ```
- **Risk**: Low — the reducer already correctly manages transitions, so this is a type-level improvement only

## Proposed Solutions

### Option A: Full Discriminated Union (Recommended)
```typescript
type PhaseState =
  | { phase: "VOTING" }
  | { phase: "REVEALING"; revealRound: number; eliminatedMapIds: string[] }
  | { phase: "WINNER_REVEAL"; winnerMapId: string; outcome: "WINNER" | "RANDOM_WINNER" }
  | { phase: "REDIRECTING"; winnerMapId: string; outcome: "WINNER" | "RANDOM_WINNER" };
```
- **Pros**: Invalid states are unrepresentable, better IDE autocomplete, self-documenting
- **Cons**: Requires narrowing `phaseState.phase` before accessing variant-specific fields
- **Effort**: Medium
- **Risk**: Low

### Option B: Keep Current Shape
- **Pros**: No changes needed, works correctly today
- **Cons**: Allows impossible states at the type level
- **Effort**: None
- **Risk**: None

## Recommended Action

Implement Option A: Full discriminated union

## Technical Details

- **Affected files**: `src/routes/vote.$token.tsx`
- **Components**: `phaseReducer`, all consumers of `phaseState`

## Acceptance Criteria

- [ ] PhaseState is a discriminated union
- [ ] All consumers use proper narrowing
- [ ] TypeScript compiles with no errors
- [ ] Reveal and winner flows still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | Identified by TypeScript and pattern recognition reviewers |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |

## Resources

- PR #75: Multiplayer round results reveal
