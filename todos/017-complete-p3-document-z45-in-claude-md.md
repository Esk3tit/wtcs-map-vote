---
status: complete
priority: p3
issue_id: "017"
tags: [code-review, documentation]
dependencies: []
---

# Document z-[45] in CLAUDE.md Z-Index Layering Scale

## Problem Statement

CLAUDE.md documents z-40 (overlays), z-50 (dialogs), and z-[100] (toasts) but doesn't mention the new z-[45] used by DisconnectedOverlay. Future developers may not know about this intermediate layer.

## Findings

- **Source:** Multiple agents (architecture-strategist, pattern-recognition-specialist)
- **Location:** `CLAUDE.md` — Z-index layering scale section

## Proposed Solutions

### Option 1: Update CLAUDE.md (Recommended)
Add `z-[45]` to the z-index layering scale:
```markdown
- `z-40`: Full-screen overlays (e.g. session paused overlay)
- `z-[45]`: Priority overlays (e.g. disconnected overlay — renders above z-40)
- `z-50`: Dialogs and sheets (shadcn AlertDialog, Sheet, etc.)
- `z-[100]`: Toasts (Sonner default)
```

- **Effort**: Small
- **Risk**: Low

## Technical Details
- **Affected Files**: `CLAUDE.md`

## Acceptance Criteria
- [ ] z-[45] is documented in the z-index layering scale

## Work Log

### 2026-02-22 - Identified during code review
**By:** Multiple agents

## Resources
- PR #77: WAR-57 Player Reconnection Flow
