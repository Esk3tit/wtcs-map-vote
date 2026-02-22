---
status: complete
priority: p2
issue_id: "014"
tags: [code-review, security, data-integrity]
dependencies: []
---

# Vote submitAction Lacks isDisconnected Guard

## Problem Statement

The `submitAction` function in `vote.$token.tsx` can be called while the player is disconnected/reconnecting. Although the server will likely reject it, there's no client-side guard to prevent submitting votes during a disconnected state. The confirmation dialog is auto-dismissed on disconnect, but a race exists where the submit could fire between disconnect detection and dialog dismissal.

## Findings

- **Source:** security-sentinel, julik-frontend-races-reviewer
- **Location:** `src/routes/vote.$token.tsx` — `submitAction` function

## Proposed Solutions

### Option 1: Add Early Return Guard (Recommended)
```typescript
async function submitAction(mapId, action) {
  if (auth.status === "reconnecting" || auth.status === "disconnected") return;
  // ... existing logic
}
```

- **Pros**: Simple, defensive; prevents wasted network requests
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — simple guard at the top of `submitAction`.

## Technical Details
- **Affected Files**: `src/routes/vote.$token.tsx`

## Acceptance Criteria
- [ ] `submitAction` returns early when auth status is reconnecting or disconnected
- [ ] No vote/ban requests sent during disconnection

## Work Log

### 2026-02-22 - Identified during code review
**By:** security-sentinel, julik-frontend-races-reviewer

## Resources
- PR #77: WAR-57 Player Reconnection Flow
