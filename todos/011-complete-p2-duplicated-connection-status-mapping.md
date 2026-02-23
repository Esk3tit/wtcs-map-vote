---
status: complete
priority: p2
issue_id: "011"
tags: [code-review, duplication, architecture]
dependencies: []
---

# Duplicated ownConnectionStatus and isDisconnected Across Route Files

## Problem Statement

Both `lobby.$token.tsx` and `vote.$token.tsx` contain identical logic for:
1. `ownConnectionStatus` — 3-way ternary mapping `auth.status` to `ConnectionStatus`
2. `isDisconnected` — boolean derived from `auth.status`
3. Subscription gate — checking 3 auth statuses for the Convex query
4. DisconnectedOverlay integration — same props pattern and `as` type assertion

This violates DRY and means any change to the mapping logic must be updated in two places.

## Findings

- **Source:** pattern-recognition-specialist, architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer
- **Location:** `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`
- **Evidence:** Identical code blocks in both files for connection status derivation

## Proposed Solutions

### Option 1: Add Derived Properties to usePlayerAuth Return Value (Recommended)
Extend `UsePlayerAuthResult` to include:
```typescript
interface UsePlayerAuthResult {
  status: AuthStatus;
  error: AuthError | null;
  retry: () => void;
  retryAttempt: number;
  maxRetries: number;
  // New derived properties:
  isDisconnected: boolean;        // status === "reconnecting" || status === "disconnected"
  isSubscriptionActive: boolean;  // authenticated || reconnecting || disconnected
  connectionStatus: ConnectionStatus; // mapped connection status
}
```

- **Pros**: Single source of truth; consumers don't need to know mapping rules; type-safe without assertions
- **Cons**: Couples ConnectionStatus type to the auth hook
- **Effort**: Small
- **Risk**: Low

### Option 2: Extract Utility Functions
Create standalone mapping functions in a shared module.

- **Pros**: No coupling to hook; reusable
- **Cons**: Still requires calling functions in both routes; easy to forget
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — add derived properties to the hook's return value. This is the most ergonomic approach and eliminates the unsafe `as` type assertion.

## Technical Details
- **Affected Files**: `src/hooks/usePlayerAuth.ts`, `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`
- **Related Components**: DisconnectedOverlay

## Acceptance Criteria
- [x] `ownConnectionStatus`, `isDisconnected`, and subscription gate logic exist only once
- [x] No `as` type assertion needed in route files
- [x] Both route files use the same derived properties from the hook

## Work Log

### 2026-02-22 - Identified during code review
**By:** Multiple agents (pattern-recognition, architecture, typescript, simplicity)
**Actions:**
- Identified identical mapping logic in two route files
- Proposed consolidation into hook return value

## Resources
- PR #77: WAR-57 Player Reconnection Flow
