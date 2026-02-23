---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, performance, session]
dependencies: []
---

# Stop heartbeat after EXPIRED session renders

## Problem Statement
After `SessionEndedPage` renders for an EXPIRED session, `usePlayerAuth` continues firing heartbeats every 30s. The heartbeat succeeds server-side (it only checks token expiry and IP match, not session status) and writes `lastHeartbeat` to the database. This is wasted work — the player is on a terminal error page with no further interaction possible.

## Findings
- `usePlayerAuth` heartbeat runs whenever `isSubscriptionActive` is true (authenticated, reconnecting, or disconnected states)
- The EXPIRED guard in lobby/vote renders `SessionEndedPage` but doesn't signal the auth hook to stop
- Server-side `playerHeartbeat` does not check `ACTIVE_SESSION_STATUSES` — only token expiry and IP
- No security risk (all game actions are server-validated) but unnecessary DB writes and network requests
- Location: `src/hooks/usePlayerAuth.ts:373` (isSubscriptionActive), `src/routes/lobby.$token.tsx:119`, `src/routes/vote.$token.tsx:252`

## Proposed Solutions

### Option 1: Stop Convex subscription when EXPIRED detected
- Pass `"skip"` to `useQuery` when session status is EXPIRED
- This stops the reactive subscription and indirectly signals no more data is needed
- **Pros**: Simple, uses existing Convex pattern
- **Cons**: Requires threading session status back to the query args
- **Effort**: Small
- **Risk**: Low

### Option 2: Add a cleanup effect that stops heartbeat on EXPIRED
- Add a `useEffect` in the route that calls a stop function on `usePlayerAuth` when EXPIRED is detected
- **Pros**: Explicit, clear intent
- **Cons**: Requires adding a new method to usePlayerAuth's return interface
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 is simpler — skip the Convex subscription when session is EXPIRED. The heartbeat naturally stops when the subscription is inactive.

## Technical Details
- **Affected Files**: `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`, possibly `src/hooks/usePlayerAuth.ts`
- **Related Components**: usePlayerAuth heartbeat loop, Convex subscription
- **Database Changes**: No

## Resources
- PR #78: https://github.com/Esk3tit/wtcs-map-vote/pull/78
- Security sentinel review finding

## Acceptance Criteria
- [ ] Heartbeat stops firing after SessionEndedPage renders
- [ ] No unnecessary DB writes for expired sessions
- [ ] Existing auth/reconnection flows unaffected
- [ ] TypeScript strict mode passes
- [ ] Tests pass

## Work Log

### 2026-02-23 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session for PR #78 review
- Status set to ready
- Prioritized as P3 (resource optimization, no security impact)

**Learnings:**
- Server-side heartbeat handler doesn't check session status, only token validity
- The heartbeat is harmless but wasteful for terminal session states

## Notes
Source: PR #78 code review — security sentinel finding
