---
status: complete
priority: p2
issue_id: "050"
tags: [code-review, accessibility, aria, animation]
dependencies: []
---

# Add ARIA announcements for ABBA ban transitions and accessible card labels

## Problem Statement

Two accessibility gaps in the animation implementation:

1. **No ARIA announcement for ABBA bans.** The `aria-live` region (lines 494-512 in `vote.$token.tsx`) announces multiplayer round completions and winners, but not ABBA ban events. Screen reader users are not informed when a map is banned.

2. **No accessible label on banned/eliminated cards.** When a map becomes banned, `isClickable` becomes false, so `role` and `aria-label` are both removed. The card becomes a generic `<div>` with no semantic meaning to assistive technology.

## Findings

- **Source**: Agent-Native Reviewer (Warnings #3, #4)
- **Location**: `src/routes/vote.$token.tsx` lines 494-512 (aria-live region), `src/components/session/VoteMapCard.tsx` lines 96-100 (aria-label)
- **Evidence**: The `aria-live` region only handles `revealData` outcomes. ABBA ban transitions trigger `animatingBanIds` changes but no announcement. The `aria-label` is conditionally set only when `isClickable` is true.

## Proposed Solutions

### Option A: Add ABBA ban announcement + always-present aria-label (Recommended)

In `vote.$token.tsx`, add to the aria-live region:
```tsx
{session.format === "ABBA" && animatingBanIds.size > 0 && (
  <span>{bannedMapName} has been banned.</span>
)}
```

In `VoteMapCard.tsx`, always provide `aria-label`:
```tsx
aria-label={
  isClickable ? `Vote for ${map.name}` :
  winner ? `Winner: ${map.name}` :
  isBanned ? `${map.name} - Banned` :
  justEliminated ? `${map.name} - Eliminated` :
  map.name
}
```

- **Pros**: Complete accessibility coverage
- **Cons**: Slightly more complex aria-label logic
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Screen reader announces when a map is banned in ABBA mode
- [ ] All map cards have descriptive aria-labels regardless of state
- [ ] Winner/eliminated/banned states are communicated to assistive technology

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/87
