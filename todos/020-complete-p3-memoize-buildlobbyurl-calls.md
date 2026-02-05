---
status: complete
priority: p3
issue_id: "020"
tags: [code-review, performance, dry, war-31]
dependencies: []
---

# Repeated buildLobbyUrl() Calls in Player Render Loop

## Problem Statement

`buildLobbyUrl(player.token)` is called 3 times per player per render: in the Input value, the onClick handler, and the copiedUrl comparison. It should be computed once per player in the `.map()` callback.

## Findings

- Location: `src/routes/admin/session.$sessionId.tsx:373,381,387`
- For 8 players, this means 24 function calls per render instead of 8
- Each call accesses `window.location.origin` and creates a new string
- Identified by: kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle

## Proposed Solutions

### Option 1: Compute URL once per player in .map() callback
- **Pros**: DRY, cleaner, avoids redundant string concatenation
- **Cons**: None
- **Effort**: Small (2 minutes)
- **Risk**: Low

## Recommended Action

Add `const lobbyUrl = buildLobbyUrl(player.token)` at the top of the `.map()` callback and replace all three usages.

## Technical Details

- **Affected Files**: `src/routes/admin/session.$sessionId.tsx`
- **Related Components**: Player cards render loop
- **Database Changes**: No

## Acceptance Criteria

- [ ] `buildLobbyUrl(player.token)` called once per player, not three times
- [ ] All three usages reference the local `lobbyUrl` variable
- [ ] No visual or functional changes
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
