---
status: complete
priority: p3
issue_id: "053"
tags: [code-review, performance, css, animation]
dependencies: []
---

# Consider removing premature will-change hint

## Problem Statement

`will-change-[filter,opacity]` (line 128 of `VoteMapCard.tsx`) is applied conditionally during active animations. While correctly conditional (not permanent), for 0.5-0.8s transitions on a handful of small card thumbnails, this is premature optimization. Browsers already handle short filter transitions well. On mobile devices with limited GPU memory, unnecessary layer promotion can increase memory usage.

## Findings

- **Source**: Code Simplicity Reviewer (YAGNI), Performance Oracle (correct usage but notes GPU memory), Frontend Races Reviewer (acceptable)
- **Location**: `src/components/session/VoteMapCard.tsx` line 128
- **Evidence**: No profiling data shows jank. The cards are small thumbnails in a grid. The `will-change` hint is new to this codebase (no other usage found).

## Proposed Solutions

### Option A: Remove will-change, add back only if profiling shows need

- **Effort**: Trivial (delete 1 line)
- **Risk**: Very low (might be slightly less smooth on very old devices)

### Option B: Keep as-is

- **Effort**: None
- **Risk**: Low (minor GPU memory overhead on mobile)

## Acceptance Criteria

- [ ] Animations remain smooth without `will-change` hint
- [ ] No visual jank on mobile devices

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |
