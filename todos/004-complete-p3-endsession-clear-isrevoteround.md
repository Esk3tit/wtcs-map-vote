---
status: complete
priority: p3
issue_id: "004"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# Add isRevoteRound: false to endSession patches

## Problem Statement

The `endSession` mutation transitions to COMPLETE but doesn't reset `isRevoteRound` to `false`. While COMPLETE is a terminal state for voting (so `isRevoteRound` is never read again), a future session reset (COMPLETE → WAITING, WAR-45) would need a clean slate. The `SESSION_RESET_PATCHES` in `constants.ts` already handles this, but defensive cleanup in `endSession` itself would be more thorough.

## Findings

- **Location:** `convex/sessions.ts` — `endSession` mutation patches
- **Agents:** architecture-strategist, data-integrity-guardian
- **Context:** `resumeSession` already resets `isRevoteRound: false`. `SESSION_RESET_PATCHES` in constants.ts includes this reset for WAR-45. So this is defense-in-depth, not a bug.
- **Risk:** Very low — only matters if someone reads COMPLETE session state and assumes `isRevoteRound` reflects final state.

## Proposed Solutions

### Option 1: Add isRevoteRound: false to endSession patches (Recommended)
- Add `isRevoteRound: false` alongside the existing `timerStartedAt: undefined, timerPausedAt: undefined` patches
- **Pros:** Consistent cleanup, defensive, matches resumeSession pattern
- **Cons:** Slightly more verbose
- **Effort:** Small (1 line)
- **Risk:** Low

### Option 2: Leave as-is, rely on SESSION_RESET_PATCHES
- WAR-45 session reset will handle this via `SESSION_RESET_PATCHES`
- **Pros:** No change needed
- **Cons:** COMPLETE sessions may have stale `isRevoteRound: true`
- **Effort:** None
- **Risk:** Low

## Recommended Action

Option 1: Add `isRevoteRound: false` to endSession patches for defense-in-depth. Add test assertion.

## Technical Details

- **Affected Files:** `convex/sessions.ts`
- **Related Components:** endSession mutation, session reset (WAR-45)
- **Database Changes:** No

## Acceptance Criteria

- [x] `isRevoteRound: false` added to endSession patches (if approved)
- [x] Test verifying isRevoteRound is false after endSession (if approved)
- [x] All existing tests still pass

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-11 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by architecture-strategist and data-integrity-guardian during PR #60 review

## Resources

- PR #60: https://github.com/Esk3tit/wtcs-map-vote/pull/60
- `convex/lib/constants.ts` — `SESSION_RESET_PATCHES`
