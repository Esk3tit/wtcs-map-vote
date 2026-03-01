---
status: complete
priority: p3
issue_id: "055"
tags: [code-review, testing, accessibility, animation]
dependencies: []
---

# Add data-animation-state attributes for automated testability

## Problem Statement

The animation states are entirely ephemeral -- they exist only in React component state and CSS classes with zero programmatic observability. An automated testing agent has no way to query "is this card currently animating?" or "has the animation completed?" The codebase has zero `data-testid` or `data-test` attributes anywhere.

## Findings

- **Source**: Agent-Native Reviewer (Warning #1, Observation #2)
- **Location**: `src/components/session/VoteMapCard.tsx`
- **Evidence**: Grep for `data-testid`, `data-test`, `data-cy` returned zero matches across all of `src/`

## Proposed Solutions

### Option A: Add data-animation-state to VoteMapCard

```tsx
data-animation-state={
  justBanned ? "banning" :
  justEliminated ? "eliminating" :
  winner ? "winning" :
  isBanned ? "banned" :
  "idle"
}
```

- **Effort**: Small (1 line)
- **Risk**: Very low

## Acceptance Criteria

- [ ] Map cards expose `data-animation-state` attribute reflecting current animation phase
- [ ] Playwright/browser automation can query animation states

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | From PR #87 code review |
