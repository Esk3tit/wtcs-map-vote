---
status: complete
priority: p3
issue_id: "006"
tags: [code-review, simplicity]
dependencies: []
---

# Remove Unnecessary timerCallback Wrapper

## Problem Statement

`useRevealTimer` wraps `onCompleteRef.current()` in a `useCallback` named `timerCallback` with an empty dependency array. Since it just calls through to the ref, the wrapper adds no value — `onCompleteRef.current()` can be called directly.

## Findings

- **Source**: code-simplicity-reviewer
- **Location**: `src/hooks/useRevealTimer.ts:54-56`

## Proposed Solutions

### Option A: Inline the Ref Call (Recommended)
Replace `timerCallback()` with `onCompleteRef.current()` at the two call sites.

- **Effort**: Small (~4 LOC)
- **Risk**: None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review of PR #75 | |
| 2026-02-21 | Approved during triage — status: pending → ready | Batch-approved all findings |
