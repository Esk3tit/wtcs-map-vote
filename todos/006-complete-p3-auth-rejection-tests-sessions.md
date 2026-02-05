---
status: complete
priority: p3
issue_id: "006"
tags: [testing, auth, consistency]
dependencies: []
---

# Missing Auth Rejection Tests for Session Queries

## Problem Statement
`listSessions`, `getSession`, and `listSessionsForDashboard` have `requireAdmin` guards but lack explicit "throws when not authenticated" tests. Other queries (`listMaps`, `getMap`, `listTeams`) do have these tests. This is a pre-existing gap, not introduced by PR #47.

## Findings
- Location: `convex/sessions.test.ts`
- Found by: Pattern recognition specialist
- Pre-existing gap — not introduced by WAR-27 PR
- Other protected queries already have auth rejection tests as pattern reference

## Proposed Solutions

### Option 1: Add auth rejection tests for all three session queries
- **Pros**: Consistent test coverage, matches pattern in maps/teams tests
- **Cons**: None
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Add `describe("authentication")` blocks with "throws when not authenticated" tests for `listSessions`, `getSession`, and `listSessionsForDashboard`, following the same pattern used in `maps.test.ts` and `teams.test.ts`.

## Technical Details
- **Affected Files**: `convex/sessions.test.ts`
- **Related Components**: Session queries, auth system
- **Database Changes**: No

## Resources
- Original finding: WAR-27 code review (PR #47)
- Reference pattern: `convex/maps.test.ts` auth rejection tests

## Acceptance Criteria
- [x] Auth rejection test for `listSessions`
- [x] Auth rejection test for `getSession`
- [x] Auth rejection test for `listSessionsForDashboard`
- [x] All tests pass

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Triage session on 2026-02-04
