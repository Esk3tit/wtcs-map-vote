---
status: complete
priority: p2
issue_id: "015"
tags: [code-review, ux, accessibility]
dependencies: []
---

# Body Scroll Lock Stacking Conflict Between Overlays

## Problem Statement

Both `SessionPausedOverlay` and `DisconnectedOverlay` independently manage `document.body.style.overflow = "hidden"`. When both are active simultaneously (session paused AND player disconnected), whichever overlay unmounts first restores `overflow` to its saved value — but the other overlay still expects overflow to be hidden. This can result in scroll lock being released prematurely or restored to the wrong value.

## Findings

- **Source:** julik-frontend-races-reviewer, pattern-recognition-specialist, code-simplicity-reviewer
- **Location:** `src/components/session/DisconnectedOverlay.tsx`, `src/components/session/SessionPausedOverlay.tsx`

## Proposed Solutions

### Option 1: Reference Counting Hook (Recommended)
Create a shared `useScrollLock()` hook with a module-level reference counter:
```typescript
let lockCount = 0;
let savedOverflow = "";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) savedOverflow = document.body.style.overflow;
    lockCount++;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = savedOverflow;
    };
  }, [active]);
}
```

- **Pros**: Correct stacking behavior; reusable for any future overlay
- **Cons**: Module-level state (acceptable for this use case)
- **Effort**: Small
- **Risk**: Low

### Option 2: Only Lock in One Overlay
Have DisconnectedOverlay (higher z-index) manage scroll lock, and SessionPausedOverlay skip it.

- **Pros**: Simple
- **Cons**: If DisconnectedOverlay is not shown but SessionPausedOverlay is, no scroll lock
- **Effort**: Small
- **Risk**: Medium

## Recommended Action
Option 1 — shared `useScrollLock` hook with reference counting.

## Technical Details
- **Affected Files**: New `src/hooks/useScrollLock.ts`, `src/components/session/DisconnectedOverlay.tsx`, `src/components/session/SessionPausedOverlay.tsx`

## Acceptance Criteria
- [ ] Both overlays can be active simultaneously without scroll lock conflicts
- [ ] Scroll lock is only released when ALL overlays are dismissed
- [ ] Original overflow value is correctly restored

## Work Log

### 2026-02-22 - Identified during code review
**By:** julik-frontend-races-reviewer, pattern-recognition-specialist

## Resources
- PR #77: WAR-57 Player Reconnection Flow
