---
status: complete
priority: p2
issue_id: "001"
tags: [security, voting, information-disclosure]
dependencies: []
---

# Data integrity throw leaks internal state

## Problem Statement

The data integrity assertion in `submitBan` exposes internal counts in the error message: `"expected 1 available map after N bans, found M"`. While this only triggers on invariant violations (not user input), the message could leak implementation details if it surfaces to clients.

## Findings

- Location: `convex/voting.ts:262-265`
- The `throw new Error(...)` message includes `bansNeeded` and `remainingMaps.length`
- This error propagates through the HTTP handler to the client as an unhandled exception
- In Convex, unhandled errors return a generic 500, so the message may not reach the client directly — but it appears in logs and could surface in development mode

## Proposed Solutions

### Option 1: Use a generic error message
- Replace with `throw new Error("Data integrity error: unexpected map count after voting")`
- **Pros**: No internal state leakage
- **Cons**: Harder to debug in logs
- **Effort**: Small (5 minutes)
- **Risk**: Low

### Option 2: Log details separately, throw generic
- Log the specific counts with `console.error(...)` then throw a generic message
- **Pros**: Best of both worlds — debug info in logs, safe message in errors
- **Cons**: Slightly more code
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action

Option 2 — log details then throw generic message.

## Technical Details

- **Affected Files**: `convex/voting.ts`
- **Related Components**: submitBan mutation, HTTP handler
- **Database Changes**: No

## Resources

- Original finding: PR #52 multi-agent code review
- Related issues: None

## Acceptance Criteria

- [ ] Error message does not expose internal counts
- [ ] Debug information is still available in Convex logs
- [ ] Tests pass

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
