---
status: complete
priority: p3
issue_id: "030"
tags: [frontend, ux, code-review]
dependencies: []
---

# Optimistic golden ring display after vote submission

## Problem Statement

After a player confirms their vote in MULTIPLAYER mode, there is a brief gap (~50-300ms) between the dialog closing and the golden ring appearing. The golden ring only renders after the Convex reactive query re-runs and returns `playerVotedMapId`. During this gap, the voted map looks identical to all other available maps.

## Findings

- Location: `src/routes/vote.$token.tsx:241-276` (submitAction), lines 366-368 (isMyVote derivation)
- Current flow: fetch success -> `setPendingAction(null)` -> dialog closes -> reactive query eventually updates -> golden ring appears
- The gap is the time between HTTP response and Convex subscription update
- Typical latency: 50-300ms depending on network conditions
- The gap is brief and may be barely perceptible in practice

## Proposed Solutions

### Option 1: Add optimistic local state
- Store `optimisticVotedMapId` in `useState` on successful submission
- Merge with server state: `isMyVote = (map._id === data.playerVotedMapId || map._id === optimisticVotedMapId) && map.state === "AVAILABLE"`
- Clear optimistic state when server state arrives
- Also clear on `currentRound` change
- **Pros**: Instant visual feedback, no perceptible lag
- **Cons**: Adds complexity (local state + 2 cleanup effects), must handle round transitions
- **Effort**: Medium
- **Risk**: Low

### Option 2: Accept the gap
- The 50-300ms lag may be imperceptible to most users
- The dialog closing already provides confirmation feedback
- Server-derived state is simpler and more reliable
- **Pros**: Zero additional complexity
- **Cons**: Brief visual gap after dialog closes
- **Effort**: None
- **Risk**: None

## Recommended Action

Defer — test manually first. If the gap is noticeable in real usage, implement Option 1.

## Technical Details

- **Affected Files**: `src/routes/vote.$token.tsx`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Golden ring appears immediately after vote confirmation (if implementing)
- [ ] Optimistic state clears when server state arrives
- [ ] Optimistic state clears on round transition
- [ ] `bun run typecheck && bun run lint` passes

## Work Log

### 2026-02-10 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (WAR-37 review findings)
- Frontend races reviewer identified optimistic update gap
- Severity assessed as P3 — the gap is likely barely perceptible
- Status: ready

### 2026-02-10 - Resolved
**By:** Claude (resolve_todo_parallel)
**Actions:**
- Added `optimisticVotedMapId` useState for instant golden ring display
- Set on successful vote submission, merged with server state in `isMyVote`
- Clear effect when server state (`playerVotedMapId`) arrives
- Clear effect on round transition (`currentRound` change)
- All 588 tests pass, typecheck and lint clean
- Status: complete

## Notes
Source: WAR-37 code review — Frontend races reviewer (Julik)
