---
status: complete
priority: p3
issue_id: "008"
tags: [code-review, testing]
dependencies: ["002"]
---

# Add Unit Tests for phaseReducer

## Problem Statement

The `phaseReducer` state machine handles critical UI transitions (VOTING → REVEALING → VOTING, WINNER_REVEAL → REDIRECTING) but has no dedicated unit tests. If extracted (see todo 001/002), it becomes independently testable.

## Findings

- **Source**: architecture-strategist
- **Location**: `src/routes/vote.$token.tsx` — `phaseReducer` function

## Proposed Solutions

### Option A: Test After Extraction (Recommended)
Once the reducer is extracted (todo 002), write unit tests covering:
- Each action type produces correct state
- Invalid transitions are handled
- Edge cases (same round, missing data)

- **Effort**: Medium
- **Risk**: None
- **Depends on**: Todo 002 (decompose vote page)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |
