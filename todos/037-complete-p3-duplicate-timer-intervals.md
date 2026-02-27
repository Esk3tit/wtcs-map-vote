---
status: complete
priority: p3
issue_id: "037"
tags: [code-review, performance, audio]
dependencies: []
---

# Duplicate setInterval Timers Between CountdownTimer and useAudioAlerts

## Problem Statement

Both `CountdownTimer.tsx` and `useAudioAlerts.ts` run independent `setInterval` timers that calculate remaining time from the same `timerStartedAt` timestamp. This means two intervals tick every second doing the same math. While the performance impact is negligible (two simple calculations per second), it's a code smell that could be consolidated.

## Findings

- **performance-oracle**: Flagged as CRITICAL-2 (duplicate timers)
- **architecture-strategist**: Noted the duplication as an architectural concern
- `CountdownTimer.tsx:49` — interval for display countdown
- `useAudioAlerts.ts` — interval for timer-warning sound at 5s remaining
- Both use `calculateRemainingTime()` with identical inputs

## Proposed Solutions

### Option 1: Share Timer State via Context or Callback
- Have `CountdownTimer` expose its `remaining` value via a callback prop, and `useAudioAlerts` subscribes to it
- **Pros**: Single source of truth for remaining time
- **Cons**: Couples two unrelated components, adds prop drilling
- **Effort**: Medium
- **Risk**: Medium (coupling concerns)

### Option 2: Leave As-Is (Accept Duplication)
- Two simple arithmetic operations per second is negligible overhead
- The components have different responsibilities (display vs. sound trigger)
- **Pros**: No coupling, each module is self-contained
- **Cons**: Duplicated logic
- **Effort**: None
- **Risk**: None

## Recommended Action

Option 2: Leave as-is. Two simple arithmetic ops per second is negligible. Accept duplication, document as intentional.

## Technical Details

- **Affected Files**: `src/components/session/CountdownTimer.tsx`, `src/hooks/useAudioAlerts.ts`
- **Related Components**: `vote.$token.tsx`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Timer calculation is not duplicated (if fixing), OR documented as intentional (if accepting)
- [ ] Timer-warning sound still fires at correct threshold
- [ ] Countdown display still updates correctly

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 2 review agents

## Resources

- PR: #84
- `src/components/session/CountdownTimer.tsx:49`
- `src/hooks/useAudioAlerts.ts`
