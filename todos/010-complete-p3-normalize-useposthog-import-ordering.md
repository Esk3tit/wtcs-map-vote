---
status: complete
priority: p3
issue_id: "010"
tags: [code-review, patterns, posthog]
dependencies: []
---

# Normalize usePostHog import ordering across route files

## Problem Statement

The `usePostHog` import from `@posthog/react` is placed inconsistently across the 3 route files that use it (`create.tsx`, `vote.$token.tsx`, `results.$sessionId.tsx`). Import ordering should follow project conventions: external deps grouped together.

## Findings

- Import ordering varies across files
- Project convention: external deps first, then local imports with `@/` alias
- Found by: pattern-recognition-specialist agent

## Proposed Solutions

### Option 1: Standardize import placement
- **Pros**: Consistent codebase
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Place `usePostHog` import with other external dependency imports (after React/Convex, before local `@/` imports).

## Technical Details

- **Affected Files**: `src/routes/admin/create.tsx`, `src/routes/vote.$token.tsx`, `src/routes/results.$sessionId.tsx`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `usePostHog` import follows consistent ordering in all 3 files
- [ ] Lint passes

## Work Log

### 2026-03-02 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)

## Notes

Source: Triage session on 2026-03-02
