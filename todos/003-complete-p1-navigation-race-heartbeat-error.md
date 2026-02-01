---
status: complete
priority: p1
issue_id: "003"
tags: [code-review, frontend, race-condition, ux]
dependencies: ["002"]
---

# Navigation Race Between Auto-Redirect and Heartbeat Error

## Problem Statement

Both lobby and vote pages have a `useEffect` that calls `navigate()` when the session status changes (e.g., WAITING -> IN_PROGRESS). If a heartbeat error resolves during this navigation transition, the error handler calls `setStatus("error")`, causing the outgoing page to briefly render `TokenErrorPage` before the new route mounts. The user sees a flash of an error page mid-navigation.

## Findings

- **Source agents:** julik-frontend-races-reviewer
- **Files:** `src/routes/lobby.$token.tsx` lines 29-38, `src/routes/vote.$token.tsx` lines 92-104
- **Scenario:** Session transitions to IN_PROGRESS -> useEffect triggers navigate -> heartbeat returns TOKEN_EXPIRED during transition -> error page flashes -> vote page loads
- **Related to:** #002 (heartbeat cancellation). Fixing #002 partially mitigates this, but a navigation guard provides additional protection.

## Proposed Solutions

### Solution A: Set a navigating ref before calling navigate (Recommended)
```typescript
const navigatingRef = useRef(false);

useEffect(() => {
  if (data?.status === "valid") {
    const { session } = data;
    if (session.status === "IN_PROGRESS") {
      navigatingRef.current = true;
      navigate({ to: "/vote/$token", params: { token } });
    }
  }
}, [data, navigate, token]);
```
Check `navigatingRef.current` in the heartbeat error handler before setting error state.
- **Pros:** Direct fix for the navigation race
- **Cons:** Adds a ref to track navigation state
- **Effort:** Small
- **Risk:** None

### Solution B: Rely on #002 cancellation fix alone
If the heartbeat checks `cancelled` after await, the unmount cleanup sets `cancelled = true` which prevents the state update.
- **Pros:** No additional code
- **Cons:** Only works if the navigation triggers unmount before the heartbeat resolves; during TanStack Router transitions, the old component may still be mounted briefly
- **Effort:** None (depends on #002)
- **Risk:** May not fully solve the race

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`, `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria

- [ ] No error page flash during session status transitions
- [ ] Navigation from lobby to vote is smooth
- [ ] Heartbeat errors during navigation are suppressed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by julik-frontend-races-reviewer |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
