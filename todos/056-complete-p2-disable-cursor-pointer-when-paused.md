---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, ux, war-55]
dependencies: []
---

# Disable cursor-pointer on Map Cards When Paused

## Problem Statement

Map cards in the vote page use `cursor-pointer` styling regardless of whether the session is paused. Even though `inert` blocks actual clicks, the pointer cursor still appears when hovering over the map grid through the semi-transparent overlay (since the overlay uses `bg-black/50`). This gives a misleading visual cue that the cards are interactive.

## Findings

- **Pattern Recognition Specialist**: Flagged — cursor-pointer CSS doesn't account for `isPaused`

### Evidence

```tsx
// Map card className includes cursor-pointer unconditionally
className={cn(
  "cursor-pointer ...",
  // No isPaused check
)}
```

## Proposed Solutions

### Solution A: Conditionally apply cursor-pointer (Recommended)

```tsx
className={cn(
  !isPaused && "cursor-pointer",
  "..."
)}
```

**Pros:** Correct visual affordance, simple change
**Cons:** None
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] Map cards show default cursor when session is paused
- [ ] Map cards show pointer cursor when session is active

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Pattern recognition agent flagged |
