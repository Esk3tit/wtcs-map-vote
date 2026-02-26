---
status: complete
priority: p3
issue_id: "040"
tags: [code-review, simplicity, audio]
dependencies: []
---

# useAudio.ts Hook Could Be Inlined Into useAudioAlerts

## Problem Statement

`useAudio.ts` is a thin wrapper that calls `audioManager.setupUnlock()` in a `useEffect` and returns `audioManager`. It's only used in one place (`useAudioAlerts.ts`). This extra layer of indirection adds a file and an abstraction boundary without providing reuse or testability benefits.

## Findings

- **code-simplicity-reviewer**: Recommended inlining `useAudio.ts` into `useAudioAlerts.ts`
- `src/hooks/useAudio.ts` — 15 lines, single consumer
- `src/hooks/useAudioAlerts.ts` — the only consumer

## Proposed Solutions

### Option 1: Inline Into useAudioAlerts
- Move the `useEffect(() => audioManager.setupUnlock(), [])` call directly into `useAudioAlerts.ts`
- Delete `useAudio.ts`
- **Pros**: One fewer file, simpler dependency chain
- **Cons**: If a second consumer appears later, need to extract again
- **Effort**: Small
- **Risk**: Low

### Option 2: Leave As-Is
- Separation is fine — the hook has a clear single responsibility
- **Pros**: Clean separation of concerns
- **Cons**: Unnecessary abstraction for single use
- **Effort**: None
- **Risk**: None

## Recommended Action

Option 1: Inline into useAudioAlerts. Move setupUnlock effect into useAudioAlerts and delete useAudio.ts.

## Technical Details

- **Affected Files**: `src/hooks/useAudio.ts`, `src/hooks/useAudioAlerts.ts`
- **Related Components**: `audio.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `useAudio.ts` is removed (if inlining)
- [ ] `setupUnlock()` still called on mount in `useAudioAlerts`
- [ ] Audio functionality unchanged

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 1 review agent

## Resources

- PR: #84
- `src/hooks/useAudio.ts`
- `src/hooks/useAudioAlerts.ts`
