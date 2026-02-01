---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, frontend, race-condition]
dependencies: []
---

# Heartbeat Interval Lacks Cancellation Check After Await

## Problem Statement

The heartbeat interval in `usePlayerAuth.ts` does not check a cancellation flag inside its async callback after `await` points. When the component unmounts while a heartbeat fetch is in-flight, `clearInterval` only prevents future ticks but does not cancel the current in-flight request. The pending fetch resolves and calls `setStatus("error")` / `setError(...)` on an unmounted component, causing wasted work and potential UI flickers.

## Findings

- **Source agents:** julik-frontend-races-reviewer
- **File:** `src/hooks/usePlayerAuth.ts` lines 60-76
- **Evidence:** The `setInterval` async callback contains `await fetch(...)` and `await hbRes.json()` but never checks the `cancelled` flag between these async operations
- **Scenario:** Player navigates from `/lobby/abc` to `/vote/abc` while heartbeat is mid-flight. Old heartbeat resolves with an error, sets error state on the now-unmounted lobby component.

## Proposed Solutions

### Solution A: Add cancelled checks after each await (Recommended)
```typescript
heartbeatRef.current = setInterval(async () => {
  if (cancelled) return;
  try {
    const hbRes = await fetch(`${SITE_URL}/api/player/heartbeat`, { ... });
    if (cancelled) return;
    const hbData = await hbRes.json();
    if (cancelled) return;
    if (hbData.status === "error") {
      setStatus("error");
      setError(hbData.error);
      stopHeartbeat();
    }
  } catch { /* ... */ }
}, HEARTBEAT_INTERVAL_MS);
```
- **Pros:** Simple, uses existing `cancelled` variable from the effect closure
- **Cons:** None
- **Effort:** Small (2-3 lines added)
- **Risk:** None

### Solution B: Use AbortController for fetch cancellation
Pass an `AbortController.signal` to the heartbeat fetch so the request is actually cancelled on unmount, not just ignored.
- **Pros:** Actually cancels the TCP connection
- **Cons:** More code, need to handle AbortError
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria

- [ ] Heartbeat callback checks `cancelled` flag after each `await`
- [ ] No state updates occur after component unmount
- [ ] Existing auth flow still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by julik-frontend-races-reviewer |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
