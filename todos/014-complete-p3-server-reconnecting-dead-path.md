---
status: complete
priority: p3
issue_id: "014"
tags: [code-review, architecture, connection-status]
dependencies: []
---

# Server-Side "Reconnecting" State Is Largely Dead for Other Players

## Problem Statement

`computeConnectionStatus()` can return "reconnecting" when a player's `lastHeartbeat` is between `HEARTBEAT_INTERVAL_MS` (30s) and `HEARTBEAT_TIMEOUT_MS` (60s). However, since `Date.now()` is not reactive in Convex queries, this "reconnecting" window is only visible when the query re-evaluates for another reason during that 30-second window. In practice, other players almost never see "reconnecting" — they see "connected" then jump to "disconnected" when the cron marks them.

## Findings

- **Source**: code-simplicity-reviewer, performance-oracle
- **Location**: `convex/sessions.ts` — `computeConnectionStatus()`
- **Already documented**: A JSDoc comment was added explaining this limitation
- **Risk**: Very low — the feature works correctly for the player's own status (client-side), and the server path is harmless even if rarely triggered

## Proposed Solutions

### Option A: Keep as-is with documentation (current state)
- **Pros**: Correct behavior when it does trigger, no code removed
- **Cons**: "Reconnecting" on the admin dashboard for other players is nearly never shown
- **Effort**: None (already done)
- **Risk**: None

### Option B: Remove server-side "reconnecting" and only use 2 states server-side
- **Pros**: Simpler server logic, honest about what it can detect
- **Cons**: Loses the small chance of showing "reconnecting" on admin dashboard
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option A: Keep as-is with documentation (already done, no further action needed)

## Acceptance Criteria

- [ ] Decision made: keep 3-state server-side or simplify to 2-state
- [ ] If simplified, update all consumers of server connectionStatus

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Date.now() limitation already documented via JSDoc in computeConnectionStatus
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
