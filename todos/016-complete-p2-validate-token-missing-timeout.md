---
status: complete
priority: p2
issue_id: "016"
tags: [code-review, security, reliability]
dependencies: []
---

# validateToken Fetch Lacks AbortSignal.timeout Unlike sendHeartbeat

## Problem Statement

`sendHeartbeat()` uses `AbortSignal.any([controller.signal, AbortSignal.timeout(HEARTBEAT_FETCH_TIMEOUT_MS)])` to bound fetch time to 8s. However, `validateToken()` only uses `controller.signal` with no timeout. If the server hangs during initial validation, the player sees an infinite loading spinner with no recovery.

## Findings

- **Source:** security-sentinel, kieran-typescript-reviewer
- **Location:** `src/hooks/usePlayerAuth.ts` — `validateToken()` fetch call

## Proposed Solutions

### Option 1: Add AbortSignal.timeout to validateToken (Recommended)
```typescript
const res = await fetch(`${SITE_URL}/api/player/validate-token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: normalizedToken }),
  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(HEARTBEAT_FETCH_TIMEOUT_MS)]),
});
```

- **Pros**: Consistent timeout behavior; prevents infinite loading
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — add the same timeout pattern used by `sendHeartbeat`.

## Technical Details
- **Affected Files**: `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria
- [ ] `validateToken` fetch has a bounded timeout
- [ ] Timeout triggers `NETWORK_ERROR` state (same as other fetch failures)

## Work Log

### 2026-02-22 - Identified during code review
**By:** security-sentinel, kieran-typescript-reviewer

## Resources
- PR #77: WAR-57 Player Reconnection Flow
