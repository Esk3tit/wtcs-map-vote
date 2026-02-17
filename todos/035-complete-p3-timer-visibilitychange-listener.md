---
status: complete
priority: p3
issue_id: "035"
tags: [code-review, performance, ux, war-50]
dependencies: []
---

# Add visibilitychange Listener to CountdownTimer

## Problem Statement
When a player backgrounds the voting tab (e.g., to check Discord or read strats), the browser throttles `setInterval` callbacks. On returning to the tab, the timer display may be stale for up to 1 second before the next tick corrects it. Adding a `visibilitychange` event listener would force an immediate recalculation when the tab becomes visible.

## Findings
- Source: Performance Oracle agent (PR #69 review)
- Location: `src/routes/vote.$token.tsx:112-126` (interval useEffect)
- The timer self-corrects because it recalculates from server timestamp each tick, so the stale display is brief (~1s max)
- Not a correctness issue — purely a UX polish item

## Proposed Solutions

### Option 1: Add visibilitychange listener in the interval useEffect
Add `document.addEventListener("visibilitychange", ...)` alongside the `setInterval` to force immediate recalculation on tab focus.

- **Pros**: Instant correction on tab focus, simple to implement
- **Cons**: One more event listener to manage
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Technical Details
- **Affected files**: `src/routes/vote.$token.tsx`
- **Database changes**: None

## Acceptance Criteria
- [ ] Timer immediately shows correct remaining time when tab becomes visible
- [ ] Event listener cleaned up on unmount

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-16 | Created from PR #69 code review | Performance Oracle flagged background tab throttling |

## Resources
- PR #69: https://github.com/Esk3tit/wtcs-map-vote/pull/69
