---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, quality, consistency]
dependencies: []
---

# Fix console.warn vs console.error inconsistency for data integrity errors

## Problem Statement

Data integrity errors in `convex/voting.ts` use inconsistent logging levels. The `resolveRound` empty revote pool guard uses `console.warn` (line 321), while similar guards in `submitBan` use `console.error` (lines 450, 511). All three represent the same class of "impossible state" errors that throw immediately after logging.

## Findings

- `convex/voting.ts:321` — `console.warn("Data integrity error: double deadlock...")` (changed from `console.error` per PR review comment)
- `convex/voting.ts:450` — `console.error("Data integrity error: player not found...")`
- `convex/voting.ts:511` — `console.error("Data integrity error: expected 1 available map...")`
- The PR review comment that suggested `console.warn` was reasonable but creates inconsistency with existing code
- Source: Pattern Recognition reviewer

## Proposed Fix

Choose one convention for all data integrity `throw` guards and apply consistently. Recommend `console.error` since these represent truly unexpected state violations, and the existing codebase already uses `console.error` for this class of error in 2 out of 3 cases.

## Files to Modify

- `convex/voting.ts:321` — Change `console.warn` back to `console.error`
