---
status: complete
priority: p3
issue_id: "038"
tags: [code-review, ux, audio]
dependencies: []
---

# vote-click Sound Fires Before Confirmation Dialog

## Problem Statement

The `vote-click` sound plays immediately when a player clicks a map card to vote, but the vote isn't actually submitted until the player confirms in the confirmation dialog. If the player cancels the dialog, they heard a "click" sound for an action that didn't happen. This creates a misleading audio feedback loop.

## Findings

- **pattern-recognition-specialist**: Flagged vote-click timing mismatch
- **kieran-typescript-reviewer**: Noted the UX inconsistency
- **code-simplicity-reviewer**: Suggested moving sound to after confirmation
- Location: `src/routes/vote.$token.tsx` (vote handler)

## Proposed Solutions

### Option 1: Move Sound to After Confirmation
- Play `vote-click` in the mutation's `onSuccess` callback instead of on card click
- **Pros**: Sound matches actual action, accurate feedback
- **Cons**: Slight delay between click and sound (mutation round-trip)
- **Effort**: Small
- **Risk**: Low

### Option 2: Two Sounds (Select + Confirm)
- Play a softer "select" sound on card click, play "vote-click" on confirm
- **Pros**: Immediate feedback AND accurate confirmation feedback
- **Cons**: Need another sound asset, more complexity
- **Effort**: Medium
- **Risk**: Low

### Option 3: Leave As-Is
- Most users who click a map will confirm. The cancel path is uncommon.
- **Pros**: No change needed
- **Cons**: Minor UX inconsistency remains
- **Effort**: None
- **Risk**: None

## Recommended Action

Option 1: Move sound to after confirmation. Play vote-click in the mutation onSuccess callback.

## Technical Details

- **Affected Files**: `src/routes/vote.$token.tsx`
- **Related Components**: `useAudioAlerts.ts`, `audio.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] vote-click sound only plays when vote is actually submitted (if fixing)
- [ ] No sound plays on cancel (if fixing)
- [ ] Sound timing feels responsive to user

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 3 review agents

## Resources

- PR: #84
- `src/routes/vote.$token.tsx`
