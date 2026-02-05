---
status: complete
priority: p2
issue_id: "019"
tags: [code-review, bug, ui-race-condition, war-31]
dependencies: []
---

# Shared Timeout Ref Causes Stuck Copy Feedback Indicators

## Problem Statement

Both `handleCopyUrl` and `handleCopyAllLinks` share a single `copyTimeoutRef`. When a user clicks "Copy All Links" then quickly clicks an individual copy button (or vice versa), the first timeout gets cancelled and the feedback indicator stays stuck showing "Copied!".

## Findings

- Location: `src/routes/admin/session.$sessionId.tsx:140-176`
- Both handlers clear the same `copyTimeoutRef` before setting a new timeout
- The cancelled timeout never resets its corresponding state (`copiedUrl` or `copiedAll`)
- Identified by: julik-frontend-races-reviewer, performance-oracle

### Problem Scenario

1. User clicks "Copy All Links" → `copiedAll = true`, timeout scheduled to reset in 2s
2. User quickly clicks individual copy button → clears the "Copy All" timeout
3. New timeout only resets `copiedUrl`, not `copiedAll`
4. "Copy All Links" button stays stuck showing "Copied!" indefinitely

## Proposed Solutions

### Option 1: Split into separate timeout refs
- **Pros**: Clean separation, each handler manages its own lifecycle
- **Cons**: One extra ref variable
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action

Split `copyTimeoutRef` into `copyUrlTimeoutRef` and `copyAllTimeoutRef`. Update cleanup effect to clear both.

## Technical Details

- **Affected Files**: `src/routes/admin/session.$sessionId.tsx`
- **Related Components**: Copy URL button, Copy All Links button
- **Database Changes**: No

## Acceptance Criteria

- [ ] Clicking "Copy All" then quickly clicking individual copy doesn't leave stuck indicators
- [ ] Both feedback indicators reset independently after 2 seconds
- [ ] Cleanup effect clears both timeout refs on unmount
- [ ] Typecheck passes

## Work Log

### 2026-02-05 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)
- Status set to ready
- Ready to be picked up and worked on

## Resources

- PR #51: https://github.com/Esk3tit/wtcs-map-vote/pull/51
- Linear: WAR-31

## Notes

Source: Code review of PR #51 on 2026-02-05
