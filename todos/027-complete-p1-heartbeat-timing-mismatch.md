---
status: ready
priority: p1
issue_id: "027"
tags: [code-review, security, performance, war-49]
dependencies: []
---

# Heartbeat Timing Mismatch — False Positive Disconnections

## Problem Statement
`HEARTBEAT_TIMEOUT_MS` (30s) in `convex/lib/constants.ts` equals the client-side `HEARTBEAT_INTERVAL_MS` (30s) in `src/hooks/usePlayerAuth.ts:8`. This means any normal network jitter, GC pause, or slow response will cause the server to consider the player disconnected, triggering false-positive auto-pauses.

Additionally, `document.visibilityState === "hidden"` in `usePlayerAuth.ts:93` causes the client to skip heartbeats when the tab is backgrounded. Combined with the zero-margin timeout, a user switching tabs for even a few seconds will be marked as disconnected. This could be exploited by an opponent to grief by forcing pauses.

## Findings
- Source: Security Sentinel, Performance Oracle agents
- Location: `convex/lib/constants.ts:29` (`HEARTBEAT_TIMEOUT_MS = 30_000`)
- Location: `src/hooks/usePlayerAuth.ts:8` (`HEARTBEAT_INTERVAL_MS = 30_000`)
- Location: `src/hooks/usePlayerAuth.ts:93` (`document.visibilityState === "hidden"` skip)
- The cron runs every 30s, so worst-case detection latency is ~60s
- With timeout = interval, even a single missed heartbeat triggers disconnect
- Tab backgrounding is a normal user behavior (e.g., checking Discord, reading strats)

## Proposed Solutions

### Option 1: Increase HEARTBEAT_TIMEOUT_MS to 60s (Recommended)
Set server timeout to 2x the client interval, giving tolerance for one missed heartbeat.

- **Pros**: Simple fix, eliminates false positives under normal conditions
- **Cons**: Increases worst-case disconnect detection to ~90s (60s timeout + 30s cron)
- **Effort**: Small (5 minutes)
- **Risk**: Low

### Option 2: Decrease client interval to 15s, keep timeout at 30s
Send heartbeats more frequently so the server has more margin.

- **Pros**: Faster disconnect detection, no increase in detection latency
- **Cons**: Doubles HTTP traffic per player, more load on Convex
- **Effort**: Small (5 minutes)
- **Risk**: Low-Medium (increased server load)

### Option 3: Remove tab visibility check
Continue sending heartbeats even when tab is hidden.

- **Pros**: Prevents griefing via tab backgrounding
- **Cons**: May send heartbeats when user is truly away, browser may throttle timers anyway
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Combine Option 1 + Option 3: increase timeout to 60s AND remove the visibility check. This provides the most robust disconnect detection while eliminating false positives.

## Technical Details
- **Affected files**: `convex/lib/constants.ts`, `src/hooks/usePlayerAuth.ts`
- **Affected components**: Heartbeat cron, player auth hook
- **Database changes**: None

## Acceptance Criteria
- [ ] `HEARTBEAT_TIMEOUT_MS` > `HEARTBEAT_INTERVAL_MS` (at least 2x)
- [ ] Tab backgrounding does not cause false disconnects
- [ ] Document the timing invariant in both files with cross-references
- [ ] Existing heartbeat tests updated for new timeout value

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | Security + Performance agents both flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
- `convex/lib/constants.ts` — server timeout
- `src/hooks/usePlayerAuth.ts` — client interval and visibility check
