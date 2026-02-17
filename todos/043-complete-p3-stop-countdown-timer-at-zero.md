---
status: complete
priority: p3
issue_id: "043"
tags: [code-review, performance]
dependencies: []
---

# Stop ReadyCountdown Timer When Countdown Reaches Zero

## Problem Statement

The `ReadyCountdown` component's `setInterval` continues ticking every second even after the countdown reaches zero. The timer should stop when `remaining <= 0` to avoid unnecessary re-renders.

## Findings

- **Performance Oracle**: Flagged as MEDIUM-HIGH — timer never stops after zero
- **Pattern Recognition**: Recommended handling `remaining <= 0` case

### Evidence

- `src/components/session/ReadyCountdown.tsx:24-27` — interval runs unconditionally

## Proposed Solutions

### Option A: Clear interval when remaining hits zero (Recommended)

Add `remaining` to the effect dependency or check inside the interval callback and call `clearInterval`.

**Pros:** Clean resource management
**Cons:** Minor complexity
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected files:**
- `src/components/session/ReadyCountdown.tsx`

## Acceptance Criteria

- [ ] Timer stops when countdown reaches zero
- [ ] No memory leak from orphaned intervals
- [ ] Visual display still shows "0" correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-17 | Created from PR #71 code review | Performance oracle flagged |

## Resources

- PR #71: https://github.com/Esk3tit/wtcs-map-vote/pull/71
