---
status: complete
priority: p3
issue_id: "013"
tags: [code-review, duplication, connection-status]
dependencies: ["010"]
---

# AdminConnectionBadge Duplicates Label Logic from ConnectionStatusBadge

## Problem Statement

`AdminConnectionBadge` in `session.$sessionId.tsx` wraps `ConnectionStatusBadge` but re-implements its own label mapping (`CONNECTION_STATUS_LABELS`) and styles (`ADMIN_CONNECTION_BADGE_STYLES`). This duplicates the color-to-status mapping that `ConnectionStatusBadge` already handles internally.

## Findings

- **Source**: pattern-recognition-specialist, architecture-strategist, code-simplicity-reviewer
- **Location**: `src/routes/admin/session.$sessionId.tsx` — `AdminConnectionBadge` component
- **Duplication**: Label text and dot colors are defined in both `ConnectionStatusBadge` and `AdminConnectionBadge`
- **Risk**: Very low — cosmetic duplication

## Proposed Solutions

### Option A: Add label support to ConnectionStatusBadge directly
- **Pros**: One component handles all variants, eliminates wrapper
- **Cons**: Slightly more complex base component
- **Effort**: Small
- **Risk**: Low

### Option B: Keep as-is (accept intentional duplication)
- **Pros**: Admin badge has distinct styling needs, separation is reasonable
- **Cons**: Two places to update if states change
- **Effort**: None
- **Risk**: None

## Recommended Action

Option A: Add label support to ConnectionStatusBadge directly

## Acceptance Criteria

- [x] Label logic exists in one place, or duplication is documented as intentional

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
