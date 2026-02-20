---
status: complete
priority: p2
issue_id: "054"
tags: [code-review, typescript, war-55]
dependencies: []
---

# Use instanceof Type Guard for document.activeElement

## Problem Statement

`SessionPausedOverlay.tsx` casts `document.activeElement` with `as HTMLElement | null`. This is a type assertion that bypasses TypeScript's type checker. `document.activeElement` can be an `SVGElement` or other non-HTMLElement `Element`, and calling `.focus()` on a bare `Element` would be a type error. An `instanceof` check is safer and provides a runtime guard.

## Findings

- **Kieran TypeScript Reviewer**: Flagged — use `instanceof HTMLElement` instead of `as` cast

### Evidence

```tsx
// src/components/session/SessionPausedOverlay.tsx:11
const previouslyFocused = document.activeElement as HTMLElement | null;
// ...
return () => {
  previouslyFocused?.focus();  // ← Would fail on SVGElement
};
```

## Proposed Solutions

### Solution A: instanceof guard (Recommended)

```tsx
const previouslyFocused =
  document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
```

**Pros:** Runtime-safe, no assertion needed, handles SVGElement correctly
**Cons:** None
**Effort:** Small (1-line change)
**Risk:** None

## Acceptance Criteria

- [ ] `as HTMLElement` cast replaced with `instanceof HTMLElement` check
- [ ] Focus restoration still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Kieran TypeScript reviewer flagged |
