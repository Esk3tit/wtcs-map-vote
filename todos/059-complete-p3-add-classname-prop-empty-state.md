---
status: complete
priority: p3
issue_id: "059"
tags: [code-review, architecture]
dependencies: []
---

# Add className prop to EmptyState component

## Problem Statement

Every other component in `src/components/ui/` accepts a `className` prop merged via `cn()`. EmptyState is the only UI component that does not, making it impossible for consumers to adjust spacing without wrapping in an extra div.

## Findings

- `src/components/ui/empty-state.tsx` — no className prop
- Other UI components (Card, Badge, Button, ImageSourcePicker) all accept className
- Agents: pattern-recognition, architecture-strategist

## Proposed Solutions

### Option A: Add optional className prop
- Add `className?: string` to props, merge with `cn()` on root div
- **Effort**: Small (3 line change)
- **Risk**: Low

## Acceptance Criteria

- [ ] EmptyState accepts optional `className` prop
- [ ] Both variants merge className via `cn()`

## Resources

- PR: #89
