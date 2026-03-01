---
status: complete
priority: p2
issue_id: "069"
tags: [code-review, performance, rate-limiting]
dependencies: []
---

# Increase playerHeartbeat rate limit capacity

## Problem Statement

The `playerHeartbeat` rate limit has capacity 3 with rate 12/min. When a heartbeat fails and the client enters retry mode (exponential backoff: 2s, 4s, 8s, 16s), multiple rapid heartbeat attempts can exhaust the burst capacity and cause spurious `RATE_LIMITED` errors — triggering further retries in a feedback loop.

The comment says "matches ~5s interval config" but the actual heartbeat interval is 30s (`HEARTBEAT_INTERVAL_MS`), making the comment stale and the rate/capacity mismatch confusing.

## Findings

- **Location**: `convex/lib/rateLimits.ts:17-22`
- **Evidence**: capacity 3 with 12/min rate means only 3 rapid requests before throttling. Retry sequence sends up to 4 attempts in quick succession.
- **Flagged by**: security-sentinel, performance-oracle, pattern-recognition-specialist

## Proposed Solutions

### Option A: Increase capacity to 6 (Recommended)
- Change `capacity: 3` to `capacity: 6` and fix stale comment
- **Pros**: Simple, accommodates full retry sequence, no other changes needed
- **Cons**: Slightly more permissive
- **Effort**: Small
- **Risk**: Low

### Option B: Increase capacity to 8 with rate adjustment
- Set `rate: 6, capacity: 8` to match actual 30s interval
- **Pros**: Rate accurately reflects real usage pattern
- **Cons**: Over-correction for a simple fix
- **Effort**: Small
- **Risk**: Low

## Technical Details

**Affected files:**
- `convex/lib/rateLimits.ts` — playerHeartbeat definition

## Acceptance Criteria

- [ ] playerHeartbeat capacity increased to accommodate retry bursts
- [ ] Stale comment updated to reflect 30s interval
- [ ] No spurious RATE_LIMITED during normal retry sequences

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-01 | Created | From PR #93 code review |
| 2026-03-01 | Approved | Triage: approved all findings — status pending → ready |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/93
- `src/hooks/usePlayerAuth.ts` — retry sequence timing
