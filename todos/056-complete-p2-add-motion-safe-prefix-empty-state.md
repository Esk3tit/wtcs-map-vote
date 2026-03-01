---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, accessibility, css]
dependencies: []
---

# Add motion-safe: prefix to EmptyState animations

## Problem Statement

The EmptyState component uses bare `animate-in fade-in duration-300/500` without the `motion-safe:` prefix. The codebase has an established convention of using `motion-safe:animate-in motion-safe:fade-in motion-safe:duration-*` for entry animations (see `results.$sessionId.tsx`, `VoteMapCard.tsx`). Since this shared component will be the canonical pattern going forward, it should set the correct precedent for accessibility.

## Findings

- `src/components/ui/empty-state.tsx:23` — card variant uses `animate-in fade-in duration-300`
- `src/components/ui/empty-state.tsx:32` — page variant uses `animate-in fade-in duration-500`
- Users with `prefers-reduced-motion: reduce` will still see these animations play
- Agent: performance-oracle

## Proposed Solutions

### Option A: Add motion-safe prefix (Recommended)
- Change classes to `motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300/500`
- **Pros**: Matches established codebase pattern, accessible
- **Effort**: Small (2 line changes)
- **Risk**: Low

## Acceptance Criteria

- [ ] Card variant animation classes use `motion-safe:` prefix
- [ ] Page variant animation classes use `motion-safe:` prefix
- [ ] Typecheck passes

## Resources

- PR: #89
- Codebase pattern: `src/routes/results.$sessionId.tsx` (uses `motion-safe:` throughout)
