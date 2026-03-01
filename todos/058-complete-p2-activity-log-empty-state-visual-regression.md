---
status: complete
priority: p2
issue_id: "058"
tags: [code-review, visual-regression]
dependencies: []
---

# Activity log empty state visual regression

## Problem Statement

The activity log empty state previously used intentionally smaller sizing (`w-10 h-10` icon, `text-sm` title, `text-xs` description) to visually distinguish it as a secondary/compact card. The PR normalizes it to the same card dimensions as the maps empty state (`w-12 h-12`, `text-lg` title, `text-sm` description). This is a deliberate design hierarchy change that should be documented or reverted.

## Findings

- Original: `Activity w-10 h-10`, title `text-sm font-medium`, description `text-xs`
- After PR: `Activity w-12 h-12`, title `text-lg font-medium`, description `text-sm`
- The maps card empty state was already `w-12 h-12` so it was unchanged
- Agents: pattern-recognition, architecture-strategist, code-simplicity, kieran-typescript

## Proposed Solutions

### Option A: Accept as intentional standardization
- Document in PR description that the size increase is deliberate
- **Pros**: Consistent card empty states
- **Effort**: None
- **Risk**: Low

### Option B: Pass original sizing via icon prop
- Pass `<Activity className="w-10 h-10" />` to preserve original sizing
- Override card variant text sizes via className prop (requires #059)
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Decision documented (either way)

## Resources

- PR: #89
- Original code: `src/routes/admin/session.$sessionId.tsx:1109-1118` (pre-PR)
