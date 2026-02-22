---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, testing, connection-status]
dependencies: []
---

# Add Unit Tests for computeConnectionStatus

## Problem Statement

The `computeConnectionStatus()` function in `convex/sessions.ts` has multiple branches based on `isConnected`, `lastHeartbeat`, and timing thresholds, but has zero unit test coverage. This is a critical piece of logic that determines what admins and players see for connection state.

## Findings

- **Source**: kieran-typescript-reviewer, architecture-strategist, data-integrity-guardian
- **Location**: `convex/sessions.ts` — `computeConnectionStatus()` (currently a file-private function)
- **Branches to test**:
  1. `isConnected: false` → "disconnected"
  2. `isConnected: true`, no `lastHeartbeat` → "connected"
  3. `isConnected: true`, `lastHeartbeat` within interval → "connected"
  4. `isConnected: true`, `lastHeartbeat` between interval and timeout → "reconnecting"
  5. `isConnected: true`, `lastHeartbeat` beyond timeout → "disconnected"
- **Risk**: Medium — untested business logic, but currently simple and well-documented

## Proposed Solutions

### Option A: Export function and test directly with vitest
- **Pros**: Simple, direct, fast tests
- **Cons**: Need to export what is currently a private helper
- **Effort**: Small
- **Risk**: Low

### Option B: Test indirectly via Convex query integration tests
- **Pros**: Tests the full pipeline, no export needed
- **Cons**: Slower, harder to isolate branches, requires test data setup
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

Option A: Export function and test directly with vitest (pairs with #010 extraction)

## Technical Details

- **Affected files**: `convex/sessions.ts`, new test file `convex/connectionStatus.test.ts`
- **If extracting**: Move to `convex/lib/connectionStatus.ts` (aligns with todo #010)

## Acceptance Criteria

- [ ] All 5 branches of computeConnectionStatus have test coverage
- [ ] Edge cases at exact boundary values (HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS) are tested
- [ ] Tests pass in CI

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
- `convex/sessions.ts`: `computeConnectionStatus()` function
