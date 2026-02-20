---
status: complete
priority: p2
issue_id: "055"
tags: [code-review, architecture, documentation, war-55]
dependencies: []
---

# Document the Inert/Portal Invariant for AlertDialog

## Problem Statement

The vote page wraps its content in a `<div inert={isPaused || undefined}>` to disable interaction during pause. However, Base UI's AlertDialog renders via a portal to `document.body`, which is *outside* the inert wrapper. The current code handles this with a `useEffect` that dismisses `pendingAction` when paused, but this invariant is not documented. A future developer could add another portalled component inside the inert wrapper without realizing it would escape the inert guard.

## Findings

- **Security Sentinel**: Flagged as MEDIUM — race window between pause and effect cleanup
- **Architecture Strategist**: Flagged — add a code comment documenting the portal escape invariant

### Evidence

```tsx
// vote.$token.tsx — AlertDialog is inside the inert wrapper in JSX,
// but renders its portal to document.body, bypassing inert
<div inert={isPaused || undefined}>
  {/* ... */}
  <AlertDialog>  {/* ← portal escapes inert */}
    <AlertDialogContent>...</AlertDialogContent>
  </AlertDialog>
</div>
```

## Proposed Solutions

### Solution A: Add code comment (Recommended)

Add a comment above the `useEffect` that dismisses pendingAction on pause, explaining why it's necessary:

```tsx
// INVARIANT: AlertDialog renders via portal to document.body, escaping the
// inert wrapper. This effect ensures the dialog is dismissed when paused,
// since the portal cannot be blocked by the inert attribute.
useEffect(() => { ... }, [data, pendingAction]);
```

**Pros:** Low effort, prevents future confusion
**Cons:** None
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] Comment documents the portal/inert escape invariant
- [ ] Comment is placed near the relevant dismiss effect

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Security and architecture agents flagged |
