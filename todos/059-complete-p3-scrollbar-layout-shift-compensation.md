---
status: complete
priority: p3
issue_id: "059"
tags: [code-review, performance, ux, war-55]
dependencies: []
---

# Compensate for Scrollbar Layout Shift on Scroll Lock

## Problem Statement

When `overflow: hidden` is applied to the body during pause, the scrollbar disappears and the page content shifts slightly to the right (by the scrollbar width, typically 15-17px). This causes a visible layout jump when pause/resume toggles.

## Findings

- **Performance Oracle**: Flagged — add `paddingRight` compensation to prevent layout shift

### Evidence

```tsx
// Scroll lock removes scrollbar, causing ~15px layout shift
document.body.style.overflow = "hidden";
// Content shifts right when scrollbar disappears
```

## Proposed Solutions

### Solution A: Add paddingRight compensation (Recommended)

```tsx
useEffect(() => {
  if (isPaused) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const original = document.body.style.overflow;
    const originalPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = original;
      document.body.style.paddingRight = originalPadding;
    };
  }
}, [isPaused]);
```

**Pros:** No layout shift on pause/resume
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] No visible layout shift when overlay appears/disappears
- [ ] Scrollbar width compensation applied correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Performance oracle flagged |
