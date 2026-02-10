---
status: complete
priority: p2
issue_id: "031"
tags: [security, voting, race-condition]
dependencies: []
---

# Post-completion race in MULTIPLAYER submitVote

## Problem Statement

In MULTIPLAYER format, `submitVote` does not re-check session status after `resolveRound` completes. While Convex mutations are serialized (single-writer) so this can't be exploited today, a defensive guard is cheap and protects against future execution model changes.

## Findings

- `convex/voting.ts:674-683` — after `resolveRound(ctx, session)` returns, the mutation immediately returns the result
- `resolveRound` may mark the session as `COMPLETE` or `EXPIRED` internally
- No post-resolve state is mutated in `submitVote`, so there's no data corruption risk today
- The concern is purely defensive: if Convex ever allows concurrent mutations, this would be the gap

## Proposed Solutions

### Option 1: No-op (current state is safe)
- **Pros**: No code change, Convex guarantees serialization
- **Cons**: Fragile if execution model changes
- **Effort**: None
- **Risk**: Low

### Option 2: Add post-resolve guard (recommended)
- **Pros**: 2-line defensive fix, no perf impact
- **Cons**: Slightly redundant today
- **Effort**: Small (< 30 min)
- **Risk**: None

## Recommended Action

Add a comment documenting why no post-resolve check is needed (Convex serialized mutations), OR add a trivial guard. Either way, this is awareness-level.

## Technical Details

- **Affected Files**: `convex/voting.ts`
- **Related Components**: `submitVote`, `resolveRound`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Post-resolve behavior is either guarded or documented
- [ ] Tests pass
- [ ] Code reviewed

## Work Log

### 2026-02-10 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Verified against source: `submitVote` does not mutate state after `resolveRound`
- Confirmed Convex serialized execution makes this theoretical-only today

## Notes

Source: WAR-20 code review (PR #58), flagged by security-sentinel agent
