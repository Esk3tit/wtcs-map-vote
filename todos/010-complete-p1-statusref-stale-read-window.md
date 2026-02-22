---
status: complete
priority: p1
issue_id: "010"
tags: [code-review, race-condition, react, frontend]
dependencies: []
---

# statusRef Stale Read Window During React Post-Paint Phase

## Problem Statement

`statusRef` is synced via `useEffect(() => { statusRef.current = status }, [status])`, which runs asynchronously after paint. Between `setStatus("disconnected")` and the effect running, `handleVisibilityChange` reads `statusRef.current` and sees the OLD status (e.g., `"reconnecting"` instead of `"disconnected"`). This means the visibility handler may attempt a heartbeat when it should be blocked (disconnected state requires manual retry only).

The ref was moved to useEffect due to React 19's `react-hooks/refs` lint rule that prohibits writing refs during render.

## Findings

- **Source:** julik-frontend-races-reviewer
- **Location:** `src/hooks/usePlayerAuth.ts` — `useEffect` that syncs `statusRef`, and `handleVisibilityChange` that reads it
- **Severity:** Can cause an unwanted heartbeat attempt from `disconnected` state, potentially re-entering retry mode automatically when only manual retry should be allowed.

## Proposed Solutions

### Option 1: Synchronous Ref Assignment Alongside setState (Recommended)
Write `statusRef.current` synchronously at every `setStatus()` call site, keeping the useEffect as a backup. Suppress the lint rule at the helper level.

```typescript
function updateStatus(newStatus: AuthStatus) {
  statusRef.current = newStatus; // sync for event handlers
  setStatus(newStatus);
}
```

- **Pros**: Zero stale window; event handlers always see latest status
- **Cons**: Lint suppression needed; discipline to always use `updateStatus` instead of `setStatus`
- **Effort**: Small
- **Risk**: Low

### Option 2: Use useRef-Only Status (No useState)
Track status entirely via ref, force re-renders with a separate counter state.

- **Pros**: No stale window at all
- **Cons**: Major refactor; loses React's batching benefits; harder to reason about
- **Effort**: Large
- **Risk**: Medium

### Option 3: Accept the Risk
The stale window is microseconds. The worst case is one extra heartbeat attempt from disconnected state, which would fail and not change state.

- **Pros**: No code change
- **Cons**: Theoretically incorrect behavior; harder to reason about correctness
- **Effort**: None
- **Risk**: Low (but technically wrong)

## Recommended Action
Use Option 1 — create an `updateStatus` helper that writes both ref and state synchronously.

## Technical Details
- **Affected Files**: `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria
- [ ] `statusRef.current` is always in sync with latest status at the time event handlers read it
- [ ] No stale reads possible between `setStatus` and effect execution
- [ ] Lint rule is properly suppressed with justification comment

## Work Log

### 2026-02-22 - Identified during code review
**By:** julik-frontend-races-reviewer
**Actions:**
- Identified stale read window due to async useEffect ref sync
- Proposed synchronous updateStatus helper pattern

## Resources
- PR #77: WAR-57 Player Reconnection Flow
- React 19 `react-hooks/refs` rule documentation
