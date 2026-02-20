---
status: complete
priority: p3
issue_id: "058"
tags: [code-review, accessibility, war-55]
dependencies: ["052"]
---

# Evaluate Whether sr-only Live Region Is Necessary

## Problem Statement

The vote page includes a `role="status" aria-live="assertive"` sr-only `<div>` that announces "Session has been paused" when `isPaused` is true. With `role="dialog"` and `aria-modal="true"` on the overlay (once todo #052 is resolved), focus moves to the overlay heading which already announces "Session Paused". The live region may be redundant.

## Findings

- **Code Simplicity Reviewer**: Recommends removing — redundant with focus management
- **Other agents**: Did not specifically contest keeping it

### Evidence

```tsx
// vote.$token.tsx — sr-only live region
<div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
  {isPaused ? "Session has been paused. All interactions are disabled." : ""}
</div>
```

## Proposed Solutions

### Solution A: Remove the live region (Recommended if #052 is done)

If the overlay has `role="dialog"` + `aria-labelledby` + focus on heading, the live region is redundant. Remove it to simplify.

**Pros:** Simpler, less noise for screen reader users
**Cons:** Belt-and-suspenders redundancy removed
**Effort:** Small
**Risk:** Low — verify with screen reader testing

### Solution B: Keep as progressive enhancement

Keep the live region as a fallback for screen readers that don't handle `role="dialog"` well.

**Pros:** Extra safety net
**Cons:** Potential double-announcement
**Effort:** None (keep as-is)
**Risk:** None

## Acceptance Criteria

- [ ] Decision made on whether to keep or remove
- [ ] If removed, verified with at least one screen reader

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Simplicity reviewer recommends removal |
