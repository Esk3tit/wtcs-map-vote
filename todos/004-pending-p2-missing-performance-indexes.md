---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, performance, convex, indexes]
dependencies: []
---

# Missing Performance Indexes

## Problem Statement

Several common query patterns identified in the specification lack supporting indexes, which will cause full table scans as data grows.

**Why it matters:** Without proper indexes, scheduled jobs (token cleanup, heartbeat monitoring) and common queries (audit history, duplicate vote checks) will degrade in performance.

## Findings

**Source:** Performance Oracle, Architecture Strategist reviews

### Missing Index 1: `auditLogs.by_sessionId_and_timestamp` (Composite Index Optimization)
**Location:** `convex/schema.ts:135-136`
**Current state:** Separate `by_sessionId` and `by_timestamp` indexes exist but not a composite
**Query pattern:** "Get audit logs for session X ordered by time"
**Impact:** Session history view requires fetch + client-side sort; composite index enables efficient filtered + ordered queries

### Missing Index 2: `sessionPlayers.by_tokenExpiresAt`
**Location:** `convex/schema.ts:80-82`
**Query pattern:** "Find expired tokens for cleanup"
**Impact:** Token cleanup cron (Section 8.7) requires full table scan

### Missing Index 3: `votes.by_sessionId_and_playerId`
**Location:** `convex/schema.ts:112-113`
**Query pattern:** "Has player voted in this session?"
**Impact:** Cannot efficiently check vote history per player per session

### Missing Index 4: `sessionPlayers.by_lastHeartbeat`
**Location:** `convex/schema.ts:80-82`
**Query pattern:** "Find stale connections (heartbeat > 15s old)"
**Impact:** Heartbeat monitoring requires full table scan

## Proposed Solutions

### Option A: Add all missing indexes (Recommended)
**Pros:** Complete coverage for documented query patterns
**Cons:** Slightly increased storage/write overhead
**Effort:** Small
**Risk:** Low

```typescript
// sessionPlayers
.index("by_tokenExpiresAt", ["tokenExpiresAt"])
.index("by_lastHeartbeat", ["lastHeartbeat"])

// votes
.index("by_sessionId_and_playerId", ["sessionId", "playerId"])

// auditLogs
.index("by_sessionId_and_timestamp", ["sessionId", "timestamp"])
```

### Option B: Add indexes incrementally as needed
**Pros:** Only add what's proven necessary
**Cons:** Requires schema migrations later
**Effort:** Varies
**Risk:** Low

## Recommended Action

Option A - Add all indexes now since the query patterns are documented in spec.

## Technical Details

**Affected files:**
- `convex/schema.ts`

## Acceptance Criteria

- [ ] All 4 indexes added to schema
- [ ] `bunx convex dev` runs without errors
- [ ] Query patterns documented in comments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-09 | Identified in code review | 4 missing indexes for common patterns |

## Resources

- PR #11: https://github.com/Esk3tit/wtcs-map-vote/pull/11
- SPECIFICATION.md Section 8.7 (Scheduled functions)
- Performance Oracle review findings
