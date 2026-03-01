---
status: complete
priority: p3
issue_id: "061"
tags: [code-review, consistency]
dependencies: []
---

# Inconsistent icon color convention between EmptyState variants

## Problem Statement

For the card variant, `text-muted-foreground/50` is applied by the wrapper div (icon inherits via CSS). For the page variant, callers must pass the color class on the icon itself. This split convention is a maintenance trap for future consumers.

## Findings

- Card: wrapper `<div className="mb-4 text-muted-foreground/50">` — icon inherits color
- Page: callers pass `className="w-24 h-24 text-muted-foreground/50"` on icon element
- Agents: pattern-recognition, code-simplicity, kieran-typescript

## Proposed Solutions

### Option A: Have component handle colors for both variants
- Add `text-muted-foreground/50` to the page variant icon wrapper too
- Remove color class from all caller-supplied icons
- **Effort**: Small
- **Risk**: Low

### Option B: Document the convention
- Add JSDoc on icon prop explaining the contract
- **Effort**: Minimal
- **Risk**: Low

## Acceptance Criteria

- [ ] Icon color approach is consistent across variants (or documented)

## Resources

- PR: #89
