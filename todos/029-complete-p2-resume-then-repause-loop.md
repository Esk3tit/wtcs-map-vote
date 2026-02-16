---
status: ready
priority: p2
issue_id: "029"
tags: [code-review, architecture, war-49]
dependencies: []
---

# Resume-Then-Immediate-Re-Pause Loop

## Problem Statement
When an admin resumes a paused session while a player is still disconnected, the next cron tick (within 30 seconds) will detect the still-disconnected player and immediately auto-pause the session again. This creates a frustrating loop for the admin.

## Findings
- Source: Architecture Strategist, Pattern Recognition agents
- Location: `convex/sessionCleanup.ts:440-480` (heartbeat check logic)
- The cron checks `isConnected` and `lastHeartbeat` to detect disconnects
- When admin resumes, the disconnected player's `isConnected` is still `false`
- The cron will re-detect this and pause again
- Admin would need to wait for the player to reconnect before resuming

## Proposed Solutions

### Option 1: Reset isConnected on resume (Recommended)
When resuming from PAUSED, set all disconnected players' `isConnected` back to `true` and clear `lastHeartbeat`. They'll need to re-establish heartbeat within the timeout window.

- **Pros**: Gives players a grace period to reconnect after resume
- **Cons**: If player is truly gone, detection is delayed by one full timeout cycle
- **Effort**: Small (30 minutes)
- **Risk**: Low

### Option 2: Add "grace period" after resume
Track when a session was last resumed and skip heartbeat checks for 60s after resume.

- **Pros**: Explicit grace period, doesn't modify player state
- **Cons**: Adds a new field to session, more complex
- **Effort**: Medium (1 hour)
- **Risk**: Low

### Option 3: Document the behavior
Add a UI toast warning admins that resuming while a player is disconnected will trigger re-pause.

- **Pros**: No code changes, sets expectations
- **Cons**: Poor UX, admin still frustrated
- **Effort**: Small (15 minutes)
- **Risk**: None

## Recommended Action
Option 1 — reset player connection state on resume. This is the cleanest solution and gives the player a fair window to re-establish their heartbeat.

## Technical Details
- **Affected files**: `convex/sessions.ts` (resumeSession mutation), `convex/sessionCleanup.ts`
- **Database changes**: None (uses existing fields)

## Acceptance Criteria
- [ ] Resuming a paused session resets disconnected players' `isConnected` to `true`
- [ ] Players get a full timeout window to re-establish heartbeat after resume
- [ ] Test: resume while player disconnected → player not immediately re-paused
- [ ] Test: resume while player disconnected → player detected again after timeout if still gone

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | Architecture Strategist flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
