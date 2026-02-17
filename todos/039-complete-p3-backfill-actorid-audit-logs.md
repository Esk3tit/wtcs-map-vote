---
status: complete
priority: p3
issue_id: "039"
tags: [code-review, quality, audit, sessions]
dependencies: []
---

# Backfill actorId in Audit Log Calls

## Problem Statement

PR #70 correctly added `actorId: admin._id` to the `SESSION_DELETED` audit log, matching the pattern used by lifecycle mutations (`createSession`, `endSession`, `cloneSession`). However, three other mutations still omit `actorId`: `updateSession`, `assignPlayer`, and `setSessionMaps`. This creates an inconsistency in the audit trail.

## Findings

- **Flagged by:** Pattern Recognition Specialist
- **Location:**
  - `convex/sessions.ts:578` (`updateSession` audit log - missing `actorId`)
  - `convex/sessions.ts:740` (`assignPlayer` audit log - missing `actorId`)
  - `convex/sessions.ts:843` (`setSessionMaps` audit log - missing `actorId`)
- **Pre-existing issue:** Not introduced by PR #70
- **Pattern:** Other mutations (`createSession`, `endSession`, lifecycle mutations) already include `actorId`

## Proposed Solutions

### Option 1: Add actorId to all three mutations (Recommended)
Each mutation already calls `requireAdmin(ctx)`. Change to capture return value and add `actorId`.
- **Pros**: Consistent audit trail, minimal change
- **Cons**: None
- **Effort**: Small (15 min)
- **Risk**: Low

## Recommended Action

Go with Option 1: Capture `requireAdmin(ctx)` return value in all three mutations and add `actorId: admin._id` to their audit log calls.

## Technical Details

- **Affected Files**: `convex/sessions.ts`
- **Related Components**: Audit logging
- **Database Changes**: None

## Acceptance Criteria

- [x] `updateSession`, `assignPlayer`, `setSessionMaps` include `actorId` in audit logs
- [x] Tests updated to verify `actorId` presence
- [x] All tests pass

## Work Log

### 2026-02-17 - Identified during PR #70 review
**By:** Code Review (7-agent parallel review)
**Actions:**
- Pattern Recognition Specialist flagged inconsistency in audit log patterns

### 2026-02-17 - Approved for Work
**By:** Triage (approve all)
**Actions:**
- Status changed from pending to ready
- Recommended Option 1: Add actorId to all three mutations

## Resources

- PR #70: https://github.com/Esk3tit/wtcs-map-vote/pull/70
