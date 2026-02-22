---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, ux, connection-status]
dependencies: []
---

# Admin Badge Shows "Disconnected" for Unactivated Players

## Problem Statement

Players who have been assigned a token but haven't yet opened their link show `connectionStatus: "disconnected"` on the admin dashboard. This is technically correct (they never connected) but creates a misleading UX — the admin sees red "Disconnected" badges before the session even starts, making it look like something is wrong.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `convex/sessions.ts` — `computeConnectionStatus()`, admin session page
- **Current behavior**: `isConnected: false` + no `lastHeartbeat` → "disconnected"
- **Expected behavior**: Unactivated players should show a neutral state (e.g., "pending" or no badge) rather than an alarming red "Disconnected"
- **Risk**: Low — cosmetic UX regression, no data integrity issue

## Proposed Solutions

### Option A: Add "pending" as a 4th connection state
- **Pros**: Semantically correct, clear to admins
- **Cons**: Requires schema/type changes across multiple files, increases scope
- **Effort**: Medium
- **Risk**: Medium — touches multiple layers

### Option B: Only show connection badge for activated players
- **Pros**: Simple, no new states needed, just conditional rendering
- **Cons**: Admin can't distinguish "never connected" from "not yet activated"
- **Effort**: Small
- **Risk**: Low

### Option C: Show "Waiting" label for unactivated players
- **Pros**: Uses existing badge with different label, minimal code change
- **Cons**: Slightly overloads the connection badge semantics
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option B: Only show connection badge for activated players (simplest fix)

## Technical Details

- **Affected files**: `src/routes/admin/session.$sessionId.tsx`, `convex/sessions.ts`
- **Components**: `AdminConnectionBadge`
- **Condition**: Player has `ipAddress === undefined` or `lastHeartbeat === undefined`

## Acceptance Criteria

- [ ] Unactivated players do NOT show red "Disconnected" badge
- [ ] Activated but disconnected players still show "Disconnected" correctly
- [ ] Admin can distinguish between unactivated and disconnected states

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
- `convex/sessions.ts`: `computeConnectionStatus()` function
