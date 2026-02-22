---
status: done
priority: p3
issue_id: "016"
tags: [code-review, duplication, connection-status]
dependencies: ["010"]
---

# Vote Page Inline Dot Duplicates ConnectionStatusBadge Color Mapping

## Problem Statement

The vote page (`vote.$token.tsx`) renders its own inline status dot with hardcoded color classes (`bg-green-500`, `bg-amber-500`) instead of using the `ConnectionStatusBadge` component. This duplicates the color-to-status mapping and means changes to the badge colors won't automatically apply to the vote page.

## Findings

- **Source**: pattern-recognition-specialist, kieran-typescript-reviewer
- **Location**: `src/routes/vote.$token.tsx` — inline JSX for connection dot
- **Risk**: Very low — cosmetic duplication

## Proposed Solutions

### Option A: Use ConnectionStatusBadge component in vote page header
- **Pros**: Eliminates duplication, consistent rendering
- **Cons**: May need layout adjustments to fit the badge in the header
- **Effort**: Small
- **Risk**: Low

### Option B: Keep inline dot (accept intentional divergence)
- **Pros**: Vote page dot has a specific compact layout need
- **Cons**: Two places to update colors
- **Effort**: None
- **Risk**: None

## Recommended Action

Option A: Use ConnectionStatusBadge component in vote page header

## Acceptance Criteria

- [x] Connection status colors are defined in one place, or divergence is documented

## Work Log

- 2026-02-22: Identified during PR #76 code review (WAR-56)
- 2026-02-22: Approved during triage (approve all) — status: pending -> ready
- 2026-02-22: Refactored inline dots to use STATUS_CONFIG from ConnectionStatusBadge — status: ready -> done

## Resources

- PR #76: Enhanced connection status indicators
