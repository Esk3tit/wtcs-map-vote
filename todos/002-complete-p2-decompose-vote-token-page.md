---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, architecture, maintainability]
dependencies: []
---

# Decompose vote.$token.tsx (1022 Lines)

## Problem Statement

`vote.$token.tsx` has grown to 1022 lines, approaching the threshold where a single file becomes difficult to navigate and maintain. The reveal logic, map card rendering, and phase state management could be extracted into focused modules.

## Findings

- **Source**: architecture-strategist, kieran-typescript-reviewer, pattern-recognition-specialist
- **Location**: `src/routes/vote.$token.tsx`
- **Key sections**:
  - Phase state reducer and types (~80 lines)
  - Reveal timer integration (~30 lines)
  - Map card rendering with reveal overlays (~150 lines)
  - Round results header/countdown (~40 lines)
  - Voting interaction handlers (~60 lines)

## Proposed Solutions

### Option A: Extract Reveal Phase Hook (Recommended)
Extract `useRevealPhase` hook that encapsulates:
- `phaseReducer` and `PhaseState` types
- `useRevealTimer` integration
- Round change detection via `usePrevious`
- Returns: `{ phaseState, remainingMs, isInteractive }`

- **Pros**: Biggest single win, testable independently, keeps route file focused on rendering
- **Cons**: Needs careful interface design to avoid prop explosion
- **Effort**: Medium
- **Risk**: Low

### Option B: Extract Map Card Component
Extract `VoteMapCard` component for the ~150 line map card rendering block.

- **Pros**: Self-contained visual component, easy to extract
- **Cons**: Smaller impact than Option A
- **Effort**: Small
- **Risk**: Low

### Option C: Both A and B
- **Pros**: Gets file well under 700 lines
- **Cons**: More work
- **Effort**: Medium-Large
- **Risk**: Low

## Recommended Action

Implement Option C: Extract both reveal hook and map card component

## Technical Details

- **Affected files**: `src/routes/vote.$token.tsx`, new hook/component files
- **Components**: Vote page, map card, reveal phase logic

## Acceptance Criteria

- [ ] vote.$token.tsx is under 800 lines
- [ ] Extracted modules have clear interfaces
- [ ] No behavior changes
- [ ] TypeScript compiles cleanly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | Multiple reviewers flagged file size |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |

## Resources

- PR #75: Multiplayer round results reveal
