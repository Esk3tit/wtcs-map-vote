---
status: complete
priority: p2
issue_id: "053"
tags: [code-review, performance, quality, war-55]
dependencies: []
---

# Merge Three Auto-Dismiss useEffects Into One

## Problem Statement

The vote page (`vote.$token.tsx`) has three separate `useEffect` hooks that all watch `[data, pendingAction]` and conditionally call `setPendingAction(null)`. Each effect runs independently on every render where `data` or `pendingAction` changes, causing three separate effect invocations instead of one. This is redundant and harder to maintain — adding a new dismiss condition means adding yet another effect.

## Findings

- **Performance Oracle**: Flagged — three effects with identical deps should be merged
- **Pattern Recognition Specialist**: Flagged — consolidate into single effect
- **Code Simplicity Reviewer**: Flagged — merge into one effect with combined guard
- **Kieran TypeScript Reviewer**: Flagged — merge effects, consider extracting helper

### Evidence

```tsx
// vote.$token.tsx lines ~99-119 — three separate effects
useEffect(() => {
  if (!pendingAction || data?.status !== "valid") return;
  const map = data.maps.find((m) => m._id === pendingAction._id);
  if (!map || map.state !== "AVAILABLE") { setPendingAction(null); }
}, [data, pendingAction]);

useEffect(() => {
  if (pendingAction && data?.status === "valid" && !data.isYourTurn) {
    setPendingAction(null);
  }
}, [data, pendingAction]);

useEffect(() => {
  if (pendingAction && data?.status === "valid" && data.session.status === "PAUSED") {
    setPendingAction(null);
  }
}, [data, pendingAction]);
```

## Proposed Solutions

### Solution A: Merge into single useEffect (Recommended)

```tsx
useEffect(() => {
  if (!pendingAction || data?.status !== "valid") return;

  const map = data.maps.find((m) => m._id === pendingAction._id);
  const shouldDismiss =
    !map ||
    map.state !== "AVAILABLE" ||
    !data.isYourTurn ||
    data.session.status === "PAUSED";

  if (shouldDismiss) {
    setPendingAction(null);
  }
}, [data, pendingAction]);
```

**Pros:** Single effect, clear logic, easy to add new conditions
**Cons:** None
**Effort:** Small
**Risk:** Low — same behavior, just consolidated

## Acceptance Criteria

- [ ] Three auto-dismiss effects replaced with one
- [ ] All dismiss conditions preserved (map unavailable, not your turn, paused)
- [ ] Confirmation dialog still auto-closes in all three scenarios

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Consensus across 4 review agents |
