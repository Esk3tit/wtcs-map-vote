---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, ux, frontend]
dependencies: []
---

# TOKEN_NOT_ACTIVATED Should Be Treated as Loading State, Not Error

## Problem Statement

When the reactive query runs before the `validateAndLockToken` mutation has fully committed, `getSessionByToken` returns `TOKEN_NOT_ACTIVATED`. This is rendered as a full `TokenErrorPage` with a warning icon and "Connecting..." text. This is a transient state (~100ms) that resolves automatically, but showing it inside an error-styled card confuses users. It should be treated as a loading state with a spinner.

## Findings

- **Source agents:** code-simplicity-reviewer, julik-frontend-races-reviewer
- **File:** `src/routes/lobby.$token.tsx` lines 54-66, `src/components/session/TokenErrorPage.tsx` lines 21-25
- **Evidence:** `TOKEN_NOT_ACTIVATED` renders full error card with warning icon

## Proposed Solutions

### Solution A: Handle TOKEN_NOT_ACTIVATED as loading in route component (Recommended)
```typescript
if (data.status === "error") {
  if (data.error === "TOKEN_NOT_ACTIVATED") {
    return <LoadingSpinner />; // Same as initial loading
  }
  return <TokenErrorPage error={data.error} />;
}
```
- **Effort:** Small | **Risk:** None

## Technical Details

- **Affected files:** `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`

## Acceptance Criteria

- [ ] TOKEN_NOT_ACTIVATED shows spinner, not error card
- [ ] Transitions smoothly to lobby/vote content once mutation commits

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by 2 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
