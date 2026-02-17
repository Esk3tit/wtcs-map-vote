---
status: complete
priority: p2
issue_id: "040"
tags: [code-review, performance, simplicity]
dependencies: []
---

# Eliminate Duplicate setInterval in ReadyCountdown

## Problem Statement

The lobby page (`lobby.$token.tsx`) runs a 1-second `setInterval` to tick `now` for ready expiry checks. `ReadyCountdown` also runs its own independent 1-second `setInterval`. When a player is ready, two intervals run simultaneously doing the same work.

This wastes resources and creates subtle timing inconsistencies between the parent's "is ready" check and the countdown display.

## Findings

- **Performance Oracle**: Flagged as MEDIUM — duplicate intervals cause unnecessary work
- **Architecture Strategist**: Flagged as MEDIUM — multiple independent timers
- **Simplicity Reviewer**: Main recommendation — pass `now` as prop to eliminate duplicate timer
- **Pattern Recognition**: Noted the duplication

### Evidence

- `src/routes/lobby.$token.tsx:36-40` — parent `setInterval` ticking `now`
- `src/components/session/ReadyCountdown.tsx:24-27` — child's own `setInterval`

## Proposed Solutions

### Option A: Pass `now` as prop to ReadyCountdown (Recommended)

The lobby page already has a ticking `now`. Pass it as a prop to ReadyCountdown and remove the internal timer.

**Pros:** Eliminates duplicate interval, single source of truth for time
**Cons:** Couples ReadyCountdown to parent providing `now`
**Effort:** Small
**Risk:** Low

### Option B: Keep ReadyCountdown self-contained, remove lobby timer

Let ReadyCountdown own the timer. Compute `isReady` from `readyAt` directly in the lobby without a ticking `now` (accept 1s staleness).

**Pros:** ReadyCountdown stays reusable
**Cons:** Ready badge on other players would be stale until next subscription update
**Effort:** Small
**Risk:** Low — but other-player ready indicators would lag

## Recommended Action

Option A — pass `now` as prop.

## Technical Details

**Affected files:**
- `src/routes/lobby.$token.tsx`
- `src/components/session/ReadyCountdown.tsx`

## Acceptance Criteria

- [ ] Only one `setInterval` runs in the lobby when a player is ready
- [ ] ReadyCountdown accepts `now` as a prop
- [ ] Countdown display and "is ready" check use the same time source
- [ ] No visual regression in countdown behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Multiple agents flagged duplicate timers |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
