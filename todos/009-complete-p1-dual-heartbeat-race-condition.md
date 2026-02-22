---
status: complete
priority: p1
issue_id: "009"
tags: [code-review, race-condition, frontend]
dependencies: []
---

# Dual Heartbeat Race Condition — Leaked Interval Timer

## Problem Statement

In `usePlayerAuth.ts`, the visibility handler (`handleVisibilityChange`) and the retry timeout callback can both call `startNormalHeartbeat()` concurrently. If the tab becomes visible at the exact moment a retry timeout fires and succeeds, two `setInterval` timers are created but only the second one's ID is stored in `heartbeatRef`. The first interval leaks and runs indefinitely, sending duplicate heartbeat requests.

This is a real race: the visibility handler clears `retryTimeoutRef` and calls `attemptHeartbeat()`, but the retry timeout may have already fired and be awaiting `sendHeartbeat()`. Both can succeed and both call `startNormalHeartbeat()`.

## Findings

- **Source:** julik-frontend-races-reviewer, architecture-strategist
- **Location:** `src/hooks/usePlayerAuth.ts` — `startNormalHeartbeat()`, `handleVisibilityChange()`, retry timeout callback
- **Severity:** The leaked interval sends extra heartbeats every 30s for the lifetime of the component. Not a data corruption issue, but degrades network performance and can cause confusing auth state flickers.

## Proposed Solutions

### Option 1: Generation Counter Pattern (Recommended)
Add a `generationRef` counter. Increment it whenever entering retry mode or starting normal heartbeat. All async callbacks check their captured generation against current — bail out if stale.

```typescript
const generationRef = useRef(0);

function startNormalHeartbeat() {
  const gen = ++generationRef.current;
  stopAll();
  heartbeatRef.current = setInterval(async () => {
    if (gen !== generationRef.current) return;
    // ... heartbeat logic
  }, HEARTBEAT_INTERVAL_MS);
}
```

- **Pros**: Clean, proven pattern; prevents all concurrent operation races
- **Cons**: Slightly more complex code
- **Effort**: Small
- **Risk**: Low

### Option 2: Mutex Flag
Add an `isStartingHeartbeat` ref to prevent concurrent `startNormalHeartbeat()` calls.

- **Pros**: Simple
- **Cons**: Fragile — must remember to reset flag in all paths; doesn't protect against other races
- **Effort**: Small
- **Risk**: Medium (easy to miss edge cases)

## Recommended Action
Use Option 1 (generation counter). It's a well-established pattern for cancelling stale async operations.

## Technical Details
- **Affected Files**: `src/hooks/usePlayerAuth.ts`
- **Related Components**: DisconnectedOverlay (indirectly — state flickers affect overlay)

## Acceptance Criteria
- [ ] No leaked intervals when visibility change and retry timeout overlap
- [ ] Generation counter prevents stale callbacks from modifying state
- [ ] Manual test: rapidly switch tabs during retry sequence — only one heartbeat interval runs

## Work Log

### 2026-02-22 - Identified during code review
**By:** julik-frontend-races-reviewer, architecture-strategist
**Actions:**
- Identified race condition between visibility handler and retry timeout
- Proposed generation counter pattern as fix

## Resources
- PR #77: WAR-57 Player Reconnection Flow
- Related: `src/hooks/usePlayerAuth.ts`
