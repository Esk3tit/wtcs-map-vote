---
status: complete
priority: p3
issue_id: "041"
tags: [code-review, simplicity, audio]
dependencies: []
---

# Redundant Reset Effect for Timer Refs in useAudioAlerts

## Problem Statement

`useAudioAlerts.ts` has a `useEffect` that resets `timerWarningFired` and `timerIntervalRef` when `timerStartedAt` changes. However, the main timer effect already handles cleanup and re-initialization when `timerStartedAt` changes (it's in the dependency array). The reset effect is redundant — the main effect's cleanup function already clears the interval, and the new effect body resets the ref.

## Findings

- **kieran-typescript-reviewer**: Flagged as redundant — main effect handles cleanup
- **code-simplicity-reviewer**: Recommended removing the extra reset effect
- Location: `src/hooks/useAudioAlerts.ts` (timer reset useEffect)

## Proposed Solutions

### Option 1: Remove Redundant Effect
- Delete the separate reset `useEffect` for timer refs
- Ensure the main timer `useEffect` resets `timerWarningFired.current = false` at the start of its body
- **Pros**: Fewer effects, clearer data flow, less code
- **Cons**: Need to verify the main effect already handles all reset cases
- **Effort**: Small
- **Risk**: Low

### Option 2: Leave As-Is
- The extra effect is harmless and makes the reset intent explicit
- **Pros**: Clear intent
- **Cons**: Redundant code
- **Effort**: None
- **Risk**: None

## Recommended Action

Option 1: Remove redundant effect. Ensure main timer effect resets timerWarningFired.current at start of its body.

## Technical Details

- **Affected Files**: `src/hooks/useAudioAlerts.ts`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Timer warning still fires correctly at threshold
- [ ] Timer refs reset properly on new turn
- [ ] No duplicate intervals created

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 2 review agents

## Resources

- PR: #84
- `src/hooks/useAudioAlerts.ts`
