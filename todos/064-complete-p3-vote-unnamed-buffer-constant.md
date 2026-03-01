---
status: ready
priority: p3
issue_id: "064"
tags: [code-review, readability, animation, war-66]
dependencies: []
---

# Vote page +100 buffer in stagger timer unnamed

## Problem Statement

The stagger timer computation in `vote.$token.tsx:274` uses `+ 100` as an unnamed buffer value. While the purpose is clear from context (safety margin for animation completion), a named constant would improve readability.

## Findings

- **Location:** `src/routes/vote.$token.tsx:274`
- Current: `(mapsForAnimation.length - 1) * MAP_STAGGER_DELAY_MS + MAP_FADE_DURATION_MS + 100`
- The `100` represents a safety buffer to ensure the CSS animation fully completes before the ref flips
- Other constants in the same block (`MAP_STAGGER_DELAY_MS`, `MAP_FADE_DURATION_MS`) are named

## Proposed Solutions

### Option 1: Extract to named constant
- Add `const STAGGER_SAFETY_BUFFER_MS = 100;`
- **Pros**: Self-documenting
- **Cons**: Minor, adds one more constant
- **Effort**: Small (2-line change)
- **Risk**: Low

## Acceptance Criteria

- [ ] Buffer value has a descriptive constant name

## Work Log

### 2026-02-28 - Created from code review
**By:** Claude Code Review
**Actions:** Identified by architecture-strategist and frontend-races-reviewer

## Resources

- PR #90: WAR-66 lobby pulsing wait + staggered maps
