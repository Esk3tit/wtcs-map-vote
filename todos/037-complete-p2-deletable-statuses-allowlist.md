---
status: complete
priority: p2
issue_id: "037"
tags: [code-review, architecture, security, sessions]
dependencies: []
---

# Switch deleteSession Guard to Explicit Allowlist

## Problem Statement

The `deleteSession` guard uses a blacklist pattern (`session.status === "IN_PROGRESS"`) which is fragile against future state additions. If a new session status is added (e.g., `ARCHIVING`, `LOCKED`), it would automatically be deletable without explicit review. The rest of the codebase (e.g., `VALID_TRANSITIONS`, `ACTIVE_SESSION_STATUSES`) uses explicit enumeration for state machine policy.

## Findings

- **Flagged by:** Security Sentinel, Architecture Strategist, Pattern Recognition Specialist, Code Simplicity Reviewer (4/7 agents)
- **Location:** `convex/sessions.ts:610`
- **Current code:** `if (session.status === "IN_PROGRESS")` (blacklist)
- **Risk:** New states silently become deletable without review
- **Precedent:** `VALID_TRANSITIONS` in `convex/lib/constants.ts` uses explicit state enumeration

## Proposed Solutions

### Option 1: Define DELETABLE_STATUSES constant (Recommended)
Add `DELETABLE_STATUSES` to `convex/lib/constants.ts` alongside existing state machine constants:
```typescript
export const DELETABLE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "DRAFT", "WAITING", "PAUSED", "COMPLETE", "EXPIRED",
]);
```
Use in `deleteSession`: `if (!DELETABLE_STATUSES.has(session.status))`

- **Pros**: Explicit, co-located with other lifecycle constants, TypeScript catches new states
- **Cons**: Slightly more indirection than inline check
- **Effort**: Small (15 min)
- **Risk**: Low

### Option 2: Keep blacklist but add NON_DELETABLE_STATUSES constant
```typescript
const NON_DELETABLE_STATUSES = new Set(["IN_PROGRESS"]);
```
- **Pros**: Communicates intent via constant name
- **Cons**: Still defaults to "allow" for new states
- **Effort**: Small (10 min)
- **Risk**: Low

### Option 3: Leave as-is
The current code is correct for all 6 existing states.
- **Pros**: Simplest code
- **Cons**: No protection against future states
- **Effort**: None
- **Risk**: Medium (if states are added)

## Recommended Action

Go with Option 1: Define `DELETABLE_STATUSES` in `convex/lib/constants.ts` and use it in `deleteSession`. This aligns with how `VALID_TRANSITIONS` and `ACTIVE_SESSION_STATUSES` are already structured.

## Technical Details

- **Affected Files**: `convex/sessions.ts`, `convex/lib/constants.ts`
- **Related Components**: Session lifecycle state machine
- **Database Changes**: None

## Acceptance Criteria

- [x] `DELETABLE_STATUSES` constant defined in `convex/lib/constants.ts`
- [x] `deleteSession` uses the constant for its guard
- [x] TypeScript compiler surfaces errors if new `SessionStatus` values are not addressed
- [x] Tests pass
- [x] Typecheck passes

## Work Log

### 2026-02-17 - Identified during PR #70 review
**By:** Code Review (7-agent parallel review)
**Actions:**
- Flagged by 4 of 7 review agents as architectural concern
- Blacklist pattern is fragile against future state additions

### 2026-02-17 - Approved for Work
**By:** Triage (approve all)
**Actions:**
- Status changed from pending to ready
- Recommended Option 1: DELETABLE_STATUSES constant

## Resources

- PR #70: https://github.com/Esk3tit/wtcs-map-vote/pull/70
- Related constants: `convex/lib/constants.ts` (VALID_TRANSITIONS, ACTIVE_SESSION_STATUSES)
