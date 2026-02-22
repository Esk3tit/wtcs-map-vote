---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, simplicity]
dependencies: []
---

# Consolidate isRevealing and isAnyReveal

## Problem Statement

`isRevealing` and `isAnyReveal` compute the same value — whether the phase is `REVEALING` or `WINNER_REVEAL`. Having two variables for the same concept adds unnecessary cognitive load.

## Findings

- **Source**: pattern-recognition-specialist, code-simplicity-reviewer
- **Location**: `src/routes/vote.$token.tsx`

## Proposed Solutions

### Option A: Keep One Variable (Recommended)
Remove one and use a single `isRevealing` that covers both reveal phases.

- **Effort**: Small (~2 LOC)
- **Risk**: None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |
