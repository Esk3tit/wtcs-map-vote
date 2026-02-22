---
status: complete
priority: p3
issue_id: "015"
tags: [code-review, yagni, connection-status]
dependencies: []
---

# Remove Unused "md" Size Variant from ConnectionStatusBadge

## Problem Statement

`ConnectionStatusBadge` supports `size: "sm" | "md"` but only `"sm"` is used anywhere in the codebase. The "md" variant was added speculatively and violates YAGNI (You Aren't Gonna Need It).

## Findings

- **Source**: code-simplicity-reviewer
- **Location**: `src/components/session/ConnectionStatusBadge.tsx`
- **Usage**: Only `size="sm"` is used in lobby, vote, and admin pages
- **Risk**: None — dead code

## Proposed Solutions

### Option A: Remove "md" size variant
- **Pros**: Cleaner, less code, YAGNI-compliant
- **Cons**: Need to re-add if later needed (trivial)
- **Effort**: Small
- **Risk**: None

## Recommended Action

Option A: Remove "md" size variant

## Acceptance Criteria

- [ ] Only one size variant remains (or size prop removed entirely)
- [ ] No compile errors

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready

## Resources

- PR #76: Enhanced connection status indicators
