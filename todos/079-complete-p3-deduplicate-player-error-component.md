---
status: complete
priority: p3
issue_id: "079"
tags: [code-review, duplication]
dependencies: ["073"]
---

# Extract shared player errorComponent across 3 routes

## Problem Statement
Identical `errorComponent` block duplicated across `vote.$token.tsx`, `lobby.$token.tsx`, and `results.$sessionId.tsx`. After fixing #073, the shared pattern should be extracted.

## Findings
- Location: `src/routes/vote.$token.tsx:48-51`, `src/routes/lobby.$token.tsx:29-32`, `src/routes/results.$sessionId.tsx:29-31`
- Flagged by: pattern-recognition-specialist

## Proposed Solutions

### Option 1: Export shared errorComponent from error-boundary.tsx
- **Effort**: Small
- **Risk**: Low

## Technical Details
- **Affected Files**: `src/components/error-boundary.tsx`, `src/routes/vote.$token.tsx`, `src/routes/lobby.$token.tsx`, `src/routes/results.$sessionId.tsx`

## Acceptance Criteria
- [ ] Single definition of player errorComponent
- [ ] All 3 routes reference the shared component

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review. Depends on #073.
