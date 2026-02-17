---
status: complete
priority: p3
issue_id: "044"
tags: [code-review, performance]
dependencies: []
---

# Guard PlayerReadyBadge Timer for Expired/Missing readyAt

## Problem Statement

The `PlayerReadyBadge` component in the admin session page runs its own `setInterval` unconditionally for every player. If `readyAt` is undefined or already expired, the timer still ticks, wasting resources — especially with many players.

## Findings

- **Performance Oracle**: Flagged as MEDIUM — timers run unconditionally per player
- **TypeScript Reviewer**: Flagged as MEDIUM — unconditional timer

### Evidence

- `src/routes/admin/session.$sessionId.tsx` — PlayerReadyBadge renders per player with self-contained timer

## Proposed Solutions

### Option A: Skip interval when readyAt is missing or expired (Recommended)

Only start the `setInterval` when `readyAt` is defined and not yet expired. Clear it when expiry is reached.

**Pros:** No wasted intervals for non-ready or expired players
**Cons:** Slightly more complex effect
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected files:**
- `src/routes/admin/session.$sessionId.tsx` — PlayerReadyBadge component

## Acceptance Criteria

- [ ] Timer does not run when `readyAt` is undefined
- [ ] Timer stops when ready period expires
- [ ] Badge still updates correctly when player becomes ready

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Performance + TS reviewer flagged |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
