---
status: complete
priority: p3
issue_id: "060"
tags: [code-review, architecture, documentation, war-55]
dependencies: []
---

# Document Z-Index Layering Convention

## Problem Statement

The paused overlay uses `z-40` while shadcn/ui AlertDialog uses `z-50`. This layering is intentional (overlay below dialogs), but there's no documented z-index scale for the project. Future developers might pick arbitrary values that conflict.

## Findings

- **Pattern Recognition Specialist**: Flagged z-40 vs z-50 concern
- **Architecture Strategist**: Recommends documenting z-index conventions

### Evidence

```tsx
// SessionPausedOverlay.tsx — z-40
<div className="fixed inset-0 z-40 ...">

// shadcn AlertDialog — z-50 (default)
// Toasts — z-[100] (sonner default)
```

## Proposed Solutions

### Solution A: Add z-index comment in index.css or CLAUDE.md (Recommended)

Document the z-index scale:
- `z-30`: Secondary overlays
- `z-40`: Session paused overlay
- `z-50`: Dialogs (AlertDialog, Sheet, etc.)
- `z-[100]`: Toasts (Sonner)

**Pros:** Prevents future z-index conflicts
**Cons:** Documentation maintenance
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] Z-index layering documented somewhere discoverable (CSS comment or CLAUDE.md)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from code review | Pattern and architecture agents flagged |
