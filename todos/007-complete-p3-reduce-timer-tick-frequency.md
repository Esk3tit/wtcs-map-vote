---
status: complete
priority: p3
issue_id: "007"
tags: [code-review, performance]
dependencies: []
---

# Reduce Timer Tick Frequency (100ms to 250ms)

## Problem Statement

`useRevealTimer` ticks every 100ms to update the visual countdown, but the display only shows whole seconds. Ticking at 250ms would reduce repaints by 60% with no visible difference to users.

## Findings

- **Source**: performance-oracle, kieran-typescript-reviewer
- **Location**: `src/hooks/useRevealTimer.ts:78` — `setInterval(..., 100)`

## Proposed Solutions

### Option A: Increase to 250ms (Recommended)
Change `setInterval(..., 100)` to `setInterval(..., 250)`.

- **Effort**: Small (1 LOC)
- **Risk**: None — countdown shows whole seconds

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |
