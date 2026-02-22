---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, accessibility]
dependencies: []
---

# Focus Restoration May Target Stale Element Reference

## Problem Statement

`DisconnectedOverlay` captures `previousFocusRef` on mount and restores focus on unmount. If the previously focused element is removed from the DOM during the disconnect period (e.g., a map card that was eliminated), `element.focus()` silently fails. Not a crash, but focus is lost.

## Findings

- **Source:** Multiple agents
- **Location:** `src/components/session/DisconnectedOverlay.tsx` — focus restoration useEffect

## Proposed Solutions

### Option 1: Guard with isConnected Check (Recommended)
```typescript
return () => {
  const el = previousFocusRef.current;
  if (el && document.body.contains(el)) {
    el.focus();
  }
};
```

- **Effort**: Small
- **Risk**: Low

## Technical Details
- **Affected Files**: `src/components/session/DisconnectedOverlay.tsx`

## Acceptance Criteria
- [ ] Focus restoration checks that element is still in DOM before calling focus()

## Work Log

### 2026-02-22 - Identified during code review
**By:** Multiple agents

## Resources
- PR #77: WAR-57 Player Reconnection Flow
