---
status: complete
priority: p3
issue_id: "023"
tags: [code-review, react, duplication]
dependencies: []
---

# Extract StepCircle Sub-component to Reduce Duplication

## Problem Statement
`ABBAProgressTracker.tsx` renders nearly identical step circle logic in both desktop (lines 57-80) and mobile (lines 133-157) layouts. The only differences are size values (`w-10 h-10` vs `w-8 h-8`, icon sizes, `mb-2` on desktop). A private sub-component would reduce ~25-30 lines of duplication.

## Findings
- Location: `src/components/session/ABBAProgressTracker.tsx` lines 57-80 (desktop) and 133-157 (mobile)
- Duplicated logic: state class computation, Check icon vs step number, pulse animation
- Only differences: circle size, icon size, minor spacing
- The dual-layout approach itself is justified (horizontal vs vertical stepper)

## Proposed Solutions

### Option 1: Extract private `StepCircle` component within the same file
- **Pros**: Reduces ~25 LOC of duplication, makes layout differences more visible
- **Cons**: Adds indirection of a sub-component
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Create a private `StepCircle` component parameterized by `size: "sm" | "md"` within ABBAProgressTracker.tsx.

## Technical Details
- **Affected Files**: `src/components/session/ABBAProgressTracker.tsx`
- **Related Components**: None (private sub-component)
- **Database Changes**: No

## Acceptance Criteria
- [ ] Step circle rendering logic exists in one place
- [ ] Both desktop and mobile layouts use the shared component
- [ ] Visual output is identical
- [ ] TypeScript strict mode passes

## Work Log

### 2026-02-24 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved all findings)
- Status: ready

## Notes
Source: PR #81 code review - flagged by pattern-recognition-specialist, code-simplicity-reviewer
